import {
  DEFAULT_CONFIG,
  MINIMAX_AI_API_BASE_URL,
  OpenAIAuthMode,
  AIProviderId,
} from "../types";

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

export const DEEPSEEK_MODEL_OPTIONS: ModelOption[] = [
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

export function getStaticModelOptions(providerType: AIProviderId): ModelOption[] | null {
  if (providerType === "deepseek") {
    return DEEPSEEK_MODEL_OPTIONS;
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
