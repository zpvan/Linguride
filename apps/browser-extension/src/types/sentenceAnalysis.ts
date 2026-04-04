/**
 * @file sentenceAnalysis.ts
 * @description 长难句分析相关类型定义
 *
 * 定义长难句分析功能所需的类型，包括：
 * - SentenceAnalysisResult: AI 返回的结构化分析结果
 * - SentenceAnalysisPromptConfig: 用户可自定义的 Prompt 配置
 * - SentenceStructure: 句子主干结构
 * - SentenceClause: 从句拆解条目
 * - KeyPhrase: 重点短语条目
 *
 * @author Lingride Team
 * @since 1.2.0
 */

/**
 * 句子主干结构
 *
 * 拆解句子的核心成分：主语、谓语、宾语、补语。
 * 不及物动词句可能没有宾语，部分句子可能没有补语。
 */
export interface SentenceStructure {
  /** 主语 */
  subject: string;

  /** 谓语 */
  predicate: string;

  /** 宾语（可选，不及物动词句无此项） */
  object?: string;

  /** 补语（可选） */
  complement?: string;
}

/**
 * 从句拆解条目
 *
 * 描述句子中的从句，包括从句类型、内容和在句中的功能。
 */
export interface SentenceClause {
  /** 从句类型（如：定语从句、状语从句、宾语从句、主语从句等） */
  type: string;

  /** 从句内容 */
  content: string;

  /** 从句在句中的功能说明 */
  function: string;
}

/**
 * 重点短语条目
 *
 * 描述句子中的重点短语或词汇，附带中文释义。
 */
export interface KeyPhrase {
  /** 短语或词汇 */
  phrase: string;

  /** 中文释义 */
  meaning: string;
}

/**
 * 长难句分析结果
 *
 * AI 返回的结构化分析结果，包含翻译、句子主干、从句拆解、
 * 重点短语、语法要点和简化改写。
 */
export interface SentenceAnalysisResult {
  /** 中文翻译 */
  translation: string;

  /** 句子主干结构 */
  structure: SentenceStructure;

  /** 从句拆解列表（简单句时为空数组） */
  clauses: SentenceClause[];

  /** 重点短语/词汇列表 */
  keyPhrases: KeyPhrase[];

  /** 语法要点列表 */
  grammarPoints: string[];

  /** 简化改写（用简单英语重新表达） */
  simplifiedVersion: string;
}

/**
 * 长难句分析 Prompt 配置
 *
 * 用户可自定义的 Prompt 设置，存储在 LingridConfig 中。
 */
export interface SentenceAnalysisPromptConfig {
  /** System Prompt，定义 AI 的角色和分析方式 */
  system_prompt: string;

  /** User Prompt 模板，使用 {{sentence}} 作为待分析句子的占位符 */
  user_prompt_template: string;
}
