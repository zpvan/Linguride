export type {
  CEFRLevel,
  DifficultyLevel,
  DifficultyResult,
  SentenceComplexity,
  VocabularyComplexity,
} from "@linguride/contracts-ts";

/**
 * 难度分析 Prompt 配置
 *
 * 用户可自定义的 Prompt 设置，存储在 LingridConfig 中。
 */
export interface DifficultyPromptConfig {
  /** System Prompt，定义 AI 的角色和分析方式 */
  system_prompt: string;
  /** User Prompt 模板，使用 {text} 作为待分析文本的占位符 */
  user_prompt_template: string;
}
