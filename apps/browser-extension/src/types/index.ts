/**
 * @file index.ts
 * @description 类型定义导出入口
 *
 * 统一导出所有类型定义，便于其他模块导入使用。
 *
 * 使用方式：
 * ```typescript
 * import { LingridConfig, MessageType, TranslationStatus } from '../types';
 * ```
 *
 * @author Lingride Team
 * @since 1.0.0
 */

// 配置类型
export {
  CEFR_LEVELS,
  DEFAULT_CONFIG,
  MINIMAX_LEGACY_DEFAULT_MODEL,
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_DEFAULT_MODEL,
  MINIMAX_TTS_DEFAULT_VOICE_ID,
  MINIMAX_TTS_LEGACY_DEFAULT_MODEL,
  MINIMAX_TTS_REMOVED_MODELS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  MINIMAX_AI_API_BASE_URL,
  MINIMAX_AI_API_BASE_URL_CN,
  MINIMAX_TTS_API_BASE_URL_CN,
  normalizeMiniMaxTTSBaseUrl,
  STORAGE_KEY,
  XIAOMI_TTS_API_BASE_URL,
  XIAOMI_TTS_MODEL,
  XIAOMI_TTS_VOICE_OPTIONS,
  XIAOMI_TTS_DEFAULT_VOICE,
  normalizeXiaomiTTSVoice,
  DOUBAO_TTS_API_URL,
  DOUBAO_TTS_RESOURCE_ID,
  DOUBAO_TTS_VOICE_OPTIONS,
  DOUBAO_TTS_DEFAULT_VOICE,
  normalizeDoubaoTTSVoice,
  DOUBAO_ASR_WS_URL,
  DOUBAO_ASR_RESOURCE_ID,
  XIAOMI_ASR_API_URL,
  XIAOMI_ASR_MODEL,
  MINIMAX_ASR_MODEL,
  isDoubaoASRConfigured,
  resolveDoubaoASRApiKey,
  resolveXiaomiASRApiKey,
  isMiniMaxASRConfigured,
  isXiaomiASRConfigured,
  resolveASRSelection,
  calculateTargetLevel,
  getRetentionPercent,
  resolveConfigApiProvider,
  resolveConfigModel,
  resolveConfigOpenAIAuthMode,
  toProviderConfig,
} from "./config";
export type {
  AIProviderId,
  ASRProviderId,
  ASRSelectionMode,
  CEFRLevel,
  EnglishDefinitionPromptConfig,
  ExplanationPromptPresetId,
  LingridConfig,
  MixedTranslatePromptConfig,
  OpenAIAuthMode,
  ParaphrasePromptConfig,
  PromptConfig,
  ProviderConfig,
  TTSSelectionMode,
  TTSProviderId,
  MiniMaxTTSConfig,
  MiniMaxTTSModel,
  MiniMaxEmotion,
  MiniMaxVoice,
  XiaomiTTSConfig,
  XiaomiTTSVoice,
  DoubaoTTSConfig,
  DoubaoTTSVoice,
  DoubaoASRConfig,
  XiaomiASRConfig,
} from "./config";
export {
  DEFAULT_TTS_SPEED,
  isTTSSpeed,
  TTS_SPEED_OPTIONS,
} from "./tts";
export type { TTSSpeed } from "./tts";

// 消息类型
export { MessageType } from "./messages";
export type {
  AnalyzeDifficultyMessage,
  AnalyzeDifficultyResponse,
  AnalyzeListeningMessage,
  AnalyzeListeningResponse,
  AnalyzeSentenceMessage,
  AnalyzeSentenceResponse,
  AssessPronunciationMessage,
  AssessPronunciationResponse,
  BaseResponse,
  ChineseToEnglishMessage,
  ChineseToEnglishResponse,
  EnglishDefinitionMessage,
  EnglishDefinitionResponse,
  EnglishDefinitionResult,
  EnglishToChineseMessage,
  EnglishToChineseResponse,
  ExtractPageTextMessage,
  ExtractPageTextResponse,
  GetOpenAIModelCatalogMessage,
  GetOpenAIModelCatalogResponse,
  GetOpenAIOAuthStatusMessage,
  GetOpenAIOAuthStatusResponse,
  GetConfigMessage,
  GetConfigResponse,
  GetMixedTranslateStateMessage,
  GetMixedTranslateStateResponse,
  GetParaphraseStateMessage,
  GetParaphraseStateResponse,
  GetTranslationStateMessage,
  GetTranslationStateResponse,
  Message,
  MixedTranslateMessage,
  MixedTranslateResponse,
  OpenAIModelCatalogResponseData,
  OpenAIModelCatalogScope,
  OpenAIModelCatalogVerificationState,
  OpenAIModelItem,
  OpenAIOAuthErrorCode,
  OpenAIOAuthStatus,
  ParaphraseMessage,
  ParaphraseResponse,
  RefreshOpenAIModelCatalogMessage,
  RefreshOpenAIModelCatalogResponse,
  Response,
  SaveConfigMessage,
  SaveConfigResponse,
  StartOpenAIOAuthMessage,
  StartOpenAIOAuthResponse,
  CompleteOpenAIOAuthMessage,
  CompleteOpenAIOAuthResponse,
  DisconnectOpenAIOAuthMessage,
  DisconnectOpenAIOAuthResponse,
  CancelTTSSynthesisMessage,
  CancelTTSSynthesisResponse,
  DiagnoseTTSMessage,
  DiagnoseTTSResponse,
  DoubaoASRPrepareMessage,
  DoubaoASRPrepareResponse,
  GetTTSSynthesisStatusMessage,
  GetTTSSynthesisStatusResponse,
  TTSDiagnoseSummary,
  TTSSynthesisStage,
  SegmentCorpusMessage,
  SegmentCorpusResponse,
  ShadowAssessMessage,
  ShadowAssessResponse,
  SplitSentencesMessage,
  SplitSentencesResponse,
  StopTTSPlaybackMessage,
  StopTTSPlaybackResponse,
  SynthesizeSpeechMessage,
  SynthesizeSpeechResponse,
  TestTTSConnectionMessage,
  TestTTSConnectionResponse,
  TestConnectionMessage,
  TestConnectionResponse,
  TTSServiceErrorCode,
  TTSServiceErrorHint,
  TTSSpeedChangedMessage,
  ToggleMixedTranslateMessage,
  ToggleParaphraseMessage,
  ToggleTranslationMessage,
  TranslateMessage,
  TranslateResponse,
} from "./messages";

// 翻译类型
export {
  DEFAULT_BATCH_CONFIG,
  TranslationStatus,
  estimateTokens,
  simpleHash,
} from "./translation";
export type {
  BatchManagerConfig,
  BatchTranslationResult,
  CacheEntry,
  TranslatableElement,
  TranslationBatch,
  TranslationCache,
} from "./translation";

// 难度分析类型（CEFRLevel 已从 config.ts 导出）
export type {
  DifficultyLevel,
  DifficultyPromptConfig,
  DifficultyResult,
  SentenceComplexity,
  VocabularyComplexity,
} from "./difficulty";

// 长难句分析类型
export type {
  KeyPhrase,
  SentenceAnalysisPromptConfig,
  SentenceAnalysisResult,
  SentenceClause,
  SentenceStructure,
} from "./sentenceAnalysis";

// 发音评估类型
export type {
  ISpeechRecognizer,
  MismatchDetail,
  PronunciationAssessmentResult,
  PronunciationIssue,
  PronunciationPromptConfig,
  TextComparison,
} from "./pronunciationAssessment";

// 影子跟读类型
export { DEFAULT_SHADOW_CONFIG } from "./shadowReading";
export type {
  ShadowAssessmentResult,
  ShadowAssessPromptConfig,
  ShadowConfig,
  ShadowMode,
  ShadowProgress,
  ShadowSentence,
  ShadowSentenceStatus,
  ShadowSpeed,
  SplitSentencesPromptConfig,
  SplitSentencesRequest,
  SplitSentencesResult,
} from "./shadowReading";

// 回声法类型
export { DEFAULT_ECHO_METHOD_STATE } from "./echoMethod";
export type {
  AudioCaptureError,
  AudioCaptureState,
  EchoMethodCallbacks,
  EchoMethodError,
  EchoMethodState,
  PlayingSource,
} from "./echoMethod";

// 语料库类型
export type {
  CorpusPromptConfig,
  CorpusSentence,
  ListeningAnalysisResult,
  ListeningError,
  ListeningErrorType,
  SegmentCorpusResult,
} from "./corpus";
