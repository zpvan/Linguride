/**
 * @file service-worker.ts
 * @description Background Service Worker 入口
 *
 * Chrome 扩展的后台服务，负责：
 * - 消息路由：处理侧边栏和 Content Script 的消息
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
  normalizeMiniMaxTTSBaseUrl,
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
  StopTTSPlaybackResponse,
  SplitSentencesResult,
  DEFAULT_TTS_SPEED,
  ReadAloudPrepareResponse,
  ReadAloudProgressMessage,
  StartReadAloudResponse,
  StopReadAloudResponse,
  PauseReadAloudResponse,
  ResumeReadAloudResponse,
  GetReadAloudStateResponse,
  SynthesizeSpeechResponse,
  TestTTSConnectionResponse,
  TestConnectionResponse,
  TTSSpeed,
  TTSProviderId,
  TTSServiceErrorCode,
  TTSServiceErrorHint,
  TranslateResponse,
  GetTTSSynthesisStatusResponse,
  CancelTTSSynthesisResponse,
  DiagnoseTTSResponse,
  DoubaoASRPrepareResponse,
  resolveDoubaoASRApiKey,
  XIAOMI_TTS_API_BASE_URL,
  XIAOMI_TTS_MODEL,
  normalizeXiaomiTTSVoice,
  DOUBAO_TTS_API_URL,
  DOUBAO_TTS_RESOURCE_ID,
  normalizeDoubaoTTSVoice,
  resolveDoubaoTTSVoiceForText,
  DOUBAO_ASR_RESOURCE_ID,
  XiaomiTTSVoice,
} from "../types";
import {
  OFFSCREEN_TTS_PAUSE,
  OFFSCREEN_TTS_PLAY,
  OFFSCREEN_TTS_RESUME,
  OFFSCREEN_TTS_STOP,
  OffscreenTTSMessage,
  OffscreenTTSResponse,
} from "../shared/offscreenTTSProtocol";
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
import { ttsSynthesisTaskRegistry } from "./ttsSynthesisTasks";
import {
  summarizeDiagnoseSamples,
  withTimeout,
  type DiagnoseSampleResult,
} from "./ttsDiagnostics";

// ====== 初始化 ======

console.log("[Lingride] Background Service Worker 已启动");

// 初始化 Tab 状态监听器
initTabStateListeners();

// 点击工具栏图标时在浏览器右侧打开侧边栏（Chrome 114+，替代默认 popup）
if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => {
      console.warn("[Lingride] 注册侧边栏打开行为失败:", error);
    });
}
void syncDoubaoASRHeaderRule().catch((error) => {
  console.warn("[Lingride] 同步豆包 ASR DNR 规则失败:", error);
});

// ====== TTS 服务 ======

const XIAOMI_TTS_AUDIO_FORMAT = "wav";
const XIAOMI_TTS_TEST_TEXT = "Hello from Lingride.";
const DOUBAO_TTS_TEST_TEXT = "Hello from Lingride.";
const DOUBAO_TTS_AUDIO_FORMAT = "mp3";
const DOUBAO_TTS_SAMPLE_RATE = 24000;
const XIAOMI_TTS_REQUEST_PROMPT =
  "Please synthesize the assistant message as speech exactly as written.";
const MINIMAX_TTS_TEST_TEXT = "Hello from Lingride.";
const MINIMAX_TTS_AUDIO_FORMAT = "mp3";
const MINIMAX_TTS_TEXT_MAX_CHARS = 50000;
/** 短文本上限：不超过则走同步 t2a_v2（~1s 返回），避免异步任务排队 */
const MINIMAX_TTS_SYNC_TEXT_MAX_CHARS = 10000;
const MINIMAX_TTS_POLL_INTERVAL_MS = 500;
const MINIMAX_TTS_POLL_TIMEOUT_MS = 300000; // 5 minutes
const MINIMAX_TTS_UPLOAD_PURPOSE = "t2a_async_input";
const OFFSCREEN_TTS_DOCUMENT_PATH = "src/offscreen/tts-offscreen.html";
const OFFSCREEN_TTS_CONTEXT_TYPE = "OFFSCREEN_DOCUMENT";
const OFFSCREEN_TTS_AUDIO_REASON = "AUDIO_PLAYBACK";
const OFFSCREEN_TTS_JUSTIFICATION =
  "Play AI-generated speech in extension context to avoid page CSP restrictions.";
type MiniMaxTaskId = string | number;
type MiniMaxFileId = string | number;
type MiniMaxTaskStatus = "processing" | "success" | "failed" | "expired";

type RuntimeWithContexts = typeof chrome.runtime & {
  getContexts?: (filter?: {
    contextTypes?: string[];
    documentUrls?: string[];
  }) => Promise<Array<{ documentUrl?: string }>>;
};

type ChromeWithOffscreen = typeof chrome & {
  offscreen?: {
    createDocument(options: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
  };
};

type WindowClientLike = {
  url: string;
};

type GlobalClientsLike = {
  matchAll(options: {
    type: "window";
    includeUncontrolled: boolean;
  }): Promise<WindowClientLike[]>;
};

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

let offscreenDocumentPromise: Promise<void> | null = null;
let ttsPlaybackEpoch = 0;

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

/** 同步 t2a_v2 响应：data.audio 为 hex 编码音频 */
interface MiniMaxTTSSyncResponse extends MiniMaxBaseResponsePayload {
  data?: {
    audio?: string;
    status?: number;
  };
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

const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
];

const TTS_PROVIDER_LABELS: Record<TTSProviderId, string> = {
  minimax: "MiniMax",
  xiaomi: "小米",
  doubao: "豆包",
};

function getTTSProviderLabel(provider: TTSProviderId): string {
  return TTS_PROVIDER_LABELS[provider];
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
    case "TTS_PLAYBACK_ERROR":
      return "扩展内音频播放失败";
    case "TTS_CANCELLED":
      return "朗读已取消";
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

function buildMiniMaxTTSSyncUrl(baseUrl: string): string {
  return buildTTSRequestUrl(baseUrl, "t2a_v2");
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

function getXiaomiTTSVoice(config: LingridConfig): XiaomiTTSVoice {
  return normalizeXiaomiTTSVoice(config.xiaomi_tts?.voice);
}

function getMiniMaxTTSModel(config: LingridConfig): MiniMaxTTSModel {
  return normalizeMiniMaxTTSModel(config.minimax_tts?.model);
}

function getMiniMaxTTSBaseUrl(config: LingridConfig): string {
  return normalizeMiniMaxTTSBaseUrl(config.minimax_tts?.api_base_url);
}

function getMiniMaxTTSVoiceId(config: LingridConfig): string {
  return config.minimax_tts?.voice_id?.trim() || MINIMAX_TTS_DEFAULT_VOICE_ID;
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

function isDoubaoTTSConfigured(config: LingridConfig): boolean {
  return !!config.doubao_tts?.api_key?.trim();
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

/** 豆包 ASR 鉴权头注入规则 ID（会话规则） */
const DOUBAO_ASR_DNR_RULE_ID = 4101;

/**
 * 同步豆包 ASR 的 DNR 会话规则：
 * 浏览器 WebSocket 无法自定义 header，通过 declarativeNetRequest
 * 在 WS 握手上注入 X-Api-Key / X-Api-Resource-Id / X-Api-Request-Id。
 * 未配置豆包 ASR key 时移除规则。
 */
async function syncDoubaoASRHeaderRule(): Promise<void> {
  const dnr = chrome.declarativeNetRequest;
  if (!dnr) return;

  const config = await getConfig();
  // 默认复用语音合成服务（doubao_tts）的 API Key
  const apiKey = resolveDoubaoASRApiKey(config);

  await dnr.updateSessionRules({
    removeRuleIds: [DOUBAO_ASR_DNR_RULE_ID],
    ...(apiKey
      ? {
          addRules: [
            {
              id: DOUBAO_ASR_DNR_RULE_ID,
              priority: 1,
              action: {
                type: chrome.declarativeNetRequest.RuleActionType
                  .MODIFY_HEADERS,
                requestHeaders: [
                  {
                    header: "X-Api-Key",
                    operation:
                      chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: apiKey,
                  },
                  {
                    header: "X-Api-Resource-Id",
                    operation:
                      chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: DOUBAO_ASR_RESOURCE_ID,
                  },
                  {
                    header: "X-Api-Request-Id",
                    operation:
                      chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: crypto.randomUUID(),
                  },
                ],
              },
              condition: {
                urlFilter: "openspeech.bytedance.com/api/v3/plan/sauc/",
                resourceTypes: [
                  chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
                ],
              },
            },
          ],
        }
      : {}),
  });
}

function nextTTSPlaybackEpoch(): number {
  ttsPlaybackEpoch += 1;
  return ttsPlaybackEpoch;
}

function isCurrentTTSPlaybackEpoch(epoch: number): boolean {
  return epoch === ttsPlaybackEpoch;
}

function getOffscreenDocumentUrl(): string {
  return chrome.runtime.getURL(OFFSCREEN_TTS_DOCUMENT_PATH);
}

function getOffscreenApi(): NonNullable<ChromeWithOffscreen["offscreen"]> {
  const offscreenApi = (chrome as ChromeWithOffscreen).offscreen;
  if (!offscreenApi) {
    throw new Error("当前浏览器不支持扩展内音频播放");
  }

  return offscreenApi;
}

async function hasTTSOffscreenDocument(): Promise<boolean> {
  const documentUrl = getOffscreenDocumentUrl();
  const runtime = chrome.runtime as RuntimeWithContexts;

  if (typeof runtime.getContexts === "function") {
    const contexts = await runtime.getContexts({
      contextTypes: [OFFSCREEN_TTS_CONTEXT_TYPE],
      documentUrls: [documentUrl],
    });

    return contexts.some((context) => context.documentUrl === documentUrl);
  }

  const globalClients = (
    globalThis as typeof globalThis & { clients?: GlobalClientsLike }
  ).clients;
  if (!globalClients) {
    return false;
  }

  const windowClients = await globalClients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  return windowClients.some((client) => client.url === documentUrl);
}

async function ensureTTSOffscreenDocument(): Promise<void> {
  if (await hasTTSOffscreenDocument()) {
    return;
  }

  if (!offscreenDocumentPromise) {
    const offscreenApi = getOffscreenApi();
    offscreenDocumentPromise = (async () => {
      try {
        await offscreenApi.createDocument({
          url: OFFSCREEN_TTS_DOCUMENT_PATH,
          reasons: [OFFSCREEN_TTS_AUDIO_REASON],
          justification: OFFSCREEN_TTS_JUSTIFICATION,
        });
      } catch (error) {
        if (await hasTTSOffscreenDocument()) {
          return;
        }

        throw error;
      }
    })().finally(() => {
      offscreenDocumentPromise = null;
    });
  }

  await offscreenDocumentPromise;
}

async function sendOffscreenTTSMessage(
  message: OffscreenTTSMessage
): Promise<OffscreenTTSResponse> {
  await ensureTTSOffscreenDocument();

  const response = (await chrome.runtime.sendMessage(
    message
  )) as OffscreenTTSResponse | undefined;

  if (!response) {
    throw new Error("扩展内音频播放未返回响应");
  }

  return response;
}

async function stopOffscreenTTSPlayback(): Promise<void> {
  if (!(await hasTTSOffscreenDocument())) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: OFFSCREEN_TTS_STOP,
  } as OffscreenTTSMessage);
}

/** 暂停 offscreen 当前播放；无播放中文档时静默成功（暂停发生在合成等待期） */
async function pauseOffscreenTTSPlayback(): Promise<void> {
  if (!(await hasTTSOffscreenDocument())) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: OFFSCREEN_TTS_PAUSE,
  } as OffscreenTTSMessage);
}

/** 恢复 offscreen 暂停的播放 */
async function resumeOffscreenTTSPlayback(): Promise<OffscreenTTSResponse | null> {
  if (!(await hasTTSOffscreenDocument())) {
    return null;
  }

  return (await chrome.runtime.sendMessage({
    type: OFFSCREEN_TTS_RESUME,
  } as OffscreenTTSMessage)) as OffscreenTTSResponse | undefined ?? null;
}

async function playTTSAudioInOffscreen(
  audioData: TTSAudioData,
  rate: TTSSpeed
): Promise<void> {
  const response = await sendOffscreenTTSMessage({
    type: OFFSCREEN_TTS_PLAY,
    payload: {
      audioBase64: audioData.audioBase64,
      mimeType: audioData.mimeType,
      rate,
    },
  });

  if (response.success) {
    return;
  }

  throw createTTSError({
    provider: audioData.provider,
    code: "TTS_PLAYBACK_ERROR",
    detail: response.detail || response.error,
    message: response.error || "扩展内音频播放失败",
  });
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

/** hex 编码音频转 base64（同步 t2a_v2 响应的 data.audio 为 hex） */
function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
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

  const xiaomiTTSConfig = config.xiaomi_tts;
  if (!xiaomiTTSConfig) {
    throw createTTSError({
      provider: "xiaomi",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const apiKey = xiaomiTTSConfig.api_key.trim();
  const assistantContent = text;
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
  baseUrl: string,
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
    response = await fetch(buildMiniMaxTTSUploadUrl(baseUrl), {
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

/** 逐块解码 base64 音频片段并拼接，再整体编码回 base64 */
function concatBase64Chunks(chunks: string[]): string {
  const parts = chunks.map((chunk) => {
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  });

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }

  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < merged.length; index += chunkSize) {
    binary += String.fromCharCode(...merged.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * 豆包（火山方舟）TTS：HTTP 单向流式接口，一次性发送文本，
 * JSONL 分块返回 base64 音频片段（code 0 = 成功）。
 */
async function requestDoubaoTTSAudio(
  context: TTSProviderRequestContext
): Promise<TTSAudioData> {
  const { config, text } = context;

  if (!isDoubaoTTSConfigured(config)) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const doubaoTTSConfig = config.doubao_tts;
  if (!doubaoTTSConfig) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const apiKey = doubaoTTSConfig.api_key.trim();
  // en_ 音色不支持中文，文本含中文时自动改用中文音色
  const speaker = resolveDoubaoTTSVoiceForText(
    normalizeDoubaoTTSVoice(doubaoTTSConfig.voice),
    text
  );
  const requestBody = {
    req_params: {
      text,
      speaker,
      audio_params: {
        format: DOUBAO_TTS_AUDIO_FORMAT,
        sample_rate: DOUBAO_TTS_SAMPLE_RATE,
      },
    },
  };

  let response: globalThis.Response;

  try {
    response = await fetch(DOUBAO_TTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-Resource-Id": DOUBAO_TTS_RESOURCE_ID,
        "X-Api-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "doubao",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  // JSONL 分块解析：{"code":0,"message":"","data":"<base64>"}
  const audioChunks: string[] = [];
  for (const line of responseText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let chunk: { code?: number; message?: string; data?: string };
    try {
      chunk = JSON.parse(trimmed);
    } catch {
      throw createTTSError({
        provider: "doubao",
        code: "TTS_UNKNOWN_ERROR",
        detail: `豆包响应包含非 JSON 行：${trimmed.slice(0, 120)}`,
      });
    }

    // code 0 = 音频分块；20000000 = 流式合成成功结束的终止帧
    if (chunk.code !== 0 && chunk.code !== 20000000) {
      throw createTTSError({
        provider: "doubao",
        code: "TTS_UNKNOWN_ERROR",
        detail: chunk.message || `豆包合成失败（code=${chunk.code}）`,
      });
    }

    if (chunk.data) {
      audioChunks.push(chunk.data);
    }
  }

  if (audioChunks.length === 0) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_AUDIO_INVALID",
      detail: responseText.trim() || "豆包合成未返回音频数据",
    });
  }

  return {
    audioBase64: concatBase64Chunks(audioChunks),
    mimeType: "audio/mpeg",
    provider: "doubao",
  };
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

  const minimaxTTSConfig = config.minimax_tts;
  if (!minimaxTTSConfig) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const apiKey = minimaxTTSConfig.api_key.trim();
  const baseUrl = getMiniMaxTTSBaseUrl(config);
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

  // 添加情绪风格（如果有）
  const emotion = minimaxTTSConfig.emotion;
  if (emotion) {
    requestBody.voice_setting = {
      ...(requestBody.voice_setting as Record<string, unknown>),
      emotion,
    };
  }

  if (text.length > MINIMAX_TTS_TEXT_MAX_CHARS) {
    requestBody.text_file_id = await uploadMiniMaxTextInput(baseUrl, apiKey, text);
  } else {
    requestBody.text = text;
  }

  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSCreateTaskUrl(baseUrl),
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
  baseUrl: string,
  apiKey: string,
  taskId: MiniMaxTaskId
): Promise<MiniMaxTTSQueryTaskResponse> {
  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSQueryUrl(baseUrl, taskId),
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
  baseUrl: string,
  apiKey: string,
  taskId: MiniMaxTaskId,
  initialFileId?: MiniMaxFileId,
  shouldAbort?: () => boolean
): Promise<MiniMaxFileId> {
  const startedAt = Date.now();
  let fileId = initialFileId;

  while (Date.now() - startedAt < MINIMAX_TTS_POLL_TIMEOUT_MS) {
    if (shouldAbort?.()) {
      throw createTTSError({
        provider: "minimax",
        code: "TTS_CANCELLED",
      });
    }

    const data = await queryMiniMaxTTSTask(baseUrl, apiKey, taskId);
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
  baseUrl: string,
  apiKey: string,
  fileId: MiniMaxFileId
): Promise<TTSAudioData> {
  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSFileRetrieveUrl(baseUrl, fileId),
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

interface TTSSynthesisProgressContext {
  requestId: string;
}

/**
 * 同步 t2a_v2 合成：短文本直接返回 hex 编码音频（实测 ~1s），
 * 避免异步任务排队导致的长时间等待与偶发挂起。
 */
async function requestMiniMaxTTSSyncAudio(
  context: TTSProviderRequestContext
): Promise<TTSAudioData> {
  const { config, text } = context;
  const minimaxTTSConfig = config.minimax_tts;
  const apiKey = minimaxTTSConfig?.api_key?.trim();
  if (!apiKey || !minimaxTTSConfig) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const requestBody: Record<string, unknown> = {
    model: getMiniMaxTTSModel(config),
    text,
    stream: false,
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

  const emotion = minimaxTTSConfig.emotion;
  if (emotion) {
    requestBody.voice_setting = {
      ...(requestBody.voice_setting as Record<string, unknown>),
      emotion,
    };
  }

  let response: globalThis.Response;

  try {
    response = await fetch(
      buildMiniMaxTTSSyncUrl(getMiniMaxTTSBaseUrl(config)),
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

  const data = parseJSONResponse<MiniMaxTTSSyncResponse>(responseText, {
    provider: "minimax",
    code: "TTS_UNKNOWN_ERROR",
  });

  ensureMiniMaxBaseResponseSuccess(responseText, data, "minimax");

  const audioHex = data.data?.audio;
  if (!audioHex) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_AUDIO_INVALID",
      detail: responseText.trim() || "MiniMax 同步合成未返回音频数据",
    });
  }

  return {
    audioBase64: hexToBase64(audioHex),
    mimeType: "audio/mpeg",
    provider: "minimax",
  };
}

async function requestMiniMaxTTSAudio(
  context: TTSProviderRequestContext,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  const apiKey = context.config.minimax_tts?.api_key?.trim();
  if (!apiKey) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  // 短文本走同步接口：~1s 返回，避免异步任务排队
  if (context.text.length <= MINIMAX_TTS_SYNC_TEXT_MAX_CHARS) {
    const audio = await requestMiniMaxTTSSyncAudio(context);
    if (progress) {
      ttsSynthesisTaskRegistry.advance(progress.requestId, "ready");
    }
    return audio;
  }

  const baseUrl = getMiniMaxTTSBaseUrl(context.config);
  const { taskId, fileId } = await createMiniMaxTTSTask(context);
  if (progress) {
    ttsSynthesisTaskRegistry.advance(progress.requestId, "synthesizing", {
      taskId,
    });
  }

  const outputFileId = await waitForMiniMaxTaskFileId(
    baseUrl,
    apiKey,
    taskId,
    fileId,
    progress
      ? () =>
          ttsSynthesisTaskRegistry.get(progress.requestId)?.stage ===
          "cancelled"
      : undefined
  );

  if (progress) {
    ttsSynthesisTaskRegistry.advance(progress.requestId, "downloading");
  }

  const audio = await downloadMiniMaxTTSAudio(baseUrl, apiKey, outputFileId);
  if (progress) {
    ttsSynthesisTaskRegistry.advance(progress.requestId, "ready");
  }
  return audio;
}

async function requestTTSAudioByProvider(
  provider: TTSProviderId,
  context: TTSProviderRequestContext,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  if (provider === "minimax") {
    return requestMiniMaxTTSAudio(context, progress);
  }
  if (provider === "xiaomi") {
    return requestXiaomiTTSAudio(context);
  }
  return requestDoubaoTTSAudio(context);
}

async function requestTTSAudioWithPriority(
  text: string,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  const config = await getConfig();
  const selection = config.tts_selection || "browser";
  const context: TTSProviderRequestContext = {
    config,
    text,
  };

  // 用户选择浏览器朗读，直接返回未配置错误触发浏览器回退
  if (selection === "browser") {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
      message: "使用浏览器朗读",
    });
  }

  // 只尝试用户选择的 AI 提供者，失败时抛出错误触发浏览器回退
  try {
    return await requestTTSAudioByProvider(selection, context, progress);
  } catch (error) {
    throw normalizeUnknownTTSError(selection, error);
  }
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
    await syncDoubaoASRHeaderRule();

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
    const TTS_TEST_TEXTS: Record<TTSProviderId, string> = {
      minimax: MINIMAX_TTS_TEST_TEXT,
      xiaomi: XIAOMI_TTS_TEST_TEXT,
      doubao: DOUBAO_TTS_TEST_TEXT,
    };
    const text = TTS_TEST_TEXTS[provider];

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
 * 按优先级调用 AI TTS 生成音频；传入 requestId 时登记合成任务表以上报进度。
 */
async function handleSynthesizeSpeech(
  text: string,
  rate: TTSSpeed,
  requestId?: string
): Promise<SynthesizeSpeechResponse> {
  const playbackEpoch = nextTTSPlaybackEpoch();
  if (requestId) {
    ttsSynthesisTaskRegistry.begin(requestId);
  }

  try {
    if (!text.trim()) {
      return {
        success: false,
        errorCode: "TTS_BAD_REQUEST",
        error: "朗读文本不能为空",
      };
    }

    const data = await requestTTSAudioWithPriority(
      text.trim(),
      requestId ? { requestId } : undefined
    );
    if (!isCurrentTTSPlaybackEpoch(playbackEpoch)) {
      if (requestId) {
        ttsSynthesisTaskRegistry.cancel(requestId);
      }
      return {
        success: false,
        errorCode: "TTS_CANCELLED",
        error: "朗读已取消",
      };
    }

    if (requestId) {
      ttsSynthesisTaskRegistry.advance(requestId, "ready");
    }

    await playTTSAudioInOffscreen(data, rate);
    if (!isCurrentTTSPlaybackEpoch(playbackEpoch)) {
      return {
        success: false,
        errorCode: "TTS_CANCELLED",
        error: "朗读已取消",
      };
    }

    return {
      success: true,
      data: {
        provider: data.provider,
        fallbackWarningMessage: data.fallbackWarningMessage,
      },
    };
  } catch (error) {
    if (requestId) {
      ttsSynthesisTaskRegistry.fail(
        requestId,
        error instanceof TTSError ? error.code : "TTS_UNKNOWN_ERROR"
      );
    }

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

async function handleStopTTSPlayback(): Promise<StopTTSPlaybackResponse> {
  try {
    nextTTSPlaybackEpoch();
    await stopOffscreenTTSPlayback();
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "停止 AI 语音播放失败",
    };
  }
}

/**
 * 处理 GET_TTS_SYNTHESIS_STATUS 消息
 *
 * 查询指定合成请求的进度；未知 requestId 返回 stage=unknown。
 */
// ====== 阅读全文（朗读 + 句子高亮） ======

/**
 * 阅读全文会话状态
 *
 * 每次最多一个会话；loop 在后台运行，通过 stopped 标志与
 * offscreen 停止消息协作取消。暂停时 paused 置位：
 * 正在播放的句子由 offscreen 暂停（播放 Promise 挂起），
 * 合成等待期的句子由 resumeResolve 挂起，恢复时统一放行。
 */
interface ReadAloudSession {
  tabId: number;
  sentences: string[];
  index: number;
  stopped: boolean;
  paused: boolean;
  /** 暂停时挂起朗读循环的放行回调（恢复/停止时调用） */
  resumeResolve: (() => void) | null;
}

let readAloudSession: ReadAloudSession | null = null;

function handleGetReadAloudState(): GetReadAloudStateResponse {
  return {
    success: true,
    data: {
      state: readAloudSession
        ? readAloudSession.paused
          ? "paused"
          : "playing"
        : "idle",
      index: readAloudSession?.index ?? 0,
      total: readAloudSession?.sentences.length ?? 0,
    },
  };
}

/** 向侧边栏等扩展页面广播朗读进度（无人监听时静默忽略） */
async function broadcastReadAloudProgress(
  payload: ReadAloudProgressMessage["payload"]
): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: MessageType.READ_ALOUD_PROGRESS,
      payload,
    });
  } catch {
    // 侧边栏未打开时无人接收，忽略
  }
}

/** 通知内容脚本高亮/清除句子；返回页面是否仍可达 */
async function sendReadAloudHighlight(
  tabId: number,
  index: number
): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(
      tabId,
      {
        type: MessageType.READ_ALOUD_HIGHLIGHT,
        payload: { index },
      },
      { frameId: 0 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 处理 START_READ_ALOUD 消息
 *
 * 校验 TTS 配置 → 提取页面句子（必要时注入 Content Script）→
 * 创建会话并后台运行朗读循环。
 */
async function handleStartReadAloud(): Promise<StartReadAloudResponse> {
  try {
    const config = await getConfig();
    const selection = config.tts_selection || "browser";

    // 浏览器朗读无法在扩展上下文播放，要求先配置 AI 语音合成服务
    if (selection === "browser") {
      return {
        success: false,
        error:
          "阅读全文需要 AI 语音合成服务，请先在设置页配置 MiniMax / 小米 / 豆包",
      };
    }

    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!activeTab?.id) {
      return { success: false, error: "无法获取当前 Tab" };
    }
    const tabId = activeTab.id;

    // 已有会话先停止
    if (readAloudSession) {
      await stopReadAloudSession();
    }

    // 提取页面句子（Content Script 缺失时注入后重试）
    let prepare: ReadAloudPrepareResponse;
    try {
      prepare = await chrome.tabs.sendMessage(
        tabId,
        { type: MessageType.READ_ALOUD_PREPARE },
        { frameId: 0 }
      );
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        prepare = await chrome.tabs.sendMessage(
          tabId,
          { type: MessageType.READ_ALOUD_PREPARE },
          { frameId: 0 }
        );
      } catch (injectError) {
        console.error("[Lingride] 阅读全文注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面阅读全文（可能是浏览器内置页面）",
        };
      }
    }

    const sentences = prepare?.data?.sentences ?? [];
    if (sentences.length === 0) {
      return { success: false, error: "当前页面没有可朗读的内容" };
    }

    readAloudSession = { tabId, sentences, index: 0, stopped: false, paused: false, resumeResolve: null };
    void broadcastReadAloudProgress({
      state: "playing",
      index: 0,
      total: sentences.length,
    });
    void runReadAloudLoop(readAloudSession);

    return { success: true };
  } catch (error) {
    console.error("[Lingride] 阅读全文启动失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "阅读全文启动失败",
    };
  }
}

/**
 * 朗读循环：逐句 合成 → 高亮 → 播放，播放当前句时预合成下一句。
 */
async function runReadAloudLoop(session: ReadAloudSession): Promise<void> {
  const total = session.sentences.length;

  // 暂停时挂起循环（合成等待期场景），恢复或停止时放行
  const waitIfPaused = (): Promise<void> => {
    if (!session.paused || session.stopped) return Promise.resolve();
    return new Promise<void>((resolve) => {
      session.resumeResolve = resolve;
    });
  };

  try {
    const config = await getConfig();
    const rate = config.tts_speed || DEFAULT_TTS_SPEED;

    let nextAudio: Promise<TTSAudioData> | null = requestTTSAudioWithPriority(
      session.sentences[0]
    );
    // 预取Promise 若被跳过（停止会话）不应触发未处理 rejection
    nextAudio.catch(() => undefined);

    for (let i = 0; i < total; i++) {
      if (session.stopped) break;

      if (!nextAudio) break;
      const data = await nextAudio;
      if (session.stopped) break;

      // 暂停发生在合成等待期：offscreen 尚无播放可暂停，在此挂起
      await waitIfPaused();
      if (session.stopped) break;

      session.index = i;

      // 页面不可达（如已关闭）则终止
      if (!(await sendReadAloudHighlight(session.tabId, i))) {
        throw new Error("页面连接已断开");
      }

      void broadcastReadAloudProgress({ state: "playing", index: i, total });

      // 播放当前句的同时预合成下一句
      if (i + 1 < total) {
        nextAudio = requestTTSAudioWithPriority(session.sentences[i + 1]);
        nextAudio.catch(() => undefined);
      }

      // 播放期暂停由 offscreen 挂起此 Promise，恢复后继续
      await playTTSAudioInOffscreen(data, rate);
    }

    if (!session.stopped) {
      void broadcastReadAloudProgress({ state: "finished", index: total, total });
    }
  } catch (error) {
    if (!session.stopped) {
      console.error("[Lingride] 阅读全文中断:", error);
      void broadcastReadAloudProgress({
        state: "error",
        index: session.index,
        total,
        error: error instanceof Error ? error.message : "朗读失败",
      });
    }
  } finally {
    await sendReadAloudHighlight(session.tabId, -1);
    if (readAloudSession === session) {
      readAloudSession = null;
    }
  }
}

async function stopReadAloudSession(): Promise<void> {
  const session = readAloudSession;
  if (!session) return;

  session.stopped = true;
  session.paused = false;
  readAloudSession = null;

  // 放行可能挂起的暂停等待，朗读循环随之退出
  session.resumeResolve?.();
  session.resumeResolve = null;

  // 中断 offscreen 当前播放，朗读循环随之退出
  await stopOffscreenTTSPlayback();
  await sendReadAloudHighlight(session.tabId, -1);
  void broadcastReadAloudProgress({
    state: "idle",
    index: session.index,
    total: session.sentences.length,
  });
}

async function handleStopReadAloud(): Promise<StopReadAloudResponse> {
  try {
    await stopReadAloudSession();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "停止朗读失败",
    };
  }
}

/**
 * 处理 PAUSE_READ_ALOUD 消息
 *
 * 播放中的句子由 offscreen 暂停；合成等待期则仅置 paused 标志，
 * 朗读循环在下一句播放前挂起。
 */
async function handlePauseReadAloud(): Promise<PauseReadAloudResponse> {
  const session = readAloudSession;
  if (!session || session.stopped) {
    return { success: false, error: "当前没有朗读会话" };
  }
  if (session.paused) {
    return { success: true };
  }

  try {
    session.paused = true;
    await pauseOffscreenTTSPlayback();
    void broadcastReadAloudProgress({
      state: "paused",
      index: session.index,
      total: session.sentences.length,
    });
    return { success: true };
  } catch (error) {
    session.paused = false;
    return {
      success: false,
      error: error instanceof Error ? error.message : "暂停朗读失败",
    };
  }
}

/**
 * 处理 RESUME_READ_ALOUD 消息
 *
 * 恢复 offscreen 播放，并放行合成等待期挂起的朗读循环。
 */
async function handleResumeReadAloud(): Promise<ResumeReadAloudResponse> {
  const session = readAloudSession;
  if (!session || session.stopped) {
    return { success: false, error: "当前没有朗读会话" };
  }
  if (!session.paused) {
    return { success: true };
  }

  try {
    session.paused = false;
    await resumeOffscreenTTSPlayback();
    session.resumeResolve?.();
    session.resumeResolve = null;
    void broadcastReadAloudProgress({
      state: "playing",
      index: session.index,
      total: session.sentences.length,
    });
    return { success: true };
  } catch (error) {
    session.paused = true;
    return {
      success: false,
      error: error instanceof Error ? error.message : "继续朗读失败",
    };
  }
}

async function handleGetTTSSynthesisStatus(
  requestId: string
): Promise<GetTTSSynthesisStatusResponse> {
  const record = ttsSynthesisTaskRegistry.get(requestId);
  if (!record) {
    return {
      success: true,
      data: { stage: "unknown", elapsedMs: 0 },
    };
  }

  const endedAt = record.finishedAt ?? Date.now();
  return {
    success: true,
    data: {
      stage: record.stage,
      elapsedMs: endedAt - record.startedAt,
      errorCode: record.errorCode,
    },
  };
}

/**
 * 处理 CANCEL_TTS_SYNTHESIS 消息
 *
 * 取消指定合成请求：任务置为 cancelled（轮询循环下一轮即中止），
 * 并递增播放 epoch 防止迟到的音频开始播放。
 */
async function handleCancelTTSSynthesis(
  requestId: string
): Promise<CancelTTSSynthesisResponse> {
  try {
    ttsSynthesisTaskRegistry.cancel(requestId);
    nextTTSPlaybackEpoch();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消语音合成失败",
    };
  }
}

const DIAGNOSE_TTS_SAMPLE_COUNT = 3;
const DIAGNOSE_TTS_SAMPLE_TIMEOUT_MS = 60_000;
const DIAGNOSE_TTS_TEXT =
  "Hello from Lingride. This is a speech synthesis diagnostic sample.";

/**
 * 处理 DOUBAO_ASR_PREPARE 消息
 *
 * 识别器建连前调用：确保 DNR 鉴权头注入规则就位。
 * 会话规则在扩展重载/更新后被清空，仅靠 SW 启动时同步存在时序缺口。
 */
async function handleDoubaoASRPrepare(): Promise<DoubaoASRPrepareResponse> {
  try {
    await syncDoubaoASRHeaderRule();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "豆包 ASR 准备失败",
    };
  }
}

/**
 * 处理 DIAGNOSE_TTS 消息
 *
 * 顺序跑多次采样合成，汇总成功率、耗时与失败原因分布。
 */
async function handleDiagnoseTTS(
  provider: TTSProviderId
): Promise<DiagnoseTTSResponse> {
  try {
    const config = await getConfig();
    const samples: DiagnoseSampleResult[] = [];

    for (let i = 0; i < DIAGNOSE_TTS_SAMPLE_COUNT; i++) {
      const startedAt = Date.now();
      try {
        await withTimeout(
          requestTTSAudioByProvider(provider, {
            config,
            text: DIAGNOSE_TTS_TEXT,
          }),
          DIAGNOSE_TTS_SAMPLE_TIMEOUT_MS,
          () =>
            createTTSError({
              provider,
              code: "TTS_SERVER_BUSY",
              detail: "诊断采样超时（60s）",
            })
        );
        samples.push({ success: true, durationMs: Date.now() - startedAt });
      } catch (error) {
        samples.push({
          success: false,
          durationMs: Date.now() - startedAt,
          errorCode:
            error instanceof TTSError ? error.code : "TTS_UNKNOWN_ERROR",
        });
      }
    }

    return { success: true, data: summarizeDiagnoseSamples(samples) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "语音合成诊断失败",
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
    return p.replace(/^\d+[.)-]+\s*/, "").trim();
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
    const { config, provider } = await prepareAIProvider();
    const prompts =
      config.english_definition_prompts || ENGLISH_DEFINITION_PROMPTS;

    // 2. 构建 Prompt
    const userPrompt = prompts.user_prompt_template
      .replace(/\{\{text\}\}/g, text)
      .replace(/\{\{user_level\}\}/g, userLevel);

    // 3. 调用 AI
    console.log(`[Lingride] 开始英英释义 (${userLevel})...`);
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

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

// ====== 消息路由 ======

/**
 * 消息监听器
 *
 * 接收来自侧边栏和 Content Script 的消息，
 * 分发到对应的处理函数。
 */
chrome.runtime.onMessage.addListener(
  (message: Message | OffscreenTTSMessage, sender, sendResponse) => {
    if (
      message.type === OFFSCREEN_TTS_PLAY ||
      message.type === OFFSCREEN_TTS_STOP
    ) {
      return false;
    }

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
            // 如果是从侧边栏发来的，获取当前活动 Tab
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
            // 如果是从侧边栏发来的，获取当前活动 Tab
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
            // 如果是从侧边栏发来的，获取当前活动 Tab
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
          response = await handleSynthesizeSpeech(
            message.payload.text,
            message.payload.rate,
            message.payload.requestId
          );
          break;

        case MessageType.GET_TTS_SYNTHESIS_STATUS:
          response = await handleGetTTSSynthesisStatus(
            message.payload.requestId
          );
          break;

        case MessageType.CANCEL_TTS_SYNTHESIS:
          response = await handleCancelTTSSynthesis(message.payload.requestId);
          break;

        case MessageType.DIAGNOSE_TTS:
          response = await handleDiagnoseTTS(message.payload.provider);
          break;

        case MessageType.DOUBAO_ASR_PREPARE:
          response = await handleDoubaoASRPrepare();
          break;

        case MessageType.STOP_TTS_PLAYBACK:
          response = await handleStopTTSPlayback();
          break;

        case MessageType.START_READ_ALOUD:
          response = await handleStartReadAloud();
          break;

        case MessageType.STOP_READ_ALOUD:
          response = await handleStopReadAloud();
          break;

        case MessageType.PAUSE_READ_ALOUD:
          response = await handlePauseReadAloud();
          break;

        case MessageType.RESUME_READ_ALOUD:
          response = await handleResumeReadAloud();
          break;

        case MessageType.GET_READ_ALOUD_STATE:
          response = handleGetReadAloudState();
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

// 点击扩展图标打开侧边栏（由 manifest.json side_panel 与 setPanelBehavior 配置处理）
// 此处可添加额外的图标点击逻辑

console.log("[Lingride] 消息路由已就绪");
