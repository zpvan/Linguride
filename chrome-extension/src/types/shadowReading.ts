/**
 * @file shadowReading.ts
 * @description 影子跟读功能相关类型定义
 *
 * 定义影子跟读练习的模式、配置、句子状态和评估结果等类型。
 * 扩展现有发音评估类型，增加语调和节奏评估维度。
 *
 * @author Lingride Team
 * @since 2.3.0
 */

import { PronunciationAssessmentResult } from "./pronunciationAssessment";

// ====== 影子跟读模式 ======

/**
 * 影子跟读练习模式
 *
 * - sentence: 逐句模式，先听完范读再跟读
 * - shadow: 影子模式，范读开始后延迟 0.5-1 秒跟读
 * - sync: 同步模式，与范读同时开始
 */
export type ShadowMode = "sentence" | "shadow" | "sync";

/**
 * 语速选项
 *
 * 支持 0.5x 到 1.5x 五档语速调节
 */
export type ShadowSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;

// ====== 练习句子 ======

/**
 * 练习句子状态
 */
export type ShadowSentenceStatus = "pending" | "practicing" | "completed";

/**
 * 练习句子
 *
 * 表示分句后的单个练习单元
 */
export interface ShadowSentence {
  /** 句子序号（从 0 开始） */
  id: number;

  /** 句子文本内容 */
  text: string;

  /** 当前状态 */
  status: ShadowSentenceStatus;

  /** 练习次数 */
  attempts: number;

  /** 历史最佳得分 */
  bestScore?: number;
}

// ====== 影子跟读配置 ======

/**
 * 影子跟读配置
 *
 * 用户可调节的练习参数
 */
export interface ShadowConfig {
  /** 跟读模式 */
  mode: ShadowMode;

  /** 语速 */
  speed: ShadowSpeed;

  /** 达标分数，默认 70 */
  passingScore: number;
}

/**
 * 默认影子跟读配置
 */
export const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  mode: "sentence",
  speed: 1.0,
  passingScore: 70,
};

// ====== 分句相关 ======

/**
 * 分句请求参数
 */
export interface SplitSentencesRequest {
  /** 待分句的英文文本 */
  text: string;

  /** 每句最大单词数，默认 15 */
  maxWordsPerSentence?: number;
}

/**
 * 分句结果
 */
export interface SplitSentencesResult {
  /** 分句后的句子数组 */
  sentences: string[];

  /** 总句数 */
  totalCount: number;
}

// ====== 影子跟读评估结果 ======

/**
 * 影子跟读评估结果
 *
 * 扩展现有发音评估结果，新增语调和节奏评估维度。
 */
export interface ShadowAssessmentResult extends PronunciationAssessmentResult {
  /** 语调评分 0-100（升降调是否自然） */
  intonation: number;

  /** 节奏评分 0-100（停顿、重音、语速是否得当） */
  rhythm: number;
}

// ====== 练习进度 ======

/**
 * 练习进度
 */
export interface ShadowProgress {
  /** 当前句子索引（从 0 开始） */
  current: number;

  /** 总句数 */
  total: number;

  /** 已完成句数 */
  completedCount: number;
}

// ====== Prompt 配置 ======

/**
 * 分句 Prompt 配置
 */
export interface SplitSentencesPromptConfig {
  /** System Prompt */
  system_prompt: string;

  /** User Prompt 模板，使用 {{text}} 占位符 */
  user_prompt_template: string;
}

/**
 * 影子跟读评估 Prompt 配置
 */
export interface ShadowAssessPromptConfig {
  /** System Prompt */
  system_prompt: string;

  /** User Prompt 模板，使用 {{original}} 和 {{recognized}} 占位符 */
  user_prompt_template: string;
}
