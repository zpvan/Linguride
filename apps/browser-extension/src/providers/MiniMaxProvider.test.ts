import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderConfig } from "../types";
import { MiniMaxProvider } from "./MiniMaxProvider";

const providerConfig: ProviderConfig = {
  providerId: "minimax",
  authMode: "api_key",
  apiBaseUrl: "https://api.minimaxi.com/anthropic",
  apiKey: "test-api-key",
  model: "MiniMax-M1",
  systemPrompt: "You are a translation assistant.",
  userPromptTemplate: "Translate the following:\n\n{{texts}}",
};

describe("MiniMaxProvider", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends Anthropic Messages requests with the expected url, headers, and body", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: "1---\n你好",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const provider = new MiniMaxProvider(providerConfig);

    await expect(provider.translate(["Hello"])).resolves.toEqual(["你好"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.minimaxi.com/anthropic/v1/messages");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toEqual({
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": "test-api-key",
    });
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      model: "MiniMax-M1",
      system: "You are a translation assistant.",
      messages: [
        {
          role: "user",
          content: "Translate the following:\n\n1---\nHello",
        },
      ],
      max_tokens: 8192,
      temperature: 0.3,
    });
  });

  it("ignores non-text content blocks and extracts text blocks", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "thinking",
              thinking: "internal reasoning",
            },
            {
              type: "tool_use",
              id: "toolu_123",
              name: "lookup",
              input: {},
            },
            {
              type: "text",
              text: "Visible answer",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const provider = new MiniMaxProvider(providerConfig);

    await expect(
      provider.chat("You are helpful.", "Say something visible.")
    ).resolves.toBe("Visible answer");
  });

  it("returns a successful connection test when at least one text block is present", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "thinking",
              thinking: "internal reasoning",
            },
            {
              type: "text",
              text: "OK",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const provider = new MiniMaxProvider(providerConfig);

    await expect(provider.testConnection()).resolves.toMatchObject({
      success: true,
    });
  });
});
