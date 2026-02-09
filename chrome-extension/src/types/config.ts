/**
 * @file config.ts
 * @description 配置类型定义
 *
 * 定义 Lingride 扩展的所有配置类型，包括：
 * - LingridConfig: 完整的扩展配置（存储在 Chrome Storage）
 * - ProviderConfig: 翻译服务提供者配置（传递给 Provider）
 * - PromptConfig: 自定义 Prompt 配置
 *
 * 命名约定：
 * - LingridConfig 使用 snake_case（与存储格式一致）
 * - ProviderConfig 使用 camelCase（与代码风格一致）
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { CEFRLevel, DifficultyPromptConfig } from "./difficulty";
import { SentenceAnalysisPromptConfig } from "./sentenceAnalysis";

// 重新导出 CEFRLevel 供其他模块使用
export type { CEFRLevel } from "./difficulty";

/**
 * 翻译服务提供者配置
 *
 * 传递给 ITranslateProvider 实现类的配置对象，
 * 使用 camelCase 命名风格以符合 TypeScript 代码规范。
 */
export interface ProviderConfig {
  /** API 端点基础 URL，例如 "https://api.deepseek.com" */
  apiBaseUrl: string;

  /** API 密钥，用于身份验证 */
  apiKey: string;

  /** 模型名称，例如 "deepseek-chat" */
  model: string;

  /** System Prompt，定义翻译助手的角色和行为 */
  systemPrompt: string;

  /** User Prompt 模板，包含 {{texts}} 占位符 */
  userPromptTemplate: string;
}

/**
 * 自定义 Prompt 配置
 *
 * 存储用户自定义的翻译 Prompt 设置。
 */
export interface PromptConfig {
  /** 系统提示词，定义 AI 的角色和翻译风格 */
  system_prompt: string;

  /** 用户提示词模板，{{texts}} 将被替换为待翻译文本 */
  user_prompt_template: string;
}

/**
 * 释义 Prompt 配置
 *
 * 存储用户自定义的英文释义 Prompt 设置。
 * 用于将高难度英文改写为适合用户水平的版本。
 */
export interface ParaphrasePromptConfig {
  /** 系统提示词，定义 AI 的角色和释义规则 */
  system_prompt: string;

  /**
   * 用户提示词模板
   * 可用占位符：
   * - {{texts}}: 待释义的文本（编号格式）
   * - {{user_level}}: 用户当前 CEFR 等级
   * - {{target_level}}: 目标 CEFR 等级（用户等级 + 1）
   */
  user_prompt_template: string;
}

/**
 * 混杂中英翻译 Prompt 配置
 *
 * 存储用户自定义的混杂中英翻译 Prompt 设置。
 * 用于将英文内容转换为中英混杂文本，遵循 i+1 原理。
 */
export interface MixedTranslatePromptConfig {
  /** 系统提示词，定义 AI 的角色和混杂翻译规则 */
  system_prompt: string;

  /**
   * 用户提示词模板
   * 可用占位符：
   * - {{texts}}: 待处理的文本（编号格式）
   * - {{user_level}}: 用户当前 CEFR 等级
   * - {{retention_percent}}: 英文保留百分比
   */
  user_prompt_template: string;
}

/**
 * 腾讯云 ASR 配置
 *
 * 用于腾讯云实时语音识别服务的鉴权配置。
 * 配置后可使用腾讯云 ASR 替代 Web Speech API，提高识别准确率。
 */
export interface TencentASRConfig {
  /** 腾讯云 AppID */
  app_id: string;

  /** 腾讯云 SecretID */
  secret_id: string;

  /** 腾讯云 SecretKey */
  secret_key: string;
}

/**
 * 阿里云 ASR 配置
 *
 * 用于阿里云百炼 Paraformer 实时语音识别服务的鉴权配置。
 * 配置后可使用阿里云 ASR 替代 Web Speech API，提高识别准确率。
 *
 * 优先级：腾讯云 ASR > 阿里云 ASR > Web Speech API
 */
export interface AlibabaASRConfig {
  /** 阿里云百炼 API Key */
  api_key: string;
}

/**
 * Lingride 扩展完整配置
 *
 * 存储在 chrome.storage.local 中的配置对象，
 * 使用 snake_case 命名风格以便于 JSON 序列化和存储。
 */
export interface LingridConfig {
  /** API 端点基础 URL */
  api_base_url: string;

  /** API 密钥 */
  api_key: string;

  /** 模型名称 */
  model: string;

  /** 翻译 Prompt 配置 */
  prompts: PromptConfig;

  /** 难度分析 Prompt 配置（可选，使用默认值） */
  difficulty_prompts?: DifficultyPromptConfig;

  /** 用户当前英文水平（CEFR 等级） */
  user_english_level?: CEFRLevel;

  /** 释义 Prompt 配置（可选，使用默认值） */
  paraphrase_prompts?: ParaphrasePromptConfig;

  /** 混杂中英翻译 Prompt 配置（可选，使用默认值） */
  mixed_translate_prompts?: MixedTranslatePromptConfig;

  /** 长难句分析 Prompt 配置（可选，使用默认值） */
  sentence_analysis_prompts?: SentenceAnalysisPromptConfig;

  /** 腾讯云 ASR 配置（可选，不配置则使用 Web Speech API） */
  tencent_asr?: TencentASRConfig;

  /** 阿里云 ASR 配置（可选，优先级低于腾讯云 ASR） */
  alibaba_asr?: AlibabaASRConfig;
}

/**
 * 默认 System Prompt
 *
 * 定义翻译助手的角色和翻译质量要求。
 */
export const DEFAULT_SYSTEM_PROMPT = `你是一个专业的英中翻译助手。请将用户提供的英文文本翻译成自然流畅的简体中文。

翻译要求：
1. 保持原文的语气和风格
2. 专业术语使用公认的中文译法
3. 不要添加任何解释或注释
4. 直接输出翻译结果，不要添加任何前缀或后缀`;

/**
 * 默认 User Prompt 模板
 *
 * {{texts}} 占位符将被替换为实际的待翻译文本。
 * 使用编号和分隔符格式便于批量翻译和结果解析。
 */
export const DEFAULT_USER_PROMPT_TEMPLATE = `请翻译以下英文段落，每个段落用序号标记。请按相同格式输出翻译结果，保持序号和分隔符：

{{texts}}

请按照上述格式（序号---翻译内容）输出每段的翻译。`;

/**
 * 默认用户英文水平
 *
 * A2 是一个较为保守的起点，适合大多数初中级学习者。
 */
export const DEFAULT_USER_ENGLISH_LEVEL: CEFRLevel = "A2";

/**
 * 默认配置
 *
 * 用于初始化扩展或重置配置时使用。
 */
export const DEFAULT_CONFIG: LingridConfig = {
  api_base_url: "https://api.deepseek.com",
  api_key: "",
  model: "deepseek-chat",
  prompts: {
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    user_prompt_template: DEFAULT_USER_PROMPT_TEMPLATE,
  },
  user_english_level: DEFAULT_USER_ENGLISH_LEVEL,
};

/**
 * Chrome Storage 键名
 *
 * 用于存取 LingridConfig 的键名常量。
 */
export const STORAGE_KEY = "lingrid_config";

/**
 * 将 LingridConfig 转换为 ProviderConfig
 *
 * 用于从存储格式转换为 Provider 调用格式。
 *
 * @param config - 存储格式的配置对象
 * @returns Provider 调用格式的配置对象
 */
export function toProviderConfig(config: LingridConfig): ProviderConfig {
  return {
    apiBaseUrl: config.api_base_url,
    apiKey: config.api_key,
    model: config.model,
    systemPrompt: config.prompts.system_prompt,
    userPromptTemplate: config.prompts.user_prompt_template,
  };
}

/**
 * CEFR 等级数组，按难度递增排序
 */
export const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * 计算目标等级（i+1 原则）
 *
 * 根据用户当前水平计算释义的目标等级。
 * 目标等级比用户水平高一级，最高为 C2。
 *
 * @param userLevel - 用户当前 CEFR 等级
 * @returns 目标 CEFR 等级
 */
export function calculateTargetLevel(userLevel: CEFRLevel): CEFRLevel {
  const currentIndex = CEFR_LEVELS.indexOf(userLevel);
  // i+1: 目标等级比用户水平高一级，最高 C2
  const targetIndex = Math.min(currentIndex + 1, CEFR_LEVELS.length - 1);
  return CEFR_LEVELS[targetIndex];
}

/**
 * 英文保留比例映射
 *
 * 根据用户 CEFR 等级确定混杂中英翻译中应保留的英文比例。
 * 等级越高，保留的英文越多。
 */
const RETENTION_MAP: Record<CEFRLevel, number> = {
  A1: 20,
  A2: 35,
  B1: 50,
  B2: 65,
  C1: 80,
  C2: 95,
};

/**
 * 获取英文保留百分比
 *
 * 根据用户 CEFR 等级返回混杂中英翻译中应保留的英文比例。
 * 用于混杂中英翻译功能的 Prompt 构建。
 *
 * @param level - 用户当前 CEFR 等级
 * @returns 英文保留百分比（0-100）
 */
export function getRetentionPercent(level: CEFRLevel): number {
  return RETENTION_MAP[level];
}
