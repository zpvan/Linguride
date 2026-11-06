import { describe, expect, it } from "vitest";

import appliances from "../data/flashcards/appliances.json";
import bathroom from "../data/flashcards/bathroom.json";
import clothing from "../data/flashcards/clothing.json";
import drinks from "../data/flashcards/drinks.json";
import food from "../data/flashcards/food.json";
import fruits from "../data/flashcards/fruits.json";
import furniture from "../data/flashcards/furniture.json";
import kitchen from "../data/flashcards/kitchen.json";
import school from "../data/flashcards/school.json";
import toys from "../data/flashcards/toys.json";
import transport from "../data/flashcards/transport.json";
import vegetables from "../data/flashcards/vegetables.json";
import { isFlashcardDeck, type FlashcardCategoryId } from "./flashcard";

const decks = {
  transport,
  fruits,
  vegetables,
  food,
  drinks,
  clothing,
  school,
  toys,
  furniture,
  appliances,
  kitchen,
  bathroom,
};

const expectedWords: Record<string, string[]> = {
  transport: ["car", "bus", "taxi", "train", "airplane", "ship", "bicycle", "motorcycle"],
  fruits: ["apple", "banana", "orange", "pear", "peach", "grape", "watermelon", "strawberry"],
  vegetables: ["carrot", "tomato", "potato", "cucumber", "onion", "pepper", "pumpkin", "mushroom"],
  food: ["egg", "bread", "rice", "noodle", "sandwich", "burger", "pizza", "salad"],
  drinks: ["water", "milk", "juice", "tea", "coffee", "lemonade", "smoothie", "soda"],
  clothing: ["shirt", "dress", "hat", "coat"],
  school: ["pencil", "pen", "book", "ruler"],
  toys: ["ball", "doll", "robot", "kite"],
  furniture: ["chair", "table", "bed", "sofa", "lamp", "door", "window", "mirror"],
  appliances: ["television", "computer", "phone", "camera"],
  kitchen: ["cup", "plate", "bowl", "spoon"],
  bathroom: ["soap", "towel", "toothbrush", "shower"],
};

const expectedEmoji: Record<string, string[]> = {
  transport: ["🚗", "🚌", "🚕", "🚆", "✈️", "🚢", "🚲", "🏍️"],
  fruits: ["🍎", "🍌", "🍊", "🍐", "🍑", "🍇", "🍉", "🍓"],
  vegetables: ["🥕", "🍅", "🥔", "🥒", "🧅", "🫑", "🎃", "🍄"],
  food: ["🥚", "🍞", "🍚", "🍜", "🥪", "🍔", "🍕", "🥗"],
  drinks: ["💧", "🥛", "🧃", "🍵", "☕", "🍋", "🥤", "🥤"],
  clothing: ["👕", "👗", "👒", "🧥"],
  school: ["✏️", "🖊️", "📖", "📏"],
  toys: ["⚽", "🪆", "🤖", "🪁"],
  furniture: ["🪑", "🪑🍽️", "🛏️", "🛋️", "💡", "🚪", "🪟", "🪞"],
  appliances: ["📺", "💻", "📱", "📷"],
  kitchen: ["☕", "🍽️", "🥣", "🥄"],
  bathroom: ["🧼", "🛁🧺", "🪥", "🚿"],
};

const expectedBackgrounds: Record<string, [string, string]> = {
  transport: ["#e2f4ff", "#b9dcf5"],
  fruits: ["#fff0f5", "#f6c9da"],
  vegetables: ["#e5f8ed", "#bce6cc"],
  food: ["#fff4d6", "#ffd7a8"],
  drinks: ["#e0f7fa", "#b2ebf2"],
  clothing: ["#f0e6ff", "#d6c1f5"],
  school: ["#fff8d9", "#f3e2a4"],
  toys: ["#fff0e1", "#ffcfbf"],
  furniture: ["#f3eadf", "#dfc3a5"],
  appliances: ["#f0f0f5", "#d5d5e2"],
  kitchen: ["#fff0e1", "#ffcfbf"],
  bathroom: ["#e2f4ff", "#b9dcf5"],
};

describe("常见物品分类正式数据", () => {
  it("12 个分类共 72 张，词条、Emoji、ID 和背景精确符合设计", () => {
    let total = 0;
    for (const [key, deck] of Object.entries(decks)) {
      const id = key as FlashcardCategoryId;
      expect(isFlashcardDeck(deck), `${id} 应通过守卫`).toBe(true);
      if (!isFlashcardDeck(deck)) continue;
      expect(deck.id).toBe(id);
      expect(deck.cards.map((card) => card.word)).toEqual(expectedWords[id]);
      expect(deck.cards.map((card) => card.id)).toEqual(
        expectedWords[id].map((word) => `${id}-${word}`)
      );
      expect(deck.cards.map((card) => card.art.kind)).toEqual(
        expectedWords[id].map(() => "emoji")
      );
      expect(deck.cards.map((card) => card.art.kind === "emoji" ? card.art.emoji : "")).toEqual(
        expectedEmoji[id]
      );
      expect(deck.cards.map((card) => card.background)).toEqual(
        expectedWords[id].map(() => expectedBackgrounds[id])
      );
      total += deck.cards.length;
    }
    expect(total).toBe(72);
    expect(64 + total).toBe(136);
  });
});
