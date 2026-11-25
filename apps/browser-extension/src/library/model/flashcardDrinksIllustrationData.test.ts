/**
 * @file flashcardDrinksIllustrationData.test.ts
 * @description 饮品定制 SVG 的词条引用、资源完整性与内容安全检查
 */

import { describe, expect, it } from "vitest";

import drinks from "../data/flashcards/drinks.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";

const TARGET_IDS = new Set([
  "drinks-smoothie", "drinks-soda", "drinks-mineral-water", "drinks-sparkling-water",
  "drinks-milkshake", "drinks-sports-drink", "drinks-coconut-water", "drinks-orange-juice",
  "drinks-apple-juice", "drinks-grape-juice", "drinks-iced-tea", "drinks-iced-coffee",
  "drinks-milk-tea", "drinks-green-tea", "drinks-black-tea", "drinks-herbal-tea",
  "drinks-hot-chocolate", "drinks-cappuccino", "drinks-latte", "drinks-espresso",
  "drinks-energy-drink", "drinks-hot-cider", "drinks-soy-milk", "drinks-tomato-juice", "drinks-pear-juice",
]);

function expectSafeSvg(svg: string, cardId: string): void {
  expect(svg).toContain('viewBox="0 0 100 100"');
  expect(svg).not.toMatch(/<(?:script|text|image|foreignObject)\b/i);
  expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
  expect(svg).not.toMatch(/(?:href|src)\s*=/i);
  expect(svg).not.toMatch(/@import|url\(\s*['"]?(?:https?:|\/\/|data:|file:)/i);
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id.startsWith(`${cardId}-`)).toBe(true);
  for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) {
    expect(match[1].startsWith(`${cardId}-`)).toBe(true);
    expect(ids).toContain(match[1]);
  }
  for (const match of svg.matchAll(/<(?:path|g)\b[^>]*>/g)) {
    const tag = match[0];
    if (/\bstroke\s*=/.test(tag)) {
      expect(/\bfill\s*=/.test(tag), `${cardId} 描边元素缺少显式 fill：${tag}`).toBe(true);
    }
  }
}

describe("饮品定制 SVG 插画", () => {
  it("只将 25 个目标词条连接到同名安全资源", () => {
    let count = 0;
    for (const card of drinks.cards) {
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
    expect(count).toBe(25);
  });

  it("没有完全相同的 SVG", () => {
    const svgs = drinks.cards
      .filter((card) => TARGET_IDS.has(card.id))
      .map((card) => getFlashcardIllustration(card.id));
    expect(new Set(svgs).size).toBe(svgs.length);
  });

  it("饮品不再用包装或温度重复教授相似概念", () => {
    const words = new Set(drinks.cards.map((card) => card.word));
    for (const removed of ["soda water", "tonic water", "americano", "mocha", "hot water", "cold water", "warm water"]) {
      expect(words.has(removed)).toBe(false);
    }
    for (const added of ["milkshake", "sports drink", "energy drink", "hot cider", "soy milk", "tomato juice", "pear juice"]) {
      expect(words.has(added)).toBe(true);
    }
    for (const retained of ["water", "mineral water", "sparkling water", "coffee", "cappuccino", "latte", "espresso"]) {
      expect(words.has(retained)).toBe(true);
    }
  });
});
