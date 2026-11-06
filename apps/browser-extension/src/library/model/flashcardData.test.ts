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

const expectedNewAnimals = [
  { id: "animals-fox", word: "fox", art: { kind: "emoji", emoji: "🦊" }, background: ["#fff0e1", "#ffcfbf"] },
  { id: "animals-wolf", word: "wolf", art: { kind: "emoji", emoji: "🐺" }, background: ["#f0f0f5", "#d5d5e2"] },
  { id: "animals-deer", word: "deer", art: { kind: "emoji", emoji: "🦌" }, background: ["#f3eadf", "#dfc3a5"] },
  { id: "animals-sheep", word: "sheep", art: { kind: "emoji", emoji: "🐑" }, background: ["#fff8d9", "#f3e2a4"] },
  { id: "animals-goat", word: "goat", art: { kind: "emoji", emoji: "🐐" }, background: ["#e8f3ef", "#b9d8ce"] },
  { id: "animals-chicken", word: "chicken", art: { kind: "emoji", emoji: "🐔" }, background: ["#fff4d6", "#ffd7a8"] },
  { id: "animals-penguin", word: "penguin", art: { kind: "emoji", emoji: "🐧" }, background: ["#e2f4ff", "#b9dcf5"] },
  { id: "animals-bird", word: "bird", art: { kind: "emoji", emoji: "🐦" }, background: ["#e0f7fa", "#b2ebf2"] },
  { id: "animals-owl", word: "owl", art: { kind: "emoji", emoji: "🦉" }, background: ["#f0e6ff", "#d6c1f5"] },
  { id: "animals-frog", word: "frog", art: { kind: "emoji", emoji: "🐸" }, background: ["#e5f8ed", "#bce6cc"] },
  { id: "animals-turtle", word: "turtle", art: { kind: "emoji", emoji: "🐢" }, background: ["#e8f3ef", "#b9d8ce"] },
  { id: "animals-snake", word: "snake", art: { kind: "emoji", emoji: "🐍" }, background: ["#e5f8ed", "#bce6cc"] },
  { id: "animals-dolphin", word: "dolphin", art: { kind: "emoji", emoji: "🐬" }, background: ["#e2f4ff", "#b9dcf5"] },
  { id: "animals-whale", word: "whale", art: { kind: "emoji", emoji: "🐋" }, background: ["#e0f7fa", "#b2ebf2"] },
  { id: "animals-octopus", word: "octopus", art: { kind: "emoji", emoji: "🐙" }, background: ["#f0e6ff", "#d6c1f5"] },
  { id: "animals-bee", word: "bee", art: { kind: "emoji", emoji: "🐝" }, background: ["#fff8d9", "#f3e2a4"] },
];

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

  it("新增动物的 ID、词条、Emoji 和背景精确符合设计", () => {
    expect(animals.cards.slice(16)).toEqual(expectedNewAnimals);
  });
});
