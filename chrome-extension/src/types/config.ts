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

import { DifficultyPromptConfig } from "./difficulty";

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
