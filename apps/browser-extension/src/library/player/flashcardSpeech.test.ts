import { describe, expect, it } from "vitest";

import { buildFlashcardSpeechText } from "./flashcardSpeech";

describe("buildFlashcardSpeechText", () => {
  it("动物重复三遍并使用 This is a 例句", () => {
    expect(buildFlashcardSpeechText("animals", "cat")).toBe(
      "cat, cat, cat. This is a cat."
    );
  });

  it("形状重复三遍并使用 This is a 例句", () => {
    expect(buildFlashcardSpeechText("shapes", "circle")).toBe(
      "circle, circle, circle. This is a circle."
    );
  });

  it("颜色使用不带冠词的例句", () => {
    expect(buildFlashcardSpeechText("colors", "red")).toBe(
      "red, red, red. This is red."
    );
  });

  it("动作使用 I can 例句", () => {
    expect(buildFlashcardSpeechText("actions", "run")).toBe(
      "run, run, run. I can run."
    );
  });
});
