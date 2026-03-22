/**
 * @file service-worker.ts
 * @description Background Service Worker 入口
 *
 * Chrome 扩展的后台服务，负责：
 * - 消息路由：处理 Popup 和 Content Script 的消息
 * - API 调用：通过 Provider 调用翻译 API
 * - 配置管理：读写配置到 Chrome Storage
 * - Tab 状态管理：维护每个 Tab 的翻译状态
 *
 * 消息类型：
 * - GET_CONFIG / SAVE_CONFIG: 配置读写
 * - TOGGLE_TRANSLATION / GET_TRANSLATION_STATE / TRANSLATE: 双语翻译
 * - TOGGLE_PARAPHRASE / GET_PARAPHRASE_STATE / PARAPHRASE: 英文释义
 * - TOGGLE_MIXED_TRANSLATE / GET_MIXED_TRANSLATE_STATE / MIXED_TRANSLATE: 混杂中英翻译
 * - TEST_CONNECTION: 测试连接
 * - ANALYZE_DIFFICULTY / EXTRACT_PAGE_TEXT: 难度分析
 * - ANALYZE_SENTENCE: 长难句分析
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { DEFAULT_DIFFICULTY_PROMPTS } from "../constants/difficultyPrompts";
import { DEFAULT_MIXED_TRANSLATE_PROMPTS } from "../constants/mixedTranslatePrompts";
import { DEFAULT_PARAPHRASE_PROMPTS } from "../constants/paraphrasePrompts";
import { DEFAULT_PRONUNCIATION_PROMPTS } from "../constants/pronunciationPrompts";
import { DEFAULT_SENTENCE_ANALYSIS_PROMPTS } from "../constants/sentenceAnalysisPrompts";
import {
  SHADOW_ASSESS_PROMPTS,
  SPLIT_SENTENCES_PROMPTS,
} from "../constants/shadowPrompts";
import {
  CHINESE_TO_ENGLISH_PROMPTS,
  ENGLISH_DEFINITION_PROMPTS,
  ENGLISH_TO_CHINESE_PROMPTS,
} from "../constants/tutorPrompts";
import {
  ANALYZE_LISTENING_PROMPTS,
  SEGMENT_CORPUS_PROMPTS,
} from "../constants/corpusPrompts";
import type { ITranslateProvider } from "../providers";
import {
  AlibabaASRStartResponse,
  AlibabaASRStopResponse,
  AnalyzeDifficultyResponse,
  AnalyzeListeningResponse,
  AnalyzeSentenceResponse,
  AssessPronunciationResponse,
  calculateTargetLevel,
  CEFRLevel,
  ChineseToEnglishResponse,
  CompleteOpenAIOAuthResponse,
  DisconnectOpenAIOAuthResponse,
  DifficultyResult,
  EnglishDefinitionResponse,
  EnglishDefinitionResult,
  EnglishToChineseResponse,
  ExtractPageTextResponse,
  GetOpenAIModelCatalogResponse,
  GetOpenAIOAuthStatusResponse,
  GetConfigResponse,
  GetMixedTranslateStateResponse,
  GetParaphraseStateResponse,
  getRetentionPercent,
  GetTranslationStateResponse,
  LingridConfig,
  ListeningAnalysisResult,
  Message,
  MessageType,
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_DEFAULT_MODEL,
  MINIMAX_TTS_DEFAULT_VOICE_ID,
  MiniMaxTTSModel,
  MixedTranslateResponse,
  ParaphraseResponse,
  PronunciationAssessmentResult,
  ProviderConfig,
  RefreshOpenAIModelCatalogResponse,
  SaveConfigResponse,
  SegmentCorpusResponse,
  SegmentCorpusResult,
  SentenceAnalysisResult,
  ShadowAssessmentResult,
  ShadowAssessResponse,
  SplitSentencesResponse,
  StartOpenAIOAuthResponse,
  SplitSentencesResult,
  SynthesizeSpeechResponse,
  TencentASRSignResponse,
  TestTTSConnectionResponse,
  TestConnectionResponse,
  TTSProviderId,
  TTSServiceErrorCode,
  TTSServiceErrorHint,
  TranslateResponse,
  XIAOMI_TTS_API_BASE_URL,
  XIAOMI_TTS_MODEL,
  XiaomiTTSStyleSelection,
  XiaomiTTSVoice,
} from "../types";
import { assertAiProviderReady, createAIProvider } from "./aiProvider";
import { getConfig, saveConfig } from "./configManager";
import {
  completeOpenAICodexOAuth,
  disconnectOpenAICodexOAuth,
  getOpenAICodexOAuthStatus,
  OpenAICodexAuthError,
  startOpenAICodexOAuth,
} from "./openaiCodexAuth";
import {
  getOpenAIModelCatalog,
  refreshOpenAIModelCatalog,
} from "./openaiModelCatalog";
import {
  getMixedTranslateState,
  getParaphraseState,
  getTabState,
  initTabStateListeners,
  setMixedTranslateState,
  setParaphraseState,
  setTabState,
} from "./tabState";

// ====== 初始化 ======

console.log("[Lingride] Background Service Worker 已启动");

// 初始化 Tab 状态监听器
initTabStateListeners();

// ====== TTS 服务 ======

const XIAOMI_TTS_AUDIO_FORMAT = "wav";
const XIAOMI_TTS_DEFAULT_VOICE: XiaomiTTSVoice = "mimo_default";
const XIAOMI_TTS_TEST_TEXT = "Hello from Lingride.";
const XIAOMI_TTS_REQUEST_PROMPT =
  "Please synthesize the assistant message as speech exactly as written.";
const MINIMAX_TTS_TEST_TEXT = "Hello from Lingride.";
const MINIMAX_TTS_AUDIO_FORMAT = "mp3";
const MINIMAX_TTS_TEXT_MAX_CHARS = 50000;
const MINIMAX_TTS_POLL_INTERVAL_MS = 500;
const MINIMAX_TTS_POLL_TIMEOUT_MS = 20000;
const MINIMAX_TTS_UPLOAD_PURPOSE = "t2a_async_input";
type XiaomiTTSStyleGroupKey = keyof XiaomiTTSStyleSelection;
type XiaomiTTSStyleValue = NonNullable<
  XiaomiTTSStyleSelection[XiaomiTTSStyleGroupKey]
>;
type MiniMaxTaskId = string | number;
type MiniMaxFileId = string | number;
type MiniMaxTaskStatus = "processing" | "success" | "failed" | "expired";

interface TTSAudioData {
  audioBase64: string;
  mimeType: string;
  provider: TTSProviderId;
  fallbackWarningMessage?: string;
}

interface TTSProviderRequestContext {
  config: LingridConfig;
  text: string;
}

interface PreparedAIProviderContext {
  config: LingridConfig;
  provider: ITranslateProvider;
  providerConfig: ProviderConfig;
}

interface XiaomiTTSChatCompletionResponse {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string;
      };
    };
  }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
  message?: string;
}

interface MiniMaxBaseResp {
  status_code?: number;
  status_msg?: string;
}

interface MiniMaxBaseResponsePayload {
  base_resp?: MiniMaxBaseResp;
  message?: string;
  error?: {
    message?: string;
  };
}

interface MiniMaxTTSCreateTaskResponse extends MiniMaxBaseResponsePayload {
  task_id?: MiniMaxTaskId;
  task_token?: string;
  file_id?: MiniMaxFileId;
}

interface MiniMaxTTSQueryTaskResponse extends MiniMaxBaseResponsePayload {
  task_id?: MiniMaxTaskId;
  status?: string;
  file_id?: MiniMaxFileId;
}

interface MiniMaxFileUploadResponse extends MiniMaxBaseResponsePayload {
  file?: {
    file_id?: MiniMaxFileId;
  };
  file_id?: MiniMaxFileId;
}

class TTSError extends Error {
  readonly provider: TTSProviderId;
  readonly code: TTSServiceErrorCode;
  readonly hint?: TTSServiceErrorHint;
  readonly httpStatus?: number;
  readonly detail?: string;

  constructor(params: {
    provider: TTSProviderId;
    code: TTSServiceErrorCode;
    message: string;
    hint?: TTSServiceErrorHint;
    httpStatus?: number;
    detail?: string;
  }) {
    super(params.message);
    this.name = "TTSError";
    this.provider = params.provider;
    this.code = params.code;
    this.hint = params.hint;
    this.httpStatus = params.httpStatus;
    this.detail = params.detail;
  }
}

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
const TTS_PROVIDER_PRIORITY: TTSProviderId[] = ["minimax", "xiaomi"];
const XIAOMI_TTS_STYLE_GROUP_ORDER: XiaomiTTSStyleGroupKey[] = [
  "speed",
  "emotion",
  "role",
  "tone",
  "dialect",
];
const XIAOMI_TTS_STYLE_PROMPTS: Record<
  XiaomiTTSStyleGroupKey,
  Record<string, string>
> = {
  speed: {
    faster: "变快",
    slower: "变慢",
  },
  emotion: {
    happy: "开心",
    sad: "悲伤",
    angry: "生气",
  },
  role: {
    sunwukong: "孙悟空",
    lindaiyu: "林黛玉",
  },
  tone: {
    whisper: "悄悄话",
    jiazi: "夹子音",
    taiwan: "台湾腔",
  },
  dialect: {
    dongbei: "东北话",
    sichuan: "四川话",
    henan: "河南话",
    cantonese: "粤语",
  },
};

function getTTSProviderLabel(provider: TTSProviderId): string {
  return provider === "minimax" ? "MiniMax" : "小米";
}

function getTTSErrorMessage(
  provider: TTSProviderId,
  code: TTSServiceErrorCode
): string {
  const providerLabel = getTTSProviderLabel(provider);

  switch (code) {
    case "TTS_NOT_CONFIGURED":
      return `未配置${providerLabel}语音合成 API Key`;
    case "TTS_BAD_REQUEST":
      return "请求参数不正确";
    case "TTS_AUTH_ERROR":
      return "API Key 无效或无权限";
    case "TTS_FORBIDDEN":
      return "当前服务不可用，或 API Key 无访问权限";
    case "TTS_CONTENT_BLOCKED":
      return "输入内容触发审核拦截";
    case "TTS_ENDPOINT_ERROR":
      return "端点不可用";
    case "TTS_NETWORK_ERROR":
      return "网络异常或端点无法访问";
    case "TTS_RATE_LIMIT":
      return "请求过于频繁或额度受限";
    case "TTS_SERVER_ERROR":
      return `${providerLabel}服务内部异常`;
    case "TTS_SERVER_BUSY":
      return `${providerLabel}服务繁忙，请稍后重试`;
    case "TTS_AUDIO_INVALID":
      return "服务返回了无效音频数据";
    case "TTS_UNKNOWN_ERROR":
      return "语音合成请求失败";
    default:
      return "语音合成请求失败";
  }
}

function buildTTSRequestUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function buildXiaomiTTSRequestUrl(baseUrl: string): string {
  return buildTTSRequestUrl(baseUrl, "chat/completions");
}

function buildMiniMaxTTSCreateTaskUrl(baseUrl: string): string {
  return buildTTSRequestUrl(baseUrl, "t2a_async_v2");
}

function buildMiniMaxTTSQueryUrl(
  baseUrl: string,
  taskId: MiniMaxTaskId
): string {
  const url = new URL(buildTTSRequestUrl(baseUrl, "query/t2a_async_query_v2"));
  url.searchParams.set("task_id", String(taskId));
  return url.toString();
}

function buildMiniMaxTTSUploadUrl(baseUrl: string): string {
  return buildTTSRequestUrl(baseUrl, "files/upload");
}

function buildMiniMaxTTSFileRetrieveUrl(
  baseUrl: string,
  fileId: MiniMaxFileId
): string {
  const url = new URL(buildTTSRequestUrl(baseUrl, "files/retrieve_content"));
  url.searchParams.set("file_id", String(fileId));
  return url.toString();
}

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

function normalizeMiniMaxTaskStatus(
  value?: string | null
): MiniMaxTaskStatus | null {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "processing" ||
    normalized === "success" ||
    normalized === "failed" ||
    normalized === "expired"
  ) {
    return normalized;
  }

  return null;
}

function isValidXiaomiTTSStyleValue(
  group: XiaomiTTSStyleGroupKey,
  value?: string | null
): value is XiaomiTTSStyleValue {
  if (!value) return false;

  return Boolean(XIAOMI_TTS_STYLE_PROMPTS[group][value]);
}

function normalizeXiaomiTTSStyles(
  styles?: XiaomiTTSStyleSelection
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

function getXiaomiTTSVoice(config: LingridConfig): XiaomiTTSVoice {
  return normalizeXiaomiTTSVoice(config.xiaomi_tts?.voice);
}

function getMiniMaxTTSModel(config: LingridConfig): MiniMaxTTSModel {
  return normalizeMiniMaxTTSModel(config.minimax_tts?.model);
}

function getMiniMaxTTSVoiceId(config: LingridConfig): string {
  return config.minimax_tts?.voice_id?.trim() || MINIMAX_TTS_DEFAULT_VOICE_ID;
}

function buildXiaomiTTSAssistantContent(
  text: string,
  config: LingridConfig
): string {
  const styles = normalizeXiaomiTTSStyles(config.xiaomi_tts?.styles);
  if (!hasXiaomiTTSStyles(styles)) {
    return text;
  }

  const promptParts: string[] = [];

  XIAOMI_TTS_STYLE_GROUP_ORDER.forEach((group) => {
    const value = styles?.[group];
    if (!value) return;

    const prompt = XIAOMI_TTS_STYLE_PROMPTS[group][value];
    if (prompt) {
      promptParts.push(prompt);
    }
  });

  if (promptParts.length === 0) {
    return text;
  }

  return `<style>${promptParts.join(" ")}</style>${text}`;
}

function extractTTSErrorMessage(errorText: string): string {
  const trimmedText = errorText.trim();
  if (!trimmedText) return "";

  try {
    const errorData = JSON.parse(errorText) as MiniMaxBaseResponsePayload & {
      error?: { message?: string };
    };
    return (
      errorData.error?.message?.trim() ||
      errorData.message?.trim() ||
      errorData.base_resp?.status_msg?.trim() ||
      trimmedText
    );
  } catch {
    return trimmedText;
  }
}

function getTTSErrorHint(
  errorMessage: string
): TTSServiceErrorHint | undefined {
  const normalizedMessage = errorMessage.toLowerCase();

  if (
    normalizedMessage.includes("voice_id") ||
    normalizedMessage.includes("voice")
  ) {
    return "VOICE_INVALID";
  }

  if (normalizedMessage.includes("model")) {
    return "MODEL_INVALID";
  }

  if (
    normalizedMessage.includes("messages") ||
    normalizedMessage.includes("message")
  ) {
    return "MESSAGES_INVALID";
  }

  if (
    normalizedMessage.includes("audio_setting") ||
    normalizedMessage.includes("audio") ||
    normalizedMessage.includes("format") ||
    normalizedMessage.includes("bitrate")
  ) {
    return "AUDIO_PARAM_INVALID";
  }

  if (
    normalizedMessage.includes("param incorrect") ||
    normalizedMessage.includes("parameter") ||
    normalizedMessage.includes("param") ||
    normalizedMessage.includes("invalid")
  ) {
    return "PARAM_INCORRECT";
  }

  return undefined;
}

function classifyTTSError(
  httpStatus: number,
  errorMessage: string
): {
  code: TTSServiceErrorCode;
  hint?: TTSServiceErrorHint;
} {
  const hint = getTTSErrorHint(errorMessage);

  switch (httpStatus) {
    case 400:
    case 422:
      return {
        code: "TTS_BAD_REQUEST",
        hint,
      };
    case 401:
      return {
        code: "TTS_AUTH_ERROR",
      };
    case 403:
      return {
        code: "TTS_FORBIDDEN",
      };
    case 404:
      return {
        code: "TTS_ENDPOINT_ERROR",
      };
    case 421:
      return {
        code: "TTS_CONTENT_BLOCKED",
      };
    case 429:
      return {
        code: "TTS_RATE_LIMIT",
      };
    case 500:
      return {
        code: "TTS_SERVER_ERROR",
      };
    case 503:
      return {
        code: "TTS_SERVER_BUSY",
      };
    default:
      return {
        code: "TTS_UNKNOWN_ERROR",
        hint,
      };
  }
}

function createTTSError(params: {
  provider: TTSProviderId;
  code: TTSServiceErrorCode;
  hint?: TTSServiceErrorHint;
  httpStatus?: number;
  detail?: string;
  message?: string;
}): TTSError {
  return new TTSError({
    ...params,
    message:
      params.message || getTTSErrorMessage(params.provider, params.code),
  });
}

function normalizeUnknownTTSError(
  provider: TTSProviderId,
  error: unknown
): TTSError {
  if (error instanceof TTSError) {
    return error;
  }

  return createTTSError({
    provider,
    code: "TTS_UNKNOWN_ERROR",
    detail: error instanceof Error ? error.message : undefined,
    message: error instanceof Error ? error.message : "语音合成请求失败",
  });
}

function isXiaomiTTSConfigured(config: LingridConfig): boolean {
  return !!config.xiaomi_tts?.api_key?.trim();
}

function isMiniMaxTTSConfigured(config: LingridConfig): boolean {
  return !!config.minimax_tts?.api_key?.trim();
}

function isTTSProviderConfigured(
  config: LingridConfig,
  provider: TTSProviderId
): boolean {
  return provider === "minimax"
    ? isMiniMaxTTSConfigured(config)
    : isXiaomiTTSConfigured(config);
}

function parseJSONResponse<T>(
  responseText: string,
  params: {
    provider: TTSProviderId;
    code: TTSServiceErrorCode;
    detail?: string;
  }
): T {
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw createTTSError({
      provider: params.provider,
      code: params.code,
      detail: params.detail || responseText.trim() || "响应不是有效 JSON",
    });
  }
}

function ensureMiniMaxBaseResponseSuccess(
  responseText: string,
  payload: MiniMaxBaseResponsePayload,
  provider: TTSProviderId
): void {
  const statusCode = payload.base_resp?.status_code;
  if (typeof statusCode === "number" && statusCode !== 0) {
    throw createTTSError({
      provider,
      code: "TTS_UNKNOWN_ERROR",
      detail:
        extractTTSErrorMessage(responseText) ||
        payload.base_resp?.status_msg ||
        `status_code=${statusCode}`,
    });
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function requestXiaomiTTSAudio(
  context: TTSProviderRequestContext
): Promise<TTSAudioData> {
  const { config, text } = context;

  if (!isXiaomiTTSConfigured(config)) {
    throw createTTSError({
      provider: "xiaomi",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const apiKey = config.xiaomi_tts!.api_key.trim();
  const assistantContent = buildXiaomiTTSAssistantContent(text, config);
  const requestBody = {
    model: XIAOMI_TTS_MODEL,
    messages: [
      {
        role: "user",
        content: XIAOMI_TTS_REQUEST_PROMPT,
      },
      {
        role: "assistant",
        content: assistantContent,
      },
    ],
    audio: {
      format: XIAOMI_TTS_AUDIO_FORMAT,
      voice: getXiaomiTTSVoice(config),
    },
  };

  let response: globalThis.Response;

  try {
    response = await fetch(buildXiaomiTTSRequestUrl(XIAOMI_TTS_API_BASE_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw createTTSError({
      provider: "xiaomi",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "xiaomi",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  const data = parseJSONResponse<XiaomiTTSChatCompletionResponse>(
    responseText,
    {
      provider: "xiaomi",
      code: "TTS_AUDIO_INVALID",
    }
  );
  const audioBase64 = data.choices?.[0]?.message?.audio?.data;

  if (!audioBase64) {
    throw createTTSError({
      provider: "xiaomi",
      code: "TTS_AUDIO_INVALID",
      detail: extractTTSErrorMessage(responseText) || responseText.trim() || undefined,
    });
  }

  return {
    audioBase64,
    mimeType: "audio/wav",
    provider: "xiaomi",
  };
}

async function uploadMiniMaxTextInput(
  apiKey: string,
  text: string
): Promise<MiniMaxFileId> {
  const formData = new FormData();
  formData.append("purpose", MINIMAX_TTS_UPLOAD_PURPOSE);
  formData.append(
    "file",
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    "lingride-tts-input.txt"
  );

  let response: globalThis.Response;

  try {
    response = await fetch(buildMiniMaxTTSUploadUrl(MINIMAX_TTS_API_BASE_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (error) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "minimax",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  const data = parseJSONResponse<MiniMaxFileUploadResponse>(responseText, {
    provider: "minimax",
    code: "TTS_UNKNOWN_ERROR",
  });

  ensureMiniMaxBaseResponseSuccess(responseText, data, "minimax");

  const fileId = data.file?.file_id ?? data.file_id;
  if (!fileId) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_UNKNOWN_ERROR",
      detail: responseText.trim() || "MiniMax 文件上传未返回 file_id",
    });
  }

  return fileId;
}

async function createMiniMaxTTSTask(
  context: TTSProviderRequestContext
): Promise<{ taskId: MiniMaxTaskId; fileId?: MiniMaxFileId }> {
  const { config, text } = context;

  if (!isMiniMaxTTSConfigured(config)) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const apiKey = config.minimax_tts!.api_key.trim();
  const requestBody: Record<string, unknown> = {
    model: getMiniMaxTTSModel(config),
    language_boost: "auto",
    voice_setting: {
      voice_id: getMiniMaxTTSVoiceId(config),
      speed: 1,
      vol: 1,
      pitch: 1,
    },
    audio_setting: {
      format: MINIMAX_TTS_AUDIO_FORMAT,
    },
  };

  if (text.length > MINIMAX_TTS_TEXT_MAX_CHARS) {
    requestBody.text_file_id = await uploadMiniMaxTextInput(apiKey, text);
  } else {
    requestBody.text = text;
  }

  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSCreateTaskUrl(MINIMAX_TTS_API_BASE_URL),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
  } catch (error) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "minimax",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  const data = parseJSONResponse<MiniMaxTTSCreateTaskResponse>(responseText, {
    provider: "minimax",
    code: "TTS_UNKNOWN_ERROR",
  });

  ensureMiniMaxBaseResponseSuccess(responseText, data, "minimax");

  if (!data.task_id) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_UNKNOWN_ERROR",
      detail: responseText.trim() || "MiniMax 创建任务未返回 task_id",
    });
  }

  return {
    taskId: data.task_id,
    fileId: data.file_id,
  };
}

async function queryMiniMaxTTSTask(
  apiKey: string,
  taskId: MiniMaxTaskId
): Promise<MiniMaxTTSQueryTaskResponse> {
  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSQueryUrl(MINIMAX_TTS_API_BASE_URL, taskId),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
  } catch (error) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "minimax",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  const data = parseJSONResponse<MiniMaxTTSQueryTaskResponse>(responseText, {
    provider: "minimax",
    code: "TTS_UNKNOWN_ERROR",
  });

  ensureMiniMaxBaseResponseSuccess(responseText, data, "minimax");
  return data;
}

async function waitForMiniMaxTaskFileId(
  apiKey: string,
  taskId: MiniMaxTaskId,
  initialFileId?: MiniMaxFileId
): Promise<MiniMaxFileId> {
  const startedAt = Date.now();
  let fileId = initialFileId;

  while (Date.now() - startedAt < MINIMAX_TTS_POLL_TIMEOUT_MS) {
    const data = await queryMiniMaxTTSTask(apiKey, taskId);
    if (data.file_id) {
      fileId = data.file_id;
    }

    const status = normalizeMiniMaxTaskStatus(data.status);

    if (status === "success") {
      if (fileId) {
        return fileId;
      }

      throw createTTSError({
        provider: "minimax",
        code: "TTS_UNKNOWN_ERROR",
        detail: `MiniMax 任务已成功，但未返回 file_id（task_id=${taskId}）`,
      });
    }

    if (status === "failed" || status === "expired") {
      throw createTTSError({
        provider: "minimax",
        code: "TTS_UNKNOWN_ERROR",
        detail: `MiniMax 任务状态为 ${status}（task_id=${taskId}）`,
      });
    }

    if (!status) {
      throw createTTSError({
        provider: "minimax",
        code: "TTS_UNKNOWN_ERROR",
        detail:
          data.status?.trim() ||
          `MiniMax 任务返回了未知状态（task_id=${taskId}）`,
      });
    }

    await sleep(MINIMAX_TTS_POLL_INTERVAL_MS);
  }

  throw createTTSError({
    provider: "minimax",
    code: "TTS_SERVER_BUSY",
    detail: `MiniMax 任务轮询超时（task_id=${taskId}）`,
  });
}

async function downloadMiniMaxTTSAudio(
  apiKey: string,
  fileId: MiniMaxFileId
): Promise<TTSAudioData> {
  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSFileRetrieveUrl(MINIMAX_TTS_API_BASE_URL, fileId),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
  } catch (error) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  if (!response.ok) {
    const responseText = await response.text();
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "minimax",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  const audioBuffer = await response.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_AUDIO_INVALID",
      detail: `MiniMax 下载的音频为空（file_id=${fileId}）`,
    });
  }

  return {
    audioBase64: arrayBufferToBase64(audioBuffer),
    mimeType: "audio/mpeg",
    provider: "minimax",
  };
}

async function requestMiniMaxTTSAudio(
  context: TTSProviderRequestContext
): Promise<TTSAudioData> {
  const apiKey = context.config.minimax_tts?.api_key?.trim();
  if (!apiKey) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const { taskId, fileId } = await createMiniMaxTTSTask(context);
  const outputFileId = await waitForMiniMaxTaskFileId(apiKey, taskId, fileId);
  return downloadMiniMaxTTSAudio(apiKey, outputFileId);
}

async function requestTTSAudioByProvider(
  provider: TTSProviderId,
  context: TTSProviderRequestContext
): Promise<TTSAudioData> {
  return provider === "minimax"
    ? requestMiniMaxTTSAudio(context)
    : requestXiaomiTTSAudio(context);
}

async function requestTTSAudioWithPriority(text: string): Promise<TTSAudioData> {
  const config = await getConfig();
  const context: TTSProviderRequestContext = {
    config,
    text,
  };
  let firstFailure: TTSError | null = null;

  for (const provider of TTS_PROVIDER_PRIORITY) {
    if (!isTTSProviderConfigured(config, provider)) {
      continue;
    }

    try {
      const result = await requestTTSAudioByProvider(provider, context);

      if (firstFailure) {
        return {
          ...result,
          fallbackWarningMessage: `${getTTSProviderLabel(
            firstFailure.provider
          )} 失败，已切换到${getTTSProviderLabel(provider)}语音合成`,
        };
      }

      return result;
    } catch (error) {
      const normalizedError = normalizeUnknownTTSError(provider, error);
      if (!firstFailure) {
        firstFailure = normalizedError;
      }
    }
  }

  if (firstFailure) {
    throw firstFailure;
  }

  throw createTTSError({
    provider: "minimax",
    code: "TTS_NOT_CONFIGURED",
    message: "未配置 AI 语音合成服务 API Key",
  });
}

// ====== 消息处理 ======

/**
 * 处理 GET_CONFIG 消息
 *
 * 返回当前存储的完整配置。
 */
async function handleGetConfig(): Promise<GetConfigResponse> {
  try {
    const config = await getConfig();
    return {
      success: true,
      data: config,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取配置失败",
    };
  }
}

/**
 * 处理 SAVE_CONFIG 消息
 *
 * 保存配置到 Chrome Storage。
 */
async function handleSaveConfig(
  payload: LingridConfig
): Promise<SaveConfigResponse> {
  try {
    const previousConfig = await getConfig();
    await saveConfig(payload);

    if (previousConfig.tts_speed !== payload.tts_speed && payload.tts_speed) {
      try {
        await chrome.runtime.sendMessage({
          type: MessageType.TTS_SPEED_CHANGED,
          payload: { speed: payload.tts_speed },
        });
      } catch (error) {
        console.warn("[Lingride] 广播 TTS 语速变更失败:", error);
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存配置失败",
    };
  }
}

async function handleGetOpenAIModelCatalog(): Promise<GetOpenAIModelCatalogResponse> {
  try {
    const config = await getConfig();
    const data = await getOpenAIModelCatalog(config);
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "获取 OpenAI 模型目录失败",
    };
  }
}

async function handleRefreshOpenAIModelCatalog(): Promise<RefreshOpenAIModelCatalogResponse> {
  try {
    const config = await getConfig();
    const data = await refreshOpenAIModelCatalog(config);
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "刷新 OpenAI 模型目录失败",
    };
  }
}

async function getAiReadinessError(): Promise<string | null> {
  const config = await getConfig();
  const readiness = await assertAiProviderReady(config);
  return readiness.ok ? null : readiness.error;
}

async function prepareAIProvider(): Promise<PreparedAIProviderContext> {
  const config = await getConfig();
  const readiness = await assertAiProviderReady(config);

  if (!readiness.ok) {
    throw new Error(readiness.error);
  }

  return {
    config,
    providerConfig: readiness.providerConfig,
    provider: await createAIProvider(config),
  };
}

function buildOpenAIOAuthErrorResponse(error: unknown): {
  success: false;
  error: string;
  errorCode?: OpenAICodexAuthError["code"];
} {
  if (error instanceof OpenAICodexAuthError) {
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : "OpenAI OAuth 操作失败",
  };
}

async function handleStartOpenAIOAuth(): Promise<StartOpenAIOAuthResponse> {
  try {
    const data = await startOpenAICodexOAuth();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return buildOpenAIOAuthErrorResponse(error);
  }
}

async function handleCompleteOpenAIOAuth(
  callbackInput: string
): Promise<CompleteOpenAIOAuthResponse> {
  try {
    const data = await completeOpenAICodexOAuth(callbackInput);
    return {
      success: true,
      data,
    };
  } catch (error) {
    return buildOpenAIOAuthErrorResponse(error);
  }
}

async function handleGetOpenAIOAuthStatus(): Promise<GetOpenAIOAuthStatusResponse> {
  try {
    const data = await getOpenAICodexOAuthStatus();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return buildOpenAIOAuthErrorResponse(error);
  }
}

async function handleDisconnectOpenAIOAuth(): Promise<DisconnectOpenAIOAuthResponse> {
  try {
    await disconnectOpenAICodexOAuth();
    return {
      success: true,
      data: {
        disconnected: true,
      },
    };
  } catch (error) {
    return buildOpenAIOAuthErrorResponse(error);
  }
}

/**
 * 处理 TOGGLE_TRANSLATION 消息
 *
 * 切换指定 Tab 的翻译状态，并通知 Content Script。
 */
async function handleToggleTranslation(
  tabId: number,
  enabled: boolean
): Promise<GetTranslationStateResponse> {
  try {
    if (enabled) {
      const readinessError = await getAiReadinessError();
      if (readinessError) {
        return {
          success: false,
          error: readinessError,
        };
      }
    }

    // 更新状态
    setTabState(tabId, enabled);

    // 通知 Content Script
    try {
      await chrome.tabs.sendMessage(
        tabId,
        {
          type: "TRANSLATION_STATE_CHANGED",
          payload: { enabled },
        },
        { frameId: 0 }
      );
      console.log("[Lingride] 已通知 Content Script, enabled:", enabled);
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(
          tabId,
          {
            type: "TRANSLATION_STATE_CHANGED",
            payload: { enabled },
          },
          { frameId: 0 }
        );
        console.log("[Lingride] 注入并通知 Content Script 成功");
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面启用翻译，请刷新页面后重试",
        };
      }
    }

    return {
      success: true,
      data: { enabled },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "切换翻译状态失败",
    };
  }
}

/**
 * 处理 GET_TRANSLATION_STATE 消息
 *
 * 返回指定 Tab 的翻译状态。
 */
function handleGetTranslationState(tabId: number): GetTranslationStateResponse {
  const enabled = getTabState(tabId);
  return {
    success: true,
    data: { enabled },
  };
}

/**
 * 处理 TRANSLATE 消息
 *
 * 调用翻译 Provider 进行文本翻译。
 */
async function handleTranslate(
  texts: string[],
  batchId: string
): Promise<TranslateResponse> {
  console.log(
    `[Lingride] 收到翻译请求: batchId=${batchId}, texts=${texts.length}条`
  );

  try {
    const { provider, providerConfig } = await prepareAIProvider();
    console.log(
      `[Lingride] Provider 配置: provider=${provider.name}, model=${providerConfig.model}`
    );

    console.log("[Lingride] 开始调用 API...");
    const translations = await provider.translate(texts);
    console.log(`[Lingride] API 返回成功: ${translations.length}条翻译`);

    return {
      success: true,
      data: {
        batchId,
        translations,
      },
    };
  } catch (error) {
    console.error("[Lingride] 翻译失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "翻译失败",
    };
  }
}

/**
 * 处理 TEST_CONNECTION 消息
 *
 * 测试 API 连接是否正常。
 */
async function handleTestConnection(): Promise<TestConnectionResponse> {
  try {
    const { provider, providerConfig } = await prepareAIProvider();
    const result = await provider.testConnection();

    if (result.success) {
      return {
        success: true,
        data: {
          latency: result.latency,
          model: providerConfig.model,
        },
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "测试连接失败",
    };
  }
}

/**
 * 处理 TEST_TTS_CONNECTION 消息
 *
 * 测试指定 TTS Provider 配置是否可用。
 */
async function handleTestTTSConnection(
  provider: TTSProviderId
): Promise<TestTTSConnectionResponse> {
  try {
    const config = await getConfig();
    const text = provider === "minimax" ? MINIMAX_TTS_TEST_TEXT : XIAOMI_TTS_TEST_TEXT;

    await requestTTSAudioByProvider(provider, {
      config,
      text,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof TTSError) {
      return {
        success: false,
        errorCode: error.code,
        error: error.message,
        errorHint: error.hint,
        httpStatus: error.httpStatus,
        errorDetail: error.detail,
      };
    }

    return {
      success: false,
      errorCode: "TTS_UNKNOWN_ERROR",
      error:
        error instanceof Error ? error.message : "语音合成服务连接失败",
      errorDetail: error instanceof Error ? error.message : undefined,
    };
  }
}

/**
 * 处理 SYNTHESIZE_SPEECH 消息
 *
 * 按优先级调用 AI TTS 生成音频。
 */
async function handleSynthesizeSpeech(
  text: string
): Promise<SynthesizeSpeechResponse> {
  try {
    if (!text.trim()) {
      return {
        success: false,
        errorCode: "TTS_BAD_REQUEST",
        error: "朗读文本不能为空",
      };
    }

    const data = await requestTTSAudioWithPriority(text.trim());
    return {
      success: true,
      data,
    };
  } catch (error) {
    if (error instanceof TTSError) {
      return {
        success: false,
        errorCode: error.code,
        error: error.message,
        errorHint: error.hint,
        httpStatus: error.httpStatus,
        errorDetail: error.detail,
      };
    }

    return {
      success: false,
      errorCode: "TTS_UNKNOWN_ERROR",
      error: error instanceof Error ? error.message : "语音合成失败",
      errorDetail: error instanceof Error ? error.message : undefined,
    };
  }
}

/**
 * 处理 ANALYZE_DIFFICULTY 消息
 *
 * 分析当前页面的英文难度级别。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取当前 Tab
 * 3. 向 Content Script 发送提取文本请求
 * 4. 调用 AI 进行难度分析
 * 5. 解析并返回结果
 */
async function handleAnalyzeDifficulty(): Promise<AnalyzeDifficultyResponse> {
  try {
    // 1. 获取配置并验证
    const { config, provider } = await prepareAIProvider();

    // 2. 获取当前活动 Tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab?.id) {
      return {
        success: false,
        error: "无法获取当前 Tab",
      };
    }

    const tabId = activeTab.id;

    // 3. 向 Content Script 发送提取文本请求
    let extractResponse: ExtractPageTextResponse;

    try {
      extractResponse = await chrome.tabs.sendMessage(
        tabId,
        {
          type: MessageType.EXTRACT_PAGE_TEXT,
        },
        { frameId: 0 }
      );
    } catch (e) {
      // Content Script 未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        extractResponse = await chrome.tabs.sendMessage(
          tabId,
          {
            type: MessageType.EXTRACT_PAGE_TEXT,
          },
          { frameId: 0 }
        );
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面分析难度（可能是浏览器内置页面）",
        };
      }
    }

    if (!extractResponse.success || !extractResponse.data) {
      return {
        success: false,
        error: extractResponse.error || "无法提取页面文本",
      };
    }

    const { text, wordCount, isSelection } = extractResponse.data;
    console.log(
      `[Lingride] 提取文本成功: ${wordCount} 词, 选中文本: ${isSelection}`
    );

    // 4. 获取 Prompt 配置（用户自定义或默认）
    const prompts = config.difficulty_prompts || DEFAULT_DIFFICULTY_PROMPTS;
    const userPrompt = prompts.user_prompt_template.replace("{text}", text);

    // 5. 调用 AI 进行分析
    console.log("[Lingride] 开始难度分析...");
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 6. 解析 JSON 响应
    let result: DifficultyResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 添加额外信息
    result.sampleWordCount = wordCount;
    result.isSelection = isSelection;

    console.log("[Lingride] 难度分析完成:", result.difficultyLevel);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 难度分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "难度分析失败",
    };
  }
}

// ====== 释义功能 ======

/**
 * 处理 TOGGLE_PARAPHRASE 消息
 *
 * 切换指定 Tab 的释义状态，并通知 Content Script。
 * 释义与翻译互斥。
 */
async function handleToggleParaphrase(
  tabId: number,
  enabled: boolean
): Promise<GetParaphraseStateResponse> {
  try {
    // 检查配置是否有效
    const config = await getConfig();
    if (enabled) {
      const readinessError = await getAiReadinessError();
      if (readinessError) {
        return {
          success: false,
          error: readinessError,
        };
      }
    }

    // 更新状态（TabState 内部处理互斥逻辑）
    setParaphraseState(tabId, enabled);

    // 获取用户等级（用于缓存键）
    const userLevel = config.user_english_level || "A2";

    // 通知 Content Script（附带用户等级）
    try {
      await chrome.tabs.sendMessage(
        tabId,
        {
          type: "PARAPHRASE_STATE_CHANGED",
          payload: { enabled, userLevel },
        },
        { frameId: 0 }
      );
      console.log(
        "[Lingride] 已通知 Content Script 释义状态, enabled:",
        enabled,
        ", userLevel:",
        userLevel
      );
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(
          tabId,
          {
            type: "PARAPHRASE_STATE_CHANGED",
            payload: { enabled, userLevel },
          },
          { frameId: 0 }
        );
        console.log("[Lingride] 注入并通知 Content Script 成功");
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面启用释义，请刷新页面后重试",
        };
      }
    }

    return {
      success: true,
      data: { enabled },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "切换释义状态失败",
    };
  }
}

/**
 * 处理 GET_PARAPHRASE_STATE 消息
 *
 * 返回指定 Tab 的释义状态。
 */
function handleGetParaphraseState(tabId: number): GetParaphraseStateResponse {
  const enabled = getParaphraseState(tabId);
  return {
    success: true,
    data: { enabled },
  };
}

/**
 * 处理 PARAPHRASE 消息
 *
 * 调用 AI 将英文文本改写为适合用户水平的版本。
 * 使用批量处理模式，与翻译功能类似。
 */
async function handleParaphrase(
  texts: string[],
  batchId: string
): Promise<ParaphraseResponse> {
  console.log(
    `[Lingride] 收到释义请求: batchId=${batchId}, texts=${texts.length}条`
  );

  try {
    // 获取配置
    const { config, provider } = await prepareAIProvider();

    // 获取用户水平和目标水平
    const userLevel = config.user_english_level || "A2";
    const targetLevel = calculateTargetLevel(userLevel);
    console.log(`[Lingride] 用户水平: ${userLevel}, 目标水平: ${targetLevel}`);

    // 获取 Prompt 配置
    const prompts = config.paraphrase_prompts || DEFAULT_PARAPHRASE_PROMPTS;

    // 构建批量文本（编号格式）
    const numberedTexts = texts
      .map((text, index) => `${index + 1}---\n${text}\n---`)
      .join("\n\n");

    // 构建 User Prompt
    const userPrompt = prompts.user_prompt_template
      .replace("{{texts}}", numberedTexts)
      .replace(/\{\{user_level\}\}/g, userLevel)
      .replace(/\{\{target_level\}\}/g, targetLevel);

    // 调用 AI
    console.log("[Lingride] 开始调用释义 API...");
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 解析响应（编号格式）
    const paraphrases = parseNumberedResponse(aiResponse, texts.length);
    console.log(`[Lingride] 释义完成: ${paraphrases.length}条`);

    return {
      success: true,
      data: {
        batchId,
        paraphrases,
      },
    };
  } catch (error) {
    console.error("[Lingride] 释义失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "释义失败",
    };
  }
}

/**
 * 解析编号格式的响应
 *
 * 响应格式：NUMBER---content---
 */
function parseNumberedResponse(
  response: string,
  expectedCount: number
): string[] {
  const results: string[] = [];

  // 尝试匹配编号格式
  const pattern = /(\d+)---\s*([\s\S]*?)\s*---/g;
  let match;

  while ((match = pattern.exec(response)) !== null) {
    const index = parseInt(match[1], 10) - 1;
    const content = match[2].trim();
    if (index >= 0 && index < expectedCount) {
      results[index] = content;
    }
  }

  // 检查是否所有条目都已解析
  if (results.filter(Boolean).length === expectedCount) {
    return results;
  }

  // 备用方案：按段落分割
  console.warn("[Lingride] 编号格式解析失败，尝试按段落分割");
  const paragraphs = response
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // 清理可能的序号前缀
  return paragraphs.slice(0, expectedCount).map((p) => {
    // 移除可能的序号前缀，如 "1. " 或 "1) " 或 "1---"
    return p.replace(/^\d+[\.\)\-]+\s*/, "").trim();
  });
}

// ====== 混杂中英翻译功能 ======

/**
 * 处理 TOGGLE_MIXED_TRANSLATE 消息
 *
 * 切换指定 Tab 的混杂中英翻译状态，并通知 Content Script。
 * 混杂中英与翻译、释义三者互斥。
 */
async function handleToggleMixedTranslate(
  tabId: number,
  enabled: boolean
): Promise<GetMixedTranslateStateResponse> {
  try {
    // 检查配置是否有效
    const config = await getConfig();
    if (enabled) {
      const readinessError = await getAiReadinessError();
      if (readinessError) {
        return {
          success: false,
          error: readinessError,
        };
      }
    }

    // 更新状态（TabState 内部处理互斥逻辑）
    setMixedTranslateState(tabId, enabled);

    // 获取用户等级（用于缓存键）
    const userLevel = config.user_english_level || "A2";

    // 通知 Content Script（附带用户等级）
    try {
      await chrome.tabs.sendMessage(
        tabId,
        {
          type: "MIXED_TRANSLATE_STATE_CHANGED",
          payload: { enabled, userLevel },
        },
        { frameId: 0 }
      );
      console.log(
        "[Lingride] 已通知 Content Script 混杂中英状态, enabled:",
        enabled,
        ", userLevel:",
        userLevel
      );
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(
          tabId,
          {
            type: "MIXED_TRANSLATE_STATE_CHANGED",
            payload: { enabled, userLevel },
          },
          { frameId: 0 }
        );
        console.log("[Lingride] 注入并通知 Content Script 成功");
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面启用混杂中英翻译，请刷新页面后重试",
        };
      }
    }

    return {
      success: true,
      data: { enabled },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "切换混杂中英翻译状态失败",
    };
  }
}

/**
 * 处理 GET_MIXED_TRANSLATE_STATE 消息
 *
 * 返回指定 Tab 的混杂中英翻译状态。
 */
function handleGetMixedTranslateState(
  tabId: number
): GetMixedTranslateStateResponse {
  const enabled = getMixedTranslateState(tabId);
  return {
    success: true,
    data: { enabled },
  };
}

/**
 * 处理 MIXED_TRANSLATE 消息
 *
 * 调用 AI 将英文文本转换为中英混杂文本。
 * 根据用户 CEFR 等级动态调整英文保留比例。
 * 使用批量处理模式，与翻译/释义功能类似。
 */
async function handleMixedTranslate(
  texts: string[],
  batchId: string
): Promise<MixedTranslateResponse> {
  console.log(
    `[Lingride] 收到混杂中英翻译请求: batchId=${batchId}, texts=${texts.length}条`
  );

  try {
    // 获取配置
    const { config, provider } = await prepareAIProvider();

    // 获取用户水平和保留比例
    const userLevel = config.user_english_level || "A2";
    const retentionPercent = getRetentionPercent(userLevel);
    console.log(
      `[Lingride] 用户水平: ${userLevel}, 英文保留比例: ${retentionPercent}%`
    );

    // 获取 Prompt 配置
    const prompts =
      config.mixed_translate_prompts || DEFAULT_MIXED_TRANSLATE_PROMPTS;

    // 构建批量文本（编号格式）
    const numberedTexts = texts
      .map((text, index) => `${index + 1}---\n${text}\n---`)
      .join("\n\n");

    // 构建 User Prompt
    const userPrompt = prompts.user_prompt_template
      .replace("{{texts}}", numberedTexts)
      .replace(/\{\{user_level\}\}/g, userLevel)
      .replace(/\{\{retention_percent\}\}/g, retentionPercent.toString());

    // 调用 AI
    console.log("[Lingride] 开始调用混杂中英翻译 API...");
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 解析响应（编号格式）
    const mixedTexts = parseNumberedResponse(aiResponse, texts.length);
    console.log(`[Lingride] 混杂中英翻译完成: ${mixedTexts.length}条`);

    return {
      success: true,
      data: {
        batchId,
        mixedTexts,
      },
    };
  } catch (error) {
    console.error("[Lingride] 混杂中英翻译失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "混杂中英翻译失败",
    };
  }
}

// ====== 长难句分析功能 ======

/**
 * 处理 ANALYZE_SENTENCE 消息
 *
 * 对用户输入的英文长难句进行结构化分析。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置（用户自定义或默认）
 * 3. 替换 {{sentence}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleAnalyzeSentence(
  sentence: string
): Promise<AnalyzeSentenceResponse> {
  try {
    // 1. 获取配置并验证
    const { config, provider } = await prepareAIProvider();

    // 2. 获取 Prompt 配置（用户自定义或默认）
    const prompts =
      config.sentence_analysis_prompts || DEFAULT_SENTENCE_ANALYSIS_PROMPTS;
    const userPrompt = prompts.user_prompt_template.replace(
      "{{sentence}}",
      sentence
    );

    // 3. 调用 AI 进行分析
    console.log("[Lingride] 开始长难句分析...");
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 4. 解析 JSON 响应（三级 fallback 策略）
    let result: SentenceAnalysisResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    console.log("[Lingride] 长难句分析完成");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 长难句分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "长难句分析失败",
    };
  }
}

// ====== 发音评估功能 ======

/**
 * 处理 ASSESS_PRONUNCIATION 消息
 *
 * 对比用户的口语发音（语音识别文本）与原文，给出评估和改进建议。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置
 * 3. 替换 {{original}} 和 {{recognized}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleAssessPronunciation(
  original: string,
  recognized: string
): Promise<AssessPronunciationResponse> {
  try {
    // 1. 获取配置并验证
    const { provider } = await prepareAIProvider();

    // 2. 获取 Prompt 配置
    const prompts = DEFAULT_PRONUNCIATION_PROMPTS;
    const userPrompt = prompts.user_prompt_template
      .replace("{{original}}", original)
      .replace("{{recognized}}", recognized);

    // 3. 调用 AI 进行分析
    console.log("[Lingride] 开始发音评估...");
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 4. 解析 JSON 响应（三级 fallback 策略）
    let result: PronunciationAssessmentResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    console.log("[Lingride] 发音评估完成, score:", result.score);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 发音评估失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "发音评估失败",
    };
  }
}

// ====== 外教助手功能 ======

/**
 * 处理中译英请求
 *
 * 调用 AI 将中文文本翻译成英文。
 */
async function handleChineseToEnglish(
  text: string
): Promise<ChineseToEnglishResponse> {
  try {
    // 1. 获取 Provider 配置
    const { provider } = await prepareAIProvider();

    // 2. 构建 Prompt
    const userPrompt = CHINESE_TO_ENGLISH_PROMPTS.user_prompt_template.replace(
      "{{text}}",
      text
    );

    // 3. 调用 AI
    console.log("[Lingride] 开始中译英...");
    const translation = await provider.chat(
      CHINESE_TO_ENGLISH_PROMPTS.system_prompt,
      userPrompt
    );

    console.log("[Lingride] 中译英完成");

    return {
      success: true,
      data: { translation: translation.trim() },
    };
  } catch (error) {
    console.error("[Lingride] 中译英失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "中译英失败",
    };
  }
}

/**
 * 处理英译中请求
 *
 * 调用 AI 将英文文本翻译成中文。
 */
async function handleEnglishToChinese(
  text: string
): Promise<EnglishToChineseResponse> {
  try {
    // 1. 获取 Provider 配置
    const { provider } = await prepareAIProvider();

    // 2. 构建 Prompt
    const userPrompt = ENGLISH_TO_CHINESE_PROMPTS.user_prompt_template.replace(
      "{{text}}",
      text
    );

    // 3. 调用 AI
    console.log("[Lingride] 开始英译中...");
    const translation = await provider.chat(
      ENGLISH_TO_CHINESE_PROMPTS.system_prompt,
      userPrompt
    );

    console.log("[Lingride] 英译中完成");

    return {
      success: true,
      data: { translation: translation.trim() },
    };
  } catch (error) {
    console.error("[Lingride] 英译中失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "英译中失败",
    };
  }
}

/**
 * 处理英英释义请求
 *
 * 调用 AI 用英语解释英文词汇/句子，根据用户 CEFR 水平调整复杂度。
 */
async function handleEnglishDefinition(
  text: string,
  userLevel: CEFRLevel
): Promise<EnglishDefinitionResponse> {
  try {
    // 1. 获取 Provider 配置
    const { provider } = await prepareAIProvider();

    // 2. 构建 Prompt
    const userPrompt = ENGLISH_DEFINITION_PROMPTS.user_prompt_template
      .replace(/\{\{text\}\}/g, text)
      .replace(/\{\{user_level\}\}/g, userLevel);

    // 3. 调用 AI
    console.log(`[Lingride] 开始英英释义 (${userLevel})...`);
    const aiResponse = await provider.chat(
      ENGLISH_DEFINITION_PROMPTS.system_prompt,
      userPrompt
    );

    // 4. 解析 JSON 响应（三级 fallback 策略）
    let result: EnglishDefinitionResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 5. 确保字段完整性
    result = {
      definition: result.definition || "",
      examples: result.examples || [],
      synonyms: result.synonyms || [],
      usageNotes: result.usageNotes || "",
    };

    console.log("[Lingride] 英英释义完成");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 英英释义失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "英英释义失败",
    };
  }
}

// ====== 影子跟读功能 ======

/**
 * 处理 SPLIT_SENTENCES 消息
 *
 * 调用 AI 将用户输入的英文文本智能分句。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置
 * 3. 替换 {{text}} 占位符
 * 4. 调用 AI 进行分句
 * 5. 解析 JSON 结果并返回
 */
async function handleSplitSentences(
  text: string
): Promise<SplitSentencesResponse> {
  try {
    // 1. 验证输入
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        success: false,
        error: "输入文本不能为空",
      };
    }

    // 2. 获取配置并验证
    const { provider } = await prepareAIProvider();

    // 3. 构建 Prompt
    const userPrompt = SPLIT_SENTENCES_PROMPTS.user_prompt_template.replace(
      "{{text}}",
      trimmedText
    );

    // 4. 调用 AI 进行分句
    console.log("[Lingride] 开始智能分句...");
    const aiResponse = await provider.chat(
      SPLIT_SENTENCES_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: SplitSentencesResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    const sentences = result.sentences || [];
    result = {
      sentences,
      totalCount: sentences.length,
    };

    console.log(`[Lingride] 分句完成: ${result.totalCount} 句`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 智能分句失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "分句失败，请重试",
    };
  }
}

/**
 * 处理 SHADOW_ASSESS 消息
 *
 * 对比用户的跟读发音（语音识别文本）与原文，从准确度、流利度、语调、节奏四个维度给出评估。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置
 * 3. 替换 {{original}} 和 {{recognized}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleShadowAssess(
  original: string,
  recognized: string
): Promise<ShadowAssessResponse> {
  try {
    // 1. 验证输入
    if (!original.trim() || !recognized.trim()) {
      return {
        success: false,
        error: "原文和识别文本不能为空",
      };
    }

    // 2. 获取配置并验证
    const { provider } = await prepareAIProvider();

    // 3. 构建 Prompt
    const userPrompt = SHADOW_ASSESS_PROMPTS.user_prompt_template
      .replace("{{original}}", original)
      .replace("{{recognized}}", recognized);

    // 4. 调用 AI 进行分析
    console.log("[Lingride] 开始影子跟读评估...");
    const aiResponse = await provider.chat(
      SHADOW_ASSESS_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: ShadowAssessmentResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    result = {
      score: result.score || 0,
      accuracy: result.accuracy || 0,
      fluency: result.fluency || 0,
      intonation: result.intonation || 0,
      rhythm: result.rhythm || 0,
      issues: result.issues || [],
      suggestions: result.suggestions || [],
      encouragement: result.encouragement || "继续努力！",
      comparison: result.comparison || {
        original,
        recognized,
        matchRate: 0,
        mismatches: [],
      },
    };

    console.log("[Lingride] 影子跟读评估完成, score:", result.score);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 影子跟读评估失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "评估失败，请重试",
    };
  }
}

// ====== 语料库听力训练功能 ======

/**
 * 处理 SEGMENT_CORPUS 消息
 *
 * 调用 AI 根据用户 CEFR 水平对语料文本进行 i+1 难度断句。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 验证输入文本
 * 3. 替换 {{userLevel}} 和 {{text}} 占位符
 * 4. 调用 AI 进行断句
 * 5. 解析 JSON 结果并返回
 */
async function handleSegmentCorpus(
  text: string,
  userLevel: CEFRLevel
): Promise<SegmentCorpusResponse> {
  try {
    // 1. 验证输入
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        success: false,
        error: "输入文本不能为空",
      };
    }

    // 2. 获取配置并验证
    const { provider } = await prepareAIProvider();

    // 3. 构建 Prompt
    const userPrompt = SEGMENT_CORPUS_PROMPTS.user_prompt_template
      .replace("{{userLevel}}", userLevel)
      .replace("{{text}}", trimmedText);

    // 4. 调用 AI 进行断句
    console.log(`[Lingride] 开始语料断句 (${userLevel})...`);
    const aiResponse = await provider.chat(
      SEGMENT_CORPUS_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: SegmentCorpusResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    result = {
      sentences: result.sentences || [],
      overallLevel: result.overallLevel || userLevel,
    };

    console.log(`[Lingride] 语料断句完成: ${result.sentences.length} 句`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 语料断句失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "断句失败，请重试",
    };
  }
}

/**
 * 处理 ANALYZE_LISTENING 消息
 *
 * 调用 AI 对比用户听写结果与原文，分析听力盲区。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 验证输入
 * 3. 替换 {{original}}、{{userInput}} 和 {{userLevel}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleAnalyzeListening(
  original: string,
  userInput: string,
  userLevel: CEFRLevel
): Promise<AnalyzeListeningResponse> {
  try {
    // 1. 验证输入
    if (!original.trim()) {
      return {
        success: false,
        error: "原文不能为空",
      };
    }

    // 2. 获取配置并验证
    const { provider } = await prepareAIProvider();

    // 3. 构建 Prompt
    const userPrompt = ANALYZE_LISTENING_PROMPTS.user_prompt_template
      .replace("{{original}}", original)
      .replace("{{userInput}}", userInput || "(用户未输入)")
      .replace("{{userLevel}}", userLevel);

    // 4. 调用 AI 进行分析
    console.log(`[Lingride] 开始听力分析 (${userLevel})...`);
    const aiResponse = await provider.chat(
      ANALYZE_LISTENING_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: ListeningAnalysisResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    result = {
      accuracy: result.accuracy || 0,
      errors: result.errors || [],
      blindSpots: result.blindSpots || [],
      suggestions: result.suggestions || [],
      encouragement: result.encouragement || "继续努力！",
    };

    console.log(`[Lingride] 听力分析完成, 准确率: ${result.accuracy}%`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 听力分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "分析失败，请重试",
    };
  }
}

// ====== 腾讯云 ASR 签名 ======

/**
 * 处理 TENCENT_ASR_SIGN 消息
 *
 * 生成腾讯云实时语音识别的签名 URL。
 * 签名在 background 中生成以保护密钥安全。
 *
 * 腾讯云 ASR WebSocket URL 格式：
 * wss://asr.cloud.tencent.com/asr/v2/{appid}?{params}&signature={signature}
 */
async function handleTencentASRSign(): Promise<TencentASRSignResponse> {
  try {
    // 1. 获取配置
    const config = await getConfig();

    if (
      !config.tencent_asr?.app_id ||
      !config.tencent_asr?.secret_id ||
      !config.tencent_asr?.secret_key
    ) {
      return {
        success: false,
        error: "腾讯云 ASR 未配置，请在设置中填写 AppID、SecretID 和 SecretKey",
      };
    }

    const { app_id, secret_id, secret_key } = config.tencent_asr;

    // 2. 生成签名参数
    const timestamp = Math.floor(Date.now() / 1000);
    const expired = timestamp + 86400; // 24小时有效期
    const nonce = Math.floor(Math.random() * 100000);

    // 请求参数
    const params: Record<string, string | number> = {
      secretid: secret_id,
      timestamp,
      expired,
      nonce,
      engine_model_type: "16k_en", // 英语 16kHz
      voice_format: 1, // PCM
      needvad: 1, // 开启 VAD
      filter_dirty: 0, // 不过滤脏话
      filter_modal: 0, // 不过滤语气词
      filter_punc: 0, // 不过滤标点
      convert_num_mode: 1, // 数字智能转换
      word_info: 0, // 不返回词级别时间戳
    };

    // 3. 生成签名字符串
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");

    // 4. 计算 HMAC-SHA1 签名
    const signature = await hmacSha1Base64(secret_key, signStr);

    // 5. 构建完整 URL
    const queryString =
      sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") +
      `&signature=${encodeURIComponent(signature)}`;

    const signedUrl = `wss://asr.cloud.tencent.com/asr/v2/${app_id}?${queryString}`;

    console.log("[Lingride] 腾讯云 ASR 签名生成成功");

    return {
      success: true,
      data: { signedUrl },
    };
  } catch (error) {
    console.error("[Lingride] 腾讯云 ASR 签名生成失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "签名生成失败",
    };
  }
}

/**
 * HMAC-SHA1 签名并返回 Base64 编码
 *
 * 使用 Web Crypto API 实现。
 */
async function hmacSha1Base64(key: string, data: string): Promise<string> {
  // 将字符串转换为 ArrayBuffer
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  // 计算 HMAC
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);

  // 转换为 Base64
  const signatureArray = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  return btoa(binary);
}

// ====== 阿里云 ASR WebSocket 管理 ======

/**
 * 阿里云 ASR 会话状态
 *
 * 每个 Tab 最多一个活跃会话。
 */
interface AlibabaASRSession {
  /** WebSocket 连接 */
  ws: WebSocket;
  /** 任务 ID（UUID） */
  taskId: string;
  /** 与 Tutor 页面的 Port 连接（用于推送实时结果） */
  port: chrome.runtime.Port;
  /** 最终识别结果（sentence_end=true 时累积） */
  finalText: string;
  /** 中间识别结果（sentence_end=false 时更新） */
  interimText: string;
  /** 是否已收到 task-started 事件 */
  taskStarted: boolean;
  /** 启动时的 resolve 回调 */
  startResolve?: (value: AlibabaASRStartResponse) => void;
  /** 启动时的 reject 回调 */
  startReject?: (error: Error) => void;
}

/** 按 Tab ID 管理阿里云 ASR 会话 */
const alibabaASRSessions = new Map<number, AlibabaASRSession>();

/**
 * 阿里云 ASR WebSocket URL
 */
const ALIBABA_ASR_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference";

/**
 * 处理 ALIBABA_ASR_START 消息
 *
 * 在 Background Service Worker 中建立 WebSocket 连接，保护 API Key 安全。
 *
 * 流程：
 * 1. 验证配置
 * 2. 建立 WebSocket 连接（Bearer Token 鉴权）
 * 3. 发送 run-task 指令
 * 4. 等待 task-started 事件
 * 5. 返回成功响应
 */
async function handleAlibabaASRStart(
  tabId: number,
  port: chrome.runtime.Port
): Promise<AlibabaASRStartResponse> {
  try {
    // 1. 检查是否已有活跃会话
    if (alibabaASRSessions.has(tabId)) {
      console.warn("[Lingride] 阿里云 ASR 会话已存在，先关闭旧会话");
      await cleanupAlibabaASRSession(tabId);
    }

    // 2. 获取配置
    const config = await getConfig();
    if (!config.alibaba_asr?.api_key) {
      return {
        success: false,
        error: "阿里云 ASR 未配置，请在设置中填写 API Key",
      };
    }

    const apiKey = config.alibaba_asr.api_key;

    // 3. 生成任务 ID
    const taskId = crypto.randomUUID().replace(/-/g, "");

    // 4. 返回 Promise，等待 task-started 事件
    return new Promise((resolve, reject) => {
      // 5. 建立 WebSocket 连接
      // 注意：Service Worker 中的 WebSocket 不支持自定义 headers
      // 阿里云 API 支持通过 URL 参数传递 token
      const wsUrl = `${ALIBABA_ASR_WS_URL}?token=${encodeURIComponent(apiKey)}`;
      const ws = new WebSocket(wsUrl);

      // 创建会话对象
      const session: AlibabaASRSession = {
        ws,
        taskId,
        port,
        finalText: "",
        interimText: "",
        taskStarted: false,
        startResolve: resolve,
        startReject: reject,
      };

      // 保存会话
      alibabaASRSessions.set(tabId, session);

      // 设置连接超时
      const connectTimeout = setTimeout(() => {
        if (!session.taskStarted) {
          console.error("[Lingride] 阿里云 ASR 连接超时");
          cleanupAlibabaASRSession(tabId);
          resolve({ success: false, error: "连接超时，请重试" });
        }
      }, 10000);

      // 6. 监听 WebSocket 事件
      ws.onopen = () => {
        console.log("[Lingride] 阿里云 ASR WebSocket 连接成功");

        // 发送 run-task 指令
        const runTaskCmd = {
          header: {
            action: "run-task",
            task_id: taskId,
            streaming: "duplex",
          },
          payload: {
            task_group: "audio",
            task: "asr",
            function: "recognition",
            model: "paraformer-realtime-v2",
            parameters: {
              format: "pcm",
              sample_rate: 16000,
              language_hints: ["en"], // 英语识别
            },
            input: {},
          },
        };

        ws.send(JSON.stringify(runTaskCmd));
        console.log("[Lingride] 已发送 run-task 指令");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          handleAlibabaASREvent(tabId, data, connectTimeout);
        } catch (e) {
          console.error("[Lingride] 解析阿里云 ASR 响应失败:", e);
        }
      };

      ws.onerror = (event) => {
        console.error("[Lingride] 阿里云 ASR WebSocket 错误:", event);
        clearTimeout(connectTimeout);
        if (!session.taskStarted) {
          cleanupAlibabaASRSession(tabId);
          resolve({ success: false, error: "WebSocket 连接失败" });
        }
      };

      ws.onclose = (event) => {
        console.log(
          `[Lingride] 阿里云 ASR WebSocket 关闭: code=${event.code}, reason=${event.reason}`
        );
        clearTimeout(connectTimeout);
        // 非正常关闭时清理会话
        if (event.code !== 1000) {
          cleanupAlibabaASRSession(tabId);
        }
      };
    });
  } catch (error) {
    console.error("[Lingride] 启动阿里云 ASR 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动失败",
    };
  }
}

/**
 * 处理阿里云 ASR 事件
 *
 * 解析服务端返回的事件，更新会话状态并推送结果到 Tutor。
 */
function handleAlibabaASREvent(
  tabId: number,
  event: {
    header?: {
      event?: string;
      task_id?: string;
      error_code?: string;
      error_message?: string;
    };
    payload?: {
      output?: {
        sentence?: {
          text?: string;
          sentence_end?: boolean;
        };
      };
    };
  },
  connectTimeout?: ReturnType<typeof setTimeout>
): void {
  const session = alibabaASRSessions.get(tabId);
  if (!session) return;

  const eventType = event.header?.event;

  switch (eventType) {
    case "task-started":
      console.log("[Lingride] 阿里云 ASR 任务已启动");
      session.taskStarted = true;
      if (connectTimeout) clearTimeout(connectTimeout);
      // 调用启动成功回调
      session.startResolve?.({ success: true });
      session.startResolve = undefined;
      session.startReject = undefined;
      break;

    case "result-generated":
      const text = event.payload?.output?.sentence?.text || "";
      const isFinal = event.payload?.output?.sentence?.sentence_end === true;

      if (isFinal) {
        // 最终结果：累积到 finalText
        session.finalText += text + " ";
        session.interimText = "";
      } else {
        // 中间结果：更新 interimText
        session.interimText = text;
      }

      // 推送实时结果到 Tutor
      try {
        session.port.postMessage({
          type: MessageType.ALIBABA_ASR_RESULT,
          payload: {
            text: (session.finalText + session.interimText).trim(),
            isFinal,
          },
        });
      } catch (e) {
        console.warn("[Lingride] 推送阿里云 ASR 结果失败:", e);
      }
      break;

    case "task-finished":
      console.log("[Lingride] 阿里云 ASR 任务已完成");
      break;

    case "task-failed":
      console.error(
        "[Lingride] 阿里云 ASR 任务失败:",
        event.header?.error_code,
        event.header?.error_message
      );
      // 如果还在启动阶段，调用失败回调
      if (!session.taskStarted) {
        if (connectTimeout) clearTimeout(connectTimeout);
        session.startResolve?.({
          success: false,
          error: event.header?.error_message || "任务启动失败",
        });
        session.startResolve = undefined;
        session.startReject = undefined;
      }
      // 通知 Tutor 错误
      try {
        session.port.postMessage({
          type: MessageType.ALIBABA_ASR_RESULT,
          payload: {
            text: "",
            isFinal: true,
            error: event.header?.error_message,
          },
        });
      } catch (e) {
        console.warn("[Lingride] 推送阿里云 ASR 错误失败:", e);
      }
      cleanupAlibabaASRSession(tabId);
      break;

    default:
      // 忽略其他事件
      break;
  }
}

/**
 * 处理 ALIBABA_ASR_AUDIO 消息
 *
 * 将 Base64 编码的音频数据解码后发送到阿里云 ASR。
 */
function handleAlibabaASRAudio(tabId: number, audioData: string): void {
  const session = alibabaASRSessions.get(tabId);
  if (!session) {
    console.warn("[Lingride] 阿里云 ASR 会话不存在，忽略音频数据");
    return;
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    console.warn("[Lingride] 阿里云 ASR WebSocket 未就绪，忽略音频数据");
    return;
  }

  if (!session.taskStarted) {
    console.warn("[Lingride] 阿里云 ASR 任务未启动，忽略音频数据");
    return;
  }

  try {
    // Base64 解码
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 发送二进制音频数据
    session.ws.send(bytes.buffer);
  } catch (e) {
    console.error("[Lingride] 发送阿里云 ASR 音频数据失败:", e);
  }
}

/**
 * 处理 ALIBABA_ASR_STOP 消息
 *
 * 发送 finish-task 指令并等待最终结果。
 */
async function handleAlibabaASRStop(
  tabId: number
): Promise<AlibabaASRStopResponse> {
  const session = alibabaASRSessions.get(tabId);
  if (!session) {
    return {
      success: false,
      error: "没有活跃的阿里云 ASR 会话",
    };
  }

  try {
    // 发送 finish-task 指令
    if (session.ws.readyState === WebSocket.OPEN && session.taskStarted) {
      const finishTaskCmd = {
        header: {
          action: "finish-task",
          task_id: session.taskId,
          streaming: "duplex",
        },
        payload: {
          input: {},
        },
      };

      session.ws.send(JSON.stringify(finishTaskCmd));
      console.log("[Lingride] 已发送 finish-task 指令");

      // 等待一小段时间让服务器处理最后的数据
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 获取最终结果
    const finalText = (session.finalText + session.interimText).trim();

    // 清理会话
    await cleanupAlibabaASRSession(tabId);

    console.log(`[Lingride] 阿里云 ASR 停止，最终结果: "${finalText}"`);

    return {
      success: true,
      data: { finalText },
    };
  } catch (error) {
    console.error("[Lingride] 停止阿里云 ASR 失败:", error);
    await cleanupAlibabaASRSession(tabId);
    return {
      success: false,
      error: error instanceof Error ? error.message : "停止失败",
    };
  }
}

/**
 * 清理阿里云 ASR 会话
 */
async function cleanupAlibabaASRSession(tabId: number): Promise<void> {
  const session = alibabaASRSessions.get(tabId);
  if (!session) return;

  try {
    // 关闭 WebSocket
    if (
      session.ws.readyState === WebSocket.OPEN ||
      session.ws.readyState === WebSocket.CONNECTING
    ) {
      session.ws.close(1000, "Session ended");
    }
  } catch (e) {
    console.warn("[Lingride] 关闭阿里云 ASR WebSocket 失败:", e);
  }

  // 从 Map 中移除
  alibabaASRSessions.delete(tabId);
  console.log(`[Lingride] 阿里云 ASR 会话已清理: tabId=${tabId}`);
}

/**
 * 监听 Port 连接（用于阿里云 ASR 实时结果推送）
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "alibaba-asr") {
    console.log("[Lingride] 收到阿里云 ASR Port 连接");

    // 获取 Tab ID
    const tabId = port.sender?.tab?.id;
    if (!tabId) {
      console.error("[Lingride] 无法获取阿里云 ASR Port 的 Tab ID");
      port.disconnect();
      return;
    }

    // 监听 Port 断开
    port.onDisconnect.addListener(() => {
      console.log(`[Lingride] 阿里云 ASR Port 断开: tabId=${tabId}`);
      // Port 断开时清理会话
      cleanupAlibabaASRSession(tabId);
    });

    // 监听来自 Tutor 的消息
    port.onMessage.addListener(async (message: Message) => {
      switch (message.type) {
        case MessageType.ALIBABA_ASR_START:
          const startResponse = await handleAlibabaASRStart(tabId, port);
          port.postMessage({ type: "ALIBABA_ASR_START_RESPONSE", ...startResponse });
          break;

        case MessageType.ALIBABA_ASR_AUDIO:
          handleAlibabaASRAudio(tabId, (message as { payload: { audioData: string } }).payload.audioData);
          break;

        case MessageType.ALIBABA_ASR_STOP:
          const stopResponse = await handleAlibabaASRStop(tabId);
          port.postMessage({ type: "ALIBABA_ASR_STOP_RESPONSE", ...stopResponse });
          break;
      }
    });
  }
});

// ====== 消息路由 ======

/**
 * 消息监听器
 *
 * 接收来自 Popup 和 Content Script 的消息，
 * 分发到对应的处理函数。
 */
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    // 获取发送消息的 Tab ID
    const tabId = sender.tab?.id;

    console.log("[Lingride] 收到消息:", message.type);

    // 异步处理消息
    (async () => {
      let response;

      switch (message.type) {
        case MessageType.GET_CONFIG:
          response = await handleGetConfig();
          break;

        case MessageType.SAVE_CONFIG:
          response = await handleSaveConfig(message.payload as LingridConfig);
          break;

        case MessageType.GET_OPENAI_MODEL_CATALOG:
          response = await handleGetOpenAIModelCatalog();
          break;

        case MessageType.REFRESH_OPENAI_MODEL_CATALOG:
          response = await handleRefreshOpenAIModelCatalog();
          break;

        case MessageType.START_OPENAI_OAUTH:
          response = await handleStartOpenAIOAuth();
          break;

        case MessageType.COMPLETE_OPENAI_OAUTH:
          response = await handleCompleteOpenAIOAuth(
            message.payload.callbackInput
          );
          break;

        case MessageType.GET_OPENAI_OAUTH_STATUS:
          response = await handleGetOpenAIOAuthStatus();
          break;

        case MessageType.DISCONNECT_OPENAI_OAUTH:
          response = await handleDisconnectOpenAIOAuth();
          break;

        case MessageType.TTS_SPEED_CHANGED:
          response = { success: true };
          break;

        case MessageType.TOGGLE_TRANSLATION:
          if (tabId === undefined) {
            // 如果是从 Popup 发来的，获取当前活动 Tab
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = await handleToggleTranslation(
                activeTab.id,
                message.payload.enabled
              );
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = await handleToggleTranslation(
              tabId,
              message.payload.enabled
            );
          }
          break;

        case MessageType.GET_TRANSLATION_STATE:
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = handleGetTranslationState(activeTab.id);
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = handleGetTranslationState(tabId);
          }
          break;

        case MessageType.TRANSLATE:
          response = await handleTranslate(
            message.payload.texts,
            message.payload.batchId
          );
          break;

        case MessageType.TEST_CONNECTION:
          response = await handleTestConnection();
          break;

        case MessageType.TEST_TTS_CONNECTION:
          response = await handleTestTTSConnection(
            message.payload?.provider || "xiaomi"
          );
          break;

        case MessageType.ANALYZE_DIFFICULTY:
          response = await handleAnalyzeDifficulty();
          break;

        case MessageType.TOGGLE_PARAPHRASE:
          if (tabId === undefined) {
            // 如果是从 Popup 发来的，获取当前活动 Tab
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = await handleToggleParaphrase(
                activeTab.id,
                message.payload.enabled
              );
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = await handleToggleParaphrase(
              tabId,
              message.payload.enabled
            );
          }
          break;

        case MessageType.GET_PARAPHRASE_STATE:
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = handleGetParaphraseState(activeTab.id);
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = handleGetParaphraseState(tabId);
          }
          break;

        case MessageType.PARAPHRASE:
          response = await handleParaphrase(
            message.payload.texts,
            message.payload.batchId
          );
          break;

        case MessageType.TOGGLE_MIXED_TRANSLATE:
          if (tabId === undefined) {
            // 如果是从 Popup 发来的，获取当前活动 Tab
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = await handleToggleMixedTranslate(
                activeTab.id,
                message.payload.enabled
              );
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = await handleToggleMixedTranslate(
              tabId,
              message.payload.enabled
            );
          }
          break;

        case MessageType.GET_MIXED_TRANSLATE_STATE:
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = handleGetMixedTranslateState(activeTab.id);
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = handleGetMixedTranslateState(tabId);
          }
          break;

        case MessageType.MIXED_TRANSLATE:
          response = await handleMixedTranslate(
            message.payload.texts,
            message.payload.batchId
          );
          break;

        case MessageType.ANALYZE_SENTENCE:
          response = await handleAnalyzeSentence(message.payload.sentence);
          break;

        case MessageType.SYNTHESIZE_SPEECH:
          response = await handleSynthesizeSpeech(message.payload.text);
          break;

        case MessageType.ASSESS_PRONUNCIATION:
          response = await handleAssessPronunciation(
            message.payload.original,
            message.payload.recognized
          );
          break;

        case MessageType.CHINESE_TO_ENGLISH:
          response = await handleChineseToEnglish(message.payload.text);
          break;

        case MessageType.ENGLISH_TO_CHINESE:
          response = await handleEnglishToChinese(message.payload.text);
          break;

        case MessageType.ENGLISH_DEFINITION:
          response = await handleEnglishDefinition(
            message.payload.text,
            message.payload.userLevel
          );
          break;

        case MessageType.SPLIT_SENTENCES:
          response = await handleSplitSentences(message.payload.text);
          break;

        case MessageType.SHADOW_ASSESS:
          response = await handleShadowAssess(
            message.payload.original,
            message.payload.recognized
          );
          break;

        case MessageType.TENCENT_ASR_SIGN:
          response = await handleTencentASRSign();
          break;

        case MessageType.SEGMENT_CORPUS:
          response = await handleSegmentCorpus(
            message.payload.text,
            message.payload.userLevel
          );
          break;

        case MessageType.ANALYZE_LISTENING:
          response = await handleAnalyzeListening(
            message.payload.original,
            message.payload.userInput,
            message.payload.userLevel
          );
          break;

        // 阿里云 ASR 消息通过 Port 处理，这里提供 fallback
        case MessageType.ALIBABA_ASR_START:
        case MessageType.ALIBABA_ASR_AUDIO:
        case MessageType.ALIBABA_ASR_STOP:
          response = {
            success: false,
            error: "阿里云 ASR 消息应通过 Port 连接发送",
          };
          break;

        default:
          response = { success: false, error: "未知消息类型" };
      }

      sendResponse(response);
    })();

    // 返回 true 表示异步发送响应
    return true;
  }
);

// ====== 扩展图标点击 ======

// 点击扩展图标打开 Popup（由 manifest.json 配置处理）
// 此处可添加额外的图标点击逻辑

console.log("[Lingride] 消息路由已就绪");
