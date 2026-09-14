/**
 * @file minimaxASRRecognizer.ts
 * @description MiniMax 语音识别（asr-1.0）
 *
 * 批量模式：录音期间攒 PCM，stop 时打包 WAV 经 multipart/form-data 上传，
 * stream:true 下经 SSE 增量出识别文本（非边录边传）。
 * 复用 MiniMax TTS 的 API Key 与线路设置（国际/国内）。
 * host_permissions 已覆盖 api.minimaxi.com / api.minimax.cn。
 */

import {
  LingridConfig,
  MINIMAX_ASR_MODEL,
  normalizeMiniMaxTTSBaseUrl,
} from "../types";
import type { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { acquireStream, releaseStream } from "./audioCapture";
import { createPCMCapture } from "./pcmCapture";
import type { PCMCapture } from "./pcmCapture";
import { encodeWavFromPCM } from "./wavEncoder";

export { isMiniMaxASRConfigured } from "../types";

/** SSE 解析结果：增量文本 / 全文快照 / 结束 / 忽略 */
export type MiniMaxSSEEvent =
  | { type: "delta"; text: string; done: boolean }
  | { type: "snapshot"; text: string; done: boolean }
  | { type: "done" }
  | null;

/**
 * 解析一行 SSE 文本。
 * 宽容模式：delta 优先（增量），text 兜底（快照替换）；
 * finish:true 或 [DONE] 结束；畸形行返回 null，不抛错。
 *
 * 注意：MiniMax 会把最后一段文本与 finish:true 放在同一事件，
 * 必须先取文本再判结束，否则会丢掉结尾（实测事件序列：
 *   {"index":0,"delta":"The","finish":false}
 *   {"index":1,"delta":" quick brown.","finish":true,"duration":0.85}
 * ）。
 */
export function parseMiniMaxASRSSELine(line: string): MiniMaxSSEEvent {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return { type: "done" };

  try {
    const chunk = JSON.parse(payload) as {
      delta?: string;
      text?: string;
      finish?: boolean;
    };
    const done = chunk.finish === true;
    if (typeof chunk.delta === "string" && chunk.delta) {
      return { type: "delta", text: chunk.delta, done };
    }
    if (typeof chunk.text === "string" && chunk.text) {
      return { type: "snapshot", text: chunk.text, done };
    }
    if (done) return { type: "done" };
    return null;
  } catch {
    return null;
  }
}

/**
 * MiniMax 流式语音识别器（批量上传 + SSE 出文本）。
 */
export class MiniMaxASRRecognizer implements ISpeechRecognizer {
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
    const key = this.config.minimax_tts?.api_key?.trim();
    if (!key) {
      throw new Error(
        "MiniMax 识别未配置 API Key（复用语音合成服务的 MiniMax Key），请到设置页配置或切换识别服务"
      );
    }
    this.apiKey = key;
    this.pendingChunks = [];

    const stream = await acquireStream();
    this.pcmCapture = createPCMCapture((chunk) => {
      if (!this._isRecognizing) return;
      this.pendingChunks.push(chunk);
    });
    this.pcmCapture.start(stream);

    this._isRecognizing = true;
    console.log("[Lingride MiniMaxASR] 识别已启动");
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

    // 打包 WAV，multipart/form-data 上传
    const wav = encodeWavFromPCM(merged);
    const form = new FormData();
    form.append("model", MINIMAX_ASR_MODEL);
    form.append(
      "file",
      new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }),
      "audio.wav"
    );
    form.append("response_format", "json");
    form.append("stream", "true");

    const baseUrl = normalizeMiniMaxTTSBaseUrl(
      this.config.minimax_tts?.api_base_url
    );

    // 上传 + SSE 读取整体超时（30s 内未响应则中止）
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, MiniMaxASRRecognizer.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/speech_to_text`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          // 注意：multipart 的 Content-Type 由浏览器自动生成（含 boundary），不要手动设置
          language: "en",
        },
        body: form,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const message = await this.extractErrorMessage(response);
        this.onError?.(new Error(message));
        return "";
      }
      if (!response.body) {
        this.onError?.(new Error("MiniMax ASR 响应为空"));
        return "";
      }

      // SSE 逐行读取
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let transcript = "";

      const applyEvent = (event: MiniMaxSSEEvent): boolean => {
        if (!event) return false;
        if (event.type === "done") return true;
        if (event.type === "delta") {
          transcript += event.text;
          this.onInterimResult?.(transcript.trim());
        }
        if (event.type === "snapshot") {
          transcript = event.text;
          this.onInterimResult?.(transcript.trim());
        }
        // 先取文本再判结束（结束事件可能携带最后一段文本）
        return event.done;
      };

      try {
        outer: for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (applyEvent(parseMiniMaxASRSSELine(line))) {
              // 服务端发结束后不一定会立刻关连接，提前退出
              break outer;
            }
          }
        }

        // 补解析残余 buffer（最后一行可能无换行结尾）
        applyEvent(parseMiniMaxASRSSELine(buffer));
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
        this.onError?.(new Error("MiniMax ASR 请求超时，请重试"));
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
      return "MiniMax ASR API Key 无效，请检查设置页配置";
    }
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
        base_resp?: { status_msg?: string };
      };
      const detail = body.error?.message || body.base_resp?.status_msg;
      if (detail) {
        return `MiniMax ASR 请求失败：${detail}`;
      }
    } catch {
      // 响应体非 JSON，落到通用错误
    }
    return `MiniMax ASR 请求失败（HTTP ${response.status}）`;
  }
}
