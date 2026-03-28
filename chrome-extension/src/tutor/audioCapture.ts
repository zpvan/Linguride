/**
 * @file audioCapture.ts
 * @description 音频采集模块 - 管理共享的 MediaStream
 *
 * 统一管理麦克风 MediaStream，供 WebSpeechRecognizer 和 echoMethod 共享使用。
 * 使用引用计数机制管理 stream 的生命周期。
 *
 * 当前设计：tutor.ts 获取一次 stream，传递给 echoMethod 和 WSR。
 * 引用计数预留给未来多模块独立获取 stream 的场景。
 *
 * @author Lingride Team
 * @since 2.4.0
 */

import { AudioCaptureError, AudioCaptureState } from "../types/echoMethod";

// ====== 状态变量 ======

/** 共享的 MediaStream */
let sharedStream: MediaStream | null = null;

/** 引用计数，用于判断何时释放 */
let refCount = 0;

// ====== 公开 API ======

/**
 * 获取共享的 MediaStream
 *
 * 如果已有活跃的流则复用，否则请求新的流。
 * 每次调用会增加引用计数。
 *
 * @returns Promise<MediaStream> 共享的音频流
 * @throws AudioCaptureError 获取失败时抛出错误类型
 */
export async function acquireStream(): Promise<MediaStream> {
  // 如果已有活跃的流，直接复用
  if (sharedStream && sharedStream.active) {
    refCount++;
    console.log("[Lingride AudioCapture] 复用现有 stream，refCount:", refCount);
    return sharedStream;
  }

  // 检查浏览器支持
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw createError("not-supported");
  }

  // 请求新的 MediaStream
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    refCount = 1;
    console.log("[Lingride AudioCapture] 获取新 stream，refCount:", refCount);
    return sharedStream;
  } catch (err) {
    // 根据错误类型转换为 AudioCaptureError
    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          throw createError("permission-denied");
        case "NotFoundError":
        case "DevicesNotFoundError":
          throw createError("device-not-found");
        case "NotReadableError":
        case "TrackStartError":
          throw createError("in-use");
        default:
          throw createError("unknown");
      }
    }
    throw createError("unknown");
  }
}

/**
 * 释放 MediaStream 的一个引用
 *
 * 当引用计数降为 0 时，停止并释放 stream。
 */
export function releaseStream(): void {
  if (refCount > 0) {
    refCount--;
    console.log("[Lingride AudioCapture] 释放引用，refCount:", refCount);
  }

  if (refCount <= 0 && sharedStream) {
    console.log("[Lingride AudioCapture] 停止并释放 stream");
    sharedStream.getTracks().forEach((track) => track.stop());
    sharedStream = null;
    refCount = 0;
  }
}

/**
 * 获取当前 stream（不增加引用计数）
 *
 * @returns 当前的 MediaStream 或 null
 */
export function getStream(): MediaStream | null {
  return sharedStream;
}

/**
 * 检查当前 stream 是否活跃
 *
 * @returns 是否有活跃的 stream
 */
export function isStreamActive(): boolean {
  return sharedStream !== null && sharedStream.active;
}

/**
 * 获取当前状态
 *
 * @returns AudioCaptureState 当前状态
 */
export function getState(): AudioCaptureState {
  return {
    isActive: isStreamActive(),
    refCount,
  };
}

/**
 * 强制释放所有资源
 *
 * 在页面关闭或异常情况下调用，忽略引用计数直接释放。
 */
export function forceRelease(): void {
  if (sharedStream) {
    console.log("[Lingride AudioCapture] 强制释放 stream");
    sharedStream.getTracks().forEach((track) => track.stop());
    sharedStream = null;
  }
  refCount = 0;
}

/**
 * 检查浏览器是否支持音频采集
 *
 * @returns 是否支持 getUserMedia
 */
export function isSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// ====== 内部辅助函数 ======

/**
 * 创建带类型的错误对象
 */
function createError(type: AudioCaptureError): Error & { type: AudioCaptureError } {
  const messages: Record<AudioCaptureError, string> = {
    "permission-denied": "麦克风权限被拒绝，请在浏览器设置中允许",
    "device-not-found": "未检测到麦克风设备，请检查麦克风连接",
    "not-supported": "当前浏览器不支持音频采集",
    "in-use": "麦克风正被其他应用使用",
    unknown: "获取麦克风时发生未知错误",
  };

  const error = new Error(messages[type]) as Error & { type: AudioCaptureError };
  error.type = type;
  return error;
}
