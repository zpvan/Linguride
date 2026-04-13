import type { ITranslateProvider } from "../providers";
import { DeepSeekProvider } from "../providers/DeepSeekProvider";
import { GLMProvider } from "../providers/GLMProvider";
import {
  OpenAICodexAuthAdapter,
  OpenAICodexProvider,
} from "../providers/OpenAICodexProvider";
import {
  LingridConfig,
  ProviderConfig,
  resolveConfigApiProvider,
  resolveConfigModel,
  resolveConfigOpenAIAuthMode,
  toProviderConfig,
} from "../types";
import {
  disconnectOpenAICodexOAuth,
  getOpenAICodexOAuthCredentials,
  getOpenAICodexOAuthStatus,
} from "./openaiCodexAuth";

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

function getOpenAICodexAuthAdapter(): OpenAICodexAuthAdapter {
  return {
    async getCredentials(options) {
      const credentials = await getOpenAICodexOAuthCredentials(options);
      return {
        accessToken: credentials.access,
        accountId: credentials.account_id,
      };
    },
    async handleUnauthorized() {
      await disconnectOpenAICodexOAuth();
    },
  };
}

export async function assertAiProviderReady(
  config: LingridConfig
): Promise<ProviderReadyResult> {
  const providerId = resolveConfigApiProvider(config);
  const authMode = resolveConfigOpenAIAuthMode(config);
  const model = resolveConfigModel(config);
  const providerConfig = toProviderConfig(config);

  if (!model.trim()) {
    return {
      ok: false,
      error: "请先配置模型",
    };
  }

  if (providerId === "openai" && authMode === "oauth") {
    const oauthStatus = await getOpenAICodexOAuthStatus();
    if (oauthStatus.status === "missing" || oauthStatus.status === "pending") {
      return {
        ok: false,
        error: "请先完成 OpenAI OAuth 登录",
      };
    }

    return {
      ok: true,
      providerConfig,
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
  if (
    providerConfig.providerId === "openai" &&
    providerConfig.authMode === "oauth"
  ) {
    return new OpenAICodexProvider(
      providerConfig,
      getOpenAICodexAuthAdapter()
    );
  }

  if (providerConfig.providerId === "glm") {
    return new GLMProvider(providerConfig);
  }

  return new DeepSeekProvider(providerConfig);
}
