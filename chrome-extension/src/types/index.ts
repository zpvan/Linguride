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
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_DEFAULT_MODEL,
  MINIMAX_TTS_DEFAULT_VOICE_ID,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  STORAGE_KEY,
  XIAOMI_TTS_API_BASE_URL,
  XIAOMI_TTS_MODEL,
  calculateTargetLevel,
  getRetentionPercent,
  toProviderConfig,
} from "./config";
export type {
  AlibabaASRConfig,
  CEFRLevel,
  LingridConfig,
  MixedTranslatePromptConfig,
  ParaphrasePromptConfig,
  PromptConfig,
  ProviderConfig,
  TencentASRConfig,
  TTSProviderId,
  MiniMaxTTSConfig,
  MiniMaxTTSModel,
  XiaomiTTSConfig,
  XiaomiTTSStyleSelection,
  XiaomiTTSVoice,
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
  AlibabaASRAudioMessage,
  AlibabaASRResultMessage,
  AlibabaASRStartMessage,
  AlibabaASRStartResponse,
  AlibabaASRStopMessage,
  AlibabaASRStopResponse,
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
  ParaphraseMessage,
  ParaphraseResponse,
  Response,
  SaveConfigMessage,
  SaveConfigResponse,
  SegmentCorpusMessage,
  SegmentCorpusResponse,
  ShadowAssessMessage,
  ShadowAssessResponse,
  SplitSentencesMessage,
  SplitSentencesResponse,
  SynthesizeSpeechMessage,
  SynthesizeSpeechResponse,
  TencentASRSignMessage,
  TencentASRSignResponse,
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
