import { describe, expect, it } from "vitest";

import {
  AI_PROVIDER_BASE_URL_PRESETS,
  CUSTOM_MODEL_PLACEHOLDER,
  DEEPSEEK_MODEL_OPTIONS,
  GLM_MODEL_OPTIONS,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_MODEL_OPTIONS,
  getDefaultModelForProvider,
  getStaticModelOptions,
  normalizeModelForProviderSwitch,
} from "./aiServiceOptions";

describe("aiServiceOptions", () => {
  it("exposes the minimax preset endpoint and model list", () => {
    expect(AI_PROVIDER_BASE_URL_PRESETS.minimax).toBe(
      "https://api.minimaxi.com/anthropic"
    );
    expect(MINIMAX_MODEL_OPTIONS).toEqual([
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
    expect(await getStaticModelOptions("deepseek")).toBe(DEEPSEEK_MODEL_OPTIONS);
    expect(await getStaticModelOptions("glm")).toBe(GLM_MODEL_OPTIONS);
  });
});
