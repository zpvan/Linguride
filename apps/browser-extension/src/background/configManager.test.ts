import { describe, expect, it } from "vitest";

import { migrateLegacyConfig } from "./configManager";
import { DEFAULT_CONFIG, LingridConfig } from "../types";

function baseConfig(overrides: Partial<LingridConfig> = {}): LingridConfig {
  return {
    ...DEFAULT_CONFIG,
    prompts: { ...DEFAULT_CONFIG.prompts },
    ...overrides,
  };
}

describe("migrateLegacyConfig - OpenAI/自定义服务商迁移", () => {
  it("api_provider=openai 时重置 AI 配置块为 DeepSeek 默认并剔除 openai_* 键", () => {
    const legacy = baseConfig({
      api_provider: "openai" as LingridConfig["api_provider"],
      api_base_url: "https://api.openai.com",
      api_key: "sk-openai",
      model: "gpt-5.1-codex",
      openai_auth_mode: "oauth",
      openai_oauth_model: "gpt-5.3-codex",
    } as Partial<LingridConfig>);

    const next = migrateLegacyConfig(legacy);

    expect(next.api_provider).toBe("deepseek");
    expect(next.api_base_url).toBe("https://api.deepseek.com");
    expect(next.api_key).toBe("");
    expect(next.model).toBe("deepseek-chat");
    expect("openai_auth_mode" in next).toBe(false);
    expect("openai_oauth_model" in next).toBe(false);
  });

  it("api_provider=custom 时同样重置", () => {
    const legacy = baseConfig({
      api_provider: "custom" as LingridConfig["api_provider"],
      api_base_url: "https://my-llm.example.com/v1",
      api_key: "sk-x",
      model: "my-model",
    } as Partial<LingridConfig>);

    const next = migrateLegacyConfig(legacy);

    expect(next.api_provider).toBe("deepseek");
    expect(next.api_base_url).toBe("https://api.deepseek.com");
    expect(next.api_key).toBe("");
    expect(next.model).toBe("deepseek-chat");
  });

  it("provider 合法时仅剔除 openai_* 残留字段，其余配置不动", () => {
    const legacy = baseConfig({
      api_provider: "deepseek",
      api_base_url: "https://api.deepseek.com",
      api_key: "sk-deepseek",
      model: "deepseek-chat",
      openai_auth_mode: "api_key",
    } as Partial<LingridConfig>);

    const next = migrateLegacyConfig(legacy);

    expect(next.api_provider).toBe("deepseek");
    expect(next.api_key).toBe("sk-deepseek");
    expect(next.model).toBe("deepseek-chat");
    expect("openai_auth_mode" in next).toBe(false);
  });

  it("正常配置不受影响", () => {
    const normal = baseConfig({
      api_provider: "kimi",
      api_base_url: "https://api.moonshot.cn",
      api_key: "sk-kimi",
      model: "kimi-k3",
    });

    const next = migrateLegacyConfig(normal);

    expect(next.api_provider).toBe("kimi");
    expect(next.api_base_url).toBe("https://api.moonshot.cn");
    expect(next.api_key).toBe("sk-kimi");
    expect(next.model).toBe("kimi-k3");
  });
});
