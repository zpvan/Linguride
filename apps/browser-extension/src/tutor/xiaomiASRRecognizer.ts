/**
 * @file xiaomiASRRecognizer.ts
 * @description 小米 MiMo 语音识别（mimo-v2.5-asr）
 *
 * 批量模式：录音期间攒 PCM，stop 时打包 WAV 上传，
 * stream:true 下经 SSE 逐 token 出识别文本（非边录边传）。
 * HTTPS 直连，页面侧 fetch（host_permissions 已覆盖 api.xiaomimimo.com）。
 */

import {
  LingridConfig,
  resolveXiaomiASRApiKey,
  XIAOMI_ASR_API_URL,
  XIAOMI_ASR_MODEL,
} from "../types";
import type { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { acquireStream, releaseStream } from "./audioCapture";
import { createPCMCapture } from "./pcmCapture";
import type { PCMCapture } from "./pcmCapture";
import { encodeWavFromPCM } from "./wavEncoder";

export { isXiaomiASRConfigured } from "../types";

/** SSE 解析结果：增量文本 / 结束 / 忽略 */
export type XiaomiSSEEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | null;

/**
 * 解析一行 SSE 文本，提取增量内容或结束信号。
 * 非 data 行、[DONE] 之外的畸形 JSON 均返回 null，不抛错。
 */
export function parseXiaomiASRSSELine(line: string): XiaomiSSEEvent {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return { type: "done" };

  try {
    const chunk = JSON.parse(payload) as {
      choices?: Array<{
        delta?: { content?: string };
        finish_reason?: string | null;
      }>;
    };
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason === "stop") return { type: "done" };
    const text = choice?.delta?.content;
    if (text) return { type: "delta", text };
    return null;
  } catch {
    return null;
  }
}

/** Uint8Array → base64（分块避免栈溢出） */
function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * 小米流式语音识别器（批量上传 + SSE 出文本）。
 */
export class XiaomiASRRecognizer implements ISpeechRecognizer {
  /** 上传 + SSE 读取超时（30s 内未响应则中止） */
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  private pcmCapture: PCMCapture | null = null;
  private pendingChunks: Int16Array[] = [];
  private _isRecognizing = false;
  private apiKey = "";

  /**
   * @param config 完整用户配置（由 tutor.ts createRecognizer 注入，
   *               与其他识别器从同一上下文取配置，避免识别器内重复读 storage）
   */
  constructor(private readonly config: LingridConfig) {}

  /** 实时识别结果回调（SSE 增量拼接后的累计文本） */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  async start(): Promise<void> {
    // 默认复用语音合成服务（xiaomi_tts）的 API Key
    const apiKey = resolveXiaomiASRApiKey(this.config);
    if (!apiKey) {
      throw new Error(
        "小米识别未配置 API Key（复用语音合成服务的小米 Key），请到设置页配置或切换识别服务"
      );
    }
    this.apiKey = apiKey;
    this.pendingChunks = [];

    const stream = await acquireStream();
    this.pcmCapture = createPCMCapture((chunk) => {
      if (!this._isRecognizing) return;
      this.pendingChunks.push(chunk);
    });
    this.pcmCapture.start(stream);

    this._isRecognizing = true;
    console.log("[Lingride XiaomiASR] 识别已启动");
  }

  /**
   * 停止录音并返回最终识别文本。
   * 契约与既有识别器一致：不抛异常——出错走 onError 并返回空串，
   * 由调用方统一处理空结果，避免中断 stopRecordingUI 流程。
   */
  async stop(): Promise<string> {
    this._isRecognizing = false;

    // 停采集并合并 PCM
    this.pcmCapture?.stop();
    this.pcmCapture = null;
    releaseStream();

    const totalLength = this.pendingChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of this.pendingChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pendingChunks = [];

    if (merged.length === 0) {
      this.onError?.(new Error("未识别到语音内容，请重试"));
      return "";
    }

    // 打包 WAV 并上传
    const wav = encodeWavFromPCM(merged);
    const audioBase64 = uint8ToBase64(wav);

    // 上传 + SSE 读取整体超时（30s 内未响应则中止）
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, XiaomiASRRecognizer.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(XIAOMI_ASR_API_URL, {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: XIAOMI_ASR_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: `data:audio/wav;base64,${audioBase64}`,
                  },
                },
              ],
            },
          ],
          asr_options: { language: "en" },
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const message = await this.extractErrorMessage(response);
        this.onError?.(new Error(message));
        return "";
      }
      if (!response.body) {
        this.onError?.(new Error("小米 ASR 响应为空"));
        return "";
      }

      // SSE 逐行读取
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let transcript = "";

      try {
        outer: for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseXiaomiASRSSELine(line);
            if (event?.type === "done") {
              // 服务端发 [DONE] 后不一定会立刻关连接，提前退出
              break outer;
            }
            if (event?.type === "delta") {
              transcript += event.text;
              this.onInterimResult?.(transcript.trim());
            }
          }
        }

        // 补解析残余 buffer（最后一行可能无换行结尾）
        const tail = parseXiaomiASRSSELine(buffer);
        if (tail?.type === "delta") {
          transcript += tail.text;
          this.onInterimResult?.(transcript.trim());
        }
      } finally {
        reader.releaseLock();
      }

      const result = transcript.trim();
      if (!result) {
        this.onError?.(new Error("未识别到语音内容，请重试"));
        return "";
      }
      return result;
    } catch (error) {
      if (abortController.signal.aborted) {
        this.onError?.(new Error("小米 ASR 请求超时，请重试"));
      } else {
        this.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
      }
      return "";
    } finally {
      clearTimeout(timeout);
    }
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    if (response.status === 401) {
      return "小米 ASR API Key 无效，请检查设置页配置";
    }
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      if (body.error?.message) {
        return `小米 ASR 请求失败：${body.error.message}`;
      }
    } catch {
      // 响应体非 JSON，落到通用错误
    }
    return `小米 ASR 请求失败（HTTP ${response.status}）`;
  }
}
