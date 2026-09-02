import { describe, expect, it } from "vitest";

import {
  MINIMAX_AI_API_BASE_URL,
  MINIMAX_AI_API_BASE_URL_CN,
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_API_BASE_URL_CN,
  normalizeMiniMaxTTSBaseUrl,
  resolveConfigApiProvider,
} from "./config";

describe("resolveConfigApiProvider", () => {
  it("accepts minimax explicitly", () => {
    expect(
      resolveConfigApiProvider({
        api_provider: "minimax",
        api_base_url: "https://example.invalid",
      })
    ).toBe("minimax");
  });

  it("infers minimax from the api base url with a trailing slash", () => {
    expect(
      resolveConfigApiProvider({
        api_base_url: `${MINIMAX_AI_API_BASE_URL}/`,
      })
    ).toBe("minimax");
  });

  it("infers minimax from the china direct base url", () => {
    expect(
      resolveConfigApiProvider({
        api_base_url: MINIMAX_AI_API_BASE_URL_CN,
      })
    ).toBe("minimax");
  });
});

describe("normalizeMiniMaxTTSBaseUrl", () => {
  it("keeps the china direct endpoint", () => {
    expect(normalizeMiniMaxTTSBaseUrl(MINIMAX_TTS_API_BASE_URL_CN)).toBe(
      MINIMAX_TTS_API_BASE_URL_CN
    );
  });

  it("keeps the china direct endpoint with a trailing slash", () => {
    expect(normalizeMiniMaxTTSBaseUrl(`${MINIMAX_TTS_API_BASE_URL_CN}/`)).toBe(
      MINIMAX_TTS_API_BASE_URL_CN
    );
  });

  it("falls back to the international endpoint for empty or unknown values", () => {
    expect(normalizeMiniMaxTTSBaseUrl(undefined)).toBe(MINIMAX_TTS_API_BASE_URL);
    expect(normalizeMiniMaxTTSBaseUrl("")).toBe(MINIMAX_TTS_API_BASE_URL);
    expect(normalizeMiniMaxTTSBaseUrl("https://example.invalid/v1")).toBe(
      MINIMAX_TTS_API_BASE_URL
    );
  });
});
