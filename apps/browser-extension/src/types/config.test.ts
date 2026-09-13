import { describe, expect, it } from "vitest";

import {
  DOUBAO_TTS_VOICE_OPTIONS,
  MINIMAX_AI_API_BASE_URL,
  MINIMAX_AI_API_BASE_URL_CN,
  MINIMAX_TTS_API_BASE_URL,
  MINIMAX_TTS_API_BASE_URL_CN,
  XIAOMI_TTS_VOICE_OPTIONS,
  isAlibabaASRConfigured,
  isDoubaoASRConfigured,
  isMiniMaxASRConfigured,
  isTencentASRConfigured,
  isXiaomiASRConfigured,
  normalizeDoubaoTTSVoice,
  normalizeMiniMaxTTSBaseUrl,
  normalizeXiaomiTTSVoice,
  resolveASRSelection,
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

describe("resolveASRSelection", () => {
  it("passes through explicit selection", () => {
    expect(
      resolveASRSelection({
        asr_selection: "browser",
        doubao_asr: { api_key: "k" },
      } as never)
    ).toBe("browser");
  });

  it("prefers doubao when nothing explicit and doubao configured", () => {
    expect(resolveASRSelection({ doubao_asr: { api_key: "k" } } as never)).toBe(
      "doubao"
    );
  });

  it("falls to tencent when only tencent configured", () => {
    expect(
      resolveASRSelection({
        tencent_asr: { app_id: "a", secret_id: "s", secret_key: "k" },
      } as never)
    ).toBe("tencent");
  });

  it("falls to alibaba when only alibaba configured", () => {
    expect(
      resolveASRSelection({ alibaba_asr: { api_key: "k" } } as never)
    ).toBe("alibaba");
  });

  it("falls to xiaomi when only xiaomi configured", () => {
    expect(resolveASRSelection({ xiaomi_asr: { api_key: "k" } } as never)).toBe(
      "xiaomi"
    );
  });

  it("prefers alibaba over xiaomi in migration order", () => {
    expect(
      resolveASRSelection({
        alibaba_asr: { api_key: "k" },
        xiaomi_asr: { api_key: "k" },
      } as never)
    ).toBe("alibaba");
  });

  it("falls back to browser when nothing configured", () => {
    expect(resolveASRSelection({} as never)).toBe("browser");
  });

  it("falls to minimax when only minimax tts key configured", () => {
    expect(
      resolveASRSelection({ minimax_tts: { api_key: "k" } } as never)
    ).toBe("minimax");
  });

  it("prefers minimax over xiaomi in migration order", () => {
    expect(
      resolveASRSelection({
        minimax_tts: { api_key: "k" },
        xiaomi_asr: { api_key: "k" },
      } as never)
    ).toBe("minimax");
  });

  it("prefers alibaba over minimax in migration order", () => {
    expect(
      resolveASRSelection({
        alibaba_asr: { api_key: "k" },
        minimax_tts: { api_key: "k" },
      } as never)
    ).toBe("alibaba");
  });

  it("explicit xiaomi selection wins over configured minimax", () => {
    expect(
      resolveASRSelection({
        asr_selection: "xiaomi",
        minimax_tts: { api_key: "k" },
      } as never)
    ).toBe("xiaomi");
  });
});

describe("isXxxASRConfigured", () => {
  it("doubao requires non-empty trimmed api_key", () => {
    expect(isDoubaoASRConfigured({} as never)).toBe(false);
    expect(isDoubaoASRConfigured({ doubao_asr: { api_key: "  " } } as never)).toBe(
      false
    );
    expect(isDoubaoASRConfigured({ doubao_asr: { api_key: "k" } } as never)).toBe(
      true
    );
  });

  it("tencent requires all three fields", () => {
    expect(
      isTencentASRConfigured({
        tencent_asr: { app_id: "a", secret_id: "", secret_key: "k" },
      } as never)
    ).toBe(false);
    expect(
      isTencentASRConfigured({
        tencent_asr: { app_id: "a", secret_id: "s", secret_key: "k" },
      } as never)
    ).toBe(true);
  });

  it("alibaba requires api_key", () => {
    expect(isAlibabaASRConfigured({} as never)).toBe(false);
    expect(isAlibabaASRConfigured({ alibaba_asr: { api_key: "k" } } as never)).toBe(
      true
    );
  });

  it("xiaomi requires non-empty trimmed api_key", () => {
    expect(isXiaomiASRConfigured({} as never)).toBe(false);
    expect(isXiaomiASRConfigured({ xiaomi_asr: { api_key: "  " } } as never)).toBe(false);
    expect(isXiaomiASRConfigured({ xiaomi_asr: { api_key: "k" } } as never)).toBe(true);
  });
});

describe("isMiniMaxASRConfigured", () => {
  it("returns true when minimax tts api key is present", () => {
    expect(
      isMiniMaxASRConfigured({ minimax_tts: { api_key: "sk-x" } } as never)
    ).toBe(true);
  });

  it("returns false for blank or missing key", () => {
    expect(
      isMiniMaxASRConfigured({ minimax_tts: { api_key: "  " } } as never)
    ).toBe(false);
    expect(isMiniMaxASRConfigured({} as never)).toBe(false);
  });
});
