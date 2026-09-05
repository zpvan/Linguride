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
import { DEFAULT_TTS_SPEED, TTSSpeed } from "./tts";

// 重新导出 CEFRLevel 供其他模块使用
export type { CEFRLevel } from "./difficulty";

/**
 * AI 服务提供者标识
 */
export type AIProviderId = "deepseek" | "openai" | "custom" | "glm" | "minimax";

/**
 * 模型选项（用于下拉列表）
 */
export interface ModelOption {
  value: string;
  label: string;
}

/**
 * OpenAI 认证模式
 */
export type OpenAIAuthMode = "api_key" | "oauth";

/**
 * 翻译服务提供者配置
 *
 * 传递给 ITranslateProvider 实现类的配置对象，
 * 使用 camelCase 命名风格以符合 TypeScript 代码规范。
 */
export interface ProviderConfig {
  /** 当前激活的 AI 服务提供者 */
  providerId: AIProviderId;

  /** OpenAI 当前认证模式（仅 providerId=openai 时生效） */
  authMode: OpenAIAuthMode;

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
 * 英英释义 Prompt 配置
 *
 * 存储用户自定义的英英释义 Prompt 设置。
 * 用于对单词、短语或句子进行英文解释。
 */
export interface EnglishDefinitionPromptConfig {
  /** 系统提示词，定义 AI 的角色和英英释义规则 */
  system_prompt: string;

  /**
   * 用户提示词模板
   * 可用占位符：
   * - {{text}}: 待释义的英文文本
   * - {{user_level}}: 用户当前 CEFR 等级
   */
  user_prompt_template: string;
}

/**
 * 释义预设 ID
 *
 * 用于标识当前共享释义 Prompt 的基准预设。
 */
export type ExplanationPromptPresetId = "prompt1" | "prompt2" | "prompt3";

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
 * 豆包（火山方舟）ASR 配置
 *
 * 用于豆包流式语音识别模型 2.0（doubao-seed-asr-2.0）。
 * 配置后优先级最高：豆包 > 腾讯云 > 阿里云 > Web Speech API。
 */
export interface DoubaoASRConfig {
  /** 火山方舟 API Key */
  api_key: string;
}

/** 豆包 ASR WebSocket 地址（SAUC 单向流式） */
export const DOUBAO_ASR_WS_URL =
  "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";

/** 豆包 ASR 资源 ID（volc.seedasr.sauc.duration = 豆包流式语音识别模型 2.0 小时版） */
export const DOUBAO_ASR_RESOURCE_ID = "volc.seedasr.sauc.duration";

/**
 * 语音合成服务选择模式
 *
 * 用户手动选择的语音合成服务：
 * - minimax: MiniMax AI 语音合成
 * - xiaomi: 小米 AI 语音合成
 * - doubao: 豆包（火山方舟）语音合成
 * - browser: 浏览器内置语音合成
 */
export type TTSSelectionMode = "minimax" | "xiaomi" | "doubao" | "browser";

/**
 * 语音合成服务标识
 */
export type TTSProviderId = "minimax" | "xiaomi" | "doubao";

/**
 * 小米语音合成配置
 *
 * 用于 OpenAI 兼容 Chat Completions 音频输出接口。
 * API Key 为空表示不启用 AI TTS，直接回落到浏览器 TTS，
 * 但仍可保留音色和风格偏好以供后续恢复。
 */
export type XiaomiTTSVoice = "mimo_default" | "Mia" | "Chloe" | "Milo" | "Dean";

/** 小米 TTS 可选音色（v2.5，仅开放英文场景音色） */
export const XIAOMI_TTS_VOICE_OPTIONS: XiaomiTTSVoice[] = [
  "mimo_default",
  "Mia",
  "Chloe",
  "Milo",
  "Dean",
];

/** 小米 TTS 默认音色 */
export const XIAOMI_TTS_DEFAULT_VOICE: XiaomiTTSVoice = "mimo_default";

/**
 * 规范化小米 TTS 音色；旧 v2 音色（default_zh/default_en）迁移为 mimo_default
 */
export function normalizeXiaomiTTSVoice(value?: string | null): XiaomiTTSVoice {
  if (value && XIAOMI_TTS_VOICE_OPTIONS.includes(value as XiaomiTTSVoice)) {
    return value as XiaomiTTSVoice;
  }

  return XIAOMI_TTS_DEFAULT_VOICE;
}

export interface XiaomiTTSConfig {
  /** 小米 API Key */
  api_key: string;

  /** 可选音色，留空时使用 mimo_default */
  voice?: XiaomiTTSVoice;
}

/**
 * 豆包（火山方舟）语音合成音色（seed-tts-2.0，美式英语）
 */
export type DoubaoTTSVoice =
  | "en_female_allison_uranus_bigtts"
  | "en_female_brittney_pimintel_uranus_bigtts"
  | "en_male_alex_uranus_bigtts"
  | "en_male_alberto_uranus_bigtts";

/** 豆包 TTS 可选音色 */
export const DOUBAO_TTS_VOICE_OPTIONS: DoubaoTTSVoice[] = [
  "en_female_allison_uranus_bigtts",
  "en_female_brittney_pimintel_uranus_bigtts",
  "en_male_alex_uranus_bigtts",
  "en_male_alberto_uranus_bigtts",
];

/** 豆包 TTS 默认音色（Allison，美式女声） */
export const DOUBAO_TTS_DEFAULT_VOICE: DoubaoTTSVoice =
  "en_female_allison_uranus_bigtts";

/** 规范化豆包 TTS 音色；未知值回退默认音色 */
export function normalizeDoubaoTTSVoice(value?: string | null): DoubaoTTSVoice {
  if (value && DOUBAO_TTS_VOICE_OPTIONS.includes(value as DoubaoTTSVoice)) {
    return value as DoubaoTTSVoice;
  }

  return DOUBAO_TTS_DEFAULT_VOICE;
}

/**
 * 豆包（火山方舟）语音合成配置
 */
export interface DoubaoTTSConfig {
  /** 火山方舟 API Key */
  api_key: string;

  /** 可选音色，留空时使用默认音色 */
  voice?: DoubaoTTSVoice;
}

/**
 * MiniMax TTS 可选模型
 */
export type MiniMaxTTSModel =
  | "speech-2.8-hd"
  | "speech-2.8-turbo";

/**
 * 已被收窄的 TTS 模型 ID。仅供 configManager 在内存迁移中以
 * string[] 形式比对,运行时 stored 中可能仍含这些历史值。
 */
export const MINIMAX_TTS_REMOVED_MODELS: readonly string[] = [
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
] as const;

/**
 * MiniMax TTS 情绪风格
 *
 * 仅对 speech-2.8-hd、speech-2.8-turbo 模型生效
 */
export type MiniMaxEmotion =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "calm"
  | "fluent"
  | "whisper";

/**
 * MiniMax TTS 音色选项（精选女声）
 */
export type MiniMaxVoice =
  // 英文女声
  | "English_Graceful_Lady"
  | "English_Whispering_girl"
  | "Sweet_Girl"
  | "Attractive_Girl"
  | "Serene_Woman"
  | "English_Gentle-voiced_man"
  // 中文女声
  | "female-shaonv"
  | "female-yujie"
  | "female-tianmei"
  | "female-chengshu"
  | "lovely_girl"
  | "Chinese (Mandarin)_Sweet_Lady"
  | "Chinese (Mandarin)_Warm_Girl"
  | "Chinese (Mandarin)_Lyrical_Voice"
  | "Chinese (Mandarin)_Crisp_Girl"
  | "Chinese (Mandarin)_Soft_Girl"
  // 粤语女声
  | "Cantonese_GentleLady"
  | "Cantonese_CuteGirl"
  // 日文女声
  | "Japanese_KindLady"
  | "Japanese_CalmLady"
  // 韩文女声
  | "Korean_SweetGirl"
  | "Korean_CalmLady";

/**
 * MiniMax 语音合成配置
 */
export interface MiniMaxTTSConfig {
  /** MiniMax API Key */
  api_key: string;

  /** 可选模型，留空时使用默认模型 */
  model?: MiniMaxTTSModel;

  /** 可选音色 ID，留空时使用默认音色 */
  voice_id?: string;

  /** 可选情绪风格，留空时不添加情绪 */
  emotion?: MiniMaxEmotion;

  /** 可选基础端点（国际/国内直连），留空时使用默认国际线路 */
  api_base_url?: string;
}

/**
 * Lingride 扩展完整配置
 *
 * 存储在 chrome.storage.local 中的配置对象，
 * 使用 snake_case 命名风格以便于 JSON 序列化和存储。
 */
export interface LingridConfig {
  /** AI 服务提供者 */
  api_provider?: AIProviderId;

  /** OpenAI 认证模式（仅 api_provider=openai 时生效） */
  openai_auth_mode?: OpenAIAuthMode;

  /** OpenAI OAuth 专用模型 */
  openai_oauth_model?: string;

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

  /** 全局 TTS 语速 */
  tts_speed?: TTSSpeed;

  /** 语音合成服务选择（用户手动选择，失败后回退到浏览器） */
  tts_selection?: TTSSelectionMode;

  /** 豆包（火山方舟）TTS 配置（可选，不配置则回退浏览器 TTS） */
  doubao_tts?: DoubaoTTSConfig;

  /** 释义 Prompt 配置（可选，使用默认值） */
  paraphrase_prompts?: ParaphrasePromptConfig;

  /** 英英释义 Prompt 配置（可选，使用默认值） */
  english_definition_prompts?: EnglishDefinitionPromptConfig;

  /** 当前释义共享 Prompt 的基准预设 */
  explanation_prompt_preset_id?: ExplanationPromptPresetId;

  /** 混杂中英翻译 Prompt 配置（可选，使用默认值） */
  mixed_translate_prompts?: MixedTranslatePromptConfig;

  /** 长难句分析 Prompt 配置（可选，使用默认值） */
  sentence_analysis_prompts?: SentenceAnalysisPromptConfig;

  /** 腾讯云 ASR 配置（可选，不配置则使用 Web Speech API） */
  tencent_asr?: TencentASRConfig;

  /** 阿里云 ASR 配置（可选，优先级低于腾讯云 ASR） */
  alibaba_asr?: AlibabaASRConfig;

  /** 豆包（火山方舟）ASR 配置（可选，配置后优先级最高） */
  doubao_asr?: DoubaoASRConfig;

  /** 小米 AI 语音合成配置（可选，不配置则使用浏览器 TTS） */
  xiaomi_tts?: XiaomiTTSConfig;

  /** MiniMax AI 语音合成配置（可选，不配置则不参与优先级调度） */
  minimax_tts?: MiniMaxTTSConfig;
}

/**
 * MiniMax TTS 基础端点（国际线路，走系统代理时可用）
 */
export const MINIMAX_TTS_API_BASE_URL = "https://api.minimaxi.com/v1";

/**
 * MiniMax TTS 基础端点（国内直连，不走代理时可用）
 */
export const MINIMAX_TTS_API_BASE_URL_CN = "https://api.minimax.cn/v1";

/**
 * MiniMax AI 基础端点（国际线路，走系统代理时可用）
 */
export const MINIMAX_AI_API_BASE_URL = "https://api.minimaxi.com/anthropic";

/**
 * MiniMax AI 基础端点（国内直连，不走代理时可用）
 */
export const MINIMAX_AI_API_BASE_URL_CN = "https://api.minimax.cn/anthropic";

/**
 * 归一化 MiniMax TTS 基础端点，仅接受国际/国内两条固定线路，
 * 其他值一律回退到国际线路。
 */
export function normalizeMiniMaxTTSBaseUrl(value?: string | null): string {
  const normalized = value?.trim().replace(/\/+$/, "").toLowerCase();
  if (normalized === MINIMAX_TTS_API_BASE_URL_CN) {
    return MINIMAX_TTS_API_BASE_URL_CN;
  }
  return MINIMAX_TTS_API_BASE_URL;
}

/**
 * MiniMax TTS 默认模型
 */
export const MINIMAX_TTS_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-turbo";

/**
 * 旧 TTS 默认模型,仅用于 configManager 中的一次性迁移识别。
 */
export const MINIMAX_TTS_LEGACY_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-hd";

/**
 * 旧默认 AI 模型,仅用于 configManager 中的一次性迁移识别。
 * 新用户不会看到此值。
 */
export const MINIMAX_LEGACY_DEFAULT_MODEL = "MiniMax-M2.7";

/**
 * MiniMax TTS 默认音色
 */
export const MINIMAX_TTS_DEFAULT_VOICE_ID = "English_expressive_narrator";

/**
 * 小米 TTS 固定基础端点
 */
export const XIAOMI_TTS_API_BASE_URL = "https://api.xiaomimimo.com/v1";

/**
 * 小米 TTS 固定模型名
 */
export const XIAOMI_TTS_MODEL = "mimo-v2.5-tts";

/**
 * 豆包（火山方舟）TTS 接口地址（HTTP 单向流式，一次性返回完整音频）
 */
export const DOUBAO_TTS_API_URL =
  "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional";

/** 豆包 TTS 资源 ID（seed-tts-2.0 = 豆包语音合成模型 2.0） */
export const DOUBAO_TTS_RESOURCE_ID = "seed-tts-2.0";

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
  api_provider: "deepseek",
  openai_auth_mode: "api_key",
  api_base_url: "https://api.deepseek.com",
  api_key: "",
  model: "deepseek-chat",
  openai_oauth_model: "gpt-5.3-codex",
  prompts: {
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    user_prompt_template: DEFAULT_USER_PROMPT_TEMPLATE,
  },
  explanation_prompt_preset_id: "prompt1",
  user_english_level: DEFAULT_USER_ENGLISH_LEVEL,
  tts_speed: DEFAULT_TTS_SPEED,
  tts_selection: "browser",
};

/**
 * Chrome Storage 键名
 *
 * 用于存取 LingridConfig 的键名常量。
 */
export const STORAGE_KEY = "lingrid_config";

/**
 * 从配置推断当前 AI 服务提供者
 */
export function resolveConfigApiProvider(config: Pick<LingridConfig, "api_provider" | "api_base_url">): AIProviderId {
  if (
    config.api_provider === "deepseek" ||
    config.api_provider === "openai" ||
    config.api_provider === "custom" ||
    config.api_provider === "glm" ||
    config.api_provider === "minimax"
  ) {
    return config.api_provider;
  }

  const normalized = (config.api_base_url || "").trim().replace(/\/+$/, "").toLowerCase();
  if (normalized === "https://api.deepseek.com") {
    return "deepseek";
  }
  if (normalized === "https://api.openai.com") {
    return "openai";
  }
  if (normalized === "https://open.bigmodel.cn/api/paas/v4") {
    return "glm";
  }
  if (
    normalized === MINIMAX_AI_API_BASE_URL ||
    normalized === MINIMAX_AI_API_BASE_URL_CN
  ) {
    return "minimax";
  }
  return "custom";
}

/**
 * 获取当前 OpenAI 认证模式
 */
export function resolveConfigOpenAIAuthMode(
  config: Pick<LingridConfig, "openai_auth_mode">
): OpenAIAuthMode {
  return config.openai_auth_mode === "oauth" ? "oauth" : "api_key";
}

/**
 * 获取当前激活模型
 */
export function resolveConfigModel(
  config: Pick<
    LingridConfig,
    "api_provider" | "api_base_url" | "openai_auth_mode" | "openai_oauth_model" | "model"
  >
): string {
  const providerId = resolveConfigApiProvider(config);
  if (providerId === "openai" && resolveConfigOpenAIAuthMode(config) === "oauth") {
    return config.openai_oauth_model?.trim() || DEFAULT_CONFIG.openai_oauth_model || "gpt-5.3-codex";
  }

  return config.model?.trim() || "";
}

/**
 * 将 LingridConfig 转换为 ProviderConfig
 *
 * 用于从存储格式转换为 Provider 调用格式。
 *
 * @param config - 存储格式的配置对象
 * @returns Provider 调用格式的配置对象
 */
export function toProviderConfig(config: LingridConfig): ProviderConfig {
  const providerId = resolveConfigApiProvider(config);
  return {
    providerId,
    authMode:
      providerId === "openai" ? resolveConfigOpenAIAuthMode(config) : "api_key",
    apiBaseUrl: config.api_base_url,
    apiKey: config.api_key,
    model: resolveConfigModel(config),
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

/**
 * DeepSeek 模型列表缓存
 */
export interface DeepSeekModelCache {
  models: ModelOption[];
  timestamp: number; // Date.now()
}

/**
 * DeepSeek 模型缓存存储键名
 */
export const DEEPSEEK_CACHE_KEY = "deepseek_models_cache";

/**
 * DeepSeek 模型缓存过期时间（24 小时）
 */
export const DEEPSEEK_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
