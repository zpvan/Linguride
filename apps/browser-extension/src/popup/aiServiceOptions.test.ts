import { beforeEach, describe, expect, it } from "vitest";

import {
  AI_PROVIDER_BASE_URL_PRESETS,
  CUSTOM_MODEL_PLACEHOLDER,
  DEEPSEEK_MODEL_OPTIONS_FALLBACK,
  GLM_MODEL_OPTIONS,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_ENDPOINT_OPTIONS,
  MINIMAX_MODEL_OPTIONS,
  fetchDeepSeekModels,
  getCachedDeepSeekModels,
  getDeepSeekModelOptions,
  getDefaultModelForProvider,
  getStaticModelOptions,
  normalizeMiniMaxAIBaseUrl,
  normalizeModelForProviderSwitch,
  setCachedDeepSeekModels,
} from "./aiServiceOptions";

describe("aiServiceOptions", () => {
  it("exposes the minimax preset endpoint and model list", () => {
    expect(AI_PROVIDER_BASE_URL_PRESETS.minimax).toBe(
      "https://api.minimaxi.com/anthropic"
    );
    expect(MINIMAX_MODEL_OPTIONS).toEqual([
      { value: "MiniMax-M3", label: "MiniMax-M3" },
      { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
      { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
      { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
      { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
      { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
      { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
      { value: "MiniMax-M2", label: "MiniMax-M2" },
      { value: "custom", label: "自定义..." },
    ]);
    expect(CUSTOM_MODEL_PLACEHOLDER).toBe("输入模型名称");
  });

  it("exposes switchable minimax endpoint lines", () => {
    expect(MINIMAX_ENDPOINT_OPTIONS).toEqual([
      {
        value: "https://api.minimaxi.com/anthropic",
        label: "国际线路 (api.minimaxi.com)",
      },
      {
        value: "https://api.minimax.cn/anthropic",
        label: "国内直连 (api.minimax.cn)",
      },
    ]);
  });

  it("normalizes the minimax ai base url to a known endpoint", () => {
    expect(normalizeMiniMaxAIBaseUrl("https://api.minimax.cn/anthropic")).toBe(
      "https://api.minimax.cn/anthropic"
    );
    expect(normalizeMiniMaxAIBaseUrl("https://api.minimax.cn/anthropic/")).toBe(
      "https://api.minimax.cn/anthropic"
    );
    expect(normalizeMiniMaxAIBaseUrl("https://api.minimaxi.com/anthropic")).toBe(
      "https://api.minimaxi.com/anthropic"
    );
    expect(normalizeMiniMaxAIBaseUrl("https://example.invalid")).toBe(
      "https://api.minimaxi.com/anthropic"
    );
    expect(normalizeMiniMaxAIBaseUrl(undefined)).toBe(
      "https://api.minimaxi.com/anthropic"
    );
  });

  it("returns the minimax default when switching from a preset selection", () => {
    expect(
      normalizeModelForProviderSwitch(
        "deepseek",
        "minimax",
        true,
        "api_key"
      )
    ).toBe(MINIMAX_DEFAULT_MODEL);
  });

  it("returns null for custom model paths", () => {
    expect(
      normalizeModelForProviderSwitch(
        "deepseek",
        "minimax",
        false,
        "api_key"
      )
    ).toBeNull();
  });

  it("keeps existing OpenAI defaults unchanged", async () => {
    expect(getDefaultModelForProvider("openai", "api_key")).toBe("");
    expect(getDefaultModelForProvider("openai", "oauth", "  gpt-5.3-codex  ")).toBe(
      "gpt-5.3-codex"
    );
    expect(await getStaticModelOptions("openai")).toBeNull();
    expect(await getStaticModelOptions("deepseek")).toBe(DEEPSEEK_MODEL_OPTIONS_FALLBACK);
    expect(await getStaticModelOptions("glm")).toBe(GLM_MODEL_OPTIONS);
  });
});

describe("DeepSeek 模型列表缓存", () => {
  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {
      // 空实现：测试不关心写入行为
    },
    removeItem: () => {
      // 空实现：测试不关心删除行为
    },
    clear: () => {
      // 空实现：测试不关心清空行为
    },
  };

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });
  });

  describe("getCachedDeepSeekModels", () => {
    it("缓存为空时返回 null", () => {
      mockLocalStorage.getItem = () => null;
      expect(getCachedDeepSeekModels()).toBeNull();
    });

    it("缓存未过期时返回缓存数据", () => {
      const models = [{ value: "test", label: "Test" }];
      const cache = { models, timestamp: Date.now() };
      mockLocalStorage.getItem = () => JSON.stringify(cache);
      expect(getCachedDeepSeekModels()).toEqual(models);
    });

    it("缓存已过期时返回 null 并清除缓存", () => {
      let removedKey = "";
      mockLocalStorage.getItem = () =>
        JSON.stringify({
          models: [{ value: "old", label: "Old" }],
          timestamp: 0,
        });
      mockLocalStorage.removeItem = (key: string) => {
        removedKey = key;
      };

      const result = getCachedDeepSeekModels();
      expect(result).toBeNull();
      expect(removedKey).toBe("deepseek_models_cache");
    });
  });

  describe("getDeepSeekModelOptions", () => {
    it("API Key 为空时返回 fallback", async () => {
      const result = await getDeepSeekModelOptions("");
      expect(result).toEqual(DEEPSEEK_MODEL_OPTIONS_FALLBACK);
    });

    it("有缓存时直接返回缓存，不发请求", async () => {
      const cached = [{ value: "cached-model", label: "Cached Model" }];
      const cache = { models: cached, timestamp: Date.now() };
      mockLocalStorage.getItem = () => JSON.stringify(cache);

      // 如果有缓存，不会发出网络请求
      const result = await getDeepSeekModelOptions("fake-key");
      expect(result).toEqual(cached);
    });
  });
});
