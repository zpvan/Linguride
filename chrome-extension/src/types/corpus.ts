/**
 * @file corpus.ts
 * @description 语料库听力训练功能类型定义
 *
 * 定义语料库功能所需的所有类型，包括：
 * - 语料句子结构
 * - 断句结果
 * - 听力错误类型
 * - 听力分析结果
 * - Prompt 配置
 *
 * @author Lingride Team
 * @since 2.1.0
 */

/** 语料句子 */
export interface CorpusSentence {
  /** 句子原文 */
  text: string;
  /** i+1 难度说明 */
  difficulty: string;
  /** 需要注意的词汇 */
  keyWords: string[];
  /** 听写提示（如：注意连读、弱读等） */
  listeningTips: string;
}

/** 断句结果 */
export interface SegmentCorpusResult {
  /** 分割后的句子列表 */
  sentences: CorpusSentence[];
  /** 文本整体难度评估 */
  overallLevel: string;
}

/**
 * 听力错误类型
 *
 * 常见听力问题分类：
 * - liaison: 连读识别（如 "want to" → "wanna"）
 * - weakForm: 弱读理解（如 "a/an/the" 等虚词）
 * - similarSound: 相似音混淆（如 "think/sink"、"light/right"）
 * - stress: 重音位置错误
 * - intonation: 语调理解问题
 * - vocabulary: 词汇盲区（从未听过的词汇）
 * - speed: 语速适应问题
 */
export type ListeningErrorType =
  | "liaison" // 连读识别
  | "weakForm" // 弱读理解
  | "similarSound" // 相似音混淆
  | "stress" // 重音位置
  | "intonation" // 语调理解
  | "vocabulary" // 词汇盲区
  | "speed"; // 语速适应

/** 听力错误 */
export interface ListeningError {
  /** 原词 */
  expected: string;
  /** 用户写的 */
  actual: string;
  /** 错误类型 */
  type: ListeningErrorType;
  /** 为什么会听错 */
  explanation: string;
  /** 改进建议 */
  tip: string;
}

/** 听力分析结果 */
export interface ListeningAnalysisResult {
  /** 准确率（0-100） */
  accuracy: number;
  /** 错误列表 */
  errors: ListeningError[];
  /** 听力盲区总结 */
  blindSpots: string[];
  /** 针对性练习建议 */
  suggestions: string[];
  /** 鼓励语 */
  encouragement: string;
}

/** 语料库 Prompt 配置 */
export interface CorpusPromptConfig {
  /** System Prompt */
  system_prompt: string;
  /** User Prompt 模板 */
  user_prompt_template: string;
}
