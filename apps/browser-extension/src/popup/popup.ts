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
  DEFAULT_SENTENCE_ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_SENTENCE_ANALYSIS_USER_PROMPT,
} from "../constants/sentenceAnalysisPrompts";
import {
  DEFAULT_EXPLANATION_PROMPT_PRESET_ID,
  getExplanationPromptPreset,
  inferExplanationPromptPresetId,
  isExplanationPromptPresetId,
  matchesExplanationPromptPreset,
} from "../constants/explanationPromptPresets";
import {
  buildDesktopHandoffEnvelope,
  buildDesktopHandoffUrl,
} from "../shared/desktopHandoff";
import { loadRustCoreHost } from "../shared/rustCoreHost";
import {
  AIProviderId,
  AnalyzeDifficultyResponse,
  CEFRLevel,
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  DifficultyResult,
  EnglishDefinitionPromptConfig,
  ExplanationPromptPresetId,
  ExtractPageTextResponse,
  LingridConfig,
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_API_BASE_URL_CN,
  MINIMAX_TTS_DEFAULT_MODEL,
  MessageType,
  MiniMaxTTSModel,
  MiniMaxEmotion,
  OpenAIAuthMode,
  OpenAIModelCatalogResponseData,
  OpenAIModelCatalogScope,
  OpenAIModelItem,
  OpenAIOAuthStatus,
  ParaphrasePromptConfig,
  normalizeMiniMaxTTSBaseUrl,
  resolveConfigApiProvider,
  resolveConfigOpenAIAuthMode,
  DiagnoseTTSResponse,
  TestTTSConnectionResponse,
  TTSSelectionMode,
  XIAOMI_TTS_DEFAULT_VOICE,
  normalizeXiaomiTTSVoice,
  DOUBAO_TTS_DEFAULT_VOICE,
  normalizeDoubaoTTSVoice,
  ASRSelectionMode,
  isAlibabaASRConfigured,
  isDoubaoASRConfigured,
  isMiniMaxASRConfigured,
  isTencentASRConfigured,
  isXiaomiASRConfigured,
  resolveASRSelection,
} from "../types";
import {
  AI_PROVIDER_BASE_URL_PRESETS,
  CUSTOM_MODEL_PLACEHOLDER,
  MINIMAX_ENDPOINT_OPTIONS,
  getDefaultModelForProvider,
  getStaticModelOptions,
  normalizeMiniMaxAIBaseUrl,
  normalizeModelForProviderSwitch,
  type ModelOption,
} from "./aiServiceOptions";

// ====== 类型定义 ======

/** 阅读模式 */
type ReadingMode = "paraphrase" | "mixed" | "translate" | null;
type ApiProviderType = AIProviderId;
type ServiceTestState = "idle" | "loading" | "success" | "error";

interface OpenAIOAuthState {
  status: OpenAIOAuthStatus;
  expiresAt?: number;
  accountId?: string;
}

type OpenAIModelCatalogState = OpenAIModelCatalogResponseData;

/** 模式描述映射 */
const MODE_DESCRIPTIONS: Record<string, string> = {
  paraphrase: "将英文改写为适合您水平的版本",
  mixed: "保留能理解的英文，用中文替换超纲部分",
  translate: "在原文下方显示中文翻译",
};

const MODE_DEFAULT_DESC = "选择一种阅读模式开始学习";
const OPENAI_API_MODEL_PLACEHOLDER = "如 gpt-5.1-codex";
const OPENAI_MODEL_CATALOG_POLL_INTERVAL_MS = 2000;
const OPENAI_MODEL_CATALOG_POLL_MAX_ATTEMPTS = 5;
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
];

// ====== DOM 元素引用 ======

// 视图
const viewport = document.querySelector(".viewport") as HTMLElement;

// Header
const corpusBtn = document.getElementById("corpusBtn") as HTMLButtonElement;
const tutorBtn = document.getElementById("tutorBtn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const settingsBadge = document.getElementById("settingsBadge") as HTMLElement;
const backBtn = document.getElementById("backBtn") as HTMLButtonElement;
const expandSettingsBtn = document.getElementById(
  "expandSettingsBtn"
) as HTMLButtonElement;

// 模式选择器
const modeSelector = document.getElementById("modeSelector") as HTMLElement;
const segmentIndicator = document.getElementById(
  "segmentIndicator"
) as HTMLElement;
const modeDesc = document.getElementById("modeDesc") as HTMLElement;
const configHint = document.getElementById("configHint") as HTMLElement;
const configHintText = document.getElementById("configHintText") as HTMLElement;
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
const openDesktopBtn = document.getElementById(
  "openDesktopBtn"
) as HTMLButtonElement;
const difficultyStatus = document.getElementById(
  "difficultyStatus"
) as HTMLElement;
const desktopHandoffStatus = document.getElementById(
  "desktopHandoffStatus"
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
const openaiAuthModeRow = document.getElementById(
  "openaiAuthModeRow"
) as HTMLElement;
const openaiAuthModeDivider = document.getElementById(
  "openaiAuthModeDivider"
) as HTMLElement;
const openaiAuthModeSelect = document.getElementById(
  "openaiAuthModeSelect"
) as HTMLSelectElement;
const apiBaseUrlRow = document.getElementById("apiBaseUrlRow") as HTMLElement;
const apiBaseUrlDivider = document.getElementById(
  "apiBaseUrlDivider"
) as HTMLElement;
const apiBaseUrlInput = document.getElementById(
  "apiBaseUrl"
) as HTMLInputElement;
const apiBaseUrlPresetSelect = document.getElementById(
  "apiBaseUrlPreset"
) as HTMLSelectElement;
const apiKeyRow = document.getElementById("apiKeyRow") as HTMLElement;
const apiKeyDivider = document.getElementById("apiKeyDivider") as HTMLElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const showKeyBtn = document.getElementById("showKeyBtn") as HTMLButtonElement;
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
const customModelInput = document.getElementById(
  "customModel"
) as HTMLInputElement;
const openaiModelCatalogPanel = document.getElementById(
  "openaiModelCatalogPanel"
) as HTMLElement;
const openaiModelCatalogStatus = document.getElementById(
  "openaiModelCatalogStatus"
) as HTMLElement;
const refreshOpenAIModelCatalogBtn = document.getElementById(
  "refreshOpenAIModelCatalogBtn"
) as HTMLButtonElement;
const openaiOauthPanel = document.getElementById(
  "openaiOauthPanel"
) as HTMLElement;
const openaiOauthStatusBadge = document.getElementById(
  "openaiOauthStatusBadge"
) as HTMLElement;
const openaiOauthStatusText = document.getElementById(
  "openaiOauthStatusText"
) as HTMLElement;
const startOpenAIOAuthBtn = document.getElementById(
  "startOpenAIOAuthBtn"
) as HTMLButtonElement;
const disconnectOpenAIOAuthBtn = document.getElementById(
  "disconnectOpenAIOAuthBtn"
) as HTMLButtonElement;
const openaiOauthCallbackInput = document.getElementById(
  "openaiOauthCallbackInput"
) as HTMLTextAreaElement;
const completeOpenAIOAuthBtn = document.getElementById(
  "completeOpenAIOAuthBtn"
) as HTMLButtonElement;
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
const explanationPromptPresetSelect = document.getElementById(
  "explanationPromptPreset"
) as HTMLSelectElement;
const explanationPromptStatus = document.getElementById(
  "explanationPromptStatus"
) as HTMLElement;
const resetExplanationPresetBtn = document.getElementById(
  "resetExplanationPresetBtn"
) as HTMLButtonElement;
const paraphraseSystemPromptTextarea = document.getElementById(
  "paraphraseSystemPrompt"
) as HTMLTextAreaElement;
const paraphraseUserPromptTextarea = document.getElementById(
  "paraphraseUserPrompt"
) as HTMLTextAreaElement;
const englishDefinitionSystemPromptTextarea = document.getElementById(
  "englishDefinitionSystemPrompt"
) as HTMLTextAreaElement;
const englishDefinitionUserPromptTextarea = document.getElementById(
  "englishDefinitionUserPrompt"
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

// Settings - 豆包 ASR 配置
const doubaoAsrApiKeyInput = document.getElementById(
  "doubaoAsrApiKey"
) as HTMLInputElement;
const showDoubaoAsrKeyBtn = document.getElementById(
  "showDoubaoAsrKeyBtn"
) as HTMLButtonElement;

// Settings - 小米 ASR 配置
const xiaomiAsrApiKeyInput = document.getElementById(
  "xiaomiAsrApiKey"
) as HTMLInputElement;
const showXiaomiAsrKeyBtn = document.getElementById(
  "showXiaomiAsrKeyBtn"
) as HTMLButtonElement;

// Settings - MiniMax TTS 配置
const minimaxTTSBaseUrlSelect = document.getElementById(
  "minimaxTTSBaseUrl"
) as HTMLSelectElement;

// MiniMax 端点线路选项（国际/国内直连），AI 与 TTS 各自独立切换
for (const option of MINIMAX_ENDPOINT_OPTIONS) {
  apiBaseUrlPresetSelect.appendChild(new Option(option.label, option.value));
}
for (const option of [
  { value: MINIMAX_TTS_API_BASE_URL, label: "国际线路 (api.minimaxi.com)" },
  { value: MINIMAX_TTS_API_BASE_URL_CN, label: "国内直连 (api.minimax.cn)" },
]) {
  minimaxTTSBaseUrlSelect.appendChild(new Option(option.label, option.value));
}
const minimaxTTSApiKeyInput = document.getElementById(
  "minimaxTTSApiKey"
) as HTMLInputElement;
const showMiniMaxTTSKeyBtn = document.getElementById(
  "showMiniMaxTTSKeyBtn"
) as HTMLButtonElement;
const minimaxTTSModelSelect = document.getElementById(
  "minimaxTTSModel"
) as HTMLSelectElement;
const minimaxTTSVoiceSelect = document.getElementById(
  "minimaxTTSVoiceSelect"
) as HTMLSelectElement;
const testMiniMaxTTSBtn = document.getElementById(
  "testMiniMaxTTSBtn"
) as HTMLButtonElement;
const diagnoseMiniMaxTTSBtn = document.getElementById(
  "diagnoseMiniMaxTTSBtn"
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
const doubaoTTSApiKeyInput = document.getElementById(
  "doubaoTTSApiKey"
) as HTMLInputElement;
const showDoubaoTTSKeyBtn = document.getElementById(
  "showDoubaoTTSKeyBtn"
) as HTMLButtonElement;
const doubaoTTSVoiceSelect = document.getElementById(
  "doubaoTTSVoice"
) as HTMLSelectElement;
const testDoubaoTTSBtn = document.getElementById(
  "testDoubaoTTSBtn"
) as HTMLButtonElement;
const doubaoTTSStatus = document.getElementById(
  "doubaoTTSStatus"
) as HTMLElement;

// Settings - MiniMax TTS 情绪风格
const minimaxEmotionSummary = document.getElementById(
  "minimaxEmotionSummary"
) as HTMLElement;
const clearMiniMaxEmotionsBtn = document.getElementById(
  "clearMiniMaxEmotionsBtn"
) as HTMLButtonElement;
const minimaxEmotionButtons = Array.from(
  document.querySelectorAll("[data-minimax-tts-emotion]")
) as HTMLButtonElement[];

// Settings - TTS 提供者选择
const ttsProviderSelect = document.getElementById(
  "ttsProviderSelect"
) as HTMLSelectElement;

// Settings - ASR 提供者选择
const asrProviderSelect = document.getElementById(
  "asrProviderSelect"
) as HTMLSelectElement;
const asrProviderHint = document.getElementById(
  "asrProviderHint"
) as HTMLParagraphElement;
const minimaxAsrReuseHint = document.getElementById(
  "minimaxAsrReuseHint"
) as HTMLParagraphElement;

// Settings - 操作
const resetDefaultsBtn = document.getElementById(
  "resetDefaultsBtn"
) as HTMLButtonElement;

// ====== 状态 ======

let currentConfig: LingridConfig = { ...DEFAULT_CONFIG };
let currentOpenAIOAuthStatus: OpenAIOAuthState = { status: "missing" };
let currentOpenAIModelCatalog: OpenAIModelCatalogState | null = null;
let currentMode: ReadingMode = null;
let minimaxTTSResetTimer: number | null = null;
let xiaomiTTSResetTimer: number | null = null;
let doubaoTTSResetTimer: number | null = null;
let isTestingMiniMaxTTS = false;
let isTestingXiaomiTTS = false;
let isTestingDoubaoTTS = false;
let openAIModelCatalogPollTimer: number | null = null;
let openAIModelCatalogPollAttempt = 0;
let isRefreshingOpenAIModelCatalog = false;
let isLoadingOpenAIModelCatalog = false;
let openAIModelCatalogInlineError: string | null = null;

function getCurrentApiProvider(): ApiProviderType {
  return resolveConfigApiProvider(currentConfig);
}

function getCurrentOpenAIAuthMode(): OpenAIAuthMode {
  return resolveConfigOpenAIAuthMode(currentConfig);
}

function ensureExplanationPromptPresetId(): ExplanationPromptPresetId {
  if (isExplanationPromptPresetId(currentConfig.explanation_prompt_preset_id)) {
    return currentConfig.explanation_prompt_preset_id;
  }

  const inferredPresetId = inferExplanationPromptPresetId(
    currentConfig.paraphrase_prompts,
    currentConfig.english_definition_prompts
  );

  const presetId =
    inferredPresetId || DEFAULT_EXPLANATION_PROMPT_PRESET_ID;
  currentConfig.explanation_prompt_preset_id = presetId;

  return presetId;
}

function getCurrentExplanationPromptPresetId(): ExplanationPromptPresetId {
  return ensureExplanationPromptPresetId();
}

function getCurrentParaphrasePromptConfig(): ParaphrasePromptConfig {
  const preset = getExplanationPromptPreset(
    getCurrentExplanationPromptPresetId()
  );
  return currentConfig.paraphrase_prompts || preset.paraphrase;
}

function getCurrentEnglishDefinitionPromptConfig(): EnglishDefinitionPromptConfig {
  const preset = getExplanationPromptPreset(
    getCurrentExplanationPromptPresetId()
  );
  return currentConfig.english_definition_prompts || preset.englishDefinition;
}

function getExplanationPromptFormSnapshot(): {
  paraphrasePrompts: ParaphrasePromptConfig;
  englishDefinitionPrompts: EnglishDefinitionPromptConfig;
} {
  return {
    paraphrasePrompts: {
      system_prompt: paraphraseSystemPromptTextarea.value,
      user_prompt_template: paraphraseUserPromptTextarea.value,
    },
    englishDefinitionPrompts: {
      system_prompt: englishDefinitionSystemPromptTextarea.value,
      user_prompt_template: englishDefinitionUserPromptTextarea.value,
    },
  };
}

function applyExplanationPromptPresetValues(
  presetId: ExplanationPromptPresetId
): void {
  const preset = getExplanationPromptPreset(presetId);

  currentConfig.paraphrase_prompts = {
    system_prompt: preset.paraphrase.system_prompt,
    user_prompt_template: preset.paraphrase.user_prompt_template,
  };
  currentConfig.english_definition_prompts = {
    system_prompt: preset.englishDefinition.system_prompt,
    user_prompt_template: preset.englishDefinition.user_prompt_template,
  };
  paraphraseSystemPromptTextarea.value = preset.paraphrase.system_prompt;
  paraphraseUserPromptTextarea.value = preset.paraphrase.user_prompt_template;
  englishDefinitionSystemPromptTextarea.value =
    preset.englishDefinition.system_prompt;
  englishDefinitionUserPromptTextarea.value =
    preset.englishDefinition.user_prompt_template;
  explanationPromptPresetSelect.value = presetId;
  currentConfig.explanation_prompt_preset_id = presetId;
}

function updateExplanationPromptPresetUI(): void {
  const presetId = getCurrentExplanationPromptPresetId();
  const preset = getExplanationPromptPreset(presetId);
  const { paraphrasePrompts, englishDefinitionPrompts } =
    getExplanationPromptFormSnapshot();
  const isCustomized = !matchesExplanationPromptPreset(
    paraphrasePrompts,
    englishDefinitionPrompts,
    presetId
  );

  explanationPromptPresetSelect.value = presetId;
  explanationPromptStatus.textContent = isCustomized ? "已自定义" : "原版";
  explanationPromptStatus.classList.toggle("customized", isCustomized);
  resetExplanationPresetBtn.textContent = `还原 ${preset.label} 原版`;
}

async function handleExplanationPromptPresetChange(): Promise<void> {
  const presetId = explanationPromptPresetSelect.value;
  if (!isExplanationPromptPresetId(presetId)) {
    return;
  }

  applyExplanationPromptPresetValues(presetId);
  updateExplanationPromptPresetUI();
  await autoSave();
  showStatus(
    connectionStatus,
    `已切换到 ${getExplanationPromptPreset(presetId).label}`,
    "success"
  );
}

async function handleResetExplanationPromptPreset(): Promise<void> {
  const presetId = getCurrentExplanationPromptPresetId();
  applyExplanationPromptPresetValues(presetId);
  updateExplanationPromptPresetUI();
  await autoSave();
  showStatus(
    connectionStatus,
    `已还原 ${getExplanationPromptPreset(presetId).label} 原版`,
    "success"
  );
}

function isOpenAIOAuthMode(): boolean {
  return (
    getCurrentApiProvider() === "openai" &&
    getCurrentOpenAIAuthMode() === "oauth"
  );
}

function isOpenAIOAuthConnected(status: OpenAIOAuthState): boolean {
  return status.status === "connected" || status.status === "expired";
}

function hasConfiguredAiAuth(
  config: LingridConfig,
  oauthStatus: OpenAIOAuthState
): boolean {
  const providerType = resolveConfigApiProvider(config);
  const authMode = resolveConfigOpenAIAuthMode(config);
  const activeModel =
    providerType === "openai" && authMode === "oauth"
      ? config.openai_oauth_model?.trim() || ""
      : config.model?.trim() || "";

  if (providerType === "openai" && authMode === "oauth") {
    return isOpenAIOAuthConnected(oauthStatus);
  }

  return Boolean(
    config.api_base_url?.trim() && config.api_key?.trim() && activeModel
  );
}

function getAiConfigHintMessage(
  config: LingridConfig,
  oauthStatus: OpenAIOAuthState
): string {
  const providerType = resolveConfigApiProvider(config);
  const authMode = resolveConfigOpenAIAuthMode(config);

  if (providerType === "openai" && authMode === "oauth") {
    if (oauthStatus.status === "pending") {
      return "需要先完成 OpenAI OAuth 登录";
    }
    return "需要先连接 OpenAI OAuth";
  }

  return "需要先配置 API 服务";
}

function formatOpenAIOAuthExpiry(expiresAt?: number): string {
  if (!expiresAt) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatter.format(new Date(expiresAt));
}

function formatCatalogSyncTime(timestamp?: number): string {
  if (!timestamp) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatter.format(new Date(timestamp));
}

function clearOpenAIModelCatalogPoll(): void {
  if (openAIModelCatalogPollTimer !== null) {
    window.clearTimeout(openAIModelCatalogPollTimer);
    openAIModelCatalogPollTimer = null;
  }
  openAIModelCatalogPollAttempt = 0;
}

function getActiveOpenAIModelCatalogScope(): OpenAIModelCatalogScope {
  return getCurrentOpenAIAuthMode() === "oauth" ? "oauth" : "api";
}

function getCurrentOpenAIModelValue(): string {
  if (getCurrentOpenAIAuthMode() === "oauth") {
    return getDefaultModelForProvider(
      "openai",
      "oauth",
      currentConfig.openai_oauth_model
    );
  }

  return currentConfig.model?.trim() || "";
}

function getOpenAIModelCatalogItemsForActiveScope(): OpenAIModelItem[] {
  if (!currentOpenAIModelCatalog) {
    return [];
  }

  if (currentOpenAIModelCatalog.scope !== getActiveOpenAIModelCatalogScope()) {
    return [];
  }

  return currentOpenAIModelCatalog.items;
}

function buildOpenAIModelOptions(currentValue: string): ModelOption[] {
  const options: ModelOption[] = [];
  const currentItems = getOpenAIModelCatalogItemsForActiveScope();

  if (
    currentValue &&
    !currentItems.some((item) => item.id === currentValue)
  ) {
    options.push({
      value: currentValue,
      label: `当前值：${currentValue}`,
    });
  }

  currentItems.forEach((item) => {
    options.push({
      value: item.id,
      label: item.label,
    });
  });

  options.push({ value: "custom", label: "自定义..." });
  return options;
}

function getOpenAIModelCatalogStatusLines(): string[] {
  if (getCurrentApiProvider() !== "openai") {
    return [];
  }

  const scope = getActiveOpenAIModelCatalogScope();
  const catalog = currentOpenAIModelCatalog;
  const isScopeMatched = catalog?.scope === scope;

  if (isLoadingOpenAIModelCatalog && !isScopeMatched) {
    return ["正在同步 OpenAI 官方模型目录..."];
  }

  if (openAIModelCatalogInlineError) {
    return [openAIModelCatalogInlineError];
  }

  if (!catalog || !isScopeMatched) {
    return ["尚未加载当前方式对应的官方模型目录。"];
  }

  const lines: string[] = [];

  if (scope === "api") {
    if (catalog.verificationState === "verified_by_api_key") {
      lines.push(
        `已按当前 API Key 校验，当前可见 ${catalog.items.length} 个兼容模型。`
      );
    } else if (currentConfig.api_key?.trim()) {
      lines.push("当前显示官方预览列表，保存并校验 API Key 后会收敛为账号可用模型。");
    } else {
      lines.push("当前显示官方预览列表，填写并保存 API Key 后会收敛为账号可用模型。");
    }
  } else {
    lines.push("当前显示官方 Coding / Codex 候选，不保证你的订阅一定可用。");
  }

  const syncTime = formatCatalogSyncTime(catalog.fetchedAt);
  if (syncTime) {
    lines.push(`最近同步：${syncTime}`);
  }

  if (catalog.stale) {
    lines.push("正在后台刷新目录...");
  }

  if (catalog.lastError) {
    lines.push(`最近同步失败：${catalog.lastError}`);
  }

  return lines;
}

function updateOpenAIModelCatalogUI(): void {
  if (getCurrentApiProvider() !== "openai") {
    openaiModelCatalogPanel.style.display = "none";
    return;
  }

  openaiModelCatalogPanel.style.display = "block";
  openaiModelCatalogStatus.textContent = getOpenAIModelCatalogStatusLines().join(
    "\n"
  );
  refreshOpenAIModelCatalogBtn.disabled = isRefreshingOpenAIModelCatalog;
  refreshOpenAIModelCatalogBtn.textContent = isRefreshingOpenAIModelCatalog
    ? "刷新中..."
    : "刷新列表";
}

async function loadOpenAIModelCatalog(options?: {
  force?: boolean;
  backgroundPoll?: boolean;
}): Promise<void> {
  if (getCurrentApiProvider() !== "openai") {
    clearOpenAIModelCatalogPoll();
    updateOpenAIModelCatalogUI();
    return;
  }

  const force = options?.force === true;
  const backgroundPoll = options?.backgroundPoll === true;
  const requestedScope = getActiveOpenAIModelCatalogScope();

  if (force) {
    isRefreshingOpenAIModelCatalog = true;
  }
  if (!backgroundPoll) {
    isLoadingOpenAIModelCatalog = true;
  }
  updateOpenAIModelCatalogUI();

  try {
    openAIModelCatalogInlineError = null;
    const response = (await chrome.runtime.sendMessage({
      type: force
        ? MessageType.REFRESH_OPENAI_MODEL_CATALOG
        : MessageType.GET_OPENAI_MODEL_CATALOG,
    })) as {
      success: boolean;
      data?: OpenAIModelCatalogResponseData;
      error?: string;
    };

    if (response.success && response.data) {
      currentOpenAIModelCatalog = response.data;
      updateAiServiceForm();

      if (
        response.data.scope === requestedScope &&
        response.data.stale &&
        openAIModelCatalogPollAttempt < OPENAI_MODEL_CATALOG_POLL_MAX_ATTEMPTS
      ) {
        if (openAIModelCatalogPollTimer !== null) {
          window.clearTimeout(openAIModelCatalogPollTimer);
          openAIModelCatalogPollTimer = null;
        }
        openAIModelCatalogPollAttempt += 1;
        openAIModelCatalogPollTimer = window.setTimeout(() => {
          void loadOpenAIModelCatalog({ backgroundPoll: true });
        }, OPENAI_MODEL_CATALOG_POLL_INTERVAL_MS);
      } else {
        clearOpenAIModelCatalogPoll();
      }

      return;
    }

    clearOpenAIModelCatalogPoll();
    if (response.error) {
      openAIModelCatalogInlineError = response.error;
    }
  } catch (error) {
    clearOpenAIModelCatalogPoll();
    openAIModelCatalogInlineError = "获取 OpenAI 模型目录失败";
  } finally {
    if (!backgroundPoll) {
      isLoadingOpenAIModelCatalog = false;
    }
    if (force) {
      isRefreshingOpenAIModelCatalog = false;
    }
    updateOpenAIModelCatalogUI();
  }
}

function normalizeMiniMaxTTSModel(value?: string | null): MiniMaxTTSModel {
  if (value && MINIMAX_TTS_MODEL_OPTIONS.includes(value as MiniMaxTTSModel)) {
    return value as MiniMaxTTSModel;
  }

  return MINIMAX_TTS_DEFAULT_MODEL;
}


// MiniMax TTS 情绪风格

function getMiniMaxEmotionFromUI(): MiniMaxEmotion | undefined {
  const activeButton = minimaxEmotionButtons.find((btn) =>
    btn.classList.contains("active")
  );
  return activeButton
    ? (activeButton.dataset.minimaxTtsEmotion as MiniMaxEmotion)
    : undefined;
}

function applyMiniMaxEmotionSelection(emotion?: MiniMaxEmotion): void {
  minimaxEmotionButtons.forEach((button) => {
    const isActive = button.dataset.minimaxTtsEmotion === emotion;
    button.classList.toggle("active", isActive);
  });

  minimaxEmotionSummary.replaceChildren();
  if (!emotion) {
    minimaxEmotionSummary.classList.add("is-empty");
    minimaxEmotionSummary.textContent = "未选择情绪";
    clearMiniMaxEmotionsBtn.classList.add("is-hidden");
  } else {
    const emotionLabels: Record<MiniMaxEmotion, string> = {
      happy: "开心",
      sad: "悲伤",
      angry: "愤怒",
      fearful: "害怕",
      disgusted: "厌恶",
      surprised: "惊讶",
      calm: "平静",
      fluent: "生动",
      whisper: "低语",
    };
    minimaxEmotionSummary.classList.remove("is-empty");
    minimaxEmotionSummary.textContent = emotionLabels[emotion] || emotion;
    clearMiniMaxEmotionsBtn.classList.remove("is-hidden");
  }
}

async function handleClearMiniMaxEmotions(event: Event): Promise<void> {
  event.preventDefault();
  applyMiniMaxEmotionSelection();
  handleMiniMaxTTSConfigInput();
  await autoSave();
}

async function handleMiniMaxEmotionClick(event: Event): Promise<void> {
  const button = event.currentTarget as HTMLButtonElement;
  const emotion = button.dataset.minimaxTtsEmotion as MiniMaxEmotion;

  const currentEmotion = getMiniMaxEmotionFromUI();
  const nextEmotion = currentEmotion === emotion ? undefined : emotion;

  applyMiniMaxEmotionSelection(nextEmotion);
  handleMiniMaxTTSConfigInput();
  await autoSave();
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

  await Promise.all([loadConfig(), loadOpenAIOAuthStatus()]);
  if (getCurrentApiProvider() === "openai") {
    await loadOpenAIModelCatalog();
  }

  updateSettingsForm();
  updateLevelSelector();
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
    }
  } catch (error) {
    console.error("[Lingride] 加载配置失败:", error);
  }
}

async function loadOpenAIOAuthStatus(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_OPENAI_OAUTH_STATUS,
    });

    if (response.success && response.data) {
      currentOpenAIOAuthStatus = response.data;
    } else {
      currentOpenAIOAuthStatus = { status: "missing" };
    }
  } catch (error) {
    console.error("[Lingride] 加载 OpenAI OAuth 状态失败:", error);
    currentOpenAIOAuthStatus = { status: "missing" };
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
  expandSettingsBtn.addEventListener("click", showSettings);
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
  openDesktopBtn.addEventListener("click", () => {
    void handleOpenDesktopHandoff();
  });

  // Settings - API 配置自动保存
  apiProviderSelect.addEventListener("change", handleApiProviderChange);
  openaiAuthModeSelect.addEventListener("change", handleOpenAIAuthModeChange);
  apiBaseUrlInput.addEventListener("blur", autoSave);
  apiBaseUrlPresetSelect.addEventListener("change", autoSave);
  apiKeyInput.addEventListener("blur", handleApiKeyBlur);
  modelSelect.addEventListener("change", handleModelChange);
  customModelInput.addEventListener("blur", autoSave);
  refreshOpenAIModelCatalogBtn.addEventListener(
    "click",
    handleRefreshOpenAIModelCatalog
  );
  startOpenAIOAuthBtn.addEventListener("click", handleStartOpenAIOAuth);
  completeOpenAIOAuthBtn.addEventListener("click", handleCompleteOpenAIOAuth);
  disconnectOpenAIOAuthBtn.addEventListener(
    "click",
    handleDisconnectOpenAIOAuth
  );

  // Settings - 显示/隐藏 API Key
  showKeyBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    showKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 腾讯云 ASR 配置自动保存
  tencentAppIdInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });
  tencentSecretIdInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });
  tencentSecretKeyInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });

  // Settings - 显示/隐藏腾讯云 SecretKey
  showTencentKeyBtn.addEventListener("click", () => {
    const isPassword = tencentSecretKeyInput.type === "password";
    tencentSecretKeyInput.type = isPassword ? "text" : "password";
    showTencentKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 阿里云 ASR 配置自动保存
  alibabaApiKeyInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });

  // Settings - 豆包 ASR 配置自动保存
  doubaoAsrApiKeyInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });
  showDoubaoAsrKeyBtn.addEventListener("click", () => {
    const isPassword = doubaoAsrApiKeyInput.type === "password";
    doubaoAsrApiKeyInput.type = isPassword ? "text" : "password";
    showDoubaoAsrKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 小米 ASR 配置自动保存
  xiaomiAsrApiKeyInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });
  showXiaomiAsrKeyBtn.addEventListener("click", () => {
    const isPassword = xiaomiAsrApiKeyInput.type === "password";
    xiaomiAsrApiKeyInput.type = isPassword ? "text" : "password";
    showXiaomiAsrKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 显示/隐藏阿里云 API Key
  showAlibabaKeyBtn.addEventListener("click", () => {
    const isPassword = alibabaApiKeyInput.type === "password";
    alibabaApiKeyInput.type = isPassword ? "text" : "password";
    showAlibabaKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - MiniMax TTS 配置自动保存
  minimaxTTSBaseUrlSelect.addEventListener("change", handleMiniMaxTTSModelChange);
  minimaxTTSApiKeyInput.addEventListener("input", handleMiniMaxTTSConfigInput);
  minimaxTTSApiKeyInput.addEventListener("blur", autoSave);
  minimaxTTSModelSelect.addEventListener("change", handleMiniMaxTTSModelChange);
  minimaxTTSVoiceSelect.addEventListener("change", handleMiniMaxTTSConfigInput);

  // Settings - 显示/隐藏 MiniMax API Key
  showMiniMaxTTSKeyBtn.addEventListener("click", () => {
    const isPassword = minimaxTTSApiKeyInput.type === "password";
    minimaxTTSApiKeyInput.type = isPassword ? "text" : "password";
    showMiniMaxTTSKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试 MiniMax TTS 连接
  testMiniMaxTTSBtn.addEventListener("click", handleTestMiniMaxTTS);
  diagnoseMiniMaxTTSBtn.addEventListener("click", handleDiagnoseMiniMaxTTS);

  // Settings - 小米 TTS 配置自动保存
  xiaomiTTSApiKeyInput.addEventListener("input", handleXiaomiTTSApiKeyInput);
  xiaomiTTSApiKeyInput.addEventListener("blur", autoSave);
  xiaomiTTSVoiceSelect.addEventListener("change", handleXiaomiTTSVoiceChange);

  // Settings - 显示/隐藏小米 API Key
  showXiaomiTTSKeyBtn.addEventListener("click", () => {
    const isPassword = xiaomiTTSApiKeyInput.type === "password";
    xiaomiTTSApiKeyInput.type = isPassword ? "text" : "password";
    showXiaomiTTSKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试小米 TTS 连接
  testXiaomiTTSBtn.addEventListener("click", handleTestXiaomiTTS);

  // Settings - 豆包 TTS 配置自动保存
  doubaoTTSApiKeyInput.addEventListener("input", handleDoubaoTTSConfigInput);
  doubaoTTSApiKeyInput.addEventListener("blur", autoSave);
  doubaoTTSVoiceSelect.addEventListener("change", handleDoubaoTTSVoiceChange);

  // Settings - 显示/隐藏豆包 API Key
  showDoubaoTTSKeyBtn.addEventListener("click", () => {
    const isPassword = doubaoTTSApiKeyInput.type === "password";
    doubaoTTSApiKeyInput.type = isPassword ? "text" : "password";
    showDoubaoTTSKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试豆包 TTS 连接
  testDoubaoTTSBtn.addEventListener("click", handleTestDoubaoTTS);

  // Settings - MiniMax TTS 情绪风格
  clearMiniMaxEmotionsBtn.addEventListener("click", handleClearMiniMaxEmotions);
  minimaxEmotionButtons.forEach((button) => {
    button.addEventListener("click", handleMiniMaxEmotionClick);
  });

  // Settings - TTS 提供者选择
  ttsProviderSelect.addEventListener("change", async () => {
    await autoSave();
  });

  // Settings - ASR 提供者选择
  asrProviderSelect.addEventListener("change", async () => {
    await autoSave();
    updateASRProviderHint();
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
    englishDefinitionSystemPromptTextarea,
    englishDefinitionUserPromptTextarea,
    mixedTranslateSystemPromptTextarea,
    mixedTranslateUserPromptTextarea,
    sentenceAnalysisSystemPromptTextarea,
    sentenceAnalysisUserPromptTextarea,
  ];
  promptTextareas.forEach((textarea) => {
    textarea.addEventListener("blur", autoSave);
  });
  [
    paraphraseSystemPromptTextarea,
    paraphraseUserPromptTextarea,
    englishDefinitionSystemPromptTextarea,
    englishDefinitionUserPromptTextarea,
  ].forEach((textarea) => {
    textarea.addEventListener("input", updateExplanationPromptPresetUI);
  });
  explanationPromptPresetSelect.addEventListener("change", () => {
    void handleExplanationPromptPresetChange();
  });
  resetExplanationPresetBtn.addEventListener("click", () => {
    void handleResetExplanationPromptPreset();
  });

  // Settings - 恢复默认
  resetDefaultsBtn.addEventListener("click", resetDefaults);
}

// ====== 视图切换 ======

function showSettings(): void {
  viewport.classList.add("show-settings");
  if (getCurrentApiProvider() === "openai" && !currentOpenAIModelCatalog) {
    void loadOpenAIModelCatalog();
  }
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

    if (!hasConfiguredAiAuth(currentConfig, currentOpenAIOAuthStatus)) {
      configHintText.textContent = getAiConfigHintMessage(
        currentConfig,
        currentOpenAIOAuthStatus
      );
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
  handleEnglishLevelChange();
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

async function handleEnglishLevelChange(): Promise<void> {
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
  const hasAiAuth = hasConfiguredAiAuth(
    currentConfig,
    currentOpenAIOAuthStatus
  );
  settingsBadge.style.display = hasAiAuth ? "none" : "";
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

function syncModelSelectOptions(options: ModelOption[]): void {
  modelSelect.innerHTML = "";

  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    modelSelect.appendChild(element);
  });
}

function showPresetModelControl(
  options: ModelOption[],
  modelValue: string,
  placeholder: string
): void {
  syncModelSelectOptions(options);
  modelSelect.style.display = "block";
  customModelInput.placeholder = placeholder;

  const hasPreset = options.some(
    (option) => option.value !== "custom" && option.value === modelValue
  );

  if (hasPreset) {
    modelSelect.value = modelValue;
    customModelInput.style.display = "none";
    customModelInput.value = "";
    return;
  }

  modelSelect.value = "custom";
  customModelInput.value = modelValue;
  customModelInput.style.display = "block";
}

function showDirectModelInput(value: string, placeholder: string): void {
  modelSelect.style.display = "none";
  customModelInput.style.display = "block";
  customModelInput.placeholder = placeholder;
  customModelInput.value = value;
}

function updateOpenAIOAuthUI(): void {
  if (!isOpenAIOAuthMode()) {
    openaiOauthPanel.style.display = "none";
    return;
  }

  openaiOauthPanel.style.display = "block";

  const statusMap: Record<OpenAIOAuthStatus, string> = {
    missing: "未连接",
    pending: "登录进行中",
    connected: "已连接",
    expired: "已过期",
  };

  openaiOauthStatusBadge.textContent =
    statusMap[currentOpenAIOAuthStatus.status];
  openaiOauthStatusBadge.className = `oauth-status-badge ${currentOpenAIOAuthStatus.status}`;

  switch (currentOpenAIOAuthStatus.status) {
    case "connected":
      openaiOauthStatusText.textContent = currentOpenAIOAuthStatus.accountId
        ? `已连接账号 ${currentOpenAIOAuthStatus.accountId}，访问令牌有效期至 ${formatOpenAIOAuthExpiry(
            currentOpenAIOAuthStatus.expiresAt
          )}。`
        : "OpenAI OAuth 已连接。";
      break;
    case "expired":
      openaiOauthStatusText.textContent =
        "访问令牌已过期，实际请求会自动刷新；如果刷新失败，请重新登录。";
      break;
    case "pending":
      openaiOauthStatusText.textContent =
        "浏览器授权完成后，把 localhost 回调地址或 code 粘贴到下方，然后点击“完成登录”。";
      break;
    case "missing":
    default:
      openaiOauthStatusText.textContent =
        "使用 ChatGPT 账号登录后，完成浏览器授权，并把 localhost 回调地址粘贴回这里。";
      break;
  }

  startOpenAIOAuthBtn.textContent = isOpenAIOAuthConnected(
    currentOpenAIOAuthStatus
  )
    ? "重新登录"
    : "开始登录";
  disconnectOpenAIOAuthBtn.disabled =
    currentOpenAIOAuthStatus.status === "missing";
}

async function updateAiServiceForm(): Promise<void> {
  const providerType = getCurrentApiProvider();
  const authMode = getCurrentOpenAIAuthMode();
  const staticModelOptions = await getStaticModelOptions(providerType, currentConfig.api_key);
  const showOpenAIAuthMode = providerType === "openai";
  const showApiCredentialRows =
    !(providerType === "openai" && authMode === "oauth");

  apiProviderSelect.value = providerType;
  openaiAuthModeSelect.value = authMode;

  openaiAuthModeRow.style.display = showOpenAIAuthMode ? "flex" : "none";
  openaiAuthModeDivider.style.display = showOpenAIAuthMode ? "block" : "none";
  apiBaseUrlRow.style.display = showApiCredentialRows ? "flex" : "none";
  apiBaseUrlDivider.style.display = showApiCredentialRows ? "block" : "none";
  apiKeyRow.style.display = showApiCredentialRows ? "flex" : "none";
  apiKeyDivider.style.display = showApiCredentialRows ? "block" : "none";

  applyApiProviderSelection(providerType, currentConfig.api_base_url || "");
  apiKeyInput.value = currentConfig.api_key || "";

  if (staticModelOptions) {
    showPresetModelControl(
      staticModelOptions,
      currentConfig.model ||
        getDefaultModelForProvider(
          providerType,
          authMode,
          currentConfig.openai_oauth_model
        ),
      CUSTOM_MODEL_PLACEHOLDER
    );
  } else if (providerType === "openai" && authMode === "oauth") {
    showPresetModelControl(
      buildOpenAIModelOptions(getCurrentOpenAIModelValue()),
      getCurrentOpenAIModelValue(),
      "输入 Codex 模型名称"
    );
  } else if (providerType === "openai") {
    showPresetModelControl(
      buildOpenAIModelOptions(getCurrentOpenAIModelValue()),
      getCurrentOpenAIModelValue(),
      OPENAI_API_MODEL_PLACEHOLDER
    );
  } else {
    showDirectModelInput(currentConfig.model || "", CUSTOM_MODEL_PLACEHOLDER);
  }

  updateOpenAIModelCatalogUI();
  updateOpenAIOAuthUI();
}

function collectFormData(): void {
  const selectedProvider = apiProviderSelect.value as ApiProviderType;
  const openaiAuthMode = openaiAuthModeSelect.value as OpenAIAuthMode;
  const apiBaseUrl =
    selectedProvider === "custom"
      ? apiBaseUrlInput.value.trim()
      : selectedProvider === "minimax"
      ? normalizeMiniMaxAIBaseUrl(apiBaseUrlPresetSelect.value)
      : getPresetApiBaseUrl(selectedProvider);
  const modelValue =
    modelSelect.style.display === "none"
      ? customModelInput.value.trim()
      : modelSelect.value === "custom"
      ? customModelInput.value.trim()
      : modelSelect.value.trim();

  currentConfig.api_provider = selectedProvider;
  currentConfig.openai_auth_mode = openaiAuthMode;
  currentConfig.api_base_url = apiBaseUrl;

  if (!(selectedProvider === "openai" && openaiAuthMode === "oauth")) {
    currentConfig.api_key = apiKeyInput.value.trim();
  }

  if (selectedProvider === "openai" && openaiAuthMode === "oauth") {
    currentConfig.openai_oauth_model =
      modelValue || DEFAULT_CONFIG.openai_oauth_model;
  } else {
    currentConfig.model = modelValue;
  }

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
  currentConfig.english_definition_prompts = {
    system_prompt: englishDefinitionSystemPromptTextarea.value,
    user_prompt_template: englishDefinitionUserPromptTextarea.value,
  };
  currentConfig.explanation_prompt_preset_id = isExplanationPromptPresetId(
    explanationPromptPresetSelect.value
  )
    ? explanationPromptPresetSelect.value
    : DEFAULT_EXPLANATION_PROMPT_PRESET_ID;
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

  // 豆包 ASR 配置（只有填写了才保存）
  const doubaoAsrApiKey = doubaoAsrApiKeyInput.value.trim();

  if (doubaoAsrApiKey) {
    currentConfig.doubao_asr = {
      api_key: doubaoAsrApiKey,
    };
  } else {
    delete currentConfig.doubao_asr;
  }

  // 小米 ASR 配置（API Key 为空视为未配置）
  const xiaomiAsrApiKey = xiaomiAsrApiKeyInput.value.trim();
  if (xiaomiAsrApiKey) {
    currentConfig.xiaomi_asr = { api_key: xiaomiAsrApiKey };
  } else {
    delete currentConfig.xiaomi_asr;
  }

  // MiniMax TTS 配置（API Key 为空视为禁用，但保留模型与音色偏好）
  const minimaxTTSApiKey = minimaxTTSApiKeyInput.value.trim();
  const minimaxTTSModel = normalizeMiniMaxTTSModel(minimaxTTSModelSelect.value);
  const minimaxTTSVoiceId = minimaxTTSVoiceSelect.value.trim();
  const minimaxEmotion = getMiniMaxEmotionFromUI();
  const hasCustomMiniMaxModel = minimaxTTSModel !== MINIMAX_TTS_DEFAULT_MODEL;
  const minimaxTTSBaseUrl = normalizeMiniMaxTTSBaseUrl(
    minimaxTTSBaseUrlSelect.value
  );
  const hasCustomMiniMaxBaseUrl = minimaxTTSBaseUrl !== MINIMAX_TTS_API_BASE_URL;

  if (minimaxTTSApiKey || hasCustomMiniMaxModel || minimaxTTSVoiceId || minimaxEmotion || hasCustomMiniMaxBaseUrl) {
    currentConfig.minimax_tts = {
      api_key: minimaxTTSApiKey,
      ...(hasCustomMiniMaxBaseUrl ? { api_base_url: minimaxTTSBaseUrl } : {}),
      ...(hasCustomMiniMaxModel ? { model: minimaxTTSModel } : {}),
      ...(minimaxTTSVoiceId ? { voice_id: minimaxTTSVoiceId } : {}),
      ...(minimaxEmotion ? { emotion: minimaxEmotion } : {}),
    };
  } else {
    delete currentConfig.minimax_tts;
  }

  // 小米 TTS 配置（API Key 为空视为禁用，直接使用浏览器 TTS）
  const xiaomiTTSApiKey = xiaomiTTSApiKeyInput.value.trim();
  const xiaomiTTSVoice = normalizeXiaomiTTSVoice(xiaomiTTSVoiceSelect.value);
  const hasCustomVoice = xiaomiTTSVoice !== XIAOMI_TTS_DEFAULT_VOICE;

  if (xiaomiTTSApiKey || hasCustomVoice) {
    currentConfig.xiaomi_tts = {
      api_key: xiaomiTTSApiKey,
      ...(hasCustomVoice ? { voice: xiaomiTTSVoice } : {}),
    };
  } else {
    delete currentConfig.xiaomi_tts;
  }

  // 豆包 TTS 配置（API Key 为空视为禁用）
  const doubaoTTSApiKey = doubaoTTSApiKeyInput.value.trim();
  const doubaoTTSVoice = normalizeDoubaoTTSVoice(doubaoTTSVoiceSelect.value);
  const hasCustomDoubaoVoice = doubaoTTSVoice !== DOUBAO_TTS_DEFAULT_VOICE;

  if (doubaoTTSApiKey || hasCustomDoubaoVoice) {
    currentConfig.doubao_tts = {
      api_key: doubaoTTSApiKey,
      ...(hasCustomDoubaoVoice ? { voice: doubaoTTSVoice } : {}),
    };
  } else {
    delete currentConfig.doubao_tts;
  }

  // TTS 提供者选择
  currentConfig.tts_selection = ttsProviderSelect.value as TTSSelectionMode;

  // ASR 提供者选择
  currentConfig.asr_selection = asrProviderSelect.value as ASRSelectionMode;

  updateMiniMaxTTSButtonAvailability();
  updateXiaomiTTSButtonAvailability();
  updateDoubaoTTSButtonAvailability();
}

// ====== Settings 表单更新 ======

function updateSettingsForm(): void {
  isTestingMiniMaxTTS = false;
  isTestingXiaomiTTS = false;
  isTestingDoubaoTTS = false;
  clearMiniMaxTTSResetTimer();
  clearXiaomiTTSResetTimer();
  clearDoubaoTTSResetTimer();
  hideMiniMaxTTSStatus();
  hideXiaomiTTSStatus();
  hideDoubaoTTSStatus();

  updateAiServiceForm();

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
  const paraphrasePromptConfig = getCurrentParaphrasePromptConfig();
  const englishDefinitionPromptConfig = getCurrentEnglishDefinitionPromptConfig();
  paraphraseSystemPromptTextarea.value = paraphrasePromptConfig.system_prompt;
  paraphraseUserPromptTextarea.value =
    paraphrasePromptConfig.user_prompt_template;
  englishDefinitionSystemPromptTextarea.value =
    englishDefinitionPromptConfig.system_prompt;
  englishDefinitionUserPromptTextarea.value =
    englishDefinitionPromptConfig.user_prompt_template;
  updateExplanationPromptPresetUI();

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
  doubaoAsrApiKeyInput.value = currentConfig.doubao_asr?.api_key || "";
  xiaomiAsrApiKeyInput.value = currentConfig.xiaomi_asr?.api_key || "";

  // MiniMax TTS 配置
  minimaxTTSBaseUrlSelect.value = normalizeMiniMaxTTSBaseUrl(
    currentConfig.minimax_tts?.api_base_url
  );
  minimaxTTSApiKeyInput.value = currentConfig.minimax_tts?.api_key || "";
  minimaxTTSModelSelect.value = normalizeMiniMaxTTSModel(
    currentConfig.minimax_tts?.model
  );
  minimaxTTSVoiceSelect.value =
    currentConfig.minimax_tts?.voice_id || "";
  applyMiniMaxEmotionSelection(currentConfig.minimax_tts?.emotion);

  // 小米 TTS 配置
  xiaomiTTSApiKeyInput.value = currentConfig.xiaomi_tts?.api_key || "";
  xiaomiTTSVoiceSelect.value = normalizeXiaomiTTSVoice(
    currentConfig.xiaomi_tts?.voice
  );

  // 豆包 TTS 配置
  doubaoTTSApiKeyInput.value = currentConfig.doubao_tts?.api_key || "";
  doubaoTTSVoiceSelect.value = normalizeDoubaoTTSVoice(
    currentConfig.doubao_tts?.voice
  );

  // TTS 提供者选择
  ttsProviderSelect.value = currentConfig.tts_selection || "browser";

  // ASR 提供者选择（老配置无字段时按已配置者迁移默认）
  asrProviderSelect.value = resolveASRSelection(currentConfig);
  updateASRProviderHint();

  updateMiniMaxTTSButtonAvailability();
  updateXiaomiTTSButtonAvailability();
  updateDoubaoTTSButtonAvailability();
}

/**
 * 选中云端 ASR 但未配置密钥时，在下拉下方显示黄色提示。
 */
function updateASRProviderHint(): void {
  const selection = asrProviderSelect.value as ASRSelectionMode;
  const labels: Record<string, string> = {
    doubao: "豆包",
    tencent: "腾讯云",
    alibaba: "阿里云",
    minimax: "MiniMax",
    xiaomi: "小米",
  };
  const configuredCheckers: Record<string, (c: LingridConfig) => boolean> = {
    doubao: isDoubaoASRConfigured,
    tencent: isTencentASRConfigured,
    alibaba: isAlibabaASRConfigured,
    minimax: isMiniMaxASRConfigured,
    xiaomi: isXiaomiASRConfigured,
  };

  // MiniMax 复用说明只在选中 MiniMax 时显示
  minimaxAsrReuseHint.style.display =
    selection === "minimax" ? "block" : "none";

  const label = labels[selection];
  const checker = configuredCheckers[selection];
  if (label && checker && !checker(currentConfig)) {
    asrProviderHint.textContent =
      selection === "minimax"
        ? "尚未配置 MiniMax 的 API 密钥（请先在语音合成服务中配置），当前选择不会生效"
        : `尚未配置${label}的 API 密钥，当前选择不会生效`;
    asrProviderHint.style.display = "block";
  } else {
    asrProviderHint.style.display = "none";
  }
}

function clearMiniMaxTTSResetTimer(): void {
  clearServiceTestResetTimer(minimaxTTSResetTimer);
  minimaxTTSResetTimer = null;
}

function clearXiaomiTTSResetTimer(): void {
  clearServiceTestResetTimer(xiaomiTTSResetTimer);
  xiaomiTTSResetTimer = null;
}

function clearDoubaoTTSResetTimer(): void {
  clearServiceTestResetTimer(doubaoTTSResetTimer);
  doubaoTTSResetTimer = null;
}

function showDoubaoTTSStatus(
  message: string,
  type: "success" | "error" | "loading"
): void {
  showServiceTestStatus(doubaoTTSStatus, message, type);
}

function hideDoubaoTTSStatus(): void {
  hideServiceTestStatus(doubaoTTSStatus);
}

function setDoubaoTTSButtonState(
  state: ServiceTestState,
  disabled: boolean,
  title: string
): void {
  setServiceTestButtonState(testDoubaoTTSBtn, state, disabled, title);
}

function updateDoubaoTTSButtonAvailability(): void {
  clearDoubaoTTSResetTimer();
  if (isTestingDoubaoTTS) return;

  if (!doubaoTTSApiKeyInput.value.trim()) {
    setDoubaoTTSButtonState("idle", true, "填写 API Key 后可测试");
    return;
  }

  setDoubaoTTSButtonState("idle", false, "测试豆包语音合成服务");
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
    diagnoseMiniMaxTTSBtn.disabled = true;
    return;
  }

  setMiniMaxTTSButtonState("idle", false, "测试 MiniMax 语音合成服务");
  diagnoseMiniMaxTTSBtn.disabled = false;
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

function getDoubaoTTSFailureReason(
  response: TestTTSConnectionResponse
): string {
  switch (response.errorCode) {
    case "TTS_NOT_CONFIGURED":
      return "请先填写 API Key";
    case "TTS_BAD_REQUEST":
      return appendTTSErrorDetail("请求参数不正确", response);
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
      return "豆包服务内部异常";
    case "TTS_SERVER_BUSY":
      return "豆包服务负载过高，请稍后重试";
    case "TTS_AUDIO_INVALID":
      return appendTTSErrorDetail("服务返回了无效音频数据", response);
    default:
      return appendTTSErrorDetail("请求失败", response);
  }
}

function handleDoubaoTTSConfigInput(): void {
  isTestingDoubaoTTS = false;
  hideDoubaoTTSStatus();
  updateDoubaoTTSButtonAvailability();
}

async function handleDoubaoTTSVoiceChange(): Promise<void> {
  handleDoubaoTTSConfigInput();
  await autoSave();
}

async function handleTestDoubaoTTS(event: Event): Promise<void> {
  event.stopPropagation();

  if (testDoubaoTTSBtn.disabled || !doubaoTTSApiKeyInput.value.trim()) {
    return;
  }

  isTestingDoubaoTTS = true;
  setDoubaoTTSButtonState("loading", true, "测试中...");
  showDoubaoTTSStatus("正在测试豆包语音合成服务...", "loading");

  try {
    await autoSave();

    const response: TestTTSConnectionResponse = await chrome.runtime.sendMessage({
      type: MessageType.TEST_TTS_CONNECTION,
      payload: { provider: "doubao" },
    });

    if (response.success) {
      showDoubaoTTSStatus("连接成功", "success");
      setDoubaoTTSButtonState("success", true, "测试成功");
    } else {
      const failureReason = getDoubaoTTSFailureReason(response);
      showDoubaoTTSStatus(`连接失败：${failureReason}`, "error");
      setDoubaoTTSButtonState("error", true, `连接失败：${failureReason}`);
    }
  } catch {
    showDoubaoTTSStatus("连接失败：测试请求发送失败", "error");
    setDoubaoTTSButtonState("error", true, "连接失败：测试请求发送失败");
  } finally {
    clearDoubaoTTSResetTimer();
    doubaoTTSResetTimer = window.setTimeout(() => {
      isTestingDoubaoTTS = false;
      hideDoubaoTTSStatus();
      updateDoubaoTTSButtonAvailability();
    }, 5000);
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

function formatDiagnoseLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function handleDiagnoseMiniMaxTTS(event: Event): Promise<void> {
  event.stopPropagation();

  if (diagnoseMiniMaxTTSBtn.disabled || !minimaxTTSApiKeyInput.value.trim()) {
    return;
  }

  diagnoseMiniMaxTTSBtn.disabled = true;
  showMiniMaxTTSStatus("正在深度诊断（连续合成 3 次，约需 1 分钟）...", "loading");

  try {
    await autoSave();

    const response: DiagnoseTTSResponse = await chrome.runtime.sendMessage({
      type: MessageType.DIAGNOSE_TTS,
      payload: { provider: "minimax" },
    });

    if (response.success && response.data) {
      const data = response.data;
      const parts: string[] = [
        `${data.successCount}/${data.totalCount} 成功`,
      ];

      if (data.successCount > 0) {
        parts.push(
          `平均 ${formatDiagnoseLatency(data.avgMs)}（${formatDiagnoseLatency(data.minMs)} ~ ${formatDiagnoseLatency(data.maxMs)}）`
        );
      }

      if (data.failures.length > 0) {
        const reasons = data.failures
          .map((failure) => {
            const reason = getMiniMaxTTSFailureReason({
              success: false,
              errorCode: failure.errorCode,
              error: "",
            });
            return `${reason} ×${failure.count}`;
          })
          .join("、");
        parts.push(`失败原因：${reasons}`);
      }

      showMiniMaxTTSStatus(
        parts.join(" · "),
        data.failures.length === 0 ? "success" : "error"
      );
    } else {
      showMiniMaxTTSStatus(
        `诊断失败：${response.error || "未知错误"}`,
        "error"
      );
    }
  } catch {
    showMiniMaxTTSStatus("诊断失败：请求发送失败", "error");
  } finally {
    diagnoseMiniMaxTTSBtn.disabled = false;
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

async function handleApiProviderChange(): Promise<void> {
  const previousProviderType = getCurrentApiProvider();
  const nextProviderType = apiProviderSelect.value as ApiProviderType;
  const previousSelectionWasPreset =
    modelSelect.style.display !== "none" && modelSelect.value !== "custom";

  currentConfig.api_provider = nextProviderType;
  const nextModel =
    nextProviderType === "custom"
      ? null
      : normalizeModelForProviderSwitch(
          previousProviderType,
          nextProviderType,
          previousSelectionWasPreset,
          getCurrentOpenAIAuthMode(),
          currentConfig.openai_oauth_model
        );

  if (nextModel !== null) {
    currentConfig.model = nextModel;
  }

  if (nextProviderType !== "openai") {
    clearOpenAIModelCatalogPoll();
  }
  updateAiServiceForm();

  if (nextProviderType === "custom") {
    await autoSave();
    apiBaseUrlInput.focus();
    return;
  }

  await autoSave();

  if (nextProviderType === "openai") {
    await loadOpenAIModelCatalog();
  }
}

async function handleOpenAIAuthModeChange(): Promise<void> {
  currentConfig.openai_auth_mode = openaiAuthModeSelect.value as OpenAIAuthMode;
  clearOpenAIModelCatalogPoll();
  updateAiServiceForm();
  await autoSave();

  if (getCurrentApiProvider() === "openai") {
    await loadOpenAIModelCatalog();
  }
}

async function handleApiKeyBlur(): Promise<void> {
  await autoSave();

  if (
    getCurrentApiProvider() === "openai" &&
    getCurrentOpenAIAuthMode() === "api_key"
  ) {
    await loadOpenAIModelCatalog({ force: true });
  }
}

async function handleRefreshOpenAIModelCatalog(event: Event): Promise<void> {
  event.preventDefault();

  if (getCurrentApiProvider() !== "openai") {
    return;
  }

  await autoSave();
  await loadOpenAIModelCatalog({ force: true });
}

function applyApiProviderSelection(
  providerType: ApiProviderType,
  currentBaseUrl: string
): void {
  if (providerType === "custom") {
    apiBaseUrlInput.style.display = "";
    apiBaseUrlPresetSelect.style.display = "none";
    apiBaseUrlInput.readOnly = false;
    apiBaseUrlInput.value = currentBaseUrl;
    apiBaseUrlInput.placeholder = "https://api.example.com";
    return;
  }

  if (providerType === "minimax") {
    // MiniMax 提供国际/国内两条固定线路，按代理环境手动切换
    apiBaseUrlInput.style.display = "none";
    apiBaseUrlPresetSelect.style.display = "";
    apiBaseUrlPresetSelect.value = normalizeMiniMaxAIBaseUrl(currentBaseUrl);
    return;
  }

  apiBaseUrlInput.style.display = "";
  apiBaseUrlPresetSelect.style.display = "none";
  apiBaseUrlInput.readOnly = true;
  apiBaseUrlInput.value = getPresetApiBaseUrl(providerType);
}

function getPresetApiBaseUrl(
  providerType: Exclude<ApiProviderType, "custom">
): string {
  return AI_PROVIDER_BASE_URL_PRESETS[providerType];
}

async function handleStartOpenAIOAuth(): Promise<void> {
  showStatus(connectionStatus, "正在创建 OpenAI 登录链接...", "loading");

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.START_OPENAI_OAUTH,
    });

    if (!response.success || !response.data?.authorizeUrl) {
      showStatus(connectionStatus, response.error || "创建登录链接失败", "error");
      return;
    }

    currentOpenAIOAuthStatus = { status: "pending" };
    updateAiServiceForm();
    updateBadge();

    await chrome.tabs.create({
      url: response.data.authorizeUrl,
    });

    showStatus(
      connectionStatus,
      "浏览器已打开登录页。完成授权后，把 localhost 回调地址粘贴回这里。",
      "loading"
    );
  } catch (error) {
    showStatus(connectionStatus, "启动 OpenAI OAuth 失败", "error");
  }
}

async function handleCompleteOpenAIOAuth(): Promise<void> {
  const callbackInput = openaiOauthCallbackInput.value.trim();
  if (!callbackInput) {
    showStatus(connectionStatus, "请先粘贴回调地址或 code", "error");
    return;
  }

  showStatus(connectionStatus, "正在完成 OpenAI OAuth 登录...", "loading");

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.COMPLETE_OPENAI_OAUTH,
      payload: {
        callbackInput,
      },
    });

    if (response.success && response.data) {
      currentOpenAIOAuthStatus = {
        status: "connected",
        expiresAt: response.data.expiresAt,
        accountId: response.data.accountId,
      };
      openaiOauthCallbackInput.value = "";
      updateAiServiceForm();
      updateBadge();
      if (isOpenAIOAuthMode()) {
        await loadOpenAIModelCatalog();
      }
      showStatus(connectionStatus, "OpenAI OAuth 已连接", "success");
      return;
    }

    showStatus(connectionStatus, response.error || "完成登录失败", "error");
  } catch (error) {
    showStatus(connectionStatus, "完成 OpenAI OAuth 登录失败", "error");
  }
}

async function handleDisconnectOpenAIOAuth(): Promise<void> {
  showStatus(connectionStatus, "正在断开 OpenAI OAuth...", "loading");

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.DISCONNECT_OPENAI_OAUTH,
    });

    if (response.success) {
      currentOpenAIOAuthStatus = { status: "missing" };
      openaiOauthCallbackInput.value = "";
      updateAiServiceForm();
      updateBadge();
      updateOpenAIModelCatalogUI();
      showStatus(connectionStatus, "OpenAI OAuth 已断开", "success");
      return;
    }

    showStatus(connectionStatus, response.error || "断开失败", "error");
  } catch (error) {
    showStatus(connectionStatus, "断开 OpenAI OAuth 失败", "error");
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
  applyExplanationPromptPresetValues(DEFAULT_EXPLANATION_PROMPT_PRESET_ID);
  updateExplanationPromptPresetUI();

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

async function handleOpenDesktopHandoff(): Promise<void> {
  openDesktopBtn.disabled = true;
  showStatus(desktopHandoffStatus, "正在为桌面端准备页面内容...", "loading");

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      showStatus(desktopHandoffStatus, "无法获取当前标签页", "error");
      return;
    }

    const response = (await chrome.tabs.sendMessage(activeTab.id, {
      type: MessageType.EXTRACT_PAGE_TEXT,
    })) as ExtractPageTextResponse;

    if (!response.success || !response.data?.text?.trim()) {
      showStatus(
        desktopHandoffStatus,
        response.error || "当前页面没有可导入的正文",
        "error"
      );
      return;
    }

    const envelope = buildDesktopHandoffEnvelope({
      title: activeTab.title || "Linguride Desktop Handoff",
      originUrl: activeTab.url,
      text: response.data.text,
      readerMode: currentMode || "translate",
      preferredSurface: "reader",
      userLevel: currentConfig.user_english_level || DEFAULT_USER_ENGLISH_LEVEL,
    });

    const rustCore = await loadRustCoreHost();
    await rustCore.ingestHandoff(JSON.stringify(envelope));

    await navigator.clipboard.writeText(JSON.stringify(envelope));
    openDesktopHandoffUrl(buildDesktopHandoffUrl(envelope));

    showStatus(
      desktopHandoffStatus,
      envelope.truncated
        ? "已复制并唤起桌面端，内容过长已截断"
        : "已复制并尝试唤起桌面端",
      "success"
    );
  } catch (error) {
    console.error("[Linguride] 桌面端 handoff 失败:", error);
    showStatus(desktopHandoffStatus, "发送到桌面端失败", "error");
  } finally {
    openDesktopBtn.disabled = false;
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0];
}

function openDesktopHandoffUrl(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.click();
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
