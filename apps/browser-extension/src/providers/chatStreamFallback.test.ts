import { describe, expect, it } from "vitest";

import type { ProviderConfig } from "../types";
import { BaseTranslateProvider } from "./ITranslateProvider";

/** 最小具体 Provider：只实现抽象方法，chat 返回固定串 */
class StubProvider extends BaseTranslateProvider {
  readonly name = "Stub";
  chatCalls: Array<{ system: string; user: string }> = [];

  async translate(): Promise<string[]> {
    return [];
  }
  async testConnection(): Promise<{ success: boolean; latency: number }> {
    return { success: true, latency: 0 };
  }
  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    this.chatCalls.push({ system: systemPrompt, user: userPrompt });
    return "FULL_RESPONSE";
  }
}

const config: ProviderConfig = {
  providerId: "deepseek",
  authMode: "api_key",
  apiBaseUrl: "https://example.com",
  apiKey: "k",
  model: "m",
  systemPrompt: "s",
  userPromptTemplate: "{{texts}}",
};

describe("BaseTranslateProvider.chatStream 非流式 fallback", () => {
  it("调用 chat 后一次性回调 onChunk，并返回完整文本", async () => {
    const provider = new StubProvider(config);
    const chunks: string[] = [];

    const full = await provider.chatStream(
      [
        { role: "system", content: "SYS" },
        { role: "user", content: "U1" },
      ],
      (delta) => chunks.push(delta)
    );

    expect(full).toBe("FULL_RESPONSE");
    expect(chunks).toEqual(["FULL_RESPONSE"]);
    expect(provider.chatCalls).toEqual([{ system: "SYS", user: "User: U1" }]);
  });

  it("多轮历史被摊平进 user prompt（User:/Assistant: 前缀）", async () => {
    const provider = new StubProvider(config);
    await provider.chatStream(
      [
        { role: "system", content: "SYS" },
        { role: "user", content: "U1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "U2" },
      ],
      () => undefined
    );

    expect(provider.chatCalls[0].system).toBe("SYS");
    expect(provider.chatCalls[0].user).toBe("User: U1\nAssistant: A1\nUser: U2");
  });

  it("没有 system 消息时以空串作为 system", async () => {
    const provider = new StubProvider(config);
    await provider.chatStream([{ role: "user", content: "U1" }], () => undefined);
    expect(provider.chatCalls[0].system).toBe("");
  });
});
