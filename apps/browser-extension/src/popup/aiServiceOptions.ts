import {
  DEFAULT_CONFIG,
  MINIMAX_AI_API_BASE_URL,
  OpenAIAuthMode,
  AIProviderId,
} from "../types";
import { DEEPSEEK_CACHE_KEY, DEEPSEEK_CACHE_EXPIRY_MS, DeepSeekModelCache } from "../types/config";

export interface ModelOption {
  value: string;
  label: string;
}

export const CUSTOM_MODEL_PLACEHOLDER = "输入模型名称";
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M2.7";

export const AI_PROVIDER_BASE_URL_PRESETS: Record<Exclude<AIProviderId, "custom">, string> =
  {
    deepseek: "https://api.deepseek.com",
    glm: "https://open.bigmodel.cn/api/paas/v4/",
    minimax: MINIMAX_AI_API_BASE_URL,
    openai: "https://api.openai.com",
  };

export const DEEPSEEK_MODEL_OPTIONS_FALLBACK: ModelOption[] = [
  { value: "deepseek-chat", label: "DeepSeek Chat" },
  { value: "deepseek-coder", label: "DeepSeek Coder" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  { value: "custom", label: "自定义..." },
];

export const GLM_MODEL_OPTIONS: ModelOption[] = [
  { value: "glm-4.5", label: "glm-4.5" },
  { value: "glm-4.5-air", label: "glm-4.5-air" },
  { value: "glm-4-air", label: "glm-4-air" },
  { value: "custom", label: "自定义..." },
];

export const MINIMAX_MODEL_OPTIONS: ModelOption[] = [
  { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
  { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
  { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
  { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
  { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
  { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
  { value: "MiniMax-M2", label: "MiniMax-M2" },
  { value: "custom", label: "自定义..." },
];

export async function getStaticModelOptions(providerType: AIProviderId, apiKey?: string): Promise<ModelOption[] | null> {
  if (providerType === "deepseek") {
    return getDeepSeekModelOptions(apiKey || "");
  }
  if (providerType === "glm") {
    return GLM_MODEL_OPTIONS;
  }
  if (providerType === "minimax") {
    return MINIMAX_MODEL_OPTIONS;
  }
  return null;
}

export function getDefaultModelForProvider(
  providerType: AIProviderId,
  openaiAuthMode: OpenAIAuthMode,
  openaiOauthModel?: string
): string {
  if (providerType === "deepseek") {
    return DEFAULT_CONFIG.model;
  }

  if (providerType === "glm") {
    return "glm-4.5";
  }

  if (providerType === "minimax") {
    return MINIMAX_DEFAULT_MODEL;
  }

  if (providerType === "openai") {
    return openaiAuthMode === "oauth"
      ? openaiOauthModel?.trim() || DEFAULT_CONFIG.openai_oauth_model || "gpt-5.3-codex"
      : "";
  }

  return "";
}

export function normalizeModelForProviderSwitch(
  previousProviderType: AIProviderId,
  nextProviderType: AIProviderId,
  previousSelectionWasPreset: boolean,
  openaiAuthMode: OpenAIAuthMode,
  openaiOauthModel?: string
): string | null {
  if (!previousSelectionWasPreset || previousProviderType === nextProviderType) {
    return null;
  }

  return getDefaultModelForProvider(
    nextProviderType,
    openaiAuthMode,
    openaiOauthModel
  );
}

/**
 * 从缓存获取 DeepSeek 模型列表
 * @returns 缓存的模型列表或 null（无缓存或已过期）
 */
export function getCachedDeepSeekModels(): ModelOption[] | null {
  try {
    const raw = localStorage.getItem(DEEPSEEK_CACHE_KEY);
    if (!raw) return null;

    const cache: DeepSeekModelCache = JSON.parse(raw);
    const now = Date.now();

    if (now - cache.timestamp > DEEPSEEK_CACHE_EXPIRY_MS) {
      localStorage.removeItem(DEEPSEEK_CACHE_KEY);
      return null;
    }

    return cache.models;
  } catch {
    return null;
  }
}

/**
 * 保存 DeepSeek 模型列表到缓存
 */
export function setCachedDeepSeekModels(models: ModelOption[]): void {
  const cache: DeepSeekModelCache = {
    models,
    timestamp: Date.now(),
  };
  localStorage.setItem(DEEPSEEK_CACHE_KEY, JSON.stringify(cache));
}

/**
 * 从 DeepSeek API 获取模型列表
 * @param apiKey DeepSeek API Key
 * @returns 模型选项数组
 */
export async function fetchDeepSeekModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch("https://api.deepseek.com/models", {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json() as { data: { id: string }[] };

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Invalid DeepSeek API response format");
  }

  // 转换 API 响应为 ModelOption 格式，保留 custom 选项
  const models: ModelOption[] = data.data
    .map(item => ({
      value: item.id,
      label: formatModelLabel(item.id),
    }));

  models.push({ value: "custom", label: "自定义..." });

  return models;
}

/**
 * 格式化模型 ID 为显示标签
 */
function formatModelLabel(modelId: string): string {
  if (modelId.startsWith("deepseek-")) {
    const suffix = modelId.replace("deepseek-", "");
    const labels: Record<string, string> = {
      "chat": "DeepSeek Chat",
      "coder": "DeepSeek Coder",
      "reasoner": "DeepSeek Reasoner",
    };
    return labels[suffix] || modelId;
  }
  return modelId;
}

/**
 * 获取 DeepSeek 模型选项（带缓存）
 * @param apiKey DeepSeek API Key
 * @returns 模型选项数组
 */
export async function getDeepSeekModelOptions(apiKey: string): Promise<ModelOption[]> {
  if (!apiKey?.trim()) {
    return DEEPSEEK_MODEL_OPTIONS_FALLBACK;
  }

  const cached = getCachedDeepSeekModels();
  if (cached) return cached;

  try {
    const models = await fetchDeepSeekModels(apiKey);
    setCachedDeepSeekModels(models);
    return models;
  } catch (error) {
    console.warn("[aiServiceOptions] Failed to fetch DeepSeek models:", error);
    return DEEPSEEK_MODEL_OPTIONS_FALLBACK;
  }
}
