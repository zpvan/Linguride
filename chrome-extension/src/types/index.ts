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
  calculateTargetLevel,
  CEFR_LEVELS,
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  STORAGE_KEY,
  toProviderConfig,
} from "./config";
export type {
  CEFRLevel,
  LingridConfig,
  ParaphrasePromptConfig,
  PromptConfig,
  ProviderConfig,
} from "./config";

// 消息类型
export { MessageType } from "./messages";
export type {
  AnalyzeDifficultyMessage,
  AnalyzeDifficultyResponse,
  BaseResponse,
  ExtractPageTextMessage,
  ExtractPageTextResponse,
  GetConfigMessage,
  GetConfigResponse,
  GetParaphraseStateMessage,
  GetParaphraseStateResponse,
  GetTranslationStateMessage,
  GetTranslationStateResponse,
  Message,
  ParaphraseMessage,
  ParaphraseResponse,
  Response,
  SaveConfigMessage,
  SaveConfigResponse,
  TestConnectionMessage,
  TestConnectionResponse,
  ToggleParaphraseMessage,
  ToggleTranslationMessage,
  TranslateMessage,
  TranslateResponse,
} from "./messages";

// 翻译类型
export {
  DEFAULT_BATCH_CONFIG,
  estimateTokens,
  simpleHash,
  TranslationStatus,
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
