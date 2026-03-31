/**
 * @file difficulty.ts
 * @description 难度分析相关类型定义
 *
 * 定义难度分析功能所需的类型，包括：
 * - DifficultyResult: AI 返回的难度分析结果
 * - DifficultyPromptConfig: 用户可自定义的 Prompt 配置
 *
 * @author Lingride Team
 * @since 1.1.0
 */

/**
 * 难度等级
 */
export type DifficultyLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

/**
 * CEFR 等级
 * 欧洲共同语言参考标准 (Common European Framework of Reference for Languages)
 */
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/**
 * 词汇复杂度分析
 */
export interface VocabularyComplexity {
  /** 罕见词数量 */
  rareWordCount: number;
  /** 学术词汇数量 */
  academicWordCount: number;
  /** 平均词长 */
  avgWordLength: number;
}

/**
 * 句子复杂度分析
 */
export interface SentenceComplexity {
  /** 平均句长（词数） */
  avgSentenceLength: number;
  /** 复杂句式比例（0-1） */
  complexSentenceRatio: number;
}

/**
 * 难度分析结果
 *
 * AI 返回的结构化分析结果，包含难度等级、CEFR 等级、
 * 词汇/句子复杂度等详细指标。
 */
export interface DifficultyResult {
  /** 难度等级 */
  difficultyLevel: DifficultyLevel;
  /** CEFR 等级 */
  cefrLevel: CEFRLevel;
  /** 综合分数（0-100） */
  score: number;
  /** 词汇复杂度分析 */
  vocabularyComplexity: VocabularyComplexity;
  /** 句子复杂度分析 */
  sentenceComplexity: SentenceComplexity;
  /** 预计阅读时间（分钟） */
  estimatedReadingTime: number;
  /** 采样的单词数量 */
  sampleWordCount: number;
  /** 改进建议 */
  suggestions: string[];
  /** 是否为选中文本分析 */
  isSelection?: boolean;
}

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
