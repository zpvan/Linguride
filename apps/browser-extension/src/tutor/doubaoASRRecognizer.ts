/**
 * @file doubaoASRRecognizer.ts
 * @description 豆包（火山方舟）流式语音识别：SAUC 单向流式（bigmodel_nostream）
 *
 * 鉴权：WebSocket 握手所需的 X-Api-Key 等头由 service worker
 * 通过 declarativeNetRequest 会话规则注入，页面侧无需感知。
 */

import { DOUBAO_ASR_WS_URL, LingridConfig } from "../types";
import type { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { acquireStream, releaseStream } from "./audioCapture";
import {
  buildAudioFrame,
  buildFullClientRequest,
  parseServerMessage,
} from "./saucProtocol";

const TARGET_SAMPLE_RATE = 16000;
const AUDIO_SEND_INTERVAL = 200;

/** 检查豆包 ASR 是否已配置 */
export function isDoubaoASRConfigured(config: LingridConfig): boolean {
  return !!config.doubao_asr?.api_key?.trim();
}

interface SaucResultPayload {
  result?: { text?: string };
}

/**
 * 豆包流式语音识别器
 *
 * 单向流式模式：流式发送音频，返回整句识别结果（准确率优于双向流式）。
 */
export class DoubaoASRRecognizer implements ISpeechRecognizer {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private _isRecognizing = false;
  private sequence = 1;
  private finalTranscript = "";
  private connectTimeout: number | null = null;
  private lastPackageReceived = false;

  /** 实时识别结果回调 */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  async start(): Promise<void> {
    this.finalTranscript = "";
    this.sequence = 1;
    this.lastPackageReceived = false;
    this._isRecognizing = false;

    await this.connectWebSocket();
    await this.startAudioCapture();

    this._isRecognizing = true;
    console.log("[Lingride DoubaoASR] 识别已启动");
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;

    // 发送最后一包（负序列号）并等待最终结果
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const lastFrame = await buildAudioFrame(
        new Uint8Array(0),
        ++this.sequence,
        true
      );
      this.ws.send(lastFrame);
    }

    // 等待服务端最后一包（sequence < 0）或超时 5s
    const deadline = Date.now() + 5000;
    while (!this.lastPackageReceived && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.cleanup();
    return this.finalTranscript.trim();
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(DOUBAO_ASR_WS_URL);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      this.connectTimeout = window.setTimeout(() => {
        reject(new Error("豆包 ASR 连接超时"));
      }, 10000);

      ws.onopen = async () => {
        if (this.connectTimeout !== null) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        try {
          // 发送 full client request（会话配置）
          const frame = await buildFullClientRequest({
            user: { uid: "lingride-user" },
            audio: {
              format: "pcm",
              codec: "raw",
              rate: TARGET_SAMPLE_RATE,
              bits: 16,
              channel: 1,
            },
            request: { model_name: "bigmodel", enable_punc: true },
          });
          ws.send(frame);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };

      ws.onmessage = (event) => {
        void this.handleMessage(event);
      };

      ws.onerror = () => {
        if (this.connectTimeout !== null) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        const error = new Error("豆包 ASR WebSocket 连接失败");
        this.onError?.(error);
        reject(error);
      };

      ws.onclose = () => {
        this.lastPackageReceived = true;
      };
    });
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    if (!(event.data instanceof ArrayBuffer)) return;

    try {
      const message = await parseServerMessage(new Uint8Array(event.data));

      if (message.type === "error") {
        this.onError?.(
          new Error(
            `豆包 ASR 错误（${message.errorCode}）：${message.errorMessage}`
          )
        );
        return;
      }

      if (message.type === "result") {
        const payload = message.payload as SaucResultPayload | undefined;
        const text = payload?.result?.text?.trim();
        if (text) {
          this.finalTranscript = text;
          this.onInterimResult?.(text);
        }
      }

      if (message.isLast) {
        this.lastPackageReceived = true;
      }
    } catch (error) {
      console.warn("[Lingride DoubaoASR] 解析响应失败:", error);
    }
  }

  private async startAudioCapture(): Promise<void> {
    const stream = await acquireStream();

    // 尝试 16kHz 采样率；不支持则用默认采样率并重采样
    try {
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    } catch {
      this.audioContext = new AudioContext();
      console.log(
        `[Lingride DoubaoASR] 使用默认采样率: ${this.audioContext.sampleRate}Hz`
      );
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    const audioContext = this.audioContext;

    let audioBuffer: Int16Array[] = [];
    let lastSendTime = Date.now();

    this.processorNode.onaudioprocess = (event) => {
      if (
        !this._isRecognizing ||
        !this.ws ||
        this.ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);
      const pcmData =
        audioContext.sampleRate !== TARGET_SAMPLE_RATE
          ? this.resample(inputData, audioContext.sampleRate, TARGET_SAMPLE_RATE)
          : inputData;

      audioBuffer.push(this.float32ToInt16(pcmData));

      const now = Date.now();
      if (now - lastSendTime >= AUDIO_SEND_INTERVAL) {
        const buffer = audioBuffer;
        audioBuffer = [];
        lastSendTime = now;
        this.sendAudioData(buffer);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  private sendAudioData(chunks: Int16Array[]): void {
    if (
      chunks.length === 0 ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const seq = ++this.sequence;
    void buildAudioFrame(new Uint8Array(merged.buffer), seq, false).then(
      (frame) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(frame);
        }
      }
    );
  }

  private resample(
    input: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      output[i] = input[Math.floor(i * ratio)];
    }

    return output;
  }

  private float32ToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private cleanup(): void {
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    this.processorNode?.disconnect();
    this.sourceNode?.disconnect();
    this.processorNode = null;
    this.sourceNode = null;

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    releaseStream();

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
