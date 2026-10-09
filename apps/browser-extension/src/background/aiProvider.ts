import type { ITranslateProvider } from "../providers";
import { DeepSeekProvider } from "../providers/DeepSeekProvider";
import { GLMProvider } from "../providers/GLMProvider";
import { MiniMaxProvider } from "../providers/MiniMaxProvider";
import {
  LingridConfig,
  ProviderConfig,
  resolveConfigModel,
  toProviderConfig,
} from "../types";

type ProviderReadyResult =
  | {
      ok: true;
      providerConfig: ProviderConfig;
    }
  | {
      ok: false;
      error: string;
    };

function hasBaseUrl(config: ProviderConfig): boolean {
  return Boolean(config.apiBaseUrl?.trim());
}

function hasModel(config: ProviderConfig): boolean {
  return Boolean(config.model?.trim());
}

function hasApiKey(config: ProviderConfig): boolean {
  return Boolean(config.apiKey?.trim());
}

export async function assertAiProviderReady(
  config: LingridConfig
): Promise<ProviderReadyResult> {
  const model = resolveConfigModel(config);
  const providerConfig = toProviderConfig(config);

  if (!model.trim()) {
    return {
      ok: false,
      error: "请先配置模型",
    };
  }

  if (!hasBaseUrl(providerConfig)) {
    return {
      ok: false,
      error: "请先配置 API 端点",
    };
  }

  if (!hasApiKey(providerConfig)) {
    return {
      ok: false,
      error: "请先配置 API Key",
    };
  }

  if (!hasModel(providerConfig)) {
    return {
      ok: false,
      error: "请先配置模型",
    };
  }

  return {
    ok: true,
    providerConfig,
  };
}

export async function createAIProvider(
  config: LingridConfig
): Promise<ITranslateProvider> {
  const readiness = await assertAiProviderReady(config);
  if (!readiness.ok) {
    throw new Error(readiness.error);
  }

  const { providerConfig } = readiness;

  if (providerConfig.providerId === "glm") {
    return new GLMProvider(providerConfig);
  }

  if (providerConfig.providerId === "minimax") {
    return new MiniMaxProvider(providerConfig);
  }

  // deepseek / kimi：均为 OpenAI 兼容协议，复用 DeepSeekProvider
  return new DeepSeekProvider(providerConfig);
}
