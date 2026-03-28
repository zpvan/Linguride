/**
 * @file alibabaASRRecognizer.ts
 * @description 阿里云 Paraformer 实时语音识别器（代理模式）
 *
 * 实现 ISpeechRecognizer 接口，通过 Chrome 消息机制与 Background Service Worker 通信。
 * WebSocket 连接在 Background 中管理，以保护 API Key 安全。
 *
 * 技术要点：
 * - 使用 Port 长连接实现双向通信
 * - 音频数据通过 Base64 编码传输
 * - 音频格式：16000Hz、16bits、单声道 PCM
 * - 建议每 100ms 发送一次音频数据（阿里云推荐）
 *
 * @author Lingride Team
 * @since 2.6.0
 */

import { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { MessageType } from "../types";
import { acquireStream, releaseStream } from "./audioCapture";

// ====== 常量定义 ======

/** 目标采样率：阿里云支持 16kHz */
const TARGET_SAMPLE_RATE = 16000;

/** 音频发送间隔（毫秒）：每 100ms 发送一次（阿里云推荐） */
const AUDIO_SEND_INTERVAL = 100;

/** 启动超时时间（毫秒） */
const START_TIMEOUT = 10000;

// ====== 消息类型 ======

/** 来自 Background 的消息 */
interface BackgroundMessage {
  type: string;
  success?: boolean;
  error?: string;
  payload?: {
    text?: string;
    isFinal?: boolean;
    error?: string;
  };
  data?: {
    finalText?: string;
  };
}

// ====== AlibabaASRRecognizer 类 ======

/**
 * 阿里云 Paraformer 实时语音识别器（代理模式）
 *
 * WebSocket 连接在 Background Service Worker 中管理，
 * 此类通过 Chrome 消息机制与 Background 通信。
 */
export class AlibabaASRRecognizer implements ISpeechRecognizer {
  /** Port 连接（用于与 Background 通信） */
  private port: chrome.runtime.Port | null = null;

  /** AudioContext */
  private audioContext: AudioContext | null = null;

  /** 音频源节点 */
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  /** 音频处理节点 */
  private processorNode: ScriptProcessorNode | null = null;

  /** 是否正在识别 */
  private _isRecognizing = false;

  /** 当前累积的识别文本 */
  private currentText = "";

  /** 实时识别结果回调 */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  /**
   * 开始识别
   *
   * 流程：
   * 1. 建立 Port 连接
   * 2. 发送启动消息并等待响应
   * 3. 开始音频采集
   */
  async start(): Promise<void> {
    // 重置状态
    this.currentText = "";
    this._isRecognizing = false;

    console.log("[Lingride AlibabaASR] 开始启动...");

    // 1. 建立 Port 连接
    this.port = chrome.runtime.connect({ name: "alibaba-asr" });

    // 设置消息监听
    this.port.onMessage.addListener(this.handlePortMessage.bind(this));

    // 设置断开监听
    this.port.onDisconnect.addListener(() => {
      console.log("[Lingride AlibabaASR] Port 连接断开");
      if (this._isRecognizing) {
        this.onError?.(new Error("连接意外断开"));
      }
    });

    // 2. 发送启动消息并等待响应
    const startResponse = await this.sendStartMessage();

    if (!startResponse.success) {
      this.cleanup();
      throw new Error(startResponse.error || "启动阿里云 ASR 失败");
    }

    console.log("[Lingride AlibabaASR] 启动成功，开始音频采集");

    // 3. 开始音频采集
    await this.startAudioCapture();

    this._isRecognizing = true;
    console.log("[Lingride AlibabaASR] 识别已启动");
  }

  /**
   * 停止识别并返回最终结果
   */
  async stop(): Promise<string> {
    this._isRecognizing = false;

    // 停止音频采集
    this.stopAudioCapture();

    // 发送停止消息并等待最终结果
    let finalText = this.currentText;

    if (this.port) {
      try {
        const stopResponse = await this.sendStopMessage();
        if (stopResponse.success && stopResponse.data?.finalText) {
          finalText = stopResponse.data.finalText;
        }
      } catch (e) {
        console.warn("[Lingride AlibabaASR] 停止消息发送失败:", e);
      }
    }

    // 清理资源
    this.cleanup();

    console.log(`[Lingride AlibabaASR] 识别结束: "${finalText}"`);
    return finalText;
  }

  /**
   * 当前是否正在识别
   */
  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  // ====== 私有方法 ======

  /**
   * 发送启动消息并等待响应
   */
  private sendStartMessage(): Promise<BackgroundMessage> {
    return new Promise((resolve) => {
      if (!this.port) {
        resolve({ type: "", success: false, error: "Port 未连接" });
        return;
      }

      // 设置超时
      const timeout = setTimeout(() => {
        resolve({ type: "", success: false, error: "启动超时" });
      }, START_TIMEOUT);

      // 临时消息监听器（等待启动响应）
      const responseListener = (message: BackgroundMessage) => {
        if (message.type === "ALIBABA_ASR_START_RESPONSE") {
          clearTimeout(timeout);
          this.port?.onMessage.removeListener(responseListener);
          resolve(message);
        }
      };

      this.port.onMessage.addListener(responseListener);

      // 发送启动消息
      this.port.postMessage({ type: MessageType.ALIBABA_ASR_START });
    });
  }

  /**
   * 发送停止消息并等待响应
   */
  private sendStopMessage(): Promise<BackgroundMessage> {
    return new Promise((resolve) => {
      if (!this.port) {
        resolve({ type: "", success: false, error: "Port 未连接" });
        return;
      }

      // 设置超时
      const timeout = setTimeout(() => {
        resolve({ type: "", success: true, data: { finalText: this.currentText } });
      }, 2000);

      // 临时消息监听器（等待停止响应）
      const responseListener = (message: BackgroundMessage) => {
        if (message.type === "ALIBABA_ASR_STOP_RESPONSE") {
          clearTimeout(timeout);
          this.port?.onMessage.removeListener(responseListener);
          resolve(message);
        }
      };

      this.port.onMessage.addListener(responseListener);

      // 发送停止消息
      this.port.postMessage({ type: MessageType.ALIBABA_ASR_STOP });
    });
  }

  /**
   * 处理来自 Background 的消息
   */
  private handlePortMessage(message: BackgroundMessage): void {
    // 处理实时识别结果
    if (message.type === MessageType.ALIBABA_ASR_RESULT) {
      if (message.payload?.error) {
        // 识别过程中出错
        console.error("[Lingride AlibabaASR] 识别错误:", message.payload.error);
        this.onError?.(new Error(message.payload.error));
        return;
      }

      const text = message.payload?.text || "";
      this.currentText = text;

      // 回调实时结果
      this.onInterimResult?.(text);
    }
  }

  /**
   * 开始音频采集
   */
  private async startAudioCapture(): Promise<void> {
    console.log("[Lingride AlibabaASR] 开始音频采集...");

    // 获取音频流
    const stream = await acquireStream();

    // 创建 AudioContext（尝试使用 16kHz 采样率）
    try {
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    } catch {
      // 如果不支持 16kHz，使用默认采样率，后续重采样
      this.audioContext = new AudioContext();
      console.log(
        `[Lingride AlibabaASR] 使用默认采样率: ${this.audioContext.sampleRate}Hz`
      );
    }

    // 创建音频源节点
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // 创建处理节点（用于获取 PCM 数据）
    const bufferSize = 4096;
    this.processorNode = this.audioContext.createScriptProcessor(
      bufferSize,
      1, // 输入声道数
      1 // 输出声道数
    );

    // 音频数据缓冲区（用于定时发送）
    let audioBuffer: Int16Array[] = [];
    let lastSendTime = Date.now();

    this.processorNode.onaudioprocess = (event) => {
      if (!this._isRecognizing || !this.port) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);

      // 如果采样率不是 16kHz，需要重采样
      let pcmData: Float32Array;
      if (this.audioContext!.sampleRate !== TARGET_SAMPLE_RATE) {
        pcmData = this.resample(
          inputData,
          this.audioContext!.sampleRate,
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

    console.log("[Lingride AlibabaASR] 音频采集已启动");
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

    console.log("[Lingride AlibabaASR] 音频采集已停止");
  }

  /**
   * 发送音频数据到 Background
   */
  private sendAudioData(buffers: Int16Array[]): void {
    if (!this.port || buffers.length === 0) {
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

    // 转换为 Base64
    const uint8Array = new Uint8Array(mergedBuffer.buffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binaryString);

    // 发送音频数据
    this.port.postMessage({
      type: MessageType.ALIBABA_ASR_AUDIO,
      payload: { audioData: base64Data },
    });
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.stopAudioCapture();

    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }

    console.log("[Lingride AlibabaASR] 资源已清理");
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
 * 检查是否配置了阿里云 ASR
 *
 * @param config 用户配置
 * @returns 是否配置了阿里云 ASR API Key
 */
export function isAlibabaASRConfigured(config: {
  alibaba_asr?: { api_key?: string };
}): boolean {
  return !!config.alibaba_asr?.api_key;
}
