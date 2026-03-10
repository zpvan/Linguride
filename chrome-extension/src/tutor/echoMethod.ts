/**
 * @file echoMethod.ts
 * @description 回声法核心模块 - 录音、播放、A-B 对比
 *
 * 实现回声法功能的核心逻辑：
 * - 使用 MediaRecorder 录制用户发音
 * - 播放用户录音和范读
 * - A-B 对比播放（先范读后用户录音）
 *
 * 提供双重通知机制：回调用于实时状态更新，Promise 用于流程控制。
 *
 * @author Lingride Team
 * @since 2.4.0
 */

import {
  DEFAULT_ECHO_METHOD_STATE,
  EchoMethodCallbacks,
  EchoMethodError,
  EchoMethodState,
} from "../types/echoMethod";

// ====== 状态变量 ======

/** 当前状态 */
let state: EchoMethodState = { ...DEFAULT_ECHO_METHOD_STATE };

/** 回调函数 */
let callbacks: EchoMethodCallbacks = {};

/** MediaRecorder 实例 */
let mediaRecorder: MediaRecorder | null = null;

/** 录音数据块 */
let audioChunks: Blob[] = [];

/** 当前录音 Blob */
let currentRecordingBlob: Blob | null = null;

/** 当前录音的 Object URL */
let currentRecordingUrl: string | null = null;

/** 录音开始时间 */
let recordingStartTime: number = 0;

/** 当前播放的 Audio 元素 */
let currentAudio: HTMLAudioElement | null = null;

/** A-B 对比是否被中断 */
let abComparisonAborted = false;

// ====== 公开 API ======

/**
 * 设置回调函数
 *
 * @param newCallbacks 回调函数对象
 */
export function setCallbacks(newCallbacks: EchoMethodCallbacks): void {
  callbacks = { ...newCallbacks };
}

/**
 * 检查浏览器是否支持 MediaRecorder
 *
 * @returns 是否支持
 */
export function isSupported(): boolean {
  return typeof MediaRecorder !== "undefined";
}

/**
 * 开始录音
 *
 * @param stream MediaStream 音频流
 * @throws EchoMethodError 录音失败时抛出错误
 */
export async function startRecording(stream: MediaStream): Promise<void> {
  // 检查是否已在录音
  if (state.isRecording) {
    notifyError("already-recording", "已在录音中");
    throw new Error("已在录音中");
  }

  // 检查浏览器支持
  if (!isSupported()) {
    notifyError("not-supported", "浏览器不支持录音功能");
    throw new Error("浏览器不支持录音功能");
  }

  try {
    // 检测支持的 MIME 类型
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onerror = () => {
      notifyError("recording-failed", "录音过程中发生错误");
      resetRecordingState();
    };

    recordingStartTime = Date.now();
    mediaRecorder.start(100); // 每 100ms 收集一次数据

    updateState({ isRecording: true });
    console.log("[Lingride EchoMethod] 开始录音");
  } catch (err) {
    notifyError("recording-failed", "启动录音失败");
    throw err;
  }
}

/**
 * 停止录音
 *
 * @returns Promise<Blob | null> 录音数据，失败时返回 null
 */
export async function stopRecording(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      updateState({ isRecording: false });
      resolve(null);
      return;
    }

    mediaRecorder.onstop = () => {
      // 清理旧的录音 URL
      if (currentRecordingUrl) {
        URL.revokeObjectURL(currentRecordingUrl);
        currentRecordingUrl = null;
      }

      // 创建新的录音 Blob
      currentRecordingBlob = new Blob(audioChunks, {
        type: mediaRecorder!.mimeType,
      });

      // 创建 Object URL 供播放使用
      currentRecordingUrl = URL.createObjectURL(currentRecordingBlob);

      const duration = (Date.now() - recordingStartTime) / 1000;

      updateState({
        hasRecording: true,
        recordingDuration: duration,
        isRecording: false,
      });

      console.log(
        "[Lingride EchoMethod] 录音完成，时长:",
        duration.toFixed(1),
        "秒"
      );
      resolve(currentRecordingBlob);
    };

    mediaRecorder.stop();
  });
}

/**
 * 播放用户录音
 *
 * @returns Promise<void> 播放完成时 resolve
 */
export function playUserRecording(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!currentRecordingUrl) {
      notifyError("no-recording", "没有可播放的录音");
      reject(new Error("没有可播放的录音"));
      return;
    }

    if (state.isPlaying) {
      stopPlayback();
    }

    const audio = new Audio(currentRecordingUrl);
    currentAudio = audio;

    updateState({ isPlaying: true, playingSource: "user" });

    audio.onended = () => {
      currentAudio = null;
      updateState({ isPlaying: false, playingSource: null });
      resolve();
    };

    audio.onerror = () => {
      currentAudio = null;
      updateState({ isPlaying: false, playingSource: null });
      notifyError("playback-failed", "播放录音失败");
      reject(new Error("播放录音失败"));
    };

    audio.play().catch((err) => {
      currentAudio = null;
      updateState({ isPlaying: false, playingSource: null });
      notifyError("playback-failed", "播放录音失败");
      reject(err);
    });

    console.log("[Lingride EchoMethod] 开始播放用户录音");
  });
}

/**
 * 播放范读（使用 Web Speech API）
 *
 * @param text 要朗读的文本
 * @param speed 语速
 * @returns Promise<void> 播放完成时 resolve
 */
export function playModelReading(text: string, speed: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (state.isPlaying) {
      stopPlayback();
    }

    // 停止当前的语音合成
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speed;

    updateState({ isPlaying: true, playingSource: "model" });

    utterance.onend = () => {
      updateState({ isPlaying: false, playingSource: null });
      resolve();
    };

    utterance.onerror = () => {
      updateState({ isPlaying: false, playingSource: null });
      notifyError("playback-failed", "范读播放失败");
      reject(new Error("范读播放失败"));
    };

    speechSynthesis.speak(utterance);
    console.log("[Lingride EchoMethod] 开始播放范读");
  });
}

/**
 * A-B 对比播放
 *
 * 先播放范读，间隔 800ms 后播放用户录音。
 *
 * @param text 范读文本
 * @param speed 语速
 * @returns Promise<void> 播放完成时 resolve
 */
export async function playABComparison(
  text: string,
  speed: number
): Promise<void> {
  if (!currentRecordingUrl) {
    notifyError("no-recording", "没有可播放的录音");
    throw new Error("没有可播放的录音");
  }

  if (state.isPlaying) {
    stopPlayback();
  }

  abComparisonAborted = false;

  try {
    // 更新状态：正在播放 A-B 对比的范读部分
    updateState({ isPlaying: true, playingSource: "ab-model" });

    // 播放范读
    await playModelReadingInternal(text, speed);

    // 检查是否被中断
    if (abComparisonAborted) {
      return;
    }

    // 间隔 800ms（给用户心理准备）
    await delay(800);

    // 检查是否被中断
    if (abComparisonAborted) {
      return;
    }

    // 更新状态：正在播放 A-B 对比的用户录音部分
    updateState({ playingSource: "ab-user" });

    // 播放用户录音
    await playUserRecordingInternal();

    // 完成
    updateState({ isPlaying: false, playingSource: null });
    console.log("[Lingride EchoMethod] A-B 对比播放完成");
  } catch (err) {
    if (!abComparisonAborted) {
      updateState({ isPlaying: false, playingSource: null });
      throw err;
    }
  }
}

/**
 * 停止当前播放
 */
export function stopPlayback(): void {
  abComparisonAborted = true;

  // 停止 Audio 元素
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // 停止语音合成
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }

  updateState({ isPlaying: false, playingSource: null });
  console.log("[Lingride EchoMethod] 停止播放");
}

/**
 * 获取当前状态
 *
 * @returns EchoMethodState 当前状态的副本
 */
export function getState(): EchoMethodState {
  return { ...state };
}

/**
 * 清理录音数据
 *
 * 在切换句子时调用，释放资源。
 */
export function clearRecording(): void {
  // 停止播放
  stopPlayback();

  // 清理录音 URL
  if (currentRecordingUrl) {
    URL.revokeObjectURL(currentRecordingUrl);
    currentRecordingUrl = null;
  }

  // 清理录音数据
  currentRecordingBlob = null;
  audioChunks = [];

  updateState({
    hasRecording: false,
    recordingDuration: 0,
  });

  console.log("[Lingride EchoMethod] 清理录音数据");
}

/**
 * 获取当前录音 Blob
 *
 * @returns Blob | null 录音数据
 */
export function getRecordingBlob(): Blob | null {
  return currentRecordingBlob;
}

/**
 * 重置模块状态
 *
 * 在退出影子跟读或页面关闭时调用。
 */
export function reset(): void {
  clearRecording();
  resetRecordingState();
  state = { ...DEFAULT_ECHO_METHOD_STATE };
  callbacks = {};
}

// ====== 内部辅助函数 ======

/**
 * 更新状态并通知
 */
function updateState(updates: Partial<EchoMethodState>): void {
  state = { ...state, ...updates };
  notifyStateChange();
}

/**
 * 通知状态变化
 */
function notifyStateChange(): void {
  callbacks.onStateChange?.(getState());
}

/**
 * 通知错误
 */
function notifyError(type: EchoMethodError, message?: string): void {
  callbacks.onError?.(type, message);
}

/**
 * 重置录音状态
 */
function resetRecordingState(): void {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.stop();
    } catch {
      // 忽略停止时的错误
    }
  }
  mediaRecorder = null;
  audioChunks = [];
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 内部范读播放（不更新外部状态）
 */
function playModelReadingInternal(text: string, speed: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speed;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = () => {
      reject(new Error("范读播放失败"));
    };

    speechSynthesis.speak(utterance);
  });
}

/**
 * 内部用户录音播放（不更新外部状态）
 */
function playUserRecordingInternal(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!currentRecordingUrl) {
      reject(new Error("没有可播放的录音"));
      return;
    }

    const audio = new Audio(currentRecordingUrl);
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      resolve();
    };

    audio.onerror = () => {
      currentAudio = null;
      reject(new Error("播放录音失败"));
    };

    audio.play().catch((err) => {
      currentAudio = null;
      reject(err);
    });
  });
}
