/**
 * @file messages.ts
 * @description Chrome 扩展消息类型定义
 *
 * 定义 Popup、Background 和 Content Script 之间
 * 通信使用的消息类型和响应类型。
 *
 * 消息流向：
 * - Popup → Background: 配置更新、翻译开关控制、连接测试、难度分析、长难句分析
 * - Content → Background: 翻译请求
 * - Background → Content: 翻译结果、状态变更、文本提取请求
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { LingridConfig, TTSProviderId } from "./config";
import { CEFRLevel, DifficultyResult } from "./difficulty";
import { SentenceAnalysisResult } from "./sentenceAnalysis";
import { PronunciationAssessmentResult } from "./pronunciationAssessment";
import {
  ShadowAssessmentResult,
  SplitSentencesResult,
} from "./shadowReading";
import {
  ListeningAnalysisResult,
  SegmentCorpusResult,
} from "./corpus";
import { TTSSpeed } from "./tts";

/**
 * 消息类型枚举
 *
 * 定义所有可能的消息操作类型。
 */
export enum MessageType {
  // ====== 配置相关 ======
  /** 获取配置 */
  GET_CONFIG = "GET_CONFIG",
  /** 保存配置 */
  SAVE_CONFIG = "SAVE_CONFIG",
  /** 启动 OpenAI OAuth 登录 */
  START_OPENAI_OAUTH = "START_OPENAI_OAUTH",
  /** 完成 OpenAI OAuth 登录 */
  COMPLETE_OPENAI_OAUTH = "COMPLETE_OPENAI_OAUTH",
  /** 获取 OpenAI OAuth 状态 */
  GET_OPENAI_OAUTH_STATUS = "GET_OPENAI_OAUTH_STATUS",
  /** 断开 OpenAI OAuth */
  DISCONNECT_OPENAI_OAUTH = "DISCONNECT_OPENAI_OAUTH",
  /** 全局 TTS 语速已变更（Background -> Extension Pages） */
  TTS_SPEED_CHANGED = "TTS_SPEED_CHANGED",

  // ====== 翻译控制 ======
  /** 开启/关闭翻译 */
  TOGGLE_TRANSLATION = "TOGGLE_TRANSLATION",
  /** 获取当前 Tab 的翻译状态 */
  GET_TRANSLATION_STATE = "GET_TRANSLATION_STATE",

  // ====== 翻译请求 ======
  /** 请求翻译文本 */
  TRANSLATE = "TRANSLATE",

  // ====== 连接测试 ======
  /** 测试 API 连接 */
  TEST_CONNECTION = "TEST_CONNECTION",
  /** 测试指定 TTS 服务连接 */
  TEST_TTS_CONNECTION = "TEST_TTS_CONNECTION",

  // ====== 难度分析 ======
  /** 分析页面难度 */
  ANALYZE_DIFFICULTY = "ANALYZE_DIFFICULTY",
  /** 提取页面文本（Background → Content） */
  EXTRACT_PAGE_TEXT = "EXTRACT_PAGE_TEXT",

  // ====== 释义控制 ======
  /** 开启/关闭释义 */
  TOGGLE_PARAPHRASE = "TOGGLE_PARAPHRASE",
  /** 获取当前 Tab 的释义状态 */
  GET_PARAPHRASE_STATE = "GET_PARAPHRASE_STATE",

  // ====== 释义请求 ======
  /** 请求释义文本 */
  PARAPHRASE = "PARAPHRASE",

  // ====== 混杂中英控制 ======
  /** 开启/关闭混杂中英翻译 */
  TOGGLE_MIXED_TRANSLATE = "TOGGLE_MIXED_TRANSLATE",
  /** 获取当前 Tab 的混杂中英翻译状态 */
  GET_MIXED_TRANSLATE_STATE = "GET_MIXED_TRANSLATE_STATE",

  // ====== 混杂中英请求 ======
  /** 请求混杂中英翻译 */
  MIXED_TRANSLATE = "MIXED_TRANSLATE",

  // ====== 长难句分析 ======
  /** 分析英文长难句 */
  ANALYZE_SENTENCE = "ANALYZE_SENTENCE",

  // ====== 语音合成 ======
  /** 合成语音 */
  SYNTHESIZE_SPEECH = "SYNTHESIZE_SPEECH",

  // ====== 发音评估 ======
  /** 评估发音 */
  ASSESS_PRONUNCIATION = "ASSESS_PRONUNCIATION",

  // ====== 外教助手 ======
  /** 中译英 */
  CHINESE_TO_ENGLISH = "CHINESE_TO_ENGLISH",
  /** 英译中 */
  ENGLISH_TO_CHINESE = "ENGLISH_TO_CHINESE",
  /** 英英释义 */
  ENGLISH_DEFINITION = "ENGLISH_DEFINITION",

  // ====== 影子跟读 ======
  /** 智能分句 */
  SPLIT_SENTENCES = "SPLIT_SENTENCES",
  /** 影子跟读评估 */
  SHADOW_ASSESS = "SHADOW_ASSESS",

  // ====== 腾讯云 ASR ======
  /** 请求腾讯云 ASR 签名 URL */
  TENCENT_ASR_SIGN = "TENCENT_ASR_SIGN",

  // ====== 阿里云 ASR ======
  /** 启动阿里云 ASR 识别 */
  ALIBABA_ASR_START = "ALIBABA_ASR_START",
  /** 发送音频数据到阿里云 ASR */
  ALIBABA_ASR_AUDIO = "ALIBABA_ASR_AUDIO",
  /** 停止阿里云 ASR 识别 */
  ALIBABA_ASR_STOP = "ALIBABA_ASR_STOP",
  /** 阿里云 ASR 实时识别结果（Background -> Tutor，通过 Port） */
  ALIBABA_ASR_RESULT = "ALIBABA_ASR_RESULT",

  // ====== 语料库听力训练 ======
  /** 语料库断句（i+1 难度） */
  SEGMENT_CORPUS = "SEGMENT_CORPUS",
  /** 听力分析 */
  ANALYZE_LISTENING = "ANALYZE_LISTENING",
}

/**
 * 获取配置消息
 */
export interface GetConfigMessage {
  type: MessageType.GET_CONFIG;
}

/**
 * 保存配置消息
 */
export interface SaveConfigMessage {
  type: MessageType.SAVE_CONFIG;
  payload: LingridConfig;
}

/**
 * OpenAI OAuth 状态
 */
export type OpenAIOAuthStatus = "missing" | "pending" | "connected" | "expired";

/**
 * OpenAI OAuth 错误码
 */
export type OpenAIOAuthErrorCode =
  | "STATE_MISMATCH"
  | "MISSING_CODE"
  | "TOKEN_EXCHANGE_FAILED"
  | "OAUTH_NOT_CONNECTED";

/**
 * 启动 OpenAI OAuth 消息
 */
export interface StartOpenAIOAuthMessage {
  type: MessageType.START_OPENAI_OAUTH;
}

/**
 * 完成 OpenAI OAuth 消息
 */
export interface CompleteOpenAIOAuthMessage {
  type: MessageType.COMPLETE_OPENAI_OAUTH;
  payload: {
    callbackInput: string;
  };
}

/**
 * 获取 OpenAI OAuth 状态消息
 */
export interface GetOpenAIOAuthStatusMessage {
  type: MessageType.GET_OPENAI_OAUTH_STATUS;
}

/**
 * 断开 OpenAI OAuth 消息
 */
export interface DisconnectOpenAIOAuthMessage {
  type: MessageType.DISCONNECT_OPENAI_OAUTH;
}

/**
 * 全局 TTS 语速变更消息
 */
export interface TTSSpeedChangedMessage {
  type: MessageType.TTS_SPEED_CHANGED;
  payload: {
    speed: TTSSpeed;
  };
}

/**
 * 切换翻译状态消息
 */
export interface ToggleTranslationMessage {
  type: MessageType.TOGGLE_TRANSLATION;
  payload: {
    /** 是否启用翻译 */
    enabled: boolean;
  };
}

/**
 * 获取翻译状态消息
 */
export interface GetTranslationStateMessage {
  type: MessageType.GET_TRANSLATION_STATE;
}

/**
 * 翻译请求消息
 */
export interface TranslateMessage {
  type: MessageType.TRANSLATE;
  payload: {
    /** 待翻译的文本数组 */
    texts: string[];
    /** 批次 ID，用于匹配响应 */
    batchId: string;
  };
}

/**
 * 测试连接消息
 */
export interface TestConnectionMessage {
  type: MessageType.TEST_CONNECTION;
}

/**
 * TTS 测试连接消息
 */
export interface TestTTSConnectionMessage {
  type: MessageType.TEST_TTS_CONNECTION;
  payload: {
    /** 待测试的 TTS 服务 */
    provider: TTSProviderId;
  };
}

/**
 * 难度分析消息
 */
export interface AnalyzeDifficultyMessage {
  type: MessageType.ANALYZE_DIFFICULTY;
}

/**
 * 提取页面文本消息
 */
export interface ExtractPageTextMessage {
  type: MessageType.EXTRACT_PAGE_TEXT;
}

/**
 * 切换释义状态消息
 */
export interface ToggleParaphraseMessage {
  type: MessageType.TOGGLE_PARAPHRASE;
  payload: {
    /** 是否启用释义 */
    enabled: boolean;
  };
}

/**
 * 获取释义状态消息
 */
export interface GetParaphraseStateMessage {
  type: MessageType.GET_PARAPHRASE_STATE;
}

/**
 * 释义请求消息
 */
export interface ParaphraseMessage {
  type: MessageType.PARAPHRASE;
  payload: {
    /** 待释义的文本数组 */
    texts: string[];
    /** 批次 ID，用于匹配响应 */
    batchId: string;
  };
}

/**
 * 切换混杂中英翻译状态消息
 */
export interface ToggleMixedTranslateMessage {
  type: MessageType.TOGGLE_MIXED_TRANSLATE;
  payload: {
    /** 是否启用混杂中英翻译 */
    enabled: boolean;
  };
}

/**
 * 获取混杂中英翻译状态消息
 */
export interface GetMixedTranslateStateMessage {
  type: MessageType.GET_MIXED_TRANSLATE_STATE;
}

/**
 * 混杂中英翻译请求消息
 */
export interface MixedTranslateMessage {
  type: MessageType.MIXED_TRANSLATE;
  payload: {
    /** 待翻译的文本数组 */
    texts: string[];
    /** 批次 ID，用于匹配响应 */
    batchId: string;
  };
}

/**
 * 长难句分析消息
 */
export interface AnalyzeSentenceMessage {
  type: MessageType.ANALYZE_SENTENCE;
  payload: {
    /** 待分析的英文句子 */
    sentence: string;
  };
}

/**
 * 语音合成消息
 */
export interface SynthesizeSpeechMessage {
  type: MessageType.SYNTHESIZE_SPEECH;
  payload: {
    /** 要朗读的文本 */
    text: string;
    /** 播放语速 */
    rate: TTSSpeed;
  };
}

/**
 * 发音评估消息
 */
export interface AssessPronunciationMessage {
  type: MessageType.ASSESS_PRONUNCIATION;
  payload: {
    /** 原文（用户输入的练习句子） */
    original: string;
    /** 识别文本（用户朗读后的语音识别结果） */
    recognized: string;
  };
}

/**
 * 中译英消息
 */
export interface ChineseToEnglishMessage {
  type: MessageType.CHINESE_TO_ENGLISH;
  payload: {
    /** 待翻译的中文文本 */
    text: string;
  };
}

/**
 * 英译中消息
 */
export interface EnglishToChineseMessage {
  type: MessageType.ENGLISH_TO_CHINESE;
  payload: {
    /** 待翻译的英文文本 */
    text: string;
  };
}

/**
 * 英英释义消息
 */
export interface EnglishDefinitionMessage {
  type: MessageType.ENGLISH_DEFINITION;
  payload: {
    /** 待释义的英文文本 */
    text: string;
    /** 用户 CEFR 水平 */
    userLevel: CEFRLevel;
  };
}

/**
 * 智能分句消息
 */
export interface SplitSentencesMessage {
  type: MessageType.SPLIT_SENTENCES;
  payload: {
    /** 待分句的英文文本 */
    text: string;
  };
}

/**
 * 影子跟读评估消息
 */
export interface ShadowAssessMessage {
  type: MessageType.SHADOW_ASSESS;
  payload: {
    /** 原文（练习句子） */
    original: string;
    /** 识别文本（用户跟读后的语音识别结果） */
    recognized: string;
  };
}

/**
 * 腾讯云 ASR 签名请求消息
 */
export interface TencentASRSignMessage {
  type: MessageType.TENCENT_ASR_SIGN;
}

/**
 * 阿里云 ASR 启动消息
 */
export interface AlibabaASRStartMessage {
  type: MessageType.ALIBABA_ASR_START;
}

/**
 * 阿里云 ASR 音频数据消息
 */
export interface AlibabaASRAudioMessage {
  type: MessageType.ALIBABA_ASR_AUDIO;
  payload: {
    /** Base64 编码的 PCM 音频数据 */
    audioData: string;
  };
}

/**
 * 阿里云 ASR 停止消息
 */
export interface AlibabaASRStopMessage {
  type: MessageType.ALIBABA_ASR_STOP;
}

/**
 * 阿里云 ASR 实时识别结果消息（Background -> Tutor，通过 Port）
 */
export interface AlibabaASRResultMessage {
  type: MessageType.ALIBABA_ASR_RESULT;
  payload: {
    /** 识别文本 */
    text: string;
    /** 是否为最终结果 */
    isFinal: boolean;
  };
}

/**
 * 语料库断句消息
 *
 * 请求 AI 根据用户 CEFR 水平对语料文本进行 i+1 难度断句。
 */
export interface SegmentCorpusMessage {
  type: MessageType.SEGMENT_CORPUS;
  payload: {
    /** 待断句的英文文本 */
    text: string;
    /** 用户 CEFR 水平 */
    userLevel: CEFRLevel;
  };
}

/**
 * 听力分析消息
 *
 * 请求 AI 对比用户听写结果与原文，分析听力盲区。
 */
export interface AnalyzeListeningMessage {
  type: MessageType.ANALYZE_LISTENING;
  payload: {
    /** 原文句子 */
    original: string;
    /** 用户听写输入 */
    userInput: string;
    /** 用户 CEFR 水平 */
    userLevel: CEFRLevel;
  };
}

/**
 * 所有消息类型的联合类型
 */
export type Message =
  | GetConfigMessage
  | SaveConfigMessage
  | StartOpenAIOAuthMessage
  | CompleteOpenAIOAuthMessage
  | GetOpenAIOAuthStatusMessage
  | DisconnectOpenAIOAuthMessage
  | TTSSpeedChangedMessage
  | ToggleTranslationMessage
  | GetTranslationStateMessage
  | TranslateMessage
  | TestConnectionMessage
  | TestTTSConnectionMessage
  | AnalyzeDifficultyMessage
  | ExtractPageTextMessage
  | ToggleParaphraseMessage
  | GetParaphraseStateMessage
  | ParaphraseMessage
  | ToggleMixedTranslateMessage
  | GetMixedTranslateStateMessage
  | MixedTranslateMessage
  | AnalyzeSentenceMessage
  | SynthesizeSpeechMessage
  | AssessPronunciationMessage
  | ChineseToEnglishMessage
  | EnglishToChineseMessage
  | EnglishDefinitionMessage
  | SplitSentencesMessage
  | ShadowAssessMessage
  | TencentASRSignMessage
  | AlibabaASRStartMessage
  | AlibabaASRAudioMessage
  | AlibabaASRStopMessage
  | AlibabaASRResultMessage
  | SegmentCorpusMessage
  | AnalyzeListeningMessage;

// ====== 响应类型定义 ======

/**
 * 基础响应结构
 */
export interface BaseResponse {
  /** 操作是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 获取配置响应
 *
 * 返回完整的用户配置，包括 API 配置、Prompt 配置和用户英文水平。
 */
export interface GetConfigResponse extends BaseResponse {
  data?: LingridConfig;
}

/**
 * 保存配置响应
 */
export interface SaveConfigResponse extends BaseResponse {}

/**
 * 启动 OpenAI OAuth 响应
 */
export interface StartOpenAIOAuthResponse extends BaseResponse {
  data?: {
    authorizeUrl: string;
    pending: true;
  };
  errorCode?: OpenAIOAuthErrorCode;
}

/**
 * 完成 OpenAI OAuth 响应
 */
export interface CompleteOpenAIOAuthResponse extends BaseResponse {
  data?: {
    connected: true;
    expiresAt: number;
    accountId: string;
  };
  errorCode?: OpenAIOAuthErrorCode;
}

/**
 * 获取 OpenAI OAuth 状态响应
 */
export interface GetOpenAIOAuthStatusResponse extends BaseResponse {
  data?: {
    status: OpenAIOAuthStatus;
    expiresAt?: number;
    accountId?: string;
  };
  errorCode?: OpenAIOAuthErrorCode;
}

/**
 * 断开 OpenAI OAuth 响应
 */
export interface DisconnectOpenAIOAuthResponse extends BaseResponse {
  data?: {
    disconnected: true;
  };
  errorCode?: OpenAIOAuthErrorCode;
}

/**
 * 翻译状态响应
 */
export interface GetTranslationStateResponse extends BaseResponse {
  data?: {
    /** 当前 Tab 翻译是否启用 */
    enabled: boolean;
  };
}

/**
 * 翻译结果响应
 */
export interface TranslateResponse extends BaseResponse {
  data?: {
    /** 批次 ID */
    batchId: string;
    /** 翻译结果数组，与请求的 texts 数组一一对应 */
    translations: string[];
  };
}

/**
 * 测试连接响应
 */
export interface TestConnectionResponse extends BaseResponse {
  data?: {
    /** 响应延迟（毫秒） */
    latency: number;
    /** 模型名称 */
    model: string;
  };
}

/**
 * TTS 服务错误码
 */
export type TTSServiceErrorCode =
  | "TTS_NOT_CONFIGURED"
  | "TTS_BAD_REQUEST"
  | "TTS_AUTH_ERROR"
  | "TTS_FORBIDDEN"
  | "TTS_CONTENT_BLOCKED"
  | "TTS_ENDPOINT_ERROR"
  | "TTS_NETWORK_ERROR"
  | "TTS_RATE_LIMIT"
  | "TTS_SERVER_ERROR"
  | "TTS_SERVER_BUSY"
  | "TTS_AUDIO_INVALID"
  | "TTS_UNKNOWN_ERROR";

/**
 * TTS 服务错误细分提示
 *
 * 仅用于前台生成更具体的错误提示，不作为稳定主错误码使用。
 */
export type TTSServiceErrorHint =
  | "PARAM_INCORRECT"
  | "VOICE_INVALID"
  | "MODEL_INVALID"
  | "MESSAGES_INVALID"
  | "AUDIO_PARAM_INVALID";

/**
 * 小米 TTS 测试连接响应
 */
export interface TestTTSConnectionResponse extends BaseResponse {
  httpStatus?: number;
  errorCode?: TTSServiceErrorCode;
  errorHint?: TTSServiceErrorHint;
  errorDetail?: string;
}

/**
 * 提取页面文本响应
 */
export interface ExtractPageTextResponse extends BaseResponse {
  data?: {
    /** 提取的文本内容 */
    text: string;
    /** 单词数量 */
    wordCount: number;
    /** 是否为选中文本 */
    isSelection: boolean;
  };
}

/**
 * 难度分析响应
 */
export interface AnalyzeDifficultyResponse extends BaseResponse {
  data?: DifficultyResult;
}

/**
 * 释义状态响应
 */
export interface GetParaphraseStateResponse extends BaseResponse {
  data?: {
    /** 当前 Tab 释义是否启用 */
    enabled: boolean;
  };
}

/**
 * 释义结果响应
 */
export interface ParaphraseResponse extends BaseResponse {
  data?: {
    /** 批次 ID */
    batchId: string;
    /** 释义结果数组，与请求的 texts 数组一一对应 */
    paraphrases: string[];
  };
}

/**
 * 混杂中英翻译状态响应
 */
export interface GetMixedTranslateStateResponse extends BaseResponse {
  data?: {
    /** 当前 Tab 混杂中英翻译是否启用 */
    enabled: boolean;
  };
}

/**
 * 混杂中英翻译结果响应
 */
export interface MixedTranslateResponse extends BaseResponse {
  data?: {
    /** 批次 ID */
    batchId: string;
    /** 混杂翻译结果数组，与请求的 texts 数组一一对应 */
    mixedTexts: string[];
  };
}

/**
 * 长难句分析响应
 */
export interface AnalyzeSentenceResponse extends BaseResponse {
  data?: SentenceAnalysisResult;
}

/**
 * 语音合成响应
 */
export interface SynthesizeSpeechResponse extends BaseResponse {
  data?: {
    /** Base64 编码的音频 */
    audioBase64: string;
    /** 音频 MIME 类型 */
    mimeType: string;
    /** 实际命中的 AI TTS 服务 */
    provider: TTSProviderId;
    /** 服务间回退时的轻提示 */
    fallbackWarningMessage?: string;
  };
  /** 错误代码（用于前台决定是否静默回退） */
  errorCode?: TTSServiceErrorCode;
  /** 细分错误提示（用于前台展示更具体原因） */
  errorHint?: TTSServiceErrorHint;
  /** HTTP 状态码（如有） */
  httpStatus?: number;
  /** 原始错误详情（如有） */
  errorDetail?: string;
}

/**
 * 发音评估响应
 */
export interface AssessPronunciationResponse extends BaseResponse {
  data?: PronunciationAssessmentResult;
}

/**
 * 中译英响应
 */
export interface ChineseToEnglishResponse extends BaseResponse {
  data?: {
    /** 翻译结果 */
    translation: string;
  };
}

/**
 * 英译中响应
 */
export interface EnglishToChineseResponse extends BaseResponse {
  data?: {
    /** 翻译结果 */
    translation: string;
  };
}

/**
 * 英英释义结果
 */
export interface EnglishDefinitionResult {
  /** 英文释义 */
  definition: string;
  /** 例句列表 */
  examples: string[];
  /** 同义词 */
  synonyms: string[];
  /** 用法说明 */
  usageNotes: string;
}

/**
 * 英英释义响应
 */
export interface EnglishDefinitionResponse extends BaseResponse {
  data?: EnglishDefinitionResult;
}

/**
 * 智能分句响应
 */
export interface SplitSentencesResponse extends BaseResponse {
  data?: SplitSentencesResult;
}

/**
 * 影子跟读评估响应
 */
export interface ShadowAssessResponse extends BaseResponse {
  data?: ShadowAssessmentResult;
}

/**
 * 腾讯云 ASR 签名响应
 */
export interface TencentASRSignResponse extends BaseResponse {
  data?: {
    /** 签名后的 WebSocket URL */
    signedUrl: string;
  };
}

/**
 * 阿里云 ASR 启动响应
 */
export interface AlibabaASRStartResponse extends BaseResponse {}

/**
 * 阿里云 ASR 停止响应
 */
export interface AlibabaASRStopResponse extends BaseResponse {
  data?: {
    /** 最终识别结果 */
    finalText: string;
  };
}

/**
 * 语料库断句响应
 *
 * 返回 AI 根据用户 CEFR 水平进行 i+1 难度断句的结果。
 */
export interface SegmentCorpusResponse extends BaseResponse {
  data?: SegmentCorpusResult;
}

/**
 * 听力分析响应
 *
 * 返回 AI 对用户听写结果的分析，包括错误类型、听力盲区和改进建议。
 */
export interface AnalyzeListeningResponse extends BaseResponse {
  data?: ListeningAnalysisResult;
}

/**
 * 所有响应类型的联合类型
 */
export type Response =
  | GetConfigResponse
  | SaveConfigResponse
  | StartOpenAIOAuthResponse
  | CompleteOpenAIOAuthResponse
  | GetOpenAIOAuthStatusResponse
  | DisconnectOpenAIOAuthResponse
  | GetTranslationStateResponse
  | TranslateResponse
  | TestConnectionResponse
  | TestTTSConnectionResponse
  | ExtractPageTextResponse
  | AnalyzeDifficultyResponse
  | GetParaphraseStateResponse
  | ParaphraseResponse
  | GetMixedTranslateStateResponse
  | MixedTranslateResponse
  | AnalyzeSentenceResponse
  | SynthesizeSpeechResponse
  | AssessPronunciationResponse
  | ChineseToEnglishResponse
  | EnglishToChineseResponse
  | EnglishDefinitionResponse
  | SplitSentencesResponse
  | ShadowAssessResponse
  | TencentASRSignResponse
  | AlibabaASRStartResponse
  | AlibabaASRStopResponse
  | SegmentCorpusResponse
  | AnalyzeListeningResponse;
