/**
 * @file popup.ts
 * @description Popup 逻辑 — Apple 风格学习控制中心
 *
 * 设计哲学："自如 (Natural Flow)"
 * - 双视图：Main View（学习控制） + Settings View（配置面板）
 * - Segmented Control：3 段可取消选择的模式选择器
 * - 自动保存：配置变更即时生效，无需保存按钮
 *
 * @author Lingride Team
 * @since 2.0.0
 */

import {
  DEFAULT_DIFFICULTY_SYSTEM_PROMPT,
  DEFAULT_DIFFICULTY_USER_PROMPT,
} from "../constants/difficultyPrompts";
import {
  DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT,
  DEFAULT_MIXED_TRANSLATE_USER_PROMPT,
} from "../constants/mixedTranslatePrompts";
import {
  DEFAULT_PARAPHRASE_SYSTEM_PROMPT,
  DEFAULT_PARAPHRASE_USER_PROMPT,
} from "../constants/paraphrasePrompts";
import {
  DEFAULT_SENTENCE_ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_SENTENCE_ANALYSIS_USER_PROMPT,
} from "../constants/sentenceAnalysisPrompts";
import {
  AnalyzeDifficultyResponse,
  AnalyzeSentenceResponse,
  AssessPronunciationResponse,
  calculateTargetLevel,
  CEFRLevel,
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  DifficultyResult,
  getRetentionPercent,
  ISpeechRecognizer,
  LingridConfig,
  MessageType,
  PronunciationAssessmentResult,
  SentenceAnalysisResult,
} from "../types";

// ====== 类型定义 ======

/** 阅读模式 */
type ReadingMode = "paraphrase" | "mixed" | "translate" | null;

/** 模式描述映射 */
const MODE_DESCRIPTIONS: Record<string, string> = {
  paraphrase: "将英文改写为适合您水平的版本",
  mixed: "保留能理解的英文，用中文替换超纲部分",
  translate: "在原文下方显示中文翻译",
};

const MODE_DEFAULT_DESC = "选择一种阅读模式开始学习";

// ====== DOM 元素引用 ======

// 视图
const viewport = document.querySelector(".viewport") as HTMLElement;

// Header
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const settingsBadge = document.getElementById("settingsBadge") as HTMLElement;
const backBtn = document.getElementById("backBtn") as HTMLButtonElement;

// 模式选择器
const modeSelector = document.getElementById("modeSelector") as HTMLElement;
const segmentIndicator = document.getElementById(
  "segmentIndicator"
) as HTMLElement;
const modeDesc = document.getElementById("modeDesc") as HTMLElement;
const configHint = document.getElementById("configHint") as HTMLElement;
const configHintBtn = document.getElementById(
  "configHintBtn"
) as HTMLButtonElement;

// 水平选择器
const levelSelector = document.getElementById("levelSelector") as HTMLElement;
const levelHint = document.getElementById("levelHint") as HTMLElement;

// 难度分析
const analyzeDifficultyBtn = document.getElementById(
  "analyzeDifficultyBtn"
) as HTMLButtonElement;
const difficultyStatus = document.getElementById(
  "difficultyStatus"
) as HTMLElement;
const difficultyResult = document.getElementById(
  "difficultyResult"
) as HTMLElement;
const difficultyBadge = document.getElementById(
  "difficultyBadge"
) as HTMLElement;
const cefrBadge = document.getElementById("cefrBadge") as HTMLElement;
const scoreProgress = document.getElementById("scoreProgress") as HTMLElement;
const scoreValue = document.getElementById("scoreValue") as HTMLElement;
const vocabMetric = document.getElementById("vocabMetric") as HTMLElement;
const sentenceMetric = document.getElementById("sentenceMetric") as HTMLElement;
const readingTime = document.getElementById("readingTime") as HTMLElement;
const wordCount = document.getElementById("wordCount") as HTMLElement;
const suggestionsList = document.getElementById(
  "suggestionsList"
) as HTMLElement;
const selectionHint = document.getElementById("selectionHint") as HTMLElement;

// 长难句分析
const sentenceInput = document.getElementById(
  "sentenceInput"
) as HTMLTextAreaElement;
const sentenceCharCount = document.getElementById(
  "sentenceCharCount"
) as HTMLElement;
const analyzeSentenceBtn = document.getElementById(
  "analyzeSentenceBtn"
) as HTMLButtonElement;
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

// Settings - API 配置
const apiBaseUrlInput = document.getElementById(
  "apiBaseUrl"
) as HTMLInputElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const showKeyBtn = document.getElementById("showKeyBtn") as HTMLButtonElement;
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
const customModelInput = document.getElementById(
  "customModel"
) as HTMLInputElement;
const testConnectionBtn = document.getElementById(
  "testConnectionBtn"
) as HTMLButtonElement;
const connectionStatus = document.getElementById(
  "connectionStatus"
) as HTMLElement;

// Settings - Prompt 配置
const systemPromptTextarea = document.getElementById(
  "systemPrompt"
) as HTMLTextAreaElement;
const userPromptTextarea = document.getElementById(
  "userPrompt"
) as HTMLTextAreaElement;
const difficultySystemPromptTextarea = document.getElementById(
  "difficultySystemPrompt"
) as HTMLTextAreaElement;
const difficultyUserPromptTextarea = document.getElementById(
  "difficultyUserPrompt"
) as HTMLTextAreaElement;
const paraphraseSystemPromptTextarea = document.getElementById(
  "paraphraseSystemPrompt"
) as HTMLTextAreaElement;
const paraphraseUserPromptTextarea = document.getElementById(
  "paraphraseUserPrompt"
) as HTMLTextAreaElement;
const mixedTranslateSystemPromptTextarea = document.getElementById(
  "mixedTranslateSystemPrompt"
) as HTMLTextAreaElement;
const mixedTranslateUserPromptTextarea = document.getElementById(
  "mixedTranslateUserPrompt"
) as HTMLTextAreaElement;
const sentenceAnalysisSystemPromptTextarea = document.getElementById(
  "sentenceAnalysisSystemPrompt"
) as HTMLTextAreaElement;
const sentenceAnalysisUserPromptTextarea = document.getElementById(
  "sentenceAnalysisUserPrompt"
) as HTMLTextAreaElement;

// Settings - 操作
const resetDefaultsBtn = document.getElementById(
  "resetDefaultsBtn"
) as HTMLButtonElement;

// ====== 状态 ======

let currentConfig: LingridConfig = { ...DEFAULT_CONFIG };
let currentMode: ReadingMode = null;

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

  onInterimResult?: (text: string) => void;
  onError?: (error: Error) => void;

  async start(): Promise<void> {
    // 检查浏览器支持
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition })
        .webkitSpeechRecognition;

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
      throw new Error("无法访问麦克风：" + (err instanceof Error ? err.message : String(err)));
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.finalTranscript = "";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + " ";
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
        console.log("[Lingride] 语音识别意外结束，尝试重启...");
        try {
          this.recognition?.start();
        } catch (e) {
          console.error("[Lingride] 重启语音识别失败:", e);
          this._isRecognizing = false;
        }
      }
    };

    this.recognition.start();
    this._isRecognizing = true;
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;
    if (this.recognition) {
      this.recognition.stop();
    }
    return this.finalTranscript.trim();
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }
}

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride] Popup 已加载");

  await loadConfig();
  await loadModeState();

  bindEvents();
  updateBadge();
});

// ====== 配置加载 ======

async function loadConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });

    if (response.success && response.data) {
      currentConfig = response.data;
      updateSettingsForm();
      updateLevelSelector();
    }
  } catch (error) {
    console.error("[Lingride] 加载配置失败:", error);
  }
}

/**
 * 加载当前激活的模式状态
 * 从三个独立状态中确定当前 segmented control 的选中项
 */
async function loadModeState(): Promise<void> {
  try {
    const [translationRes, paraphraseRes, mixedRes] = await Promise.all([
      chrome.runtime.sendMessage({ type: MessageType.GET_TRANSLATION_STATE }),
      chrome.runtime.sendMessage({ type: MessageType.GET_PARAPHRASE_STATE }),
      chrome.runtime.sendMessage({
        type: MessageType.GET_MIXED_TRANSLATE_STATE,
      }),
    ]);

    if (paraphraseRes.success && paraphraseRes.data?.enabled) {
      currentMode = "paraphrase";
    } else if (mixedRes.success && mixedRes.data?.enabled) {
      currentMode = "mixed";
    } else if (translationRes.success && translationRes.data?.enabled) {
      currentMode = "translate";
    } else {
      currentMode = null;
    }

    updateSegmentedControl();
    updateModeDesc();
    updateLevelHint();
  } catch (error) {
    console.error("[Lingride] 加载模式状态失败:", error);
  }
}

// ====== 事件绑定 ======

function bindEvents(): void {
  // 视图切换
  settingsBtn.addEventListener("click", showSettings);
  backBtn.addEventListener("click", showMain);
  configHintBtn.addEventListener("click", showSettings);

  // 模式选择器（事件委托）
  modeSelector.addEventListener("click", handleModeClick);

  // 水平选择器（事件委托）
  levelSelector.addEventListener("click", handleLevelClick);

  // 难度分析
  analyzeDifficultyBtn.addEventListener("click", handleAnalyzeDifficulty);

  // 长难句分析
  analyzeSentenceBtn.addEventListener("click", handleAnalyzeSentence);
  sentenceInput.addEventListener("input", handleSentenceInput);

  // 语音朗读
  speakSentenceBtn.addEventListener("click", handleSpeakSentence);

  // 录音练习
  recordSentenceBtn.addEventListener("click", handleRecordSentence);
  speakFeedbackBtn?.addEventListener("click", handleSpeakFeedback);

  // Popup 关闭时停止朗读和录音（双重兜底）
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      speechSynthesis.cancel();
      stopRecordingCleanup();
    }
  });
  window.addEventListener("pagehide", () => {
    speechSynthesis.cancel();
    stopRecordingCleanup();
  });

  // Settings - API 配置自动保存
  apiBaseUrlInput.addEventListener("blur", autoSave);
  apiKeyInput.addEventListener("blur", autoSave);
  modelSelect.addEventListener("change", handleModelChange);
  customModelInput.addEventListener("blur", autoSave);

  // Settings - 显示/隐藏 API Key
  showKeyBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    showKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试连接
  testConnectionBtn.addEventListener("click", testConnection);

  // Settings - Accordion
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", handleAccordionClick);
  });

  // Settings - Prompt 自动保存
  const promptTextareas = [
    systemPromptTextarea,
    userPromptTextarea,
    difficultySystemPromptTextarea,
    difficultyUserPromptTextarea,
    paraphraseSystemPromptTextarea,
    paraphraseUserPromptTextarea,
    mixedTranslateSystemPromptTextarea,
    mixedTranslateUserPromptTextarea,
    sentenceAnalysisSystemPromptTextarea,
    sentenceAnalysisUserPromptTextarea,
  ];
  promptTextareas.forEach((textarea) => {
    textarea.addEventListener("blur", autoSave);
  });

  // Settings - 恢复默认
  resetDefaultsBtn.addEventListener("click", resetDefaults);
}

// ====== 视图切换 ======

function showSettings(): void {
  viewport.classList.add("show-settings");
}

function showMain(): void {
  viewport.classList.remove("show-settings");
  updateBadge();
}

// ====== 模式选择器 ======

function handleModeClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(".segment") as HTMLElement;
  if (!target) return;

  const mode = target.dataset.mode as ReadingMode;

  // 可取消选择：点击已选中的段则取消
  if (mode === currentMode) {
    deactivateMode(currentMode);
    currentMode = null;
  } else {
    // 先关闭旧模式，再开启新模式
    if (currentMode) {
      deactivateMode(currentMode);
    }

    // 检查 API Key
    if (!currentConfig.api_key) {
      configHint.style.display = "flex";
      setTimeout(() => {
        configHint.style.display = "none";
      }, 4000);
      currentMode = null;
      updateSegmentedControl();
      updateModeDesc();
      return;
    }

    activateMode(mode);
    currentMode = mode;
  }

  updateSegmentedControl();
  updateModeDesc();
  updateLevelHint();
}

function activateMode(mode: ReadingMode): void {
  if (!mode) return;

  const messageMap: Record<string, string> = {
    paraphrase: MessageType.TOGGLE_PARAPHRASE,
    mixed: MessageType.TOGGLE_MIXED_TRANSLATE,
    translate: MessageType.TOGGLE_TRANSLATION,
  };

  chrome.runtime.sendMessage({
    type: messageMap[mode],
    payload: { enabled: true },
  });
}

function deactivateMode(mode: ReadingMode): void {
  if (!mode) return;

  const messageMap: Record<string, string> = {
    paraphrase: MessageType.TOGGLE_PARAPHRASE,
    mixed: MessageType.TOGGLE_MIXED_TRANSLATE,
    translate: MessageType.TOGGLE_TRANSLATION,
  };

  chrome.runtime.sendMessage({
    type: messageMap[mode],
    payload: { enabled: false },
  });
}

function updateSegmentedControl(): void {
  const segments = modeSelector.querySelectorAll(".segment");
  const modeIndex: Record<string, number> = {
    paraphrase: 0,
    mixed: 1,
    translate: 2,
  };

  // 更新 segment active 状态
  segments.forEach((seg) => {
    const segMode = (seg as HTMLElement).dataset.mode;
    seg.classList.toggle("active", segMode === currentMode);
  });

  // 更新滑动指示器
  if (currentMode) {
    const idx = modeIndex[currentMode];
    segmentIndicator.className = `segment-indicator active pos-${idx}`;
  } else {
    segmentIndicator.className = "segment-indicator";
  }
}

function updateModeDesc(): void {
  if (currentMode && MODE_DESCRIPTIONS[currentMode]) {
    modeDesc.textContent = MODE_DESCRIPTIONS[currentMode];
  } else {
    modeDesc.textContent = MODE_DEFAULT_DESC;
  }
}

// ====== 水平选择器 ======

function handleLevelClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(".pill") as HTMLElement;
  if (!target) return;

  const level = target.dataset.level as CEFRLevel;
  if (!level) return;

  // 更新 UI
  setActiveLevel(level);

  // 更新配置
  currentConfig.user_english_level = level;
  updateLevelHint();

  // 立即保存并刷新模式
  handleEnglishLevelChange(level);
}

function setActiveLevel(level: CEFRLevel): void {
  levelSelector.querySelectorAll(".pill").forEach((pill) => {
    const pillLevel = (pill as HTMLElement).dataset.level;
    pill.classList.toggle("active", pillLevel === level);
  });
}

function updateLevelSelector(): void {
  const level = currentConfig.user_english_level || DEFAULT_USER_ENGLISH_LEVEL;
  setActiveLevel(level);
  updateLevelHint();
}

function updateLevelHint(): void {
  const userLevel = (currentConfig.user_english_level ||
    DEFAULT_USER_ENGLISH_LEVEL) as CEFRLevel;

  if (currentMode === "mixed") {
    const percent = getRetentionPercent(userLevel);
    levelHint.innerHTML = `将保留约 <strong>${percent}%</strong> 英文内容，其余用中文表达`;
  } else {
    const targetLevel = calculateTargetLevel(userLevel);
    levelHint.innerHTML = `目标水平: <strong>${targetLevel}</strong>（略高于您的水平）`;
  }
}

async function handleEnglishLevelChange(_newLevel: CEFRLevel): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: currentConfig,
    });

    if (response.success) {
      // 如果释义已开启，重新触发
      if (currentMode === "paraphrase") {
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_PARAPHRASE,
          payload: { enabled: false },
        });
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_PARAPHRASE,
          payload: { enabled: true },
        });
      }

      // 如果混杂中英已开启，重新触发
      if (currentMode === "mixed") {
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_MIXED_TRANSLATE,
          payload: { enabled: false },
        });
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_MIXED_TRANSLATE,
          payload: { enabled: true },
        });
      }
    }
  } catch (error) {
    console.error("[Lingride] 保存英文水平失败:", error);
  }
}

// ====== Badge 控制 ======

function updateBadge(): void {
  const hasApiKey = !!currentConfig.api_key;
  settingsBadge.style.display = hasApiKey ? "none" : "";
}

// ====== 自动保存 ======

async function autoSave(): Promise<void> {
  collectFormData();

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: currentConfig,
    });

    if (response.success) {
      updateBadge();
    }
  } catch (error) {
    console.error("[Lingride] 自动保存失败:", error);
  }
}

function collectFormData(): void {
  const model =
    modelSelect.value === "custom" ? customModelInput.value : modelSelect.value;

  currentConfig.api_base_url = apiBaseUrlInput.value.trim();
  currentConfig.api_key = apiKeyInput.value.trim();
  currentConfig.model = model.trim();
  currentConfig.prompts = {
    system_prompt: systemPromptTextarea.value,
    user_prompt_template: userPromptTextarea.value,
  };
  currentConfig.difficulty_prompts = {
    system_prompt: difficultySystemPromptTextarea.value,
    user_prompt_template: difficultyUserPromptTextarea.value,
  };
  currentConfig.paraphrase_prompts = {
    system_prompt: paraphraseSystemPromptTextarea.value,
    user_prompt_template: paraphraseUserPromptTextarea.value,
  };
  currentConfig.mixed_translate_prompts = {
    system_prompt: mixedTranslateSystemPromptTextarea.value,
    user_prompt_template: mixedTranslateUserPromptTextarea.value,
  };
  currentConfig.sentence_analysis_prompts = {
    system_prompt: sentenceAnalysisSystemPromptTextarea.value,
    user_prompt_template: sentenceAnalysisUserPromptTextarea.value,
  };
}

// ====== Settings 表单更新 ======

function updateSettingsForm(): void {
  // API 配置
  apiBaseUrlInput.value = currentConfig.api_base_url || "";
  apiKeyInput.value = currentConfig.api_key || "";

  // 模型
  const modelValue = currentConfig.model || "deepseek-chat";
  const modelOption = Array.from(modelSelect.options).find(
    (opt) => opt.value === modelValue
  );

  if (modelOption) {
    modelSelect.value = modelValue;
    customModelInput.style.display = "none";
  } else {
    modelSelect.value = "custom";
    customModelInput.value = modelValue;
    customModelInput.style.display = "block";
  }

  // 翻译 Prompt
  systemPromptTextarea.value =
    currentConfig.prompts?.system_prompt || DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value =
    currentConfig.prompts?.user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

  // 难度分析 Prompt
  difficultySystemPromptTextarea.value =
    currentConfig.difficulty_prompts?.system_prompt ||
    DEFAULT_DIFFICULTY_SYSTEM_PROMPT;
  difficultyUserPromptTextarea.value =
    currentConfig.difficulty_prompts?.user_prompt_template ||
    DEFAULT_DIFFICULTY_USER_PROMPT;

  // 释义 Prompt
  paraphraseSystemPromptTextarea.value =
    currentConfig.paraphrase_prompts?.system_prompt ||
    DEFAULT_PARAPHRASE_SYSTEM_PROMPT;
  paraphraseUserPromptTextarea.value =
    currentConfig.paraphrase_prompts?.user_prompt_template ||
    DEFAULT_PARAPHRASE_USER_PROMPT;

  // 混杂中英 Prompt
  mixedTranslateSystemPromptTextarea.value =
    currentConfig.mixed_translate_prompts?.system_prompt ||
    DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT;
  mixedTranslateUserPromptTextarea.value =
    currentConfig.mixed_translate_prompts?.user_prompt_template ||
    DEFAULT_MIXED_TRANSLATE_USER_PROMPT;

  // 长难句分析 Prompt
  sentenceAnalysisSystemPromptTextarea.value =
    currentConfig.sentence_analysis_prompts?.system_prompt ||
    DEFAULT_SENTENCE_ANALYSIS_SYSTEM_PROMPT;
  sentenceAnalysisUserPromptTextarea.value =
    currentConfig.sentence_analysis_prompts?.user_prompt_template ||
    DEFAULT_SENTENCE_ANALYSIS_USER_PROMPT;
}

// ====== 模型选择 ======

function handleModelChange(): void {
  if (modelSelect.value === "custom") {
    customModelInput.style.display = "block";
    customModelInput.focus();
  } else {
    customModelInput.style.display = "none";
    autoSave();
  }
}

// ====== 测试连接 ======

async function testConnection(): Promise<void> {
  testConnectionBtn.textContent = "测试中...";
  testConnectionBtn.style.pointerEvents = "none";
  showStatus(connectionStatus, "正在测试...", "loading");

  try {
    await autoSave();

    const response = await chrome.runtime.sendMessage({
      type: MessageType.TEST_CONNECTION,
    });

    if (response.success && response.data) {
      showStatus(
        connectionStatus,
        `连接成功！延迟: ${response.data.latency}ms`,
        "success"
      );
    } else {
      showStatus(connectionStatus, response.error || "连接失败", "error");
    }
  } catch (error) {
    showStatus(connectionStatus, "测试请求失败", "error");
  } finally {
    testConnectionBtn.textContent = "测试连接";
    testConnectionBtn.style.pointerEvents = "";
  }
}

// ====== Accordion ======

function handleAccordionClick(e: Event): void {
  const header = e.currentTarget as HTMLElement;
  const targetId = header.dataset.accordion;
  if (!targetId) return;

  const body = document.getElementById(targetId);
  if (!body) return;

  const isOpen = body.classList.contains("open");

  // Accordion 模式：关闭所有其他
  document.querySelectorAll(".accordion-body.open").forEach((openBody) => {
    openBody.classList.remove("open");
  });
  document.querySelectorAll(".accordion-header.expanded").forEach((h) => {
    h.classList.remove("expanded");
  });

  // 切换当前项
  if (!isOpen) {
    body.classList.add("open");
    header.classList.add("expanded");
  }
}

// ====== 恢复默认 ======

function resetDefaults(): void {
  // 翻译 Prompt
  systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value = DEFAULT_USER_PROMPT_TEMPLATE;

  // 难度分析 Prompt
  difficultySystemPromptTextarea.value = DEFAULT_DIFFICULTY_SYSTEM_PROMPT;
  difficultyUserPromptTextarea.value = DEFAULT_DIFFICULTY_USER_PROMPT;

  // 释义 Prompt
  paraphraseSystemPromptTextarea.value = DEFAULT_PARAPHRASE_SYSTEM_PROMPT;
  paraphraseUserPromptTextarea.value = DEFAULT_PARAPHRASE_USER_PROMPT;

  // 混杂中英 Prompt
  mixedTranslateSystemPromptTextarea.value =
    DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT;
  mixedTranslateUserPromptTextarea.value = DEFAULT_MIXED_TRANSLATE_USER_PROMPT;

  // 长难句分析 Prompt
  sentenceAnalysisSystemPromptTextarea.value =
    DEFAULT_SENTENCE_ANALYSIS_SYSTEM_PROMPT;
  sentenceAnalysisUserPromptTextarea.value =
    DEFAULT_SENTENCE_ANALYSIS_USER_PROMPT;

  // 自动保存
  autoSave();

  showStatus(connectionStatus, "已恢复默认设置", "success");
}

// ====== 难度分析 ======

async function handleAnalyzeDifficulty(): Promise<void> {
  analyzeDifficultyBtn.disabled = true;
  analyzeDifficultyBtn.textContent = "分析中...";
  difficultyResult.style.display = "none";
  showStatus(difficultyStatus, "正在分析页面难度...", "loading");

  try {
    const response: AnalyzeDifficultyResponse =
      await chrome.runtime.sendMessage({
        type: MessageType.ANALYZE_DIFFICULTY,
      });

    if (response.success && response.data) {
      difficultyStatus.style.display = "none";
      renderDifficultyResult(response.data);
    } else {
      showStatus(difficultyStatus, response.error || "分析失败", "error");
    }
  } catch (error) {
    console.error("[Lingride] 难度分析失败:", error);
    showStatus(difficultyStatus, "分析请求失败", "error");
  } finally {
    analyzeDifficultyBtn.disabled = false;
    analyzeDifficultyBtn.textContent = "分析当前页面";
  }
}

function renderDifficultyResult(result: DifficultyResult): void {
  difficultyResult.style.display = "block";

  // 难度等级徽章
  const levelClass = result.difficultyLevel.toLowerCase();
  difficultyBadge.textContent = result.difficultyLevel;
  difficultyBadge.className = `difficulty-badge ${levelClass}`;

  // CEFR 徽章
  cefrBadge.textContent = result.cefrLevel;

  // 分数进度条
  scoreProgress.style.width = `${result.score}%`;
  scoreValue.textContent = result.score.toString();

  // 词汇复杂度
  const vocab = result.vocabularyComplexity;
  vocabMetric.textContent = `${vocab.rareWordCount} 罕见词 / ${vocab.academicWordCount} 学术词`;

  // 句子复杂度
  const sentence = result.sentenceComplexity;
  const complexRatio = Math.round(sentence.complexSentenceRatio * 100);
  sentenceMetric.textContent = `平均 ${sentence.avgSentenceLength.toFixed(
    1
  )} 词/句 (${complexRatio}% 复杂)`;

  // 阅读时间
  readingTime.textContent = `${result.estimatedReadingTime} 分钟`;

  // 采样词数
  wordCount.textContent = `${result.sampleWordCount} 词`;

  // 建议列表
  suggestionsList.innerHTML = "";
  for (const suggestion of result.suggestions) {
    const li = document.createElement("li");
    li.textContent = suggestion;
    suggestionsList.appendChild(li);
  }

  // 选中文本提示
  selectionHint.style.display = result.isSelection ? "block" : "none";
}

// ====== 长难句分析 ======

/**
 * 处理输入框的 input 事件
 *
 * 更新字符计数器和按钮 disabled 状态。
 */
function handleSentenceInput(): void {
  const length = sentenceInput.value.length;
  sentenceCharCount.textContent = `${length}/500`;
  analyzeSentenceBtn.disabled = length === 0;
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

  // D2: 分析与朗读互斥 — 停止正在进行的朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
  }

  analyzeSentenceBtn.disabled = true;
  analyzeSentenceBtn.textContent = "分析中...";
  sentenceResultEl.style.display = "none";
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
    console.error("[Lingride] 长难句分析失败:", error);
    showStatus(sentenceStatus, "分析请求失败", "error");
  } finally {
    analyzeSentenceBtn.disabled = false;
    analyzeSentenceBtn.textContent = "分析句子";
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
  type: "success" | "error" | "loading"
): void {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = "block";

  if (type === "success") {
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
 * 停止录音时的清理函数（供异常或 Popup 关闭时调用）
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

    // 初始化识别器
    recognizer = new WebSpeechRecognizer();
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
        showStatus(pronunciationStatus, "录音已达最大时长，自动停止", "loading");
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
 * 更新录音时间显示
 */
function updateRecordingTime(seconds: number): void {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  recordingTime.textContent = `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
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
    console.error("[Lingride] 发音评估失败:", error);
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
function renderPronunciationResult(result: PronunciationAssessmentResult): void {
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
 * 处理朗读反馈按钮点击
 *
 * 使用 TTS 朗读 AI 反馈的鼓励语和建议。
 */
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
  const severityOrder: Record<string, number> = { major: 0, moderate: 1, minor: 2 };
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
