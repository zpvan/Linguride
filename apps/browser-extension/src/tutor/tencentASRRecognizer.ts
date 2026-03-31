/**
 * @file tencentASRRecognizer.ts
 * @description 腾讯云实时语音识别器
 *
 * 实现 ISpeechRecognizer 接口，使用腾讯云实时语音识别服务（WebSocket）。
 * 相比 Web Speech API，腾讯云 ASR 对非母语者的发音更友好，识别准确率更高。
 *
 * 技术要点：
 * - WebSocket 协议：wss://asr.cloud.tencent.com/asr/v2/{appid}?{params}
 * - 音频格式：16000Hz、16bits、单声道 PCM
 * - 实时中间结果：slice_type: 0=开始, 1=识别中, 2=结束
 *
 * @author Lingride Team
 * @since 2.5.0
 */

import { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { MessageType, TencentASRSignResponse } from "../types";
import { acquireStream, releaseStream } from "./audioCapture";

// ====== 常量定义 ======

/** 目标采样率：腾讯云要求 16kHz */
const TARGET_SAMPLE_RATE = 16000;

/** 音频发送间隔（毫秒）：每 200ms 发送一次 */
const AUDIO_SEND_INTERVAL = 200;

/** WebSocket 连接超时时间（毫秒） */
const WS_CONNECT_TIMEOUT = 10000;

/** WebSocket 关闭代码 */
const WS_CLOSE_NORMAL = 1000;

// ====== 腾讯云 ASR 响应类型 ======

interface TencentASRResponse {
  /** 状态码，0 表示成功 */
  code: number;
  /** 错误信息 */
  message: string;
  /** 语音 ID */
  voice_id?: string;
  /** 消息类型 */
  message_id?: number;
  /** 识别结果 */
  result?: {
    /** 片段类型：0=开始, 1=中间, 2=结束 */
    slice_type: number;
    /** 是否为最终结果 */
    index: number;
    /** 开始时间 */
    start_time: number;
    /** 结束时间 */
    end_time: number;
    /** 识别文本 */
    voice_text_str: string;
    /** 单词级别结果 */
    word_list?: Array<{
      word: string;
      start_time: number;
      end_time: number;
      stable_flag: number;
    }>;
  };
  /** 最终结果 */
  final?: number;
}

// ====== TencentASRRecognizer 类 ======

/**
 * 腾讯云实时语音识别器
 *
 * 通过 WebSocket 与腾讯云 ASR 服务通信，实现实时语音识别。
 */
export class TencentASRRecognizer implements ISpeechRecognizer {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private _isRecognizing = false;
  private finalTranscript = "";
  private interimTranscript = "";
  private connectTimeout: number | null = null;

  /** 实时识别结果回调 */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  /**
   * 开始识别
   *
   * 1. 请求 background 生成签名 URL
   * 2. 建立 WebSocket 连接
   * 3. 获取音频流并开始采集
   * 4. 实时发送音频数据
   */
  async start(): Promise<void> {
    // 重置状态
    this.finalTranscript = "";
    this.interimTranscript = "";
    this._isRecognizing = false;

    // 1. 请求签名 URL
    console.log("[Lingride TencentASR] 请求签名 URL...");
    const response: TencentASRSignResponse = await chrome.runtime.sendMessage({
      type: MessageType.TENCENT_ASR_SIGN,
    });

    if (!response.success || !response.data?.signedUrl) {
      throw new Error(response.error || "获取腾讯云 ASR 签名失败");
    }

    const signedUrl = response.data.signedUrl;
    console.log("[Lingride TencentASR] 签名 URL 获取成功");

    // 2. 建立 WebSocket 连接
    await this.connectWebSocket(signedUrl);

    // 3. 获取音频流并开始采集
    await this.startAudioCapture();

    this._isRecognizing = true;
    console.log("[Lingride TencentASR] 识别已启动");
  }

  /**
   * 停止识别并返回最终结果
   */
  async stop(): Promise<string> {
    this._isRecognizing = false;

    // 停止音频采集
    this.stopAudioCapture();

    // 发送结束标记并关闭 WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 发送结束标记（空的音频数据）
      const endMark = JSON.stringify({ type: "end" });
      this.ws.send(endMark);

      // 等待一小段时间让服务器处理最后的数据
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.ws.close(WS_CLOSE_NORMAL);
    }
    this.ws = null;

    // 清除超时计时器
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    const result = (this.finalTranscript + this.interimTranscript).trim();
    console.log(`[Lingride TencentASR] 识别结束: "${result}"`);
    return result;
  }

  /**
   * 当前是否正在识别
   */
  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  // ====== 私有方法 ======

  /**
   * 建立 WebSocket 连接
   */
  private connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("[Lingride TencentASR] 建立 WebSocket 连接...");

      this.ws = new WebSocket(url);

      // 设置连接超时
      this.connectTimeout = window.setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error("WebSocket 连接超时"));
        }
      }, WS_CONNECT_TIMEOUT);

      this.ws.onopen = () => {
        console.log("[Lingride TencentASR] WebSocket 连接成功");
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (event) => {
        console.error("[Lingride TencentASR] WebSocket 错误:", event);
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        const error = new Error("WebSocket 连接失败");
        if (this._isRecognizing) {
          this.onError?.(error);
        } else {
          reject(error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(
          `[Lingride TencentASR] WebSocket 关闭: code=${event.code}, reason=${event.reason}`
        );
        if (this._isRecognizing) {
          // 非正常关闭
          if (event.code !== WS_CLOSE_NORMAL) {
            this.onError?.(new Error(`连接异常关闭: ${event.reason || event.code}`));
          }
        }
      };
    });
  }

  /**
   * 处理服务器消息
   */
  private handleMessage(data: string): void {
    try {
      const response: TencentASRResponse = JSON.parse(data);

      if (response.code !== 0) {
        console.error("[Lingride TencentASR] 识别错误:", response.message);
        this.onError?.(new Error(`识别错误: ${response.message}`));
        return;
      }

      if (response.result) {
        const { slice_type, voice_text_str } = response.result;

        if (slice_type === 2) {
          // 最终结果
          this.finalTranscript += voice_text_str + " ";
          this.interimTranscript = "";
          console.log(`[Lingride TencentASR] Final: "${voice_text_str}"`);
        } else {
          // 中间结果
          this.interimTranscript = voice_text_str;
        }

        // 回调实时结果
        this.onInterimResult?.(
          (this.finalTranscript + this.interimTranscript).trim()
        );
      }
    } catch (e) {
      console.error("[Lingride TencentASR] 解析响应失败:", e, data);
    }
  }

  /**
   * 开始音频采集
   */
  private async startAudioCapture(): Promise<void> {
    console.log("[Lingride TencentASR] 开始音频采集...");

    // 获取音频流
    const stream = await acquireStream();

    // 创建 AudioContext（尝试使用 16kHz 采样率）
    // 注意：浏览器可能不支持 16kHz，需要重采样
    try {
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    } catch {
      // 如果不支持 16kHz，使用默认采样率，后续重采样
      this.audioContext = new AudioContext();
      console.log(
        `[Lingride TencentASR] 使用默认采样率: ${this.audioContext.sampleRate}Hz`
      );
    }

    // 创建音频源节点
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // 创建处理节点（用于获取 PCM 数据）
    // bufferSize 必须是 2 的幂：256, 512, 1024, 2048, 4096, 8192, 16384
    const bufferSize = 4096;
    this.processorNode = this.audioContext.createScriptProcessor(
      bufferSize,
      1, // 输入声道数
      1 // 输出声道数
    );
    const audioContext = this.audioContext;

    // 音频数据缓冲区（用于定时发送）
    let audioBuffer: Int16Array[] = [];
    let lastSendTime = Date.now();

    this.processorNode.onaudioprocess = (event) => {
      if (!this._isRecognizing || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);

      // 如果采样率不是 16kHz，需要重采样
      let pcmData: Float32Array;
      if (audioContext.sampleRate !== TARGET_SAMPLE_RATE) {
        pcmData = this.resample(
          inputData,
          audioContext.sampleRate,
          TARGET_SAMPLE_RATE
        );
      } else {
        pcmData = inputData;
      }

      // 转换为 16-bit PCM
      const int16Data = this.float32ToInt16(pcmData);
      audioBuffer.push(int16Data);

      // 每 AUDIO_SEND_INTERVAL 毫秒发送一次
      const now = Date.now();
      if (now - lastSendTime >= AUDIO_SEND_INTERVAL) {
        this.sendAudioData(audioBuffer);
        audioBuffer = [];
        lastSendTime = now;
      }
    };

    // 连接节点
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    console.log("[Lingride TencentASR] 音频采集已启动");
  }

  /**
   * 停止音频采集
   */
  private stopAudioCapture(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // 释放 MediaStream
    releaseStream();

    console.log("[Lingride TencentASR] 音频采集已停止");
  }

  /**
   * 发送音频数据
   */
  private sendAudioData(buffers: Int16Array[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || buffers.length === 0) {
      return;
    }

    // 合并所有缓冲区
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const mergedBuffer = new Int16Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      mergedBuffer.set(buf, offset);
      offset += buf.length;
    }

    // 发送二进制数据
    this.ws.send(mergedBuffer.buffer);
  }

  /**
   * Float32 转 Int16 PCM
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // 限制范围并转换
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  /**
   * 重采样（简单线性插值）
   */
  private resample(
    inputData: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Float32Array {
    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputData.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
      const t = srcIndex - srcIndexFloor;

      // 线性插值
      output[i] =
        inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t;
    }

    return output;
  }
}

/**
 * 检查是否配置了腾讯云 ASR
 *
 * @param config 用户配置
 * @returns 是否配置了完整的腾讯云 ASR 信息
 */
export function isTencentASRConfigured(config: {
  tencent_asr?: { app_id?: string; secret_id?: string; secret_key?: string };
}): boolean {
  return !!(
    config.tencent_asr?.app_id &&
    config.tencent_asr?.secret_id &&
    config.tencent_asr?.secret_key
  );
}
