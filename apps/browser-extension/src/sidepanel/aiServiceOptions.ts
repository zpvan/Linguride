import {
  DEFAULT_CONFIG,
  MINIMAX_AI_API_BASE_URL,
  MINIMAX_AI_API_BASE_URL_CN,
  OpenAIAuthMode,
  AIProviderId,
} from "../types";
import {
  DEEPSEEK_CACHE_KEY,
  DEEPSEEK_CACHE_EXPIRY_MS,
  GLM_MODELS_CACHE_KEY,
  MINIMAX_MODELS_CACHE_KEY,
  DeepSeekModelCache,
} from "../types/config";

export interface ModelOption {
  value: string;
  label: string;
}

export const CUSTOM_MODEL_PLACEHOLDER = "输入模型名称";
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M3";

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

/**
 * MiniMax 端点线路选项：国际线路走代理可用，国内直连不走代理可用。
 */
export const MINIMAX_ENDPOINT_OPTIONS: ModelOption[] = [
  { value: MINIMAX_AI_API_BASE_URL, label: "国际线路 (api.minimaxi.com)" },
  { value: MINIMAX_AI_API_BASE_URL_CN, label: "国内直连 (api.minimax.cn)" },
];

/**
 * 归一化 MiniMax AI 基础端点，仅接受国际/国内两条固定线路，
 * 其他值一律回退到国际线路。
 */
export function normalizeMiniMaxAIBaseUrl(value?: string | null): string {
  const normalized = value?.trim().replace(/\/+$/, "").toLowerCase();
  if (normalized === MINIMAX_AI_API_BASE_URL_CN) {
    return MINIMAX_AI_API_BASE_URL_CN;
  }
  return MINIMAX_AI_API_BASE_URL;
}

export const MINIMAX_MODEL_OPTIONS: ModelOption[] = [
  { value: "MiniMax-M3", label: "MiniMax-M3" },
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
    // 优先使用「测试连接」刷新后缓存的模型列表，否则回退到内置静态列表
    return getCachedProviderModels("glm") ?? GLM_MODEL_OPTIONS;
  }
  if (providerType === "minimax") {
    return getCachedProviderModels("minimax") ?? MINIMAX_MODEL_OPTIONS;
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
 * 动态拉取模型列表时最多展示的最新模型数量
 */
export const LATEST_MODEL_OPTIONS_LIMIT = 6;

/**
 * 支持动态拉取模型列表的服务商及其 localStorage 缓存键
 */
const PROVIDER_MODELS_CACHE_KEYS: Partial<Record<AIProviderId, string>> = {
  deepseek: DEEPSEEK_CACHE_KEY,
  glm: GLM_MODELS_CACHE_KEY,
  minimax: MINIMAX_MODELS_CACHE_KEY,
};

/**
 * 远端模型条目（兼容 OpenAI 与 Anthropic 风格的 models 响应）
 */
export interface RemoteModelItem {
  id: string;
  /** 创建时间戳（毫秒），响应未携带时缺省 */
  created?: number;
}

/**
 * 从缓存获取指定服务商的模型列表
 * @returns 缓存的模型列表或 null（无缓存、已过期或不支持缓存）
 */
export function getCachedProviderModels(providerType: AIProviderId): ModelOption[] | null {
  const cacheKey = PROVIDER_MODELS_CACHE_KEYS[providerType];
  if (!cacheKey) return null;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const cache: DeepSeekModelCache = JSON.parse(raw);
    const now = Date.now();

    if (now - cache.timestamp > DEEPSEEK_CACHE_EXPIRY_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return cache.models;
  } catch {
    return null;
  }
}

/**
 * 保存指定服务商的模型列表到缓存
 */
export function setCachedProviderModels(providerType: AIProviderId, models: ModelOption[]): void {
  const cacheKey = PROVIDER_MODELS_CACHE_KEYS[providerType];
  if (!cacheKey) return;

  const cache: DeepSeekModelCache = {
    models,
    timestamp: Date.now(),
  };
  localStorage.setItem(cacheKey, JSON.stringify(cache));
}

/**
 * 从缓存获取 DeepSeek 模型列表
 * @returns 缓存的模型列表或 null（无缓存或已过期）
 */
export function getCachedDeepSeekModels(): ModelOption[] | null {
  return getCachedProviderModels("deepseek");
}

/**
 * 保存 DeepSeek 模型列表到缓存
 */
export function setCachedDeepSeekModels(models: ModelOption[]): void {
  setCachedProviderModels("deepseek", models);
}

/**
 * 构建指定服务商的模型列表接口地址。
 * DeepSeek / GLM 走 OpenAI 兼容的 `/models`，MiniMax 走 Anthropic 兼容的 `/v1/models`。
 */
function buildModelsEndpointUrl(providerType: AIProviderId, baseUrl?: string): string | null {
  const trimmed = baseUrl?.trim().replace(/\/+$/, "");

  if (providerType === "deepseek") {
    return `${trimmed || AI_PROVIDER_BASE_URL_PRESETS.deepseek}/models`;
  }
  if (providerType === "glm") {
    const preset = AI_PROVIDER_BASE_URL_PRESETS.glm.replace(/\/+$/, "");
    return `${trimmed || preset}/models`;
  }
  if (providerType === "minimax") {
    return `${normalizeMiniMaxAIBaseUrl(trimmed)}/v1/models`;
  }
  return null;
}

/**
 * 归一化模型创建时间：兼容 Unix 秒/毫秒时间戳与 ISO 字符串
 */
function normalizeCreatedTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

/**
 * 从服务商模型列表接口拉取远端模型条目
 */
async function fetchRemoteModels(
  providerType: AIProviderId,
  apiKey: string,
  baseUrl?: string
): Promise<RemoteModelItem[]> {
  const url = buildModelsEndpointUrl(providerType, baseUrl);
  if (!url) {
    throw new Error(`不支持拉取模型列表的服务商: ${providerType}`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
  // MiniMax Anthropic 兼容接口按官方文档以 x-api-key 鉴权，与 MiniMaxProvider 保持一致
  if (providerType === "minimax") {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`${providerType} 模型列表接口请求失败: ${response.status}`);
  }

  const data = await response.json() as {
    data?: ({ id?: string; created?: number; created_at?: string } | string)[];
  };

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error(`${providerType} 模型列表接口返回格式异常`);
  }

  return data.data
    .map((item): RemoteModelItem => {
      if (typeof item === "string") {
        return { id: item };
      }
      const created = normalizeCreatedTimestamp(item?.created ?? item?.created_at);
      return created !== undefined
        ? { id: typeof item?.id === "string" ? item.id : "", created }
        : { id: typeof item?.id === "string" ? item.id : "" };
    })
    .filter((item) => item.id);
}

/**
 * 模型 ID 版本号自然序比较（倒序，新版本在前）。
 * 用于响应未携带创建时间时推断「最新」模型，如 MiniMax-M3 > MiniMax-M2.7。
 */
function compareModelIdsByVersionDesc(a: string, b: string): number {
  const chunksA = a.split(/(\d+)/);
  const chunksB = b.split(/(\d+)/);
  const length = Math.max(chunksA.length, chunksB.length);

  for (let i = 0; i < length; i += 1) {
    const partA = chunksA[i];
    const partB = chunksB[i];
    if (partA === undefined) return 1;
    if (partB === undefined) return -1;
    if (partA === partB) continue;

    const numA = Number(partA);
    const numB = Number(partB);
    const bothNumeric =
      partA !== "" && partB !== "" && !Number.isNaN(numA) && !Number.isNaN(numB);
    const order = bothNumeric ? numA - numB : partA.localeCompare(partB);
    if (order !== 0) return -order;
  }
  return 0;
}

/**
 * 从远端模型条目中挑选最新的若干个，转换为下拉框选项（末尾保留「自定义...」）。
 * 优先按创建时间倒序，缺失时间戳时按模型 ID 版本号倒序。
 */
export function pickLatestModelOptions(
  items: RemoteModelItem[],
  limit: number = LATEST_MODEL_OPTIONS_LIMIT
): ModelOption[] {
  const sorted = [...items].sort((a, b) => {
    if (a.created !== undefined && b.created !== undefined) {
      return b.created - a.created;
    }
    if (a.created !== undefined) return -1;
    if (b.created !== undefined) return 1;
    return compareModelIdsByVersionDesc(a.id, b.id);
  });

  const options: ModelOption[] = sorted.slice(0, limit).map((item) => ({
    value: item.id,
    label: formatModelLabel(item.id),
  }));

  options.push({ value: "custom", label: "自定义..." });
  return options;
}

/**
 * 从 DeepSeek API 获取模型列表
 * @param apiKey DeepSeek API Key
 * @returns 模型选项数组
 */
export async function fetchDeepSeekModels(apiKey: string): Promise<ModelOption[]> {
  const items = await fetchRemoteModels("deepseek", apiKey);

  // 转换 API 响应为 ModelOption 格式，保留 custom 选项
  const models: ModelOption[] = items.map((item) => ({
    value: item.id,
    label: formatModelLabel(item.id),
  }));

  models.push({ value: "custom", label: "自定义..." });

  return models;
}

/**
 * 刷新服务商模型列表：强制拉取最新模型，保留最新 6 个并写入缓存。
 * 用于「测试连接」成功后顺便更新模型下拉框。
 *
 * @param providerType 当前服务商
 * @param apiKey API Key（为空或不支持的服务商直接返回 null）
 * @param baseUrl 接口基础地址（MiniMax 用于区分国际/国内线路）
 * @returns 最新的模型选项；拉取失败或不支持时返回 null（调用方保持现有列表）
 */
export async function refreshProviderModelOptions(
  providerType: AIProviderId,
  apiKey?: string,
  baseUrl?: string
): Promise<ModelOption[] | null> {
  if (!PROVIDER_MODELS_CACHE_KEYS[providerType] || !apiKey?.trim()) {
    return null;
  }

  try {
    const items = await fetchRemoteModels(providerType, apiKey.trim(), baseUrl);
    if (items.length === 0) return null;

    const options = pickLatestModelOptions(items);
    setCachedProviderModels(providerType, options);
    return options;
  } catch (error) {
    console.warn("[aiServiceOptions] 刷新模型列表失败:", error);
    return null;
  }
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
