import { describe, expect, it } from "vitest";

import { getFlashcardRevealA11y } from "./flashcardA11y";

describe("getFlashcardRevealA11y", () => {
  it("隐藏时不关联英文单词", () => {
    expect(getFlashcardRevealA11y("animals-cat", false)).toEqual({
      label: "显示单词",
      pressed: "false",
      describedBy: null,
      wordId: "animals-cat-word",
    });
  });

  it("reveal 后通过 describedBy 关联英文单词", () => {
    expect(getFlashcardRevealA11y("animals-cat", true)).toEqual({
      label: "隐藏单词",
      pressed: "true",
      describedBy: "animals-cat-word",
      wordId: "animals-cat-word",
    });
  });
});
