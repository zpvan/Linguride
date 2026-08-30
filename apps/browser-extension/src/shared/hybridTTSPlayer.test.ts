import { describe, expect, it } from "vitest";

import { selectNaturalBrowserVoice } from "./hybridTTSPlayer";

function makeVoice(
  name: string,
  lang: string,
  isDefault = false
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: isDefault,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

describe("selectNaturalBrowserVoice", () => {
  it("returns null when no voices are available", () => {
    expect(selectNaturalBrowserVoice([], "en-US")).toBeNull();
  });

  it("excludes novelty voices like Whisper", () => {
    const voices = [
      makeVoice("Whisper", "en-US"),
      makeVoice("Samantha", "en-US"),
    ];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe("Samantha");
  });

  it("prefers the system default voice among natural voices", () => {
    const voices = [
      makeVoice("Samantha", "en-US"),
      makeVoice("Google US English", "en-US", true),
    ];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe(
      "Google US English"
    );
  });

  it("falls back to language prefix match when no exact match exists", () => {
    const voices = [makeVoice("Daniel", "en-GB")];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe("Daniel");
  });

  it("returns null when no voice matches the language", () => {
    const voices = [makeVoice("Tingting", "zh-CN")];
    expect(selectNaturalBrowserVoice(voices, "en-US")).toBeNull();
  });

  it("accepts voices when every match is a novelty voice", () => {
    const voices = [makeVoice("Whisper", "en-US")];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe("Whisper");
  });
});
