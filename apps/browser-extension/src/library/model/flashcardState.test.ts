import { describe, expect, it } from "vitest";

import { FlashcardRevealState } from "./flashcardState";

describe("FlashcardRevealState", () => {
  it("创建时全部隐藏", () => {
    const state = new FlashcardRevealState();
    expect(state.isRevealed("animals-cat")).toBe(false);
  });

  it("独立切换两张卡片", () => {
    const state = new FlashcardRevealState();
    state.toggle("animals-cat");
    state.toggle("animals-dog");
    expect(state.isRevealed("animals-cat")).toBe(true);
    expect(state.isRevealed("animals-dog")).toBe(true);
    state.toggle("animals-cat");
    expect(state.isRevealed("animals-cat")).toBe(false);
    expect(state.isRevealed("animals-dog")).toBe(true);
  });

  it("重新创建后恢复隐藏", () => {
    const previous = new FlashcardRevealState();
    previous.toggle("animals-cat");
    const next = new FlashcardRevealState();
    expect(next.isRevealed("animals-cat")).toBe(false);
  });
});
