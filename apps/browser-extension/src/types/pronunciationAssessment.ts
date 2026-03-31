/**
 * @file pronunciationAssessment.ts
 * @description 发音评估相关类型定义
 *
 * 定义语音识别器接口、发音评估结果结构等类型，
 * 支持多种 ASR 后端（Web Speech API / Whisper）切换。
 *
 * @author Lingride Team
 * @since 1.0.0
 */

// ====== 语音识别器接口 ======

/**
 * 语音识别器接口
 *
 * 抽象层设计，支持多种 ASR 后端切换：
 * - WebSpeechRecognizer: 使用浏览器原生 Web Speech API（MVP）
 * - WhisperRecognizer: 使用 OpenAI Whisper API（预留）
 */
export interface ISpeechRecognizer {
  /** 开始识别 */
  start(): Promise<void>;

  /** 停止识别并返回最终结果 */
  stop(): Promise<string>;

  /** 当前是否正在识别 */
  isRecognizing(): boolean;

  /** 实时识别结果回调（中间结果） */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;
}

// ====== 发音评估结果 ======

/**
 * 发音评估结果
 *
 * AI 返回的完整评估结构，包含评分、问题列表、建议等。
 */
export interface PronunciationAssessmentResult {
  /** 总分 0-100 */
  score: number;

  /** 准确度 0-100 */
  accuracy: number;

  /** 流利度 0-100 */
  fluency: number;

  /** 发音问题列表 */
  issues: PronunciationIssue[];

  /** 改进建议 */
  suggestions: string[];

  /** 鼓励语 */
  encouragement: string;

  /** 原文与识别文本对比（AI 生成） */
  comparison: TextComparison;
}

/**
 * 发音问题详情
 */
export interface PronunciationIssue {
  /** 问题单词 */
  word: string;

  /** 问题描述 */
  issue: string;

  /** 正确发音提示 */
  correction: string;

  /** 严重程度 */
  severity: "minor" | "moderate" | "major";
}

/**
 * 文本对比结果
 *
 * 由 AI 生成，对比原文与识别文本的差异。
 */
export interface TextComparison {
  /** 原文 */
  original: string;

  /** 识别文本 */
  recognized: string;

  /** 匹配率 0-1 */
  matchRate: number;

  /** 不匹配详情 */
  mismatches: MismatchDetail[];
}

/**
 * 不匹配详情
 */
export interface MismatchDetail {
  /** 期望的单词 */
  expected: string;

  /** 实际识别的单词 */
  actual: string;

  /** 在原文中的位置（第几个词，从 1 开始） */
  position: number;
}

// ====== Prompt 配置 ======

/**
 * 发音评估 Prompt 配置
 */
export interface PronunciationPromptConfig {
  /** System Prompt */
  system_prompt: string;

  /** User Prompt 模板，使用 {{original}} 和 {{recognized}} 占位符 */
  user_prompt_template: string;
}
