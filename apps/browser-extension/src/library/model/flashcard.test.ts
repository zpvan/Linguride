import { describe, expect, it } from "vitest";

import {
  FLASHCARD_CATEGORY_IDS,
  FLASHCARD_CATEGORY_META,
  isFlashcardDeck,
  type FlashcardArt,
  type FlashcardDeck,
} from "./flashcard";

function makeDeck(): FlashcardDeck {
  return {
    schemaVersion: 1,
    id: "animals",
    cards: [
      {
        id: "animals-cat",
        word: "cat",
        art: { kind: "emoji", emoji: "🐱" },
        background: ["#fff4d6", "#ffd7a8"],
      },
    ],
  };
}

describe("isFlashcardDeck", () => {
  it("接受合法 Emoji 卡片", () => {
    expect(isFlashcardDeck(makeDeck())).toBe(true);
  });

  it("接受合法 vector 卡片", () => {
    const deck = makeDeck();
    deck.id = "shapes";
    deck.cards[0] = {
      id: "shapes-circle",
      word: "circle",
      art: { kind: "vector", shape: "circle", color: "#3b82f6" },
      background: ["#e2f4ff", "#b9dcf5"],
    };
    expect(isFlashcardDeck(deck)).toBe(true);
  });

  const invalidCases: Array<[string, (deck: FlashcardDeck) => void]> = [
    ["未知分类", (deck) => { (deck as { id: unknown }).id = "places"; }],
    ["schemaVersion 错误", (deck) => { (deck as { schemaVersion: number }).schemaVersion = 2; }],
    ["空 cards", (deck) => { deck.cards = []; }],
    ["大写单词", (deck) => { deck.cards[0].word = "Cat"; }],
    ["ID 与分类和单词不一致", (deck) => { deck.cards[0].id = "animals-dog"; }],
    ["背景不是六位 hex", (deck) => { deck.cards[0].background = ["red", "#ffd7a8"]; }],
    ["非法形状", (deck) => {
      deck.cards[0].art = {
        kind: "vector",
        shape: "hexagon",
        color: "#3b82f6",
      } as unknown as FlashcardArt;
    }],
    ["图案颜色不是六位 hex", (deck) => {
      deck.cards[0].art = { kind: "vector", shape: "circle", color: "red" };
    }],
    ["空 Emoji", (deck) => { deck.cards[0].art = { kind: "emoji", emoji: " " }; }],
    ["重复卡片", (deck) => { deck.cards.push({ ...deck.cards[0] }); }],
  ];

  it.each(invalidCases)("拒绝：%s", (_name, mutate) => {
    const deck = makeDeck();
    mutate(deck);
    expect(isFlashcardDeck(deck)).toBe(false);
  });
});

describe("FLASHCARD_CATEGORY_META", () => {
  it("按固定顺序覆盖四个分类", () => {
    expect(FLASHCARD_CATEGORY_IDS).toEqual(["animals", "shapes", "colors", "actions"]);
    for (const id of FLASHCARD_CATEGORY_IDS) {
      expect(FLASHCARD_CATEGORY_META[id].name).toBeTruthy();
      expect(FLASHCARD_CATEGORY_META[id].emoji).toBeTruthy();
    }
  });
});
