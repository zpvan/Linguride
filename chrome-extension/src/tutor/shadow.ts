/**
 * @file shadow.ts
 * @description 影子跟读功能核心模块
 *
 * 负责影子跟读练习的状态管理、练习流程控制。
 * 通过依赖注入方式使用语音识别器，由 tutor.ts 负责创建并传入。
 *
 * @author Lingride Team
 * @since 2.3.0
 */

import {
  DEFAULT_SHADOW_CONFIG,
  ISpeechRecognizer,
  MessageType,
  ShadowAssessmentResult,
  ShadowAssessResponse,
  ShadowConfig,
  ShadowMode,
  ShadowProgress,
  ShadowSentence,
  ShadowSpeed,
  SplitSentencesResponse,
} from "../types";

// ====== 状态变量 ======

/** 练习句子列表 */
let sentences: ShadowSentence[] = [];

/** 当前句子索引 */
let currentIndex = 0;

/** 影子跟读配置 */
let shadowConfig: ShadowConfig = { ...DEFAULT_SHADOW_CONFIG };

/** 注入的语音识别器 */
let recognizer: ISpeechRecognizer | null = null;

/** 录音计时器 */
let recordingTimer: number | null = null;

/** 录音秒数 */
let recordingSeconds = 0;

/** 最大录音时长（秒） */
const MAX_RECORDING_SECONDS = 60;

/** 最后一次评估结果 */
let lastAssessResult: ShadowAssessmentResult | null = null;

/** 所有评分（用于计算平均分） */
let allScores: number[] = [];

// ====== 回调函数 ======

/** 实时识别回调 */
let onInterimResultCallback: ((text: string) => void) | null = null;

/** 录音时间更新回调 */
let onRecordingTimeCallback: ((seconds: number) => void) | null = null;

/** 错误回调 */
let onErrorCallback: ((error: Error) => void) | null = null;

// ====== 初始化（依赖注入） ======

/**
 * 注入语音识别器实例
 *
 * 由 tutor.ts 在初始化时调用，传入 WebSpeechRecognizer 实例。
 */
export function injectRecognizer(rec: ISpeechRecognizer): void {
  recognizer = rec;
}

/**
 * 设置实时识别回调
 */
export function setOnInterimResult(callback: (text: string) => void): void {
  onInterimResultCallback = callback;
}

/**
 * 设置录音时间更新回调
 */
export function setOnRecordingTime(callback: (seconds: number) => void): void {
  onRecordingTimeCallback = callback;
}

/**
 * 设置错误回调
 */
export function setOnError(callback: (error: Error) => void): void {
  onErrorCallback = callback;
}

// ====== 公开 API ======

/**
 * 初始化影子跟读练习
 *
 * 调用 AI 分句接口，将文本分割成适合跟读的句子。
 *
 * @param text 用户输入的英文文本
 * @returns 分句后的句子数组
 * @throws 分句失败时抛出错误
 */
export async function initShadowPractice(
  text: string
): Promise<ShadowSentence[]> {
  // 重置状态
  resetPractice();

  // 调用 AI 分句
  const response: SplitSentencesResponse = await chrome.runtime.sendMessage({
    type: MessageType.SPLIT_SENTENCES,
    payload: { text },
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || "分句失败，请重试");
  }

  // 检查句子数量
  if (response.data.sentences.length === 0) {
    throw new Error("未能识别出有效句子，请检查输入内容");
  }

  if (response.data.sentences.length > 20) {
    throw new Error("文本过长，请缩短后重试（最多支持 20 句）");
  }

  // 构建句子列表
  sentences = response.data.sentences.map((text, index) => ({
    id: index,
    text: text.trim(),
    status: "pending" as const,
    attempts: 0,
  }));

  // 设置第一句为当前练习
  currentIndex = 0;
  if (sentences.length > 0) {
    sentences[0].status = "practicing";
  }

  return sentences;
}

/**
 * 获取当前句子
 */
export function getCurrentSentence(): ShadowSentence | null {
  if (currentIndex >= 0 && currentIndex < sentences.length) {
    return sentences[currentIndex];
  }
  return null;
}

/**
 * 获取所有句子
 */
export function getAllSentences(): ShadowSentence[] {
  return [...sentences];
}

/**
 * 播放范读
 *
 * 使用 Web Speech API 朗读当前句子，支持语速调节。
 *
 * @param onEnd 朗读结束回调
 * @param onStart 朗读开始回调
 */
export function playModelReading(onEnd?: () => void, onStart?: () => void): void {
  const sentence = getCurrentSentence();
  if (!sentence) return;

  // 停止当前朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(sentence.text);
  utterance.lang = "en-US";
  utterance.rate = shadowConfig.speed;

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = () => {
    onEnd?.();
  };

  speechSynthesis.speak(utterance);
}

/**
 * 停止范读
 */
export function stopModelReading(): void {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
}

/**
 * 开始跟读录音
 *
 * 根据模式决定延迟时间：
 * - sentence: 无延迟，用户手动点击后开始
 * - shadow: 延迟 500ms 后开始
 * - sync: 与范读同时开始（无延迟）
 */
export async function startShadowRecording(): Promise<void> {
  if (!recognizer) {
    throw new Error("语音识别器未初始化");
  }

  // 配置识别器回调
  recognizer.onInterimResult = (text) => {
    onInterimResultCallback?.(text);
  };

  recognizer.onError = (error) => {
    stopRecordingCleanup();
    onErrorCallback?.(error);
  };

  // 启动识别
  await recognizer.start();

  // 启动计时器
  recordingSeconds = 0;
  onRecordingTimeCallback?.(0);

  recordingTimer = window.setInterval(() => {
    recordingSeconds++;
    onRecordingTimeCallback?.(recordingSeconds);

    // 超时自动停止
    if (recordingSeconds >= MAX_RECORDING_SECONDS) {
      onErrorCallback?.(new Error("录音已达最大时长，自动停止"));
    }
  }, 1000);
}

/**
 * 停止录音并返回识别结果
 */
export async function stopRecording(): Promise<string> {
  stopRecordingCleanup();

  if (!recognizer) {
    return "";
  }

  return await recognizer.stop();
}

/**
 * 停止录音并进行 AI 评估
 *
 * @returns 评估结果
 */
export async function stopAndAssess(): Promise<ShadowAssessmentResult> {
  const recognizedText = await stopRecording();
  const sentence = getCurrentSentence();

  if (!sentence) {
    throw new Error("无当前练习句子");
  }

  if (!recognizedText || recognizedText.trim().length === 0) {
    throw new Error("未识别到语音内容，请重试");
  }

  // 更新练习次数
  sentence.attempts++;

  // 调用 AI 评估
  const response: ShadowAssessResponse = await chrome.runtime.sendMessage({
    type: MessageType.SHADOW_ASSESS,
    payload: {
      original: sentence.text,
      recognized: recognizedText.trim(),
    },
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || "评估失败，请重试");
  }

  // 保存评估结果
  lastAssessResult = response.data;

  // 更新最佳得分
  if (!sentence.bestScore || response.data.score > sentence.bestScore) {
    sentence.bestScore = response.data.score;
  }

  // 记录得分
  allScores.push(response.data.score);

  return response.data;
}

/**
 * 获取最后一次评估结果
 */
export function getLastAssessResult(): ShadowAssessmentResult | null {
  return lastAssessResult;
}

/**
 * 移动到下一句
 *
 * @returns 是否还有下一句
 */
export function nextSentence(): boolean {
  const currentSentence = getCurrentSentence();

  // 标记当前句子为已完成
  if (currentSentence) {
    currentSentence.status = "completed";
  }

  // 移动索引
  currentIndex++;

  // 检查是否还有下一句
  if (currentIndex >= sentences.length) {
    return false;
  }

  // 标记下一句为练习中
  sentences[currentIndex].status = "practicing";
  lastAssessResult = null;

  return true;
}

/**
 * 重新练习当前句
 */
export function retryCurrent(): void {
  lastAssessResult = null;
}

/**
 * 播放问题词
 *
 * 使用慢速朗读问题单词两遍，帮助用户学习。
 */
export function speakProblemWord(word: string): void {
  // 停止当前朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }

  const utterance1 = new SpeechSynthesisUtterance(word);
  utterance1.lang = "en-US";
  utterance1.rate = shadowConfig.speed;

  const utterance2 = new SpeechSynthesisUtterance(word);
  utterance2.lang = "en-US";
  utterance2.rate = shadowConfig.speed;

  utterance1.onend = () => {
    setTimeout(() => {
      speechSynthesis.speak(utterance2);
    }, 500);
  };

  speechSynthesis.speak(utterance1);
}

/**
 * 更新配置
 */
export function updateConfig(config: Partial<ShadowConfig>): void {
  shadowConfig = { ...shadowConfig, ...config };
}

/**
 * 获取当前配置
 */
export function getConfig(): ShadowConfig {
  return { ...shadowConfig };
}

/**
 * 设置跟读模式
 */
export function setMode(mode: ShadowMode): void {
  shadowConfig.mode = mode;
}

/**
 * 设置语速
 */
export function setSpeed(speed: ShadowSpeed): void {
  shadowConfig.speed = speed;
}

/**
 * 获取练习进度
 */
export function getProgress(): ShadowProgress {
  const completedCount = sentences.filter((s) => s.status === "completed").length;
  return {
    current: currentIndex,
    total: sentences.length,
    completedCount,
  };
}

/**
 * 获取平均得分
 */
export function getAverageScore(): number {
  if (allScores.length === 0) return 0;
  const sum = allScores.reduce((a, b) => a + b, 0);
  return Math.round(sum / allScores.length);
}

/**
 * 检查是否正在录音
 */
export function isRecording(): boolean {
  return recognizer?.isRecognizing() ?? false;
}

/**
 * 检查练习是否完成
 */
export function isPracticeComplete(): boolean {
  return currentIndex >= sentences.length && sentences.length > 0;
}

/**
 * 重置练习状态
 */
export function resetPractice(): void {
  stopRecordingCleanup();
  stopModelReading();

  sentences = [];
  currentIndex = 0;
  lastAssessResult = null;
  allScores = [];
}

/**
 * 获取延迟时间（毫秒）
 *
 * 根据当前模式返回录音启动延迟：
 * - sentence: 0（无延迟）
 * - shadow: 500ms
 * - sync: 0（与范读同步）
 */
export function getRecordingDelay(): number {
  switch (shadowConfig.mode) {
    case "shadow":
      return 500;
    case "sentence":
    case "sync":
    default:
      return 0;
  }
}

// ====== 内部辅助函数 ======

/**
 * 清理录音资源
 *
 * 停止录音计时器并重置录音秒数。
 * 在录音停止、异常或页面关闭时调用。
 */
function stopRecordingCleanup(): void {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  recordingSeconds = 0;
}
