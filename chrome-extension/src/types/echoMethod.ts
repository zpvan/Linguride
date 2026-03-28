/**
 * @file echoMethod.ts
 * @description 回声法功能相关类型定义
 *
 * 定义回声法功能的录音状态、播放状态、回调接口等类型。
 * 回声法允许用户回听自己的发音并与范读进行 A-B 对比。
 *
 * @author Lingride Team
 * @since 2.4.0
 */

// ====== 播放来源 ======

/**
 * 播放来源类型
 *
 * - model: 播放范读
 * - user: 播放用户录音
 * - ab-model: A-B 对比中播放范读部分
 * - ab-user: A-B 对比中播放用户录音部分
 * - null: 未在播放
 */
export type PlayingSource = "model" | "user" | "ab-model" | "ab-user" | null;

// ====== 回声法状态 ======

/**
 * 回声法状态接口
 *
 * 描述当前回声法模块的完整状态
 */
export interface EchoMethodState {
  /** 是否有录音数据 */
  hasRecording: boolean;

  /** 是否正在播放 */
  isPlaying: boolean;

  /** 当前播放来源 */
  playingSource: PlayingSource;

  /** 录音时长（秒） */
  recordingDuration: number;

  /** 是否正在录音 */
  isRecording: boolean;
}

/**
 * 默认回声法状态
 */
export const DEFAULT_ECHO_METHOD_STATE: EchoMethodState = {
  hasRecording: false,
  isPlaying: false,
  playingSource: null,
  recordingDuration: 0,
  isRecording: false,
};

// ====== 错误类型 ======

/**
 * 回声法错误类型
 *
 * - recording-failed: 录音启动失败
 * - playback-failed: 播放失败
 * - no-recording: 无录音数据
 * - not-supported: 浏览器不支持 MediaRecorder
 * - already-recording: 已在录音中
 * - already-playing: 已在播放中
 */
export type EchoMethodError =
  | "recording-failed"
  | "playback-failed"
  | "no-recording"
  | "not-supported"
  | "already-recording"
  | "already-playing";

// ====== 回调接口 ======

/**
 * 回声法回调接口
 *
 * 用于实时通知状态变化和错误
 */
export interface EchoMethodCallbacks {
  /** 状态变化回调 */
  onStateChange?: (state: EchoMethodState) => void;

  /** 错误回调 */
  onError?: (error: EchoMethodError, message?: string) => void;
}

// ====== 音频采集错误类型 ======

/**
 * 音频采集错误类型
 *
 * - permission-denied: 用户拒绝麦克风权限
 * - device-not-found: 未找到麦克风设备
 * - not-supported: 浏览器不支持 getUserMedia
 * - in-use: 麦克风被其他应用占用
 * - unknown: 未知错误
 */
export type AudioCaptureError =
  | "permission-denied"
  | "device-not-found"
  | "not-supported"
  | "in-use"
  | "unknown";

// ====== 音频采集状态 ======

/**
 * 音频采集状态接口
 */
export interface AudioCaptureState {
  /** 是否有活跃的 MediaStream */
  isActive: boolean;

  /** 当前引用计数 */
  refCount: number;
}
