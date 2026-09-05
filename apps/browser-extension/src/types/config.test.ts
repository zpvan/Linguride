import { describe, expect, it } from "vitest";

import {
  DOUBAO_TTS_VOICE_OPTIONS,
  MINIMAX_AI_API_BASE_URL,
  MINIMAX_AI_API_BASE_URL_CN,
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_API_BASE_URL_CN,
  XIAOMI_TTS_VOICE_OPTIONS,
  normalizeDoubaoTTSVoice,
  normalizeMiniMaxTTSBaseUrl,
  normalizeXiaomiTTSVoice,
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

describe("normalizeXiaomiTTSVoice", () => {
  it("returns mimo_default for empty input", () => {
    expect(normalizeXiaomiTTSVoice(undefined)).toBe("mimo_default");
    expect(normalizeXiaomiTTSVoice("")).toBe("mimo_default");
  });

  it("accepts v2.5 voices", () => {
    expect(normalizeXiaomiTTSVoice("Mia")).toBe("Mia");
    expect(normalizeXiaomiTTSVoice("Dean")).toBe("Dean");
  });

  it("migrates legacy v2 voices to mimo_default", () => {
    expect(normalizeXiaomiTTSVoice("default_zh")).toBe("mimo_default");
    expect(normalizeXiaomiTTSVoice("default_en")).toBe("mimo_default");
  });

  it("voice options contain only v2.5 voices", () => {
    expect(XIAOMI_TTS_VOICE_OPTIONS).toEqual([
      "mimo_default",
      "Mia",
      "Chloe",
      "Milo",
      "Dean",
    ]);
  });
});

describe("normalizeDoubaoTTSVoice", () => {
  it("returns default voice for empty input", () => {
    expect(normalizeDoubaoTTSVoice(undefined)).toBe(
      "en_female_allison_uranus_bigtts"
    );
    expect(normalizeDoubaoTTSVoice("")).toBe("en_female_allison_uranus_bigtts");
  });

  it("accepts known v2.0 voices", () => {
    expect(normalizeDoubaoTTSVoice("en_male_alex_uranus_bigtts")).toBe(
      "en_male_alex_uranus_bigtts"
    );
  });

  it("falls back to default for unknown voices", () => {
    expect(normalizeDoubaoTTSVoice("unknown_voice")).toBe(
      "en_female_allison_uranus_bigtts"
    );
  });

  it("voice options contain the 4 curated voices", () => {
    expect(DOUBAO_TTS_VOICE_OPTIONS).toEqual([
      "en_female_allison_uranus_bigtts",
      "en_female_brittney_pimintel_uranus_bigtts",
      "en_male_alex_uranus_bigtts",
      "en_male_alberto_uranus_bigtts",
    ]);
  });
});
