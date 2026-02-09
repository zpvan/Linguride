/**
 * @file tutor.ts
 * @description 外教标签页逻辑 — AI 助手多模式功能
 *
 * 从 popup.ts 迁移而来，提供更大的操作空间和更好的用户体验。
 * 功能：中译英、英译中、英英释义、长难句分析、语音朗读、录音练习、发音评估。
 *
 * @author Lingride Team
 * @since 2.2.0
 */

import {
  AnalyzeSentenceResponse,
  AssessPronunciationResponse,
  CEFRLevel,
  ChineseToEnglishResponse,
  EchoMethodState,
  EnglishDefinitionResponse,
  EnglishToChineseResponse,
  GetConfigResponse,
  ISpeechRecognizer,
  LingridConfig,
  MessageType,
  PronunciationAssessmentResult,
  SentenceAnalysisResult,
  ShadowAssessmentResult,
  ShadowMode,
  ShadowSpeed,
} from "../types";
import * as shadow from "./shadow";
import * as audioCapture from "./audioCapture";
import * as echoMethod from "./echoMethod";
import {
  TencentASRRecognizer,
  isTencentASRConfigured,
} from "./tencentASRRecognizer";
import {
  AlibabaASRRecognizer,
  isAlibabaASRConfigured,
} from "./alibabaASRRecognizer";

// ====== 类型定义 ======

/** 外教助手模式 */
type TutorMode = "cn2en" | "en2cn" | "definition" | "analyze" | "shadow";

/** 模式配置 */
interface ModeConfig {
  placeholder: string;
  btnText: string;
}

/** 模式配置映射 */
const MODE_CONFIG: Record<TutorMode, ModeConfig> = {
  cn2en: { placeholder: "输入中文，点击翻译成英文...", btnText: "翻译" },
  en2cn: { placeholder: "输入英文，点击翻译成中文...", btnText: "翻译" },
  definition: {
    placeholder: "输入英文单词或句子，获取英英释义...",
    btnText: "释义",
  },
  analyze: { placeholder: "输入英文长难句，点击分析...", btnText: "语法分析" },
  shadow: {
    placeholder: "输入英文文本，开始影子跟读练习...",
    btnText: "开始练习",
  },
};

// ====== 状态变量 ======

/** 当前模式 */
let currentMode: TutorMode = "cn2en";

/** 用户 CEFR 水平 */
let userLevel: CEFRLevel = "A2";

/** 用户完整配置（用于识别器选择） */
let userConfig: LingridConfig | null = null;

// ====== DOM 元素引用 ======

// Level Badge
const levelBadgeWrapper = document.getElementById(
  "levelBadgeWrapper"
) as HTMLElement;
const levelBadge = document.getElementById("levelBadge") as HTMLButtonElement;
const levelDropdown = document.getElementById("levelDropdown") as HTMLElement;

// 模式选择器
const modeSelector = document.getElementById("modeSelector") as HTMLElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;

// 输入区域
const sentenceInput = document.getElementById(
  "sentenceInput"
) as HTMLTextAreaElement;
const sentenceCharCount = document.getElementById(
  "sentenceCharCount"
) as HTMLElement;

// 翻译结果
const translationResult = document.getElementById(
  "translationResult"
) as HTMLElement;
const translationText = document.getElementById(
  "translationText"
) as HTMLElement;
const copyTranslationBtn = document.getElementById(
  "copyTranslationBtn"
) as HTMLButtonElement;

// 英英释义结果
const definitionResult = document.getElementById(
  "definitionResult"
) as HTMLElement;
const definitionText = document.getElementById(
  "definitionText"
) as HTMLElement;
const examplesSection = document.getElementById(
  "examplesSection"
) as HTMLElement;
const examplesList = document.getElementById("examplesList") as HTMLElement;
const synonymsSection = document.getElementById(
  "synonymsSection"
) as HTMLElement;
const synonymsText = document.getElementById("synonymsText") as HTMLElement;
const usageSection = document.getElementById("usageSection") as HTMLElement;
const usageText = document.getElementById("usageText") as HTMLElement;
const copyDefinitionBtn = document.getElementById(
  "copyDefinitionBtn"
) as HTMLButtonElement;

// 长难句分析结果（保留原有引用）
const sentenceStatus = document.getElementById("sentenceStatus") as HTMLElement;
const sentenceResultEl = document.getElementById(
  "sentenceResult"
) as HTMLElement;
const sentenceTranslation = document.getElementById(
  "sentenceTranslation"
) as HTMLElement;
const sentenceStructure = document.getElementById(
  "sentenceStructure"
) as HTMLElement;
const clausesSection = document.getElementById("clausesSection") as HTMLElement;
const sentenceClauses = document.getElementById(
  "sentenceClauses"
) as HTMLElement;
const sentenceKeyPhrases = document.getElementById(
  "sentenceKeyPhrases"
) as HTMLElement;
const sentenceGrammarPoints = document.getElementById(
  "sentenceGrammarPoints"
) as HTMLElement;
const sentenceSimplified = document.getElementById(
  "sentenceSimplified"
) as HTMLElement;

// 语音朗读
const speakSentenceBtn = document.getElementById(
  "speakSentenceBtn"
) as HTMLButtonElement;

// 录音练习
const recordSentenceBtn = document.getElementById(
  "recordSentenceBtn"
) as HTMLButtonElement;
const recordingStatus = document.getElementById(
  "recordingStatus"
) as HTMLElement;
const recordingTime = document.getElementById("recordingTime") as HTMLElement;
const recognitionPreview = document.getElementById(
  "recognitionPreview"
) as HTMLElement;
const recognitionText = document.getElementById(
  "recognitionText"
) as HTMLElement;
const pronunciationStatus = document.getElementById(
  "pronunciationStatus"
) as HTMLElement;

// 发音评估结果
const pronunciationResult = document.getElementById(
  "pronunciationResult"
) as HTMLElement;
const pronunciationScore = document.getElementById(
  "pronunciationScore"
) as HTMLElement;
const accuracyBar = document.getElementById("accuracyBar") as HTMLElement;
const accuracyValue = document.getElementById("accuracyValue") as HTMLElement;
const fluencyBar = document.getElementById("fluencyBar") as HTMLElement;
const fluencyValue = document.getElementById("fluencyValue") as HTMLElement;
const comparisonOriginal = document.getElementById(
  "comparisonOriginal"
) as HTMLElement;
const comparisonRecognized = document.getElementById(
  "comparisonRecognized"
) as HTMLElement;
const matchRate = document.getElementById("matchRate") as HTMLElement;
const issuesSection = document.getElementById("issuesSection") as HTMLElement;
const issuesList = document.getElementById("issuesList") as HTMLElement;
const suggestionsSection = document.getElementById(
  "suggestionsSection"
) as HTMLElement;
const encouragementText = document.getElementById(
  "encouragementText"
) as HTMLElement;
const speakFeedbackBtn = document.getElementById(
  "speakFeedbackBtn"
) as HTMLButtonElement;

// 自由练习结果
const freeRecognitionResult = document.getElementById(
  "freeRecognitionResult"
) as HTMLElement;
const freeRecognitionText = document.getElementById(
  "freeRecognitionText"
) as HTMLElement;

// ====== 影子跟读 DOM 元素 ======

// 耳机提示
const headphoneHint = document.getElementById("headphoneHint") as HTMLElement;
const headphoneHintDismiss = document.getElementById(
  "headphoneHintDismiss"
) as HTMLButtonElement;

// 影子跟读练习面板
const shadowPracticePanel = document.getElementById(
  "shadowPracticePanel"
) as HTMLElement;
const shadowModeSelector = document.getElementById(
  "shadowModeSelector"
) as HTMLElement;
const shadowSpeedSelect = document.getElementById(
  "shadowSpeedSelect"
) as HTMLSelectElement;
const shadowCurrentSentence = document.getElementById(
  "shadowCurrentSentence"
) as HTMLElement;
const shadowProgressText = document.getElementById(
  "shadowProgressText"
) as HTMLElement;
const shadowPlayBtn = document.getElementById(
  "shadowPlayBtn"
) as HTMLButtonElement;
const shadowRecordBtn = document.getElementById(
  "shadowRecordBtn"
) as HTMLButtonElement;
const shadowSkipBtn = document.getElementById(
  "shadowSkipBtn"
) as HTMLButtonElement;
const shadowRecordingStatus = document.getElementById(
  "shadowRecordingStatus"
) as HTMLElement;
const shadowRecordingTime = document.getElementById(
  "shadowRecordingTime"
) as HTMLElement;
const shadowRecognitionPreview = document.getElementById(
  "shadowRecognitionPreview"
) as HTMLElement;
const shadowRecognitionText = document.getElementById(
  "shadowRecognitionText"
) as HTMLElement;
const shadowStatus = document.getElementById("shadowStatus") as HTMLElement;

// 影子跟读评估结果
const shadowAssessResult = document.getElementById(
  "shadowAssessResult"
) as HTMLElement;
const shadowScore = document.getElementById("shadowScore") as HTMLElement;
const shadowAccuracyBar = document.getElementById(
  "shadowAccuracyBar"
) as HTMLElement;
const shadowAccuracyValue = document.getElementById(
  "shadowAccuracyValue"
) as HTMLElement;
const shadowFluencyBar = document.getElementById(
  "shadowFluencyBar"
) as HTMLElement;
const shadowFluencyValue = document.getElementById(
  "shadowFluencyValue"
) as HTMLElement;
const shadowIntonationBar = document.getElementById(
  "shadowIntonationBar"
) as HTMLElement;
const shadowIntonationValue = document.getElementById(
  "shadowIntonationValue"
) as HTMLElement;
const shadowRhythmBar = document.getElementById(
  "shadowRhythmBar"
) as HTMLElement;
const shadowRhythmValue = document.getElementById(
  "shadowRhythmValue"
) as HTMLElement;
const shadowComparisonOriginal = document.getElementById(
  "shadowComparisonOriginal"
) as HTMLElement;
const shadowComparisonRecognized = document.getElementById(
  "shadowComparisonRecognized"
) as HTMLElement;
const shadowMatchRate = document.getElementById(
  "shadowMatchRate"
) as HTMLElement;
const shadowIssuesSection = document.getElementById(
  "shadowIssuesSection"
) as HTMLElement;
const shadowIssuesList = document.getElementById(
  "shadowIssuesList"
) as HTMLElement;
const shadowSuggestionsSection = document.getElementById(
  "shadowSuggestionsSection"
) as HTMLElement;
const shadowSuggestionsList = document.getElementById(
  "shadowSuggestionsList"
) as HTMLElement;
const shadowEncouragementText = document.getElementById(
  "shadowEncouragementText"
) as HTMLElement;
const shadowRetryBtn = document.getElementById(
  "shadowRetryBtn"
) as HTMLButtonElement;
const shadowNextBtn = document.getElementById(
  "shadowNextBtn"
) as HTMLButtonElement;

// 影子跟读完成面板
const shadowCompletePanel = document.getElementById(
  "shadowCompletePanel"
) as HTMLElement;
const shadowCompleteStats = document.getElementById(
  "shadowCompleteStats"
) as HTMLElement;
const shadowRestartBtn = document.getElementById(
  "shadowRestartBtn"
) as HTMLButtonElement;

// ====== 回声法 DOM 元素 ======

const echoPlayModelBtn = document.getElementById(
  "echoPlayModel"
) as HTMLButtonElement;
const echoPlayUserBtn = document.getElementById(
  "echoPlayUser"
) as HTMLButtonElement;
const echoPlayABBtn = document.getElementById(
  "echoPlayAB"
) as HTMLButtonElement;
const echoPlayingStatus = document.getElementById(
  "echoPlayingStatus"
) as HTMLElement;
const echoStatusText = document.getElementById(
  "echoStatusText"
) as HTMLElement;

// ====== 录音相关状态 ======

let recognizer: ISpeechRecognizer | null = null;
let recordingTimer: number | null = null;
let recordingSeconds = 0;
const MAX_RECORDING_SECONDS = 60;
let lastPronunciationResult: PronunciationAssessmentResult | null = null;

// ====== Web Speech API 语音识别器 ======

/**
 * Web Speech API 语音识别器
 *
 * 实时识别，无需录音文件。
 */
class WebSpeechRecognizer implements ISpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private finalTranscript = "";
  private _isRecognizing = false;
  private lastConfidence = 0;

  onInterimResult?: (text: string) => void;
  onError?: (error: Error) => void;

  /**
   * 获取最后一次识别结果的置信度
   * @returns 置信度 0-1，低于 0.6 建议提示用户重试
   */
  getLastConfidence(): number {
    return this.lastConfidence;
  }

  async start(): Promise<void> {
    // 先清理之前的识别实例（解决重复录音问题）
    if (this.recognition) {
      try {
        this.recognition.onend = null; // 移除 onend 回调防止自动重启
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.stop();
      } catch (e) {
        // 忽略停止时的错误
      }
      this.recognition = null;
    }

    // 重置状态
    this._isRecognizing = false;
    this.finalTranscript = "";
    this.lastConfidence = 0;

    // 检查浏览器支持
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error("当前浏览器不支持语音识别，请使用 Chrome 浏览器");
    }

    // 先请求麦克风权限（触发浏览器权限对话框）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 获取权限后立即停止，只是为了触发权限请求
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          // 打开授权页面
          openMicrophoneAuthPage();
          throw new Error("需要麦克风权限，已打开授权页面");
        } else if (err.name === "NotFoundError") {
          throw new Error("未检测到麦克风设备，请检查麦克风连接");
        }
      }
      throw new Error(
        "无法访问麦克风：" +
          (err instanceof Error ? err.message : String(err))
      );
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3; // 获取多个候选结果，提高识别准确率

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // 获取置信度最高的候选结果
        let bestAlternative = result[0];
        let bestConfidence = result[0].confidence || 0;

        // 遍历所有候选，选择置信度最高的
        for (let j = 1; j < result.length; j++) {
          const altConfidence = result[j].confidence || 0;
          if (altConfidence > bestConfidence) {
            bestAlternative = result[j];
            bestConfidence = altConfidence;
          }
        }

        const transcript = bestAlternative.transcript;

        if (result.isFinal) {
          this.finalTranscript += transcript + " ";
          // 记录最终结果的置信度
          this.lastConfidence = bestConfidence;
          console.log(
            `[Lingride ASR] Final: "${transcript}" (confidence: ${(bestConfidence * 100).toFixed(1)}%)`
          );
        } else {
          interimTranscript += transcript;
        }
      }
      // 回调实时结果
      this.onInterimResult?.(this.finalTranscript + interimTranscript);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this._isRecognizing = false;
      const errorMap: Record<string, string> = {
        "no-speech": "未检测到语音，请对着麦克风说话",
        "audio-capture": "无法访问麦克风，请检查权限设置",
        "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许",
        network: "网络错误，语音识别需要网络连接",
      };
      const message = errorMap[event.error] || `语音识别错误: ${event.error}`;
      this.onError?.(new Error(message));
    };

    this.recognition.onend = () => {
      // 如果仍在录音状态但识别意外结束，尝试重启
      if (this._isRecognizing) {
        console.log("[Lingride Tutor] 语音识别意外结束，尝试重启...");
        try {
          this.recognition?.start();
        } catch (e) {
          console.error("[Lingride Tutor] 重启语音识别失败:", e);
          this._isRecognizing = false;
        }
      }
    };

    this.recognition.start();
    this._isRecognizing = true;
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;
    const result = this.finalTranscript.trim();

    if (this.recognition) {
      // 移除回调防止后续干扰
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
      try {
        this.recognition.stop();
      } catch (e) {
        // 忽略停止时的错误
      }
    }

    return result;
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }
}

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride Tutor] 外教标签页已加载");

  // 获取用户配置
  await loadUserConfig();

  // 绑定事件
  bindEvents();

  // 初始化 UI
  updateModeUI();
});

/**
 * 加载用户配置
 *
 * 获取用户 CEFR 水平，用于英英释义功能。
 */
async function loadUserConfig(): Promise<void> {
  try {
    const response: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });
    if (response.success && response.data) {
      // 保存完整配置
      userConfig = response.data as LingridConfig;

      if (response.data.user_english_level) {
        userLevel = response.data.user_english_level;
        console.log(`[Lingride Tutor] 用户水平: ${userLevel}`);
        updateLevelBadge(userLevel);
      }
    }
  } catch (error) {
    console.error("[Lingride Tutor] 获取用户配置失败:", error);
  }
}

/**
 * 创建语音识别器（工厂函数）
 *
 * 根据用户配置选择使用腾讯云 ASR、阿里云 ASR 或 Web Speech API。
 * 优先级：腾讯云 ASR > 阿里云 ASR > Web Speech API
 *
 * @param options 选项
 * @param options.onFallback 降级回调，当云服务失败时调用
 */
function createRecognizer(options?: {
  onFallback?: (reason: string) => void;
}): ISpeechRecognizer {
  // 优先级 1: 腾讯云 ASR
  if (userConfig && isTencentASRConfigured(userConfig)) {
    console.log("[Lingride Tutor] 使用腾讯云 ASR 识别器");
    const tencentRecognizer = new TencentASRRecognizer();

    // 包装错误处理，实现降级逻辑
    const originalOnError = tencentRecognizer.onError;
    tencentRecognizer.onError = (error: Error) => {
      console.warn("[Lingride Tutor] 腾讯云 ASR 失败，降级到 Web Speech API:", error.message);
      options?.onFallback?.(`腾讯云识别失败: ${error.message}，使用浏览器识别`);
      originalOnError?.(error);
    };

    return tencentRecognizer;
  }

  // 优先级 2: 阿里云 ASR
  if (userConfig && isAlibabaASRConfigured(userConfig)) {
    console.log("[Lingride Tutor] 使用阿里云 ASR 识别器");
    const alibabaRecognizer = new AlibabaASRRecognizer();

    // 包装错误处理，实现降级逻辑
    alibabaRecognizer.onError = (error: Error) => {
      console.warn("[Lingride Tutor] 阿里云 ASR 失败，降级到 Web Speech API:", error.message);
      options?.onFallback?.(`阿里云识别失败: ${error.message}，使用浏览器识别`);
    };

    return alibabaRecognizer;
  }

  // 优先级 3: Web Speech API（降级方案）
  console.log("[Lingride Tutor] 使用 Web Speech API 识别器");
  return new WebSpeechRecognizer();
}

// ====== Level Badge 等级选择 ======

/**
 * 切换下拉菜单显示状态
 */
function toggleLevelDropdown(e: Event): void {
  e.stopPropagation();
  const isOpen = levelDropdown.classList.contains("open");
  if (isOpen) {
    closeLevelDropdown();
  } else {
    openLevelDropdown();
  }
}

/**
 * 打开下拉菜单
 */
function openLevelDropdown(): void {
  levelDropdown.classList.add("open");
  levelBadge.classList.add("open");
}

/**
 * 关闭下拉菜单
 */
function closeLevelDropdown(): void {
  levelDropdown.classList.remove("open");
  levelBadge.classList.remove("open");
}

/**
 * 处理点击外部区域关闭下拉
 */
function handleOutsideClick(e: Event): void {
  if (!levelBadgeWrapper.contains(e.target as Node)) {
    closeLevelDropdown();
  }
}

/**
 * 处理等级选项点击
 */
async function handleLevelOptionClick(e: Event): Promise<void> {
  const target = (e.target as HTMLElement).closest(
    ".level-option"
  ) as HTMLElement;
  if (!target) return;

  const level = target.dataset.level as CEFRLevel;
  if (!level) return;

  // 更新 UI
  updateLevelBadge(level);
  closeLevelDropdown();

  // 更新本地状态
  userLevel = level;

  // 保存到配置
  try {
    const configResponse: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });
    if (configResponse.success && configResponse.data) {
      configResponse.data.user_english_level = level;
      await chrome.runtime.sendMessage({
        type: MessageType.SAVE_CONFIG,
        payload: configResponse.data,
      });
      console.log(`[Lingride Tutor] 用户水平已更新: ${level}`);
    }
  } catch (error) {
    console.error("[Lingride Tutor] 保存用户水平失败:", error);
  }
}

/**
 * 更新徽章和下拉选项的选中状态
 */
function updateLevelBadge(level: CEFRLevel): void {
  // 更新徽章文本
  levelBadge.textContent = `Lv.${level}`;

  // 更新下拉选项的 active 状态
  levelDropdown.querySelectorAll(".level-option").forEach((option) => {
    const optionLevel = (option as HTMLElement).dataset.level;
    option.classList.toggle("active", optionLevel === level);
  });
}

// ====== 事件绑定 ======

function bindEvents(): void {
  // Level Badge 下拉选择
  levelBadge.addEventListener("click", toggleLevelDropdown);
  levelDropdown.addEventListener("click", handleLevelOptionClick);
  document.addEventListener("click", handleOutsideClick);

  // 模式选择器（事件委托）
  modeSelector.addEventListener("click", handleModeClick);

  // 提交按钮
  submitBtn.addEventListener("click", handleSubmit);

  // 输入框
  sentenceInput.addEventListener("input", handleSentenceInput);

  // 复制按钮
  copyTranslationBtn?.addEventListener("click", () =>
    handleCopy(translationText.textContent || "", copyTranslationBtn)
  );
  copyDefinitionBtn?.addEventListener("click", () =>
    handleCopy(getDefinitionCopyText(), copyDefinitionBtn)
  );

  // 语音朗读
  speakSentenceBtn.addEventListener("click", handleSpeakSentence);

  // 录音练习
  recordSentenceBtn.addEventListener("click", handleRecordSentence);
  speakFeedbackBtn?.addEventListener("click", handleSpeakFeedback);

  // 页面关闭时停止朗读和录音
  window.addEventListener("beforeunload", () => {
    speechSynthesis.cancel();
    stopRecordingCleanup();
    shadow.resetPractice();
    echoMethod.reset();
    audioCapture.forceRelease();
  });

  // ====== 影子跟读事件 ======

  // 耳机提示关闭
  headphoneHintDismiss?.addEventListener("click", () => {
    headphoneHint.style.display = "none";
    localStorage.setItem("lingride_headphone_hint_dismissed", "true");
  });

  // 影子跟读模式选择
  shadowModeSelector?.addEventListener("click", handleShadowModeClick);

  // 语速选择
  shadowSpeedSelect?.addEventListener("change", handleShadowSpeedChange);

  // 范读按钮
  shadowPlayBtn?.addEventListener("click", handleShadowPlay);

  // 跟读录音按钮
  shadowRecordBtn?.addEventListener("click", handleShadowRecord);

  // 跳过按钮
  shadowSkipBtn?.addEventListener("click", handleShadowSkip);

  // 重新练习按钮
  shadowRetryBtn?.addEventListener("click", handleShadowRetry);

  // 下一句按钮
  shadowNextBtn?.addEventListener("click", handleShadowNext);

  // 重新开始按钮
  shadowRestartBtn?.addEventListener("click", handleShadowRestart);

  // 问题词点击（事件委托）
  shadowIssuesList?.addEventListener("click", handleShadowIssueClick);

  // 快捷键支持
  document.addEventListener("keydown", handleShadowKeydown);

  // ====== 回声法事件 ======

  // 回声法按钮
  echoPlayModelBtn?.addEventListener("click", handleEchoPlayModel);
  echoPlayUserBtn?.addEventListener("click", handleEchoPlayUser);
  echoPlayABBtn?.addEventListener("click", handleEchoPlayAB);

  // 设置回声法回调
  echoMethod.setCallbacks({
    onStateChange: handleEchoStateChange,
    onError: (error, message) => {
      console.error("[Lingride Tutor] 回声法错误:", error, message);
    },
  });
}

// ====== 模式切换 ======

/**
 * 处理模式按钮点击
 */
function handleModeClick(e: Event): void {
  const target = e.target as HTMLElement;
  if (!target.classList.contains("mode-btn")) return;

  const mode = target.dataset.mode as TutorMode;
  if (!mode || mode === currentMode) return;

  // 切换模式前重置影子跟读状态
  if (currentMode === "shadow") {
    shadow.resetPractice();
    hideShadowUI();
  }

  currentMode = mode;
  updateModeUI();
  clearAllResults();

  // 进入 shadow 模式时的特殊处理
  if (mode === "shadow") {
    initShadowMode();
  }
}

/**
 * 更新模式 UI
 *
 * 更新模式按钮样式、placeholder 和提交按钮文本。
 */
function updateModeUI(): void {
  // 更新模式按钮样式
  modeSelector.querySelectorAll(".mode-btn").forEach((btn) => {
    const btnMode = (btn as HTMLElement).dataset.mode;
    btn.classList.toggle("active", btnMode === currentMode);
  });

  // 更新 placeholder 和按钮文本
  const config = MODE_CONFIG[currentMode];
  sentenceInput.placeholder = config.placeholder;
  submitBtn.textContent = config.btnText;
}

/**
 * 清除所有结果区域
 */
function clearAllResults(): void {
  // 隐藏所有结果区域
  translationResult.style.display = "none";
  definitionResult.style.display = "none";
  sentenceResultEl.style.display = "none";
  pronunciationResult.style.display = "none";
  freeRecognitionResult.style.display = "none";

  // 清除状态消息
  sentenceStatus.style.display = "none";
  pronunciationStatus.style.display = "none";

  // 隐藏影子跟读相关区域（但不隐藏练习面板）
  shadowAssessResult.style.display = "none";
  shadowCompletePanel.style.display = "none";
  shadowStatus.style.display = "none";
}

// ====== 统一提交处理 ======

/**
 * 处理提交按钮点击
 */
async function handleSubmit(): Promise<void> {
  const text = sentenceInput.value.trim();
  if (!text) return;

  // 停止正在进行的朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
  }

  // 根据当前模式调用对应的处理函数
  switch (currentMode) {
    case "cn2en":
      await handleChineseToEnglish(text);
      break;
    case "en2cn":
      await handleEnglishToChinese(text);
      break;
    case "definition":
      await handleEnglishDefinition(text);
      break;
    case "analyze":
      await handleAnalyzeSentence();
      break;
    case "shadow":
      await handleStartShadowPractice(text);
      break;
  }
}

// ====== 中译英 ======

/**
 * 处理中译英
 */
async function handleChineseToEnglish(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "翻译中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在翻译...", "loading");

  try {
    const response: ChineseToEnglishResponse = await chrome.runtime.sendMessage(
      {
        type: MessageType.CHINESE_TO_ENGLISH,
        payload: { text },
      }
    );

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderTranslationResult(response.data.translation);
    } else {
      showStatus(sentenceStatus, response.error || "翻译失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 中译英失败:", error);
    showStatus(sentenceStatus, "翻译请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

// ====== 英译中 ======

/**
 * 处理英译中
 */
async function handleEnglishToChinese(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "翻译中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在翻译...", "loading");

  try {
    const response: EnglishToChineseResponse = await chrome.runtime.sendMessage(
      {
        type: MessageType.ENGLISH_TO_CHINESE,
        payload: { text },
      }
    );

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderTranslationResult(response.data.translation);
    } else {
      showStatus(sentenceStatus, response.error || "翻译失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 英译中失败:", error);
    showStatus(sentenceStatus, "翻译请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

/**
 * 渲染翻译结果
 */
function renderTranslationResult(translation: string): void {
  translationText.textContent = translation;
  translationResult.style.display = "block";
}

// ====== 英英释义 ======

/**
 * 处理英英释义
 */
async function handleEnglishDefinition(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "释义中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在获取释义...", "loading");

  try {
    const response: EnglishDefinitionResponse =
      await chrome.runtime.sendMessage({
        type: MessageType.ENGLISH_DEFINITION,
        payload: { text, userLevel },
      });

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderDefinitionResult(response.data);
    } else {
      showStatus(sentenceStatus, response.error || "获取释义失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 英英释义失败:", error);
    showStatus(sentenceStatus, "释义请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

/**
 * 渲染英英释义结果
 */
function renderDefinitionResult(
  data: EnglishDefinitionResponse["data"]
): void {
  if (!data) return;

  // 释义
  definitionText.textContent = data.definition;

  // 例句
  if (data.examples && data.examples.length > 0) {
    examplesList.innerHTML = data.examples
      .map((ex) => `<li>${ex}</li>`)
      .join("");
    examplesSection.style.display = "block";
  } else {
    examplesSection.style.display = "none";
  }

  // 同义词
  if (data.synonyms && data.synonyms.length > 0) {
    synonymsText.textContent = data.synonyms.join(", ");
    synonymsSection.style.display = "block";
  } else {
    synonymsSection.style.display = "none";
  }

  // 用法说明
  if (data.usageNotes) {
    usageText.textContent = data.usageNotes;
    usageSection.style.display = "block";
  } else {
    usageSection.style.display = "none";
  }

  definitionResult.style.display = "block";
}

/**
 * 获取英英释义的复制文本
 */
function getDefinitionCopyText(): string {
  const parts = [definitionText.textContent || ""];

  if (examplesSection.style.display !== "none") {
    const examples = Array.from(examplesList.querySelectorAll("li"))
      .map((li) => `• ${li.textContent}`)
      .join("\n");
    parts.push(`\nExamples:\n${examples}`);
  }

  if (synonymsSection.style.display !== "none") {
    parts.push(`\nSynonyms: ${synonymsText.textContent}`);
  }

  if (usageSection.style.display !== "none") {
    parts.push(`\nUsage: ${usageText.textContent}`);
  }

  return parts.join("");
}

// ====== 复制功能 ======

/**
 * 处理复制
 */
async function handleCopy(
  text: string,
  button: HTMLButtonElement
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    button.classList.add("copied");
    setTimeout(() => button.classList.remove("copied"), 1500);
  } catch (error) {
    console.error("[Lingride Tutor] 复制失败:", error);
  }
}

// ====== 长难句分析 ======

// ====== 输入处理 ======

/**
 * 处理输入框的 input 事件
 *
 * 更新字符计数器和按钮 disabled 状态。
 */
function handleSentenceInput(): void {
  const length = sentenceInput.value.length;
  sentenceCharCount.textContent = `${length}/500`;
  submitBtn.disabled = length === 0;
  speakSentenceBtn.disabled = length === 0;

  // 输入内容修改时停止正在进行的朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
  }
}

/**
 * 处理语音朗读
 *
 * 使用浏览器原生 Web Speech API (speechSynthesis) 朗读输入框中的英文内容。
 * 点击切换：未朗读 → 开始朗读；朗读中 → 停止朗读。
 */
function handleSpeakSentence(): void {
  // 如果正在朗读，则停止
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
    return;
  }

  const text = sentenceInput.value.trim();
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9; // 略慢，适合学习者

  utterance.onstart = () => speakSentenceBtn.classList.add("speaking");
  utterance.onend = () => speakSentenceBtn.classList.remove("speaking");
  utterance.onerror = () => speakSentenceBtn.classList.remove("speaking");

  speechSynthesis.speak(utterance);
}

/**
 * 处理长难句分析
 *
 * 空输入校验 -> 禁用按钮 + 显示"分析中..." -> 发送消息 -> 处理结果 -> 恢复按钮
 */
async function handleAnalyzeSentence(): Promise<void> {
  const sentence = sentenceInput.value.trim();
  if (!sentence) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "分析中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在分析句子结构...", "loading");

  try {
    const response: AnalyzeSentenceResponse = await chrome.runtime.sendMessage({
      type: MessageType.ANALYZE_SENTENCE,
      payload: { sentence },
    });

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderSentenceAnalysisResult(response.data);
    } else {
      showStatus(sentenceStatus, response.error || "分析失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 长难句分析失败:", error);
    showStatus(sentenceStatus, "分析请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

/**
 * 渲染长难句分析结果
 */
function renderSentenceAnalysisResult(result: SentenceAnalysisResult): void {
  sentenceResultEl.style.display = "block";

  // 翻译
  sentenceTranslation.textContent = result.translation;

  // 主干结构（彩色标签）
  sentenceStructure.innerHTML = "";
  const structureParts: Array<{ label: string; value: string; cls: string }> = [
    { label: "S", value: result.structure.subject, cls: "tag-subject" },
    { label: "V", value: result.structure.predicate, cls: "tag-predicate" },
  ];
  if (result.structure.object) {
    structureParts.push({
      label: "O",
      value: result.structure.object,
      cls: "tag-object",
    });
  }
  if (result.structure.complement) {
    structureParts.push({
      label: "C",
      value: result.structure.complement,
      cls: "tag-complement",
    });
  }
  for (const part of structureParts) {
    const tag = document.createElement("div");
    tag.className = `structure-tag ${part.cls}`;
    tag.innerHTML = `<span class="tag-label">${part.label}</span><span class="tag-value">${part.value}</span>`;
    sentenceStructure.appendChild(tag);
  }

  // 从句拆解（有从句时显示，无从句时隐藏）
  if (result.clauses && result.clauses.length > 0) {
    clausesSection.style.display = "block";
    sentenceClauses.innerHTML = "";
    for (const clause of result.clauses) {
      const item = document.createElement("div");
      item.className = "clause-item";
      item.innerHTML = `<span class="clause-type">${clause.type}</span><p class="clause-content">${clause.content}</p><p class="clause-function">${clause.function}</p>`;
      sentenceClauses.appendChild(item);
    }
  } else {
    clausesSection.style.display = "none";
  }

  // 重点短语
  sentenceKeyPhrases.innerHTML = "";
  if (result.keyPhrases) {
    for (const kp of result.keyPhrases) {
      const item = document.createElement("div");
      item.className = "phrase-item";
      item.innerHTML = `<span class="phrase-text">${kp.phrase}</span><span class="phrase-meaning">${kp.meaning}</span>`;
      sentenceKeyPhrases.appendChild(item);
    }
  }

  // 语法要点
  sentenceGrammarPoints.innerHTML = "";
  if (result.grammarPoints) {
    for (const point of result.grammarPoints) {
      const li = document.createElement("li");
      li.textContent = point;
      sentenceGrammarPoints.appendChild(li);
    }
  }

  // 简化改写
  sentenceSimplified.textContent = result.simplifiedVersion;
}

// ====== 辅助函数 ======

function showStatus(
  element: HTMLElement,
  message: string,
  type: "success" | "error" | "loading" | "warning"
): void {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = "block";

  if (type === "success" || type === "warning") {
    setTimeout(() => {
      element.style.display = "none";
    }, 3000);
  }
}

// ====== 录音练习功能 ======

/**
 * 打开麦克风授权页面
 *
 * 在新标签页中打开专门的授权页面，让用户为扩展授权麦克风。
 */
function openMicrophoneAuthPage(): void {
  const authPageUrl = chrome.runtime.getURL("src/permissions/permissions.html");
  chrome.tabs.create({ url: authPageUrl });
}

/**
 * 停止录音时的清理函数（供异常或页面关闭时调用）
 */
function stopRecordingCleanup(): void {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  recognizer?.stop();
  recognizer = null;
  recordingSeconds = 0;
}

/**
 * 处理录音按钮点击
 *
 * 点击切换：未录音 → 开始录音；录音中 → 停止并处理。
 */
async function handleRecordSentence(): Promise<void> {
  // 如果正在录音，停止并处理
  if (recognizer?.isRecognizing()) {
    await stopRecordingAndProcess();
    return;
  }

  // 开始录音
  await startRecording();
}

/**
 * 开始录音
 */
async function startRecording(): Promise<void> {
  try {
    // 隐藏之前的结果
    pronunciationResult.style.display = "none";
    freeRecognitionResult.style.display = "none";
    pronunciationStatus.style.display = "none";

    // 初始化识别器（根据配置选择腾讯云或 Web Speech API）
    recognizer = createRecognizer({
      onFallback: (reason) => {
        showStatus(pronunciationStatus, reason, "warning");
      },
    });
    recognizer.onInterimResult = (text) => {
      updateRecognitionPreview(text);
    };
    recognizer.onError = (error) => {
      stopRecordingUI();
      showStatus(pronunciationStatus, error.message, "error");
    };

    await recognizer.start();

    // 更新 UI 状态
    startRecordingUI();

    // 启动计时器
    recordingSeconds = 0;
    updateRecordingTime(0);
    recordingTimer = window.setInterval(() => {
      recordingSeconds++;
      updateRecordingTime(recordingSeconds);

      // 自动停止（超时保护）
      if (recordingSeconds >= MAX_RECORDING_SECONDS) {
        showStatus(
          pronunciationStatus,
          "录音已达最大时长，自动停止",
          "loading"
        );
        stopRecordingAndProcess();
      }
    }, 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "录音启动失败";
    showStatus(pronunciationStatus, message, "error");
  }
}

/**
 * 停止录音并处理结果
 */
async function stopRecordingAndProcess(): Promise<void> {
  // 防止重复点击：立即禁用按钮
  recordSentenceBtn.disabled = true;

  // 清理计时器
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  // 获取识别结果
  const recognizedText = (await recognizer?.stop()) || "";
  stopRecordingUI();

  // 检查录音时长
  if (recordingSeconds < 1) {
    showStatus(pronunciationStatus, "录音时间太短，请至少说 1 秒", "error");
    recordSentenceBtn.disabled = false;
    return;
  }

  // 检查识别结果
  if (!recognizedText) {
    showStatus(pronunciationStatus, "未识别到语音内容，请重试", "error");
    recordSentenceBtn.disabled = false;
    return;
  }

  const originalText = sentenceInput.value.trim();

  if (originalText) {
    // 模式 A：对照练习 - 调用 AI 评估
    await assessPronunciation(originalText, recognizedText);
  } else {
    // 模式 B：自由练习 - 仅显示识别结果
    showFreeRecognitionResult(recognizedText);
  }

  recordSentenceBtn.disabled = false;
}

/**
 * 格式化时间显示（MM:SS）
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 更新录音时间显示
 */
function updateRecordingTime(seconds: number): void {
  recordingTime.textContent = formatTime(seconds);
}

/**
 * 更新实时识别预览
 */
function updateRecognitionPreview(text: string): void {
  if (text) {
    recognitionPreview.style.display = "block";
    recognitionText.textContent = text;
  } else {
    recognitionPreview.style.display = "none";
  }
}

/**
 * 开始录音时的 UI 更新
 */
function startRecordingUI(): void {
  recordSentenceBtn.classList.add("recording");
  recordSentenceBtn.classList.remove("processing");
  recordingStatus.style.display = "flex";
  recognitionPreview.style.display = "none";
}

/**
 * 停止录音时的 UI 更新
 */
function stopRecordingUI(): void {
  recordSentenceBtn.classList.remove("recording");
  recordingStatus.style.display = "none";
  recognitionPreview.style.display = "none";
}

/**
 * 调用 AI 进行发音评估
 */
async function assessPronunciation(
  original: string,
  recognized: string
): Promise<void> {
  recordSentenceBtn.classList.add("processing");
  showStatus(pronunciationStatus, "正在评估发音...", "loading");

  try {
    const response: AssessPronunciationResponse =
      await chrome.runtime.sendMessage({
        type: MessageType.ASSESS_PRONUNCIATION,
        payload: { original, recognized },
      });

    if (response.success && response.data) {
      pronunciationStatus.style.display = "none";
      lastPronunciationResult = response.data;
      renderPronunciationResult(response.data);
    } else {
      showStatus(
        pronunciationStatus,
        response.error || "评估失败，请重试",
        "error"
      );
      // 降级：仍显示识别结果
      showFreeRecognitionResult(recognized);
    }
  } catch (error) {
    console.error("[Lingride Tutor] 发音评估失败:", error);
    showStatus(pronunciationStatus, "评估请求失败", "error");
    // 降级：仍显示识别结果
    showFreeRecognitionResult(recognized);
  } finally {
    recordSentenceBtn.classList.remove("processing");
  }
}

/**
 * 渲染发音评估结果
 */
function renderPronunciationResult(
  result: PronunciationAssessmentResult
): void {
  pronunciationResult.style.display = "block";
  freeRecognitionResult.style.display = "none";

  // 评分
  pronunciationScore.textContent = result.score.toString();
  pronunciationScore.className = `score-value-large ${getScoreClass(result.score)}`;

  // 准确度和流利度条
  accuracyBar.style.width = `${result.accuracy}%`;
  accuracyValue.textContent = result.accuracy.toString();
  fluencyBar.style.width = `${result.fluency}%`;
  fluencyValue.textContent = result.fluency.toString();

  // 文本对比
  comparisonOriginal.textContent = result.comparison.original;
  comparisonRecognized.textContent = result.comparison.recognized;
  matchRate.textContent = `${Math.round(result.comparison.matchRate * 100)}%`;

  // 问题列表
  if (result.issues && result.issues.length > 0) {
    issuesSection.style.display = "block";
    issuesList.innerHTML = "";
    for (const issue of result.issues) {
      const item = document.createElement("div");
      item.className = `issue-item ${issue.severity}`;
      item.innerHTML = `
        <div class="issue-word">${issue.word}</div>
        <div class="issue-desc">${issue.issue}</div>
        <div class="issue-correction">${issue.correction}</div>
      `;
      issuesList.appendChild(item);
    }
  } else {
    issuesSection.style.display = "none";
  }

  // 改进建议
  const pronSuggestionsList = document.getElementById(
    "pronunciationSuggestionsList"
  ) as HTMLElement;
  if (result.suggestions && result.suggestions.length > 0) {
    suggestionsSection.style.display = "block";
    if (pronSuggestionsList) {
      pronSuggestionsList.innerHTML = "";
      for (const suggestion of result.suggestions) {
        const li = document.createElement("li");
        li.textContent = suggestion;
        pronSuggestionsList.appendChild(li);
      }
    }
  } else {
    suggestionsSection.style.display = "none";
  }

  // 鼓励语
  encouragementText.textContent = result.encouragement;
}

/**
 * 获取评分对应的 CSS 类名
 */
function getScoreClass(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * 显示自由练习结果（无原文时）
 */
function showFreeRecognitionResult(text: string): void {
  pronunciationResult.style.display = "none";
  freeRecognitionResult.style.display = "block";
  freeRecognitionText.textContent = text;
}

/**
 * 处理示范发音按钮点击
 *
 * 挑选最需要改进的单词，用英语语音示范两遍，帮助用户针对性练习。
 * - 有问题时：示范 severity 最高的问题单词
 * - 无问题时：说一句英语鼓励语
 */
function handleSpeakFeedback(): void {
  if (!lastPronunciationResult) return;

  // 如果正在朗读，则停止
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }

  // 找到最需要改进的单词（按 severity 排序）
  const issues = lastPronunciationResult.issues || [];
  const severityOrder: Record<string, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  };
  const sorted = [...issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  if (sorted.length > 0) {
    // 有问题：示范问题单词两遍
    speakWordTwice(sorted[0].word);
  } else {
    // 无问题：说一句英语鼓励语
    speakEncouragement();
  }
}

/**
 * 用英语语音示范单词两遍
 *
 * 慢速朗读，两遍之间间隔 500ms，便于用户跟读学习。
 */
function speakWordTwice(word: string): void {
  const utterance1 = new SpeechSynthesisUtterance(word);
  utterance1.lang = "en-US";
  utterance1.rate = 0.8; // 稍慢，便于学习

  const utterance2 = new SpeechSynthesisUtterance(word);
  utterance2.lang = "en-US";
  utterance2.rate = 0.8;

  // 第一遍结束后，稍等再读第二遍
  utterance1.onend = () => {
    setTimeout(() => {
      speechSynthesis.speak(utterance2);
    }, 500); // 500ms 间隔
  };

  speechSynthesis.speak(utterance1);
}

/**
 * 说一句英语鼓励语
 *
 * 用于发音完美时给予正面反馈。
 */
function speakEncouragement(): void {
  const utterance = new SpeechSynthesisUtterance("Perfect! Great job!");
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
}

// ====== 影子跟读功能 ======

/**
 * 初始化影子跟读模式
 *
 * 设置 shadow 模块的依赖注入和回调。
 */
function initShadowMode(): void {
  // 检查是否需要显示耳机提示
  const isDismissed = localStorage.getItem("lingride_headphone_hint_dismissed");
  if (!isDismissed) {
    headphoneHint.style.display = "flex";
  }

  // 创建并注入语音识别器（根据配置选择腾讯云或 Web Speech API）
  const shadowRecognizer = createRecognizer({
    onFallback: (reason) => {
      // 显示降级提示
      showStatus(shadowStatus, reason, "warning");
    },
  });
  shadow.injectRecognizer(shadowRecognizer);

  // 设置回调
  shadow.setOnInterimResult((text) => {
    shadowRecognitionPreview.style.display = "block";
    shadowRecognitionText.textContent = text;
  });

  shadow.setOnRecordingTime((seconds) => {
    shadowRecordingTime.textContent = formatTime(seconds);
  });

  shadow.setOnError((error) => {
    showStatus(shadowStatus, error.message, "error");
    stopShadowRecordingUI();
  });

  // 加载保存的配置
  loadShadowConfig();

  console.log("[Lingride Tutor] 影子跟读模式已初始化");
}

/**
 * 加载保存的影子跟读配置
 */
function loadShadowConfig(): void {
  const savedMode = localStorage.getItem("lingride_shadow_mode") as ShadowMode;
  const savedSpeed = localStorage.getItem("lingride_shadow_speed");

  if (savedMode) {
    shadow.setMode(savedMode);
    updateShadowModeBtns(savedMode);
  }

  if (savedSpeed) {
    const speed = parseFloat(savedSpeed) as ShadowSpeed;
    shadow.setSpeed(speed);
    shadowSpeedSelect.value = savedSpeed;
  }
}

/**
 * 隐藏影子跟读 UI
 */
function hideShadowUI(): void {
  // 重置回声法
  echoMethod.reset();

  headphoneHint.style.display = "none";
  shadowPracticePanel.style.display = "none";
  shadowAssessResult.style.display = "none";
  shadowCompletePanel.style.display = "none";
  shadowRecordingStatus.style.display = "none";
  shadowRecognitionPreview.style.display = "none";
  shadowStatus.style.display = "none";
  echoPlayingStatus.style.display = "none";
}

/**
 * 开始影子跟读练习
 */
async function handleStartShadowPractice(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "分句中...";
  clearAllResults();
  showStatus(shadowStatus, "正在智能分句...", "loading");

  try {
    const sentences = await shadow.initShadowPractice(text);

    if (sentences.length === 0) {
      showStatus(shadowStatus, "未能识别出有效句子", "error");
      return;
    }

    shadowStatus.style.display = "none";

    // 显示练习面板
    shadowPracticePanel.style.display = "block";

    // 启用操作按钮
    shadowPlayBtn.disabled = false;
    shadowRecordBtn.disabled = false;
    shadowSkipBtn.disabled = false;

    // 更新 UI
    updateShadowSentenceUI();

    console.log(`[Lingride Tutor] 影子跟读已启动: ${sentences.length} 句`);
  } catch (error) {
    console.error("[Lingride Tutor] 启动影子跟读失败:", error);
    showStatus(
      shadowStatus,
      error instanceof Error ? error.message : "启动失败，请重试",
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG.shadow.btnText;
  }
}

/**
 * 更新影子跟读句子 UI
 *
 * 显示当前练习句子和进度（如：句子 1/5）。
 */
function updateShadowSentenceUI(): void {
  const sentence = shadow.getCurrentSentence();
  const progress = shadow.getProgress();

  if (sentence) {
    shadowCurrentSentence.textContent = sentence.text;
    shadowProgressText.textContent = `句子 ${progress.current + 1}/${progress.total}`;
  } else {
    shadowCurrentSentence.textContent = "暂无句子";
    shadowProgressText.textContent = "句子 0/0";
  }
}

/**
 * 更新影子跟读模式按钮状态
 *
 * 高亮当前选中的模式按钮（逐句/影子/同步）。
 */
function updateShadowModeBtns(mode: ShadowMode): void {
  shadowModeSelector.querySelectorAll(".shadow-mode-btn").forEach((btn) => {
    const btnMode = (btn as HTMLElement).dataset.shadowMode;
    btn.classList.toggle("active", btnMode === mode);
  });
}

/**
 * 处理影子跟读模式选择
 */
function handleShadowModeClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(
    ".shadow-mode-btn"
  ) as HTMLElement;
  if (!target) return;

  const mode = target.dataset.shadowMode as ShadowMode;
  if (!mode) return;

  shadow.setMode(mode);
  updateShadowModeBtns(mode);
  localStorage.setItem("lingride_shadow_mode", mode);

  // 影子/同步模式下显示耳机提示
  const isDismissed = localStorage.getItem("lingride_headphone_hint_dismissed");
  if (!isDismissed && (mode === "shadow" || mode === "sync")) {
    headphoneHint.style.display = "flex";
  }
}

/**
 * 处理语速选择
 */
function handleShadowSpeedChange(): void {
  const speed = parseFloat(shadowSpeedSelect.value) as ShadowSpeed;
  shadow.setSpeed(speed);
  localStorage.setItem("lingride_shadow_speed", shadowSpeedSelect.value);
}

/**
 * 处理范读按钮点击
 */
function handleShadowPlay(): void {
  // 如果正在播放，则停止
  if (shadowPlayBtn.classList.contains("playing")) {
    shadow.stopModelReading();
    shadowPlayBtn.classList.remove("playing");
    return;
  }

  // 开始范读
  shadowPlayBtn.classList.add("playing");
  shadow.playModelReading(
    () => {
      // 范读结束
      shadowPlayBtn.classList.remove("playing");

      // 影子模式：延迟后自动开始录音
      const config = shadow.getConfig();
      if (config.mode === "shadow" || config.mode === "sync") {
        const delay = shadow.getRecordingDelay();
        setTimeout(() => {
          if (!shadow.isRecording()) {
            handleShadowRecord();
          }
        }, delay);
      }
    },
    () => {
      // 同步模式：范读开始时同时开始录音
      const config = shadow.getConfig();
      if (config.mode === "sync" && !shadow.isRecording()) {
        handleShadowRecord();
      }
    }
  );
}

/**
 * 处理跟读录音按钮点击
 */
async function handleShadowRecord(): Promise<void> {
  // 如果正在录音，则停止并评估
  if (shadow.isRecording()) {
    await stopAndAssessShadow();
    return;
  }

  // 开始录音
  try {
    startShadowRecordingUI();

    // 1. 获取共享的 MediaStream
    const stream = await audioCapture.acquireStream();

    // 2. 启动回声法录音（如果支持）
    if (echoMethod.isSupported()) {
      await echoMethod.startRecording(stream);
    }

    // 3. 启动语音识别
    await shadow.startShadowRecording();
  } catch (error) {
    console.error("[Lingride Tutor] 影子跟读录音失败:", error);
    showStatus(
      shadowStatus,
      error instanceof Error ? error.message : "录音失败，请重试",
      "error"
    );
    stopShadowRecordingUI();

    // 清理资源
    if (echoMethod.getState().isRecording) {
      await echoMethod.stopRecording();
    }
    audioCapture.releaseStream();
  }
}

/**
 * 开始录音 UI 状态
 *
 * 显示录音指示器，禁用范读和跳过按钮，清空识别预览。
 */
function startShadowRecordingUI(): void {
  shadowRecordBtn.classList.add("recording");
  shadowRecordingStatus.style.display = "flex";
  shadowRecognitionPreview.style.display = "none";
  shadowRecognitionText.textContent = "";
  shadowStatus.style.display = "none";

  // 禁用其他按钮
  shadowPlayBtn.disabled = true;
  shadowSkipBtn.disabled = true;
}

/**
 * 停止录音 UI 状态
 *
 * 隐藏录音指示器，恢复范读和跳过按钮。
 */
function stopShadowRecordingUI(): void {
  shadowRecordBtn.classList.remove("recording");
  shadowRecordingStatus.style.display = "none";

  // 恢复按钮状态
  shadowPlayBtn.disabled = false;
  shadowSkipBtn.disabled = false;
}

/**
 * 停止录音并进行评估
 */
async function stopAndAssessShadow(): Promise<void> {
  stopShadowRecordingUI();
  showStatus(shadowStatus, "正在评估...", "loading");

  try {
    // 1. 停止回声法录音
    if (echoMethod.getState().isRecording) {
      await echoMethod.stopRecording();
    }

    // 2. 停止语音识别并获取评估结果
    const result = await shadow.stopAndAssess();

    // 3. 释放 MediaStream
    audioCapture.releaseStream();

    shadowStatus.style.display = "none";
    shadowRecognitionPreview.style.display = "none";

    // 4. 渲染评估结果（包含回声法面板）
    renderShadowAssessResult(result);
    updateEchoMethodUI();
  } catch (error) {
    console.error("[Lingride Tutor] 影子跟读评估失败:", error);
    showStatus(
      shadowStatus,
      error instanceof Error ? error.message : "评估失败，请重试",
      "error"
    );

    // 清理资源
    audioCapture.releaseStream();
  }
}

/**
 * 渲染影子跟读评估结果
 *
 * 显示四维度评分（准确度、流利度、语调、节奏）、文本对比、
 * 问题列表（可点击听示范）、改进建议和鼓励语。
 */
function renderShadowAssessResult(result: ShadowAssessmentResult): void {
  shadowAssessResult.style.display = "block";
  shadowPracticePanel.style.display = "none";

  // 评分
  shadowScore.textContent = result.score.toString();
  shadowScore.className = `score-value-large ${getScoreClass(result.score)}`;

  // 准确度、流利度、语调、节奏条
  shadowAccuracyBar.style.width = `${result.accuracy}%`;
  shadowAccuracyValue.textContent = result.accuracy.toString();
  shadowFluencyBar.style.width = `${result.fluency}%`;
  shadowFluencyValue.textContent = result.fluency.toString();
  shadowIntonationBar.style.width = `${result.intonation}%`;
  shadowIntonationValue.textContent = result.intonation.toString();
  shadowRhythmBar.style.width = `${result.rhythm}%`;
  shadowRhythmValue.textContent = result.rhythm.toString();

  // 文本对比
  shadowComparisonOriginal.textContent = result.comparison.original;
  shadowComparisonRecognized.textContent = result.comparison.recognized;
  shadowMatchRate.textContent = `${Math.round(result.comparison.matchRate * 100)}%`;

  // 问题列表
  if (result.issues && result.issues.length > 0) {
    shadowIssuesSection.style.display = "block";
    shadowIssuesList.innerHTML = "";
    for (const issue of result.issues) {
      const item = document.createElement("div");
      item.className = `issue-item ${issue.severity}`;
      item.innerHTML = `
        <button class="issue-word-btn" data-word="${issue.word}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          ${issue.word}
        </button>
        <div class="issue-desc">${issue.issue}</div>
        <div class="issue-correction">${issue.correction}</div>
      `;
      shadowIssuesList.appendChild(item);
    }
  } else {
    shadowIssuesSection.style.display = "none";
  }

  // 改进建议
  if (result.suggestions && result.suggestions.length > 0) {
    shadowSuggestionsSection.style.display = "block";
    shadowSuggestionsList.innerHTML = "";
    for (const suggestion of result.suggestions) {
      const li = document.createElement("li");
      li.textContent = suggestion;
      shadowSuggestionsList.appendChild(li);
    }
  } else {
    shadowSuggestionsSection.style.display = "none";
  }

  // 鼓励语
  shadowEncouragementText.textContent = result.encouragement;
}

/**
 * 处理跳过按钮点击
 */
function handleShadowSkip(): void {
  // 切换句子时清理回声法录音
  echoMethod.clearRecording();

  if (shadow.nextSentence()) {
    updateShadowSentenceUI();
    clearAllResults();
  } else {
    showShadowComplete();
  }
}

/**
 * 处理重新练习按钮点击
 *
 * 保留旧录音，用户可能想对比前后两次录音。
 * 新录音开始后旧录音会被覆盖。
 */
function handleShadowRetry(): void {
  // 停止当前播放（如果有）
  echoMethod.stopPlayback();

  shadow.retryCurrent();
  shadowAssessResult.style.display = "none";
  shadowPracticePanel.style.display = "block";
  updateShadowSentenceUI();
}

/**
 * 处理下一句按钮点击
 */
function handleShadowNext(): void {
  // 切换句子时清理回声法录音
  echoMethod.clearRecording();

  if (shadow.nextSentence()) {
    shadowAssessResult.style.display = "none";
    shadowPracticePanel.style.display = "block";
    updateShadowSentenceUI();
  } else {
    showShadowComplete();
  }
}

/**
 * 显示练习完成面板
 *
 * 隐藏评估和练习面板，显示完成统计（完成句数、平均得分）。
 */
function showShadowComplete(): void {
  // 清理回声法
  echoMethod.clearRecording();

  shadowAssessResult.style.display = "none";
  shadowPracticePanel.style.display = "none";
  shadowCompletePanel.style.display = "block";

  const progress = shadow.getProgress();
  const avgScore = shadow.getAverageScore();
  shadowCompleteStats.textContent = `共完成 ${progress.completedCount} 句，平均得分 ${avgScore} 分`;
}

/**
 * 处理重新开始按钮点击
 */
function handleShadowRestart(): void {
  shadow.resetPractice();
  echoMethod.reset();

  shadowCompletePanel.style.display = "none";
  shadowPracticePanel.style.display = "none";

  // 重置输入框
  sentenceInput.value = "";
  handleSentenceInput();
}

/**
 * 处理问题词点击
 */
function handleShadowIssueClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(
    ".issue-word-btn"
  ) as HTMLElement;
  if (!target) return;

  const word = target.dataset.word;
  if (word) {
    shadow.speakProblemWord(word);
  }
}

/**
 * 处理影子跟读快捷键
 */
function handleShadowKeydown(e: KeyboardEvent): void {
  // 仅在 shadow 模式且不在输入框中时生效
  if (currentMode !== "shadow") return;
  if (document.activeElement === sentenceInput) return;

  switch (e.code) {
    case "Space":
      e.preventDefault();
      if (!shadowRecordBtn.disabled) {
        handleShadowRecord();
      }
      break;
    case "Enter":
      e.preventDefault();
      if (!shadowPlayBtn.disabled) {
        handleShadowPlay();
      }
      break;
    case "Tab":
      e.preventDefault();
      if (!shadowSkipBtn.disabled) {
        handleShadowSkip();
      }
      break;
    case "KeyR":
      e.preventDefault();
      if (shadowAssessResult.style.display !== "none") {
        handleShadowRetry();
      }
      break;
    case "KeyE":
      // E 键播放自己的录音
      e.preventDefault();
      if (
        shadowAssessResult.style.display !== "none" &&
        !echoPlayUserBtn.disabled
      ) {
        handleEchoPlayUser();
      }
      break;
  }
}

// ====== 回声法处理函数 ======

/**
 * 处理回声法"听范读"按钮点击
 */
async function handleEchoPlayModel(): Promise<void> {
  const sentence = shadow.getCurrentSentence();
  if (!sentence) return;

  const config = shadow.getConfig();

  try {
    // 停止当前播放（如果有）
    echoMethod.stopPlayback();

    await echoMethod.playModelReading(sentence.text, config.speed);
  } catch (error) {
    console.error("[Lingride Tutor] 播放范读失败:", error);
  }
}

/**
 * 处理回声法"听自己"按钮点击
 */
async function handleEchoPlayUser(): Promise<void> {
  try {
    // 停止当前播放（如果有）
    echoMethod.stopPlayback();

    await echoMethod.playUserRecording();
  } catch (error) {
    console.error("[Lingride Tutor] 播放录音失败:", error);
  }
}

/**
 * 处理回声法"A-B对比"按钮点击
 */
async function handleEchoPlayAB(): Promise<void> {
  const sentence = shadow.getCurrentSentence();
  if (!sentence) return;

  const config = shadow.getConfig();

  try {
    // 停止当前播放（如果有）
    echoMethod.stopPlayback();

    await echoMethod.playABComparison(sentence.text, config.speed);
  } catch (error) {
    console.error("[Lingride Tutor] A-B 对比播放失败:", error);
  }
}

/**
 * 处理回声法状态变化
 */
function handleEchoStateChange(state: EchoMethodState): void {
  // 更新按钮状态
  updateEchoButtonStates(state);

  // 更新播放状态显示
  updateEchoPlayingStatusUI(state);
}

/**
 * 更新回声法按钮状态
 */
function updateEchoButtonStates(state: EchoMethodState): void {
  // "听范读"按钮始终可用
  echoPlayModelBtn.disabled = false;

  // "听自己"和"A-B对比"按钮需要有录音
  echoPlayUserBtn.disabled = !state.hasRecording;
  echoPlayABBtn.disabled = !state.hasRecording;

  // 更新按钮的 playing 样式
  echoPlayModelBtn.classList.toggle(
    "playing",
    state.playingSource === "model" || state.playingSource === "ab-model"
  );
  echoPlayUserBtn.classList.toggle(
    "playing",
    state.playingSource === "user" || state.playingSource === "ab-user"
  );
  echoPlayABBtn.classList.toggle(
    "playing",
    state.playingSource === "ab-model" || state.playingSource === "ab-user"
  );
}

/**
 * 更新回声法播放状态 UI
 */
function updateEchoPlayingStatusUI(state: EchoMethodState): void {
  if (state.isPlaying && state.playingSource) {
    echoPlayingStatus.style.display = "flex";

    const statusTexts: Record<string, string> = {
      model: "正在播放范读...",
      user: "正在播放您的录音...",
      "ab-model": "A-B 对比：正在播放范读...",
      "ab-user": "A-B 对比：正在播放您的录音...",
    };

    echoStatusText.textContent = statusTexts[state.playingSource] || "";
  } else {
    echoPlayingStatus.style.display = "none";
  }
}

/**
 * 更新回声法 UI（评估结果后调用）
 */
function updateEchoMethodUI(): void {
  const state = echoMethod.getState();
  updateEchoButtonStates(state);
  updateEchoPlayingStatusUI(state);
}
