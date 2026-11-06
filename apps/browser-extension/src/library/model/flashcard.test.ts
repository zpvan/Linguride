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

  it.each([
    ["transport", "fire truck", "transport-fire-truck"],
    ["clothing", "t-shirt", "clothing-t-shirt"],
    ["toys", "yo-yo", "toys-yo-yo"],
    ["actions", "wake up", "actions-wake-up"],
  ] as const)("接受短语并归一化 ID：%s", (category, word, id) => {
    const deck = makeDeck();
    deck.id = category;
    deck.cards[0] = { ...deck.cards[0], id, word };
    expect(isFlashcardDeck(deck)).toBe(true);
  });

  it.each([
    ["fire  truck", "animals-fire--truck"],
    [" fire truck", "animals--fire-truck"],
    ["fire truck ", "animals-fire-truck-"],
    ["fire_truck", "animals-fire_truck"],
  ] as const)("拒绝非法分隔符：%s", (word, id) => {
    const deck = makeDeck();
    deck.cards[0] = { ...deck.cards[0], id, word };
    expect(isFlashcardDeck(deck)).toBe(false);
  });

  it("拒绝空格与连字符归一化后的重复 ID", () => {
    const deck = makeDeck();
    deck.id = "clothing";
    deck.cards = [
      { ...deck.cards[0], id: "clothing-t-shirt", word: "t-shirt" },
      { ...deck.cards[0], id: "clothing-t-shirt", word: "t shirt" },
    ];
    expect(isFlashcardDeck(deck)).toBe(false);
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
  it("按固定顺序覆盖十六个分类", () => {
    expect(FLASHCARD_CATEGORY_IDS).toEqual([
      "animals", "shapes", "colors", "actions", "transport", "fruits",
      "vegetables", "food", "drinks", "clothing", "school", "toys",
      "furniture", "appliances", "kitchen", "bathroom",
    ]);
    for (const id of FLASHCARD_CATEGORY_IDS) {
      expect(FLASHCARD_CATEGORY_META[id].name).toBeTruthy();
      expect(FLASHCARD_CATEGORY_META[id].emoji).toBeTruthy();
    }
  });
});
