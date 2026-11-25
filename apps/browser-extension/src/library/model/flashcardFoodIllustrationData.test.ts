/**
 * @file flashcardFoodIllustrationData.test.ts
 * @description 水果、蔬菜与食物定制 SVG 的词条引用、资源完整性与内容安全检查
 */

import { describe, expect, it } from "vitest";

import food from "../data/flashcards/food.json";
import fruits from "../data/flashcards/fruits.json";
import vegetables from "../data/flashcards/vegetables.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";

const TARGET_IDS = new Set([
  "fruits-lime", "fruits-papaya", "fruits-cantaloupe", "fruits-plum",
  "fruits-apricot", "fruits-fig", "fruits-date", "fruits-pomegranate",
  "fruits-raspberry", "fruits-blackberry", "fruits-cranberry", "fruits-gooseberry",
  "fruits-passion-fruit", "fruits-dragon-fruit", "fruits-guava", "fruits-lychee",
  "vegetables-cauliflower", "vegetables-lettuce", "vegetables-spinach", "vegetables-kale",
  "vegetables-celery", "vegetables-asparagus", "vegetables-zucchini", "vegetables-radish",
  "vegetables-turnip", "vegetables-beet", "vegetables-chickpea", "vegetables-lentil",
  "vegetables-okra", "vegetables-artichoke", "vegetables-bok-choy",
  "food-yogurt", "food-jam", "food-peanut-butter", "food-cereal", "food-oatmeal",
  "food-toast", "food-sausage", "food-ham", "food-chicken", "food-pork", "food-lamb", "food-fish",
]);
const decks = { fruits, vegetables, food };

function expectSafeSvg(svg: string, cardId: string): void {
  expect(svg).toContain('viewBox="0 0 100 100"');
  expect(svg).not.toMatch(/<(?:script|text|image|foreignObject)\b/i);
  expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
  expect(svg).not.toMatch(/(?:href|src)\s*=/i);
  expect(svg).not.toMatch(/url\(\s*['"]?https?:/i);
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id.startsWith(`${cardId}-`)).toBe(true);
  for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) {
    expect(match[1].startsWith(`${cardId}-`)).toBe(true);
  }
}

describe("水果、蔬菜与食物定制 SVG 插画", () => {
  it("只将 43 个目标词条连接到同名安全资源", () => {
    let count = 0;
    for (const deck of Object.values(decks)) {
      for (const card of deck.cards) {
        if (!TARGET_IDS.has(card.id)) {
          expect(card.art.kind).not.toBe("illustration");
          continue;
        }
        count += 1;
        expect(card.art).toEqual({ kind: "illustration", illustration: card.id });
        const svg = getFlashcardIllustration(card.id);
        expect(svg, `${card.id} 缺少 SVG`).toBeDefined();
        if (!svg) throw new Error(`${card.id} 缺少 SVG`);
        expectSafeSvg(svg, card.id);
      }
    }
    expect(count).toBe(43);
  });

  it("同分类没有完全相同的 SVG", () => {
    for (const [category, deck] of Object.entries(decks)) {
      const svgs = deck.cards
        .filter((card) => TARGET_IDS.has(card.id))
        .map((card) => getFlashcardIllustration(card.id));
      expect(new Set(svgs).size, `${category} 插画内容完全相同`).toBe(svgs.length);
    }
  });

  it("食物不再用热狗、鸡腿或带骨肉代替大类", () => {
    for (const upgraded of ["sausage", "ham", "chicken"]) {
      const card = food.cards.find((item) => item.word === upgraded);
      expect(card?.art).toEqual({ kind: "illustration", illustration: `food-${upgraded}` });
    }
    for (const retained of ["bread", "toast", "cereal", "oatmeal", "beef", "pork", "lamb", "fish"]) {
      expect(food.cards.some((card) => card.word === retained)).toBe(true);
    }
  });

  it("蔬菜不再重复教授甜椒", () => {
    const words = new Set(vegetables.cards.map((card) => card.word));
    expect(words.has("bell pepper")).toBe(false);
    expect(words.has("okra")).toBe(true);
    for (const retained of ["pepper", "chili", "lettuce", "spinach", "kale", "celery", "asparagus", "zucchini", "cucumber"]) {
      expect(words.has(retained)).toBe(true);
    }
  });
});
