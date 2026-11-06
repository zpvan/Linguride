import { describe, expect, it } from "vitest";

import actions from "../data/flashcards/actions.json";
import animals from "../data/flashcards/animals.json";
import colors from "../data/flashcards/colors.json";
import shapes from "../data/flashcards/shapes.json";
import {
  FLASHCARD_CATEGORY_IDS,
  isFlashcardDeck,
  type FlashcardCategoryId,
} from "./flashcard";

const decks = { animals, shapes, colors, actions };
const expectedWords: Record<FlashcardCategoryId, readonly string[]> = {
  animals: [
    "cat", "dog", "rabbit", "bear", "panda", "lion", "tiger", "elephant",
    "monkey", "giraffe", "zebra", "horse", "cow", "pig", "duck", "fish",
    "fox", "wolf", "deer", "sheep", "goat", "chicken", "penguin", "bird",
    "owl", "frog", "turtle", "snake", "dolphin", "whale", "octopus", "bee",
  ],
  shapes: ["circle", "square", "triangle", "rectangle", "oval", "star", "heart", "diamond"],
  colors: ["red", "blue", "yellow", "green", "orange", "purple", "pink", "brown"],
  actions: ["run", "walk", "jump", "swim", "dance", "sing", "eat", "drink", "sleep", "read", "write", "draw", "ride", "clap", "sit", "stand"],
};

describe("正式认图卡片数据", () => {
  it("四分类、数量和词条均符合设计", () => {
    let total = 0;
    for (const id of FLASHCARD_CATEGORY_IDS) {
      const deck = decks[id];
      expect(isFlashcardDeck(deck), `${id} 数据应通过守卫`).toBe(true);
      if (!isFlashcardDeck(deck)) continue;
      expect(deck.id).toBe(id);
      expect(deck.cards.map((card) => card.word)).toEqual(expectedWords[id]);
      total += deck.cards.length;
    }
    expect(total).toBe(64);
  });
});
