import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_BASE_URL_PRESETS,
  CUSTOM_MODEL_PLACEHOLDER,
  DEEPSEEK_MODEL_OPTIONS_FALLBACK,
  GLM_MODEL_OPTIONS,
  LATEST_MODEL_OPTIONS_LIMIT,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_ENDPOINT_OPTIONS,
  MINIMAX_MODEL_OPTIONS,
  getCachedDeepSeekModels,
  getCachedProviderModels,
  getDeepSeekModelOptions,
  getDefaultModelForProvider,
  getStaticModelOptions,
  normalizeMiniMaxAIBaseUrl,
  normalizeModelForProviderSwitch,
  pickLatestModelOptions,
  refreshProviderModelOptions,
  setCachedProviderModels,
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

describe("模型列表动态刷新", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      },
      writable: true,
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("pickLatestModelOptions", () => {
    it("有创建时间时按时间倒序取最新 6 个", () => {
      const items = Array.from({ length: 8 }, (_, i) => ({
        id: `model-${i + 1}`,
        created: 1000 + i,
      }));

      const options = pickLatestModelOptions(items);

      expect(options).toHaveLength(LATEST_MODEL_OPTIONS_LIMIT + 1);
      expect(options[0].value).toBe("model-8");
      expect(options[5].value).toBe("model-3");
      expect(options[6]).toEqual({ value: "custom", label: "自定义..." });
    });

    it("兼容 ISO 字符串形式的创建时间", () => {
      const options = pickLatestModelOptions([
        { id: "old-model", created: Date.parse("2024-01-01T00:00:00Z") },
        { id: "new-model", created: Date.parse("2026-01-01T00:00:00Z") },
      ]);

      expect(options[0].value).toBe("new-model");
    });

    it("无创建时间时按模型 ID 版本号倒序", () => {
      const options = pickLatestModelOptions([
        { id: "MiniMax-M2" },
        { id: "MiniMax-M3" },
        { id: "MiniMax-M2.7" },
        { id: "MiniMax-M2.7-highspeed" },
      ]);

      expect(options.map((option) => option.value)).toEqual([
        "MiniMax-M3",
        "MiniMax-M2.7-highspeed",
        "MiniMax-M2.7",
        "MiniMax-M2",
        "custom",
      ]);
    });

    it("不足 6 个时全部保留", () => {
      const options = pickLatestModelOptions([
        { id: "deepseek-chat" },
        { id: "deepseek-reasoner" },
      ]);

      expect(options).toHaveLength(3);
      expect(options[2]).toEqual({ value: "custom", label: "自定义..." });
    });
  });

  describe("refreshProviderModelOptions", () => {
    it("不支持的服务商或缺少 API Key 时返回 null", async () => {
      expect(await refreshProviderModelOptions("openai", "key")).toBeNull();
      expect(await refreshProviderModelOptions("custom", "key")).toBeNull();
      expect(await refreshProviderModelOptions("minimax", "")).toBeNull();
    });

    it("MiniMax：请求 Anthropic 兼容端点并携带 x-api-key，结果写入缓存", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "MiniMax-M2", created_at: "2025-01-01T00:00:00Z" },
            { id: "MiniMax-M2.7", created_at: "2026-01-01T00:00:00Z" },
            { id: "MiniMax-M3", created_at: "2026-06-01T00:00:00Z" },
          ],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const options = await refreshProviderModelOptions(
        "minimax",
        "test-key",
        "https://api.minimaxi.com/anthropic"
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.minimaxi.com/anthropic/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "test-key",
            "Authorization": "Bearer test-key",
          }),
        })
      );
      expect(options?.map((option) => option.value)).toEqual([
        "MiniMax-M3",
        "MiniMax-M2.7",
        "MiniMax-M2",
        "custom",
      ]);
      expect(getCachedProviderModels("minimax")).toEqual(options);
      // 刷新后 getStaticModelOptions 优先返回缓存列表
      expect(await getStaticModelOptions("minimax")).toEqual(options);
    });

    it("GLM：请求 OpenAI 兼容端点，超过 6 个时只保留最新 6 个", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "glm-4-air" },
            { id: "glm-4.5" },
            { id: "glm-4.5-air" },
            { id: "glm-4.5-flash" },
            { id: "glm-4.6" },
            { id: "glm-4-plus" },
            { id: "glm-4" },
            { id: "embedding-3" },
          ],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const options = await refreshProviderModelOptions("glm", "test-key");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://open.bigmodel.cn/api/paas/v4/models",
        expect.anything()
      );
      expect(options).toHaveLength(LATEST_MODEL_OPTIONS_LIMIT + 1);
      expect(options?.[0].value).toBe("glm-4.6");
      expect(options?.[6]).toEqual({ value: "custom", label: "自定义..." });
      expect(await getStaticModelOptions("glm")).toEqual(options);
    });

    it("拉取失败时返回 null 且不破坏已有缓存", async () => {
      const cached = [{ value: "MiniMax-M3", label: "MiniMax-M3" }];
      setCachedProviderModels("minimax", cached);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 401 })
      );

      const options = await refreshProviderModelOptions("minimax", "bad-key");

      expect(options).toBeNull();
      expect(getCachedProviderModels("minimax")).toEqual(cached);
    });
  });
});
