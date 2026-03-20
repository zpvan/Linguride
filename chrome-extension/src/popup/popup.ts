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
  CEFRLevel,
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  DifficultyResult,
  LingridConfig,
  MINIMAX_TTS_DEFAULT_MODEL,
  MessageType,
  MiniMaxTTSModel,
  TestTTSConnectionResponse,
  XiaomiTTSStyleSelection,
  XiaomiTTSVoice,
} from "../types";

// ====== 类型定义 ======

/** 阅读模式 */
type ReadingMode = "paraphrase" | "mixed" | "translate" | null;
type ApiProviderType = "deepseek" | "openai" | "custom";
type ServiceTestState = "idle" | "loading" | "success" | "error";
type XiaomiTTSStyleGroupKey = keyof XiaomiTTSStyleSelection;
type XiaomiTTSStyleValue = NonNullable<
  XiaomiTTSStyleSelection[XiaomiTTSStyleGroupKey]
>;

/** 模式描述映射 */
const MODE_DESCRIPTIONS: Record<string, string> = {
  paraphrase: "将英文改写为适合您水平的版本",
  mixed: "保留能理解的英文，用中文替换超纲部分",
  translate: "在原文下方显示中文翻译",
};

const MODE_DEFAULT_DESC = "选择一种阅读模式开始学习";
const API_BASE_URL_PRESETS: Record<Exclude<ApiProviderType, "custom">, string> =
  {
    deepseek: "https://api.deepseek.com",
    openai: "https://api.openai.com",
  };
const XIAOMI_TTS_DEFAULT_VOICE: XiaomiTTSVoice = "mimo_default";
const XIAOMI_TTS_STYLE_GROUP_ORDER: XiaomiTTSStyleGroupKey[] = [
  "speed",
  "emotion",
  "role",
  "tone",
  "dialect",
];
const XIAOMI_TTS_STYLE_GROUP_LABELS: Record<
  XiaomiTTSStyleGroupKey,
  string
> = {
  speed: "语速控制",
  emotion: "情绪变化",
  role: "角色扮演",
  tone: "风格变化",
  dialect: "方言",
};
const XIAOMI_TTS_VOICE_OPTIONS: XiaomiTTSVoice[] = [
  "mimo_default",
  "default_zh",
  "default_en",
];
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
];
const XIAOMI_TTS_STYLE_OPTIONS: Record<
  XiaomiTTSStyleGroupKey,
  Array<{ value: XiaomiTTSStyleValue; label: string }>
> = {
  speed: [
    { value: "faster", label: "变快" },
    { value: "slower", label: "变慢" },
  ],
  emotion: [
    { value: "happy", label: "开心" },
    { value: "sad", label: "悲伤" },
    { value: "angry", label: "生气" },
  ],
  role: [
    { value: "sunwukong", label: "孙悟空" },
    { value: "lindaiyu", label: "林黛玉" },
  ],
  tone: [
    { value: "whisper", label: "悄悄话" },
    { value: "jiazi", label: "夹子音" },
    { value: "taiwan", label: "台湾腔" },
  ],
  dialect: [
    { value: "dongbei", label: "东北话" },
    { value: "sichuan", label: "四川话" },
    { value: "henan", label: "河南话" },
    { value: "cantonese", label: "粤语" },
  ],
};

// ====== DOM 元素引用 ======

// 视图
const viewport = document.querySelector(".viewport") as HTMLElement;

// Header
const corpusBtn = document.getElementById("corpusBtn") as HTMLButtonElement;
const tutorBtn = document.getElementById("tutorBtn") as HTMLButtonElement;
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

// 水平选择器（徽章式）
const levelBadgeWrapper = document.getElementById(
  "levelBadgeWrapper"
) as HTMLElement;
const levelBadge = document.getElementById("levelBadge") as HTMLButtonElement;
const levelDropdown = document.getElementById("levelDropdown") as HTMLElement;

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


// Settings - API 配置
const apiProviderSelect = document.getElementById(
  "apiProviderSelect"
) as HTMLSelectElement;
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

// Settings - 腾讯云 ASR 配置
const tencentAppIdInput = document.getElementById(
  "tencentAppId"
) as HTMLInputElement;
const tencentSecretIdInput = document.getElementById(
  "tencentSecretId"
) as HTMLInputElement;
const tencentSecretKeyInput = document.getElementById(
  "tencentSecretKey"
) as HTMLInputElement;
const showTencentKeyBtn = document.getElementById(
  "showTencentKeyBtn"
) as HTMLButtonElement;

// Settings - 阿里云 ASR 配置
const alibabaApiKeyInput = document.getElementById(
  "alibabaApiKey"
) as HTMLInputElement;
const showAlibabaKeyBtn = document.getElementById(
  "showAlibabaKeyBtn"
) as HTMLButtonElement;

// Settings - MiniMax TTS 配置
const minimaxTTSApiKeyInput = document.getElementById(
  "minimaxTTSApiKey"
) as HTMLInputElement;
const showMiniMaxTTSKeyBtn = document.getElementById(
  "showMiniMaxTTSKeyBtn"
) as HTMLButtonElement;
const minimaxTTSModelSelect = document.getElementById(
  "minimaxTTSModel"
) as HTMLSelectElement;
const minimaxTTSVoiceIdInput = document.getElementById(
  "minimaxTTSVoiceId"
) as HTMLInputElement;
const testMiniMaxTTSBtn = document.getElementById(
  "testMiniMaxTTSBtn"
) as HTMLButtonElement;
const minimaxTTSStatus = document.getElementById(
  "minimaxTTSStatus"
) as HTMLElement;

// Settings - 小米 TTS 配置
const xiaomiTTSApiKeyInput = document.getElementById(
  "xiaomiTTSApiKey"
) as HTMLInputElement;
const showXiaomiTTSKeyBtn = document.getElementById(
  "showXiaomiTTSKeyBtn"
) as HTMLButtonElement;
const xiaomiTTSVoiceSelect = document.getElementById(
  "xiaomiTTSVoice"
) as HTMLSelectElement;
const testXiaomiTTSBtn = document.getElementById(
  "testXiaomiTTSBtn"
) as HTMLButtonElement;
const xiaomiTTSStatus = document.getElementById(
  "xiaomiTTSStatus"
) as HTMLElement;
const xiaomiTTSStyleSummary = document.getElementById(
  "xiaomiTTSStyleSummary"
) as HTMLElement;
const clearXiaomiTTSStylesBtn = document.getElementById(
  "clearXiaomiTTSStylesBtn"
) as HTMLButtonElement;
const xiaomiTTSStyleButtons = Array.from(
  document.querySelectorAll("[data-xiaomi-tts-style-group]")
) as HTMLButtonElement[];

// Settings - 操作
const resetDefaultsBtn = document.getElementById(
  "resetDefaultsBtn"
) as HTMLButtonElement;

// ====== 状态 ======

let currentConfig: LingridConfig = { ...DEFAULT_CONFIG };
let currentMode: ReadingMode = null;
let minimaxTTSResetTimer: number | null = null;
let xiaomiTTSResetTimer: number | null = null;
let isTestingMiniMaxTTS = false;
let isTestingXiaomiTTS = false;

function normalizeXiaomiTTSVoice(value?: string | null): XiaomiTTSVoice {
  if (value && XIAOMI_TTS_VOICE_OPTIONS.includes(value as XiaomiTTSVoice)) {
    return value as XiaomiTTSVoice;
  }

  return XIAOMI_TTS_DEFAULT_VOICE;
}

function normalizeMiniMaxTTSModel(value?: string | null): MiniMaxTTSModel {
  if (value && MINIMAX_TTS_MODEL_OPTIONS.includes(value as MiniMaxTTSModel)) {
    return value as MiniMaxTTSModel;
  }

  return MINIMAX_TTS_DEFAULT_MODEL;
}

function isValidXiaomiTTSStyleValue(
  group: XiaomiTTSStyleGroupKey,
  value?: string | null
): value is XiaomiTTSStyleValue {
  if (!value) return false;

  return XIAOMI_TTS_STYLE_OPTIONS[group].some((option) => option.value === value);
}

function normalizeXiaomiTTSStyles(
  styles?: XiaomiTTSStyleSelection | null
): XiaomiTTSStyleSelection | undefined {
  if (!styles) return undefined;

  const normalized: XiaomiTTSStyleSelection = {};

  XIAOMI_TTS_STYLE_GROUP_ORDER.forEach((group) => {
    const value = styles[group];
    if (isValidXiaomiTTSStyleValue(group, value)) {
      setXiaomiTTSStyleValue(normalized, group, value);
    }
  });

  return hasXiaomiTTSStyles(normalized) ? normalized : undefined;
}

function hasXiaomiTTSStyles(styles?: XiaomiTTSStyleSelection): boolean {
  if (!styles) return false;

  return XIAOMI_TTS_STYLE_GROUP_ORDER.some((group) => Boolean(styles[group]));
}

function getXiaomiTTSStyleLabel(
  group: XiaomiTTSStyleGroupKey,
  value: XiaomiTTSStyleValue
): string {
  const option = XIAOMI_TTS_STYLE_OPTIONS[group].find(
    (item) => item.value === value
  );
  return option?.label || value;
}

function setXiaomiTTSStyleValue(
  selection: XiaomiTTSStyleSelection,
  group: XiaomiTTSStyleGroupKey,
  value: XiaomiTTSStyleValue
): void {
  switch (group) {
    case "speed":
      if (value === "faster" || value === "slower") {
        selection.speed = value;
      }
      break;
    case "emotion":
      if (value === "happy" || value === "sad" || value === "angry") {
        selection.emotion = value;
      }
      break;
    case "role":
      if (value === "sunwukong" || value === "lindaiyu") {
        selection.role = value;
      }
      break;
    case "tone":
      if (value === "whisper" || value === "jiazi" || value === "taiwan") {
        selection.tone = value;
      }
      break;
    case "dialect":
      if (
        value === "dongbei" ||
        value === "sichuan" ||
        value === "henan" ||
        value === "cantonese"
      ) {
        selection.dialect = value;
      }
      break;
  }
}

function renderXiaomiTTSStyleSummary(
  selection?: XiaomiTTSStyleSelection
): void {
  xiaomiTTSStyleSummary.replaceChildren();

  if (!hasXiaomiTTSStyles(selection)) {
    xiaomiTTSStyleSummary.classList.add("is-empty");
    xiaomiTTSStyleSummary.textContent = "未选择额外风格";
    clearXiaomiTTSStylesBtn.classList.add("is-hidden");
    return;
  }

  xiaomiTTSStyleSummary.classList.remove("is-empty");
  clearXiaomiTTSStylesBtn.classList.remove("is-hidden");

  XIAOMI_TTS_STYLE_GROUP_ORDER.forEach((group) => {
    const value = selection?.[group];
    if (!value) return;

    const tag = document.createElement("span");
    tag.className = "xiaomi-tts-style-summary-tag";
    tag.textContent = `${XIAOMI_TTS_STYLE_GROUP_LABELS[group]}：${getXiaomiTTSStyleLabel(
      group,
      value
    )}`;
    xiaomiTTSStyleSummary.appendChild(tag);
  });
}

function applyXiaomiTTSStyleSelection(
  selection?: XiaomiTTSStyleSelection
): void {
  const normalizedSelection = normalizeXiaomiTTSStyles(selection);

  xiaomiTTSStyleButtons.forEach((button) => {
    const group = button.dataset.xiaomiTtsStyleGroup as XiaomiTTSStyleGroupKey;
    const value = button.dataset.xiaomiTtsStyleValue as XiaomiTTSStyleValue;
    button.classList.toggle("active", normalizedSelection?.[group] === value);
  });

  renderXiaomiTTSStyleSummary(normalizedSelection);
}

function getXiaomiTTSStylesFromUI(): XiaomiTTSStyleSelection | undefined {
  const selection: XiaomiTTSStyleSelection = {};

  xiaomiTTSStyleButtons.forEach((button) => {
    if (!button.classList.contains("active")) return;

    const group = button.dataset.xiaomiTtsStyleGroup as XiaomiTTSStyleGroupKey;
    const value = button.dataset.xiaomiTtsStyleValue;

    if (isValidXiaomiTTSStyleValue(group, value)) {
      setXiaomiTTSStyleValue(selection, group, value);
    }
  });

  return hasXiaomiTTSStyles(selection) ? selection : undefined;
}

function clearServiceTestResetTimer(timer: number | null): void {
  if (timer) {
    clearTimeout(timer);
  }
}

function showServiceTestStatus(
  element: HTMLElement,
  message: string,
  type: "success" | "error" | "loading"
): void {
  element.textContent = message;
  element.className = `status-message service-test-status ${type}`;
  element.style.display = "block";
}

function hideServiceTestStatus(element: HTMLElement): void {
  element.style.display = "none";
  element.className = "status-message service-test-status";
  element.textContent = "";
}

function setServiceTestButtonState(
  button: HTMLButtonElement,
  state: ServiceTestState,
  disabled: boolean,
  title: string
): void {
  button.classList.remove(
    "is-loading",
    "is-success",
    "is-error",
    "is-disabled"
  );

  if (state === "loading") {
    button.classList.add("is-loading");
  } else if (state === "success") {
    button.classList.add("is-success");
  } else if (state === "error") {
    button.classList.add("is-error");
  } else if (disabled) {
    button.classList.add("is-disabled");
  }

  button.disabled = disabled;
  button.title = title;
}

function getShortTTSErrorDetail(
  response: TestTTSConnectionResponse
): string | null {
  const detail = response.errorDetail?.trim() || response.error?.trim() || "";

  if (!detail || detail.length > 60) {
    return null;
  }

  if (
    detail === "请求失败" ||
    detail === "语音合成请求失败" ||
    detail === "语音合成服务连接失败"
  ) {
    return null;
  }

  return detail;
}

function appendTTSErrorDetail(
  message: string,
  response: TestTTSConnectionResponse
): string {
  const detail = getShortTTSErrorDetail(response);
  if (!detail || message.includes(detail)) {
    return message;
  }

  return `${message}（服务返回：${detail}）`;
}

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride] Popup 已加载");

  await loadConfig();
  await loadModeState();

  bindEvents();
  updateBadge();
  updateMiniMaxTTSButtonAvailability();
  updateXiaomiTTSButtonAvailability();
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

  // 语料库标签页入口
  corpusBtn.addEventListener("click", openCorpusPage);

  // 外教标签页入口
  tutorBtn.addEventListener("click", openTutorPage);

  // 模式选择器（事件委托）
  modeSelector.addEventListener("click", handleModeClick);

  // 水平选择器（徽章式下拉）
  levelBadge.addEventListener("click", toggleLevelDropdown);
  levelDropdown.addEventListener("click", handleLevelOptionClick);
  document.addEventListener("click", handleOutsideClick);

  // 难度分析
  analyzeDifficultyBtn.addEventListener("click", handleAnalyzeDifficulty);

  // Settings - API 配置自动保存
  apiProviderSelect.addEventListener("change", handleApiProviderChange);
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

  // Settings - 腾讯云 ASR 配置自动保存
  tencentAppIdInput.addEventListener("blur", autoSave);
  tencentSecretIdInput.addEventListener("blur", autoSave);
  tencentSecretKeyInput.addEventListener("blur", autoSave);

  // Settings - 显示/隐藏腾讯云 SecretKey
  showTencentKeyBtn.addEventListener("click", () => {
    const isPassword = tencentSecretKeyInput.type === "password";
    tencentSecretKeyInput.type = isPassword ? "text" : "password";
    showTencentKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 阿里云 ASR 配置自动保存
  alibabaApiKeyInput.addEventListener("blur", autoSave);

  // Settings - 显示/隐藏阿里云 API Key
  showAlibabaKeyBtn.addEventListener("click", () => {
    const isPassword = alibabaApiKeyInput.type === "password";
    alibabaApiKeyInput.type = isPassword ? "text" : "password";
    showAlibabaKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - MiniMax TTS 配置自动保存
  minimaxTTSApiKeyInput.addEventListener("input", handleMiniMaxTTSConfigInput);
  minimaxTTSApiKeyInput.addEventListener("blur", autoSave);
  minimaxTTSModelSelect.addEventListener("change", handleMiniMaxTTSModelChange);
  minimaxTTSVoiceIdInput.addEventListener("input", handleMiniMaxTTSConfigInput);
  minimaxTTSVoiceIdInput.addEventListener("blur", autoSave);

  // Settings - 显示/隐藏 MiniMax API Key
  showMiniMaxTTSKeyBtn.addEventListener("click", () => {
    const isPassword = minimaxTTSApiKeyInput.type === "password";
    minimaxTTSApiKeyInput.type = isPassword ? "text" : "password";
    showMiniMaxTTSKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试 MiniMax TTS 连接
  testMiniMaxTTSBtn.addEventListener("click", handleTestMiniMaxTTS);

  // Settings - 小米 TTS 配置自动保存
  xiaomiTTSApiKeyInput.addEventListener("input", handleXiaomiTTSApiKeyInput);
  xiaomiTTSApiKeyInput.addEventListener("blur", autoSave);
  xiaomiTTSVoiceSelect.addEventListener("change", handleXiaomiTTSVoiceChange);
  clearXiaomiTTSStylesBtn.addEventListener("click", handleClearXiaomiTTSStyles);
  xiaomiTTSStyleButtons.forEach((button) => {
    button.addEventListener("click", handleXiaomiTTSStyleClick);
  });

  // Settings - 显示/隐藏小米 API Key
  showXiaomiTTSKeyBtn.addEventListener("click", () => {
    const isPassword = xiaomiTTSApiKeyInput.type === "password";
    xiaomiTTSApiKeyInput.type = isPassword ? "text" : "password";
    showXiaomiTTSKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试小米 TTS 连接
  testXiaomiTTSBtn.addEventListener("click", handleTestXiaomiTTS);

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

// ====== 水平选择器（徽章式下拉） ======

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
function handleLevelOptionClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(
    ".level-option"
  ) as HTMLElement;
  if (!target) return;

  const level = target.dataset.level as CEFRLevel;
  if (!level) return;

  // 更新 UI
  updateLevelBadge(level);
  closeLevelDropdown();

  // 更新配置
  currentConfig.user_english_level = level;

  // 立即保存并刷新模式
  handleEnglishLevelChange(level);
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

/**
 * 初始化/更新水平选择器 UI
 */
function updateLevelSelector(): void {
  const level = currentConfig.user_english_level || DEFAULT_USER_ENGLISH_LEVEL;
  updateLevelBadge(level);
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
  const selectedProvider = apiProviderSelect.value as ApiProviderType;
  const apiBaseUrl =
    selectedProvider === "custom"
      ? apiBaseUrlInput.value.trim()
      : API_BASE_URL_PRESETS[selectedProvider];
  const model =
    modelSelect.value === "custom" ? customModelInput.value : modelSelect.value;

  currentConfig.api_base_url = apiBaseUrl;
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

  // 腾讯云 ASR 配置（只有填写了才保存）
  const appId = tencentAppIdInput.value.trim();
  const secretId = tencentSecretIdInput.value.trim();
  const secretKey = tencentSecretKeyInput.value.trim();

  if (appId || secretId || secretKey) {
    currentConfig.tencent_asr = {
      app_id: appId,
      secret_id: secretId,
      secret_key: secretKey,
    };
  } else {
    // 如果全部为空，删除配置
    delete currentConfig.tencent_asr;
  }

  // 阿里云 ASR 配置（只有填写了才保存）
  const alibabaApiKey = alibabaApiKeyInput.value.trim();

  if (alibabaApiKey) {
    currentConfig.alibaba_asr = {
      api_key: alibabaApiKey,
    };
  } else {
    // 如果为空，删除配置
    delete currentConfig.alibaba_asr;
  }

  // MiniMax TTS 配置（API Key 为空视为禁用，但保留模型与音色偏好）
  const minimaxTTSApiKey = minimaxTTSApiKeyInput.value.trim();
  const minimaxTTSModel = normalizeMiniMaxTTSModel(minimaxTTSModelSelect.value);
  const minimaxTTSVoiceId = minimaxTTSVoiceIdInput.value.trim();
  const hasCustomMiniMaxModel = minimaxTTSModel !== MINIMAX_TTS_DEFAULT_MODEL;

  if (minimaxTTSApiKey || hasCustomMiniMaxModel || minimaxTTSVoiceId) {
    currentConfig.minimax_tts = {
      api_key: minimaxTTSApiKey,
      ...(hasCustomMiniMaxModel ? { model: minimaxTTSModel } : {}),
      ...(minimaxTTSVoiceId ? { voice_id: minimaxTTSVoiceId } : {}),
    };
  } else {
    delete currentConfig.minimax_tts;
  }

  // 小米 TTS 配置（API Key 为空视为禁用，直接使用浏览器 TTS）
  const xiaomiTTSApiKey = xiaomiTTSApiKeyInput.value.trim();
  const xiaomiTTSVoice = normalizeXiaomiTTSVoice(xiaomiTTSVoiceSelect.value);
  const xiaomiTTSStyles = getXiaomiTTSStylesFromUI();
  const hasCustomVoice = xiaomiTTSVoice !== XIAOMI_TTS_DEFAULT_VOICE;

  if (xiaomiTTSApiKey || hasCustomVoice || hasXiaomiTTSStyles(xiaomiTTSStyles)) {
    currentConfig.xiaomi_tts = {
      api_key: xiaomiTTSApiKey,
      ...(hasCustomVoice ? { voice: xiaomiTTSVoice } : {}),
      ...(xiaomiTTSStyles ? { styles: xiaomiTTSStyles } : {}),
    };
  } else {
    delete currentConfig.xiaomi_tts;
  }

  updateMiniMaxTTSButtonAvailability();
  updateXiaomiTTSButtonAvailability();
}

// ====== Settings 表单更新 ======

function updateSettingsForm(): void {
  isTestingMiniMaxTTS = false;
  isTestingXiaomiTTS = false;
  clearMiniMaxTTSResetTimer();
  clearXiaomiTTSResetTimer();
  hideMiniMaxTTSStatus();
  hideXiaomiTTSStatus();

  // API 配置
  const providerType = resolveApiProviderType(currentConfig.api_base_url);
  apiProviderSelect.value = providerType;
  applyApiProviderSelection(providerType, currentConfig.api_base_url || "");
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

  // 腾讯云 ASR 配置
  tencentAppIdInput.value = currentConfig.tencent_asr?.app_id || "";
  tencentSecretIdInput.value = currentConfig.tencent_asr?.secret_id || "";
  tencentSecretKeyInput.value = currentConfig.tencent_asr?.secret_key || "";

  // 阿里云 ASR 配置
  alibabaApiKeyInput.value = currentConfig.alibaba_asr?.api_key || "";

  // MiniMax TTS 配置
  minimaxTTSApiKeyInput.value = currentConfig.minimax_tts?.api_key || "";
  minimaxTTSModelSelect.value = normalizeMiniMaxTTSModel(
    currentConfig.minimax_tts?.model
  );
  minimaxTTSVoiceIdInput.value =
    currentConfig.minimax_tts?.voice_id || "";

  // 小米 TTS 配置
  xiaomiTTSApiKeyInput.value = currentConfig.xiaomi_tts?.api_key || "";
  xiaomiTTSVoiceSelect.value = normalizeXiaomiTTSVoice(
    currentConfig.xiaomi_tts?.voice
  );
  applyXiaomiTTSStyleSelection(currentConfig.xiaomi_tts?.styles);
  updateMiniMaxTTSButtonAvailability();
  updateXiaomiTTSButtonAvailability();
}

function clearMiniMaxTTSResetTimer(): void {
  clearServiceTestResetTimer(minimaxTTSResetTimer);
  minimaxTTSResetTimer = null;
}

function clearXiaomiTTSResetTimer(): void {
  clearServiceTestResetTimer(xiaomiTTSResetTimer);
  xiaomiTTSResetTimer = null;
}

function showMiniMaxTTSStatus(
  message: string,
  type: "success" | "error" | "loading"
): void {
  showServiceTestStatus(minimaxTTSStatus, message, type);
}

function hideMiniMaxTTSStatus(): void {
  hideServiceTestStatus(minimaxTTSStatus);
}

function showXiaomiTTSStatus(
  message: string,
  type: "success" | "error" | "loading"
): void {
  showServiceTestStatus(xiaomiTTSStatus, message, type);
}

function hideXiaomiTTSStatus(): void {
  hideServiceTestStatus(xiaomiTTSStatus);
}

function setMiniMaxTTSButtonState(
  state: ServiceTestState,
  disabled: boolean,
  title: string
): void {
  setServiceTestButtonState(testMiniMaxTTSBtn, state, disabled, title);
}

function setXiaomiTTSButtonState(
  state: ServiceTestState,
  disabled: boolean,
  title: string
): void {
  setServiceTestButtonState(testXiaomiTTSBtn, state, disabled, title);
}

function updateMiniMaxTTSButtonAvailability(): void {
  clearMiniMaxTTSResetTimer();
  if (isTestingMiniMaxTTS) return;

  if (!minimaxTTSApiKeyInput.value.trim()) {
    setMiniMaxTTSButtonState("idle", true, "填写 API Key 后可测试");
    return;
  }

  setMiniMaxTTSButtonState("idle", false, "测试 MiniMax 语音合成服务");
}

function updateXiaomiTTSButtonAvailability(): void {
  clearXiaomiTTSResetTimer();
  if (isTestingXiaomiTTS) return;

  if (!xiaomiTTSApiKeyInput.value.trim()) {
    setXiaomiTTSButtonState("idle", true, "填写 API Key 后可测试");
    return;
  }

  setXiaomiTTSButtonState("idle", false, "测试小米语音合成服务");
}

function handleMiniMaxTTSConfigInput(): void {
  isTestingMiniMaxTTS = false;
  hideMiniMaxTTSStatus();
  updateMiniMaxTTSButtonAvailability();
}

async function handleMiniMaxTTSModelChange(): Promise<void> {
  handleMiniMaxTTSConfigInput();
  await autoSave();
}

function handleXiaomiTTSApiKeyInput(): void {
  isTestingXiaomiTTS = false;
  hideXiaomiTTSStatus();
  updateXiaomiTTSButtonAvailability();
}

function handleXiaomiTTSConfigInput(): void {
  isTestingXiaomiTTS = false;
  hideXiaomiTTSStatus();
  updateXiaomiTTSButtonAvailability();
}

async function handleXiaomiTTSVoiceChange(): Promise<void> {
  handleXiaomiTTSConfigInput();
  await autoSave();
}

async function handleClearXiaomiTTSStyles(event: Event): Promise<void> {
  event.preventDefault();
  applyXiaomiTTSStyleSelection();
  handleXiaomiTTSConfigInput();
  await autoSave();
}

async function handleXiaomiTTSStyleClick(event: Event): Promise<void> {
  const button = event.currentTarget as HTMLButtonElement;
  const group = button.dataset.xiaomiTtsStyleGroup as XiaomiTTSStyleGroupKey;
  const value = button.dataset.xiaomiTtsStyleValue;

  if (!isValidXiaomiTTSStyleValue(group, value)) {
    return;
  }

  const nextSelection = getXiaomiTTSStylesFromUI() || {};

  if (nextSelection[group] === value) {
    delete nextSelection[group];
  } else {
    setXiaomiTTSStyleValue(nextSelection, group, value);
  }

  applyXiaomiTTSStyleSelection(nextSelection);
  handleXiaomiTTSConfigInput();
  await autoSave();
}

function getMiniMaxTTSFailureReason(
  response: TestTTSConnectionResponse
): string {
  switch (response.errorCode) {
    case "TTS_NOT_CONFIGURED":
      return "请先填写 API Key";
    case "TTS_BAD_REQUEST":
      switch (response.errorHint) {
        case "VOICE_INVALID":
          return "voice_id 参数不正确";
        case "MODEL_INVALID":
          return "模型参数不正确";
        case "MESSAGES_INVALID":
          return "请求格式不符合接口要求";
        case "AUDIO_PARAM_INVALID":
          return "音频参数不正确";
        case "PARAM_INCORRECT":
        default:
          return appendTTSErrorDetail("请求参数不正确", response);
      }
    case "TTS_AUTH_ERROR":
      return "API Key 无效或无权限";
    case "TTS_FORBIDDEN":
      return "当前服务不可用或无访问权限";
    case "TTS_CONTENT_BLOCKED":
      return "输入内容触发审核拦截";
    case "TTS_ENDPOINT_ERROR":
      return appendTTSErrorDetail("端点不可用", response);
    case "TTS_NETWORK_ERROR":
      return "网络异常或端点无法访问";
    case "TTS_RATE_LIMIT":
      return "请求过于频繁或额度受限";
    case "TTS_SERVER_ERROR":
      return "MiniMax 服务内部异常";
    case "TTS_SERVER_BUSY":
      return "MiniMax 服务繁忙，请稍后重试";
    case "TTS_AUDIO_INVALID":
      return appendTTSErrorDetail("服务返回了无效音频数据", response);
    case "TTS_UNKNOWN_ERROR":
      return appendTTSErrorDetail("请求失败", response);
    default:
      return appendTTSErrorDetail("请求失败", response);
  }
}

function getXiaomiTTSFailureReason(
  response: TestTTSConnectionResponse
): string {
  switch (response.errorCode) {
    case "TTS_NOT_CONFIGURED":
      return "请先填写 API Key";
    case "TTS_BAD_REQUEST":
      switch (response.errorHint) {
        case "VOICE_INVALID":
          return "音色参数不正确";
        case "MODEL_INVALID":
          return "模型参数不正确";
        case "MESSAGES_INVALID":
          return "消息格式不符合接口要求";
        case "AUDIO_PARAM_INVALID":
          return "音频参数不正确";
        case "PARAM_INCORRECT":
        default:
          return appendTTSErrorDetail("请求参数不正确", response);
      }
    case "TTS_AUTH_ERROR":
      return "API Key 无效或无权限";
    case "TTS_FORBIDDEN":
      return "当前地区不可用，或 API Key 被风控";
    case "TTS_CONTENT_BLOCKED":
      return "输入内容触发审核拦截";
    case "TTS_ENDPOINT_ERROR":
      return appendTTSErrorDetail("端点不可用", response);
    case "TTS_NETWORK_ERROR":
      return "网络异常或端点无法访问";
    case "TTS_RATE_LIMIT":
      return "请求过于频繁或额度受限";
    case "TTS_SERVER_ERROR":
      return "小米服务内部异常";
    case "TTS_SERVER_BUSY":
      return "小米服务负载过高，请稍后重试";
    case "TTS_AUDIO_INVALID":
      return appendTTSErrorDetail("服务返回了无效音频数据", response);
    case "TTS_UNKNOWN_ERROR":
      return appendTTSErrorDetail("请求失败", response);
    default:
      return appendTTSErrorDetail("请求失败", response);
  }
}

async function handleTestMiniMaxTTS(event: Event): Promise<void> {
  event.stopPropagation();

  if (testMiniMaxTTSBtn.disabled || !minimaxTTSApiKeyInput.value.trim()) {
    return;
  }

  isTestingMiniMaxTTS = true;
  setMiniMaxTTSButtonState("loading", true, "测试中...");
  showMiniMaxTTSStatus("正在测试 MiniMax 语音合成服务...", "loading");

  try {
    await autoSave();

    const response: TestTTSConnectionResponse = await chrome.runtime.sendMessage({
      type: MessageType.TEST_TTS_CONNECTION,
      payload: { provider: "minimax" },
    });

    if (response.success) {
      showMiniMaxTTSStatus("连接成功", "success");
      setMiniMaxTTSButtonState("success", true, "测试成功");
    } else {
      const failureReason = getMiniMaxTTSFailureReason(response);
      showMiniMaxTTSStatus(`连接失败：${failureReason}`, "error");
      setMiniMaxTTSButtonState("error", true, `连接失败：${failureReason}`);
    }
  } catch {
    showMiniMaxTTSStatus("连接失败：测试请求发送失败", "error");
    setMiniMaxTTSButtonState("error", true, "连接失败：测试请求发送失败");
  } finally {
    clearMiniMaxTTSResetTimer();
    minimaxTTSResetTimer = window.setTimeout(() => {
      isTestingMiniMaxTTS = false;
      hideMiniMaxTTSStatus();
      updateMiniMaxTTSButtonAvailability();
    }, 5000);
  }
}

async function handleTestXiaomiTTS(event: Event): Promise<void> {
  event.stopPropagation();

  if (testXiaomiTTSBtn.disabled || !xiaomiTTSApiKeyInput.value.trim()) {
    return;
  }

  isTestingXiaomiTTS = true;
  setXiaomiTTSButtonState("loading", true, "测试中...");
  showXiaomiTTSStatus("正在测试小米语音合成服务...", "loading");

  try {
    await autoSave();

    const response: TestTTSConnectionResponse = await chrome.runtime.sendMessage({
      type: MessageType.TEST_TTS_CONNECTION,
      payload: { provider: "xiaomi" },
    });

    if (response.success) {
      showXiaomiTTSStatus("连接成功", "success");
      setXiaomiTTSButtonState("success", true, "测试成功");
    } else {
      const failureReason = getXiaomiTTSFailureReason(response);
      showXiaomiTTSStatus(`连接失败：${failureReason}`, "error");
      setXiaomiTTSButtonState(
        "error",
        true,
        `连接失败：${failureReason}`
      );
    }
  } catch {
    showXiaomiTTSStatus("连接失败：测试请求发送失败", "error");
    setXiaomiTTSButtonState("error", true, "连接失败：测试请求发送失败");
  } finally {
    clearXiaomiTTSResetTimer();
    xiaomiTTSResetTimer = window.setTimeout(() => {
      isTestingXiaomiTTS = false;
      hideXiaomiTTSStatus();
      updateXiaomiTTSButtonAvailability();
    }, 5000);
  }
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

function handleApiProviderChange(): void {
  const providerType = apiProviderSelect.value as ApiProviderType;
  applyApiProviderSelection(providerType, currentConfig.api_base_url || "");

  if (providerType === "custom") {
    apiBaseUrlInput.focus();
  } else {
    autoSave();
  }
}

function resolveApiProviderType(apiBaseUrl?: string): ApiProviderType {
  const normalized = normalizeApiBaseUrl(apiBaseUrl || "");
  if (normalized === API_BASE_URL_PRESETS.deepseek) {
    return "deepseek";
  }
  if (normalized === API_BASE_URL_PRESETS.openai) {
    return "openai";
  }
  return "custom";
}

function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function applyApiProviderSelection(
  providerType: ApiProviderType,
  currentBaseUrl: string
): void {
  if (providerType === "custom") {
    apiBaseUrlInput.readOnly = false;
    apiBaseUrlInput.value = currentBaseUrl;
    apiBaseUrlInput.placeholder = "https://api.example.com";
    return;
  }

  apiBaseUrlInput.readOnly = true;
  apiBaseUrlInput.value = API_BASE_URL_PRESETS[providerType];
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
  const isNested = header.dataset.nested === "true";
  if (!targetId) return;

  const body = document.getElementById(targetId);
  if (!body) return;

  const isOpen = body.classList.contains("open");

  if (isNested) {
    // 嵌套 accordion：只在同级范围内互斥
    const parent = header.closest(".accordion-body");
    if (parent) {
      parent.querySelectorAll(".accordion-body.open").forEach((openBody) => {
        openBody.classList.remove("open");
      });
      parent.querySelectorAll(".accordion-header.expanded").forEach((h) => {
        h.classList.remove("expanded");
      });
    }
  } else {
    // 顶层 accordion：关闭所有同级
    const section = header.closest(".settings-group");
    if (section) {
      section.querySelectorAll(":scope > .accordion-item > .accordion-body.open").forEach((openBody) => {
        openBody.classList.remove("open");
      });
      section.querySelectorAll(":scope > .accordion-item > .accordion-header.expanded").forEach((h) => {
        h.classList.remove("expanded");
      });
    }
  }

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
    analyzeDifficultyBtn.textContent = "当前页面";
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

// ====== 语料库标签页 ======

/**
 * 打开语料库标签页
 *
 * 在新标签页中打开语料库页面（听力训练）。
 */
function openCorpusPage(): void {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/corpus/corpus.html"),
  });
  window.close(); // 关闭 popup
}

// ====== 外教标签页 ======

/**
 * 打开外教标签页
 *
 * 在新标签页中打开外教页面（长难句分析 + 发音评估）。
 */
function openTutorPage(): void {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/tutor/tutor.html"),
  });
  window.close(); // 关闭 popup
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
