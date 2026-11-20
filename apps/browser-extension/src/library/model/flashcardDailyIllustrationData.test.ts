/**
 * @file flashcardDailyIllustrationData.test.ts
 * @description 衣物、学习用品与玩具定制 SVG 的词条引用、资源与线稿检查
 */

import { describe, expect, it } from "vitest";

import clothing from "../data/flashcards/clothing.json";
import school from "../data/flashcards/school.json";
import toys from "../data/flashcards/toys.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";

const TARGET_IDS = new Set([
  "clothing-t-shirt", "clothing-skirt", "clothing-sweater", "clothing-cardigan", "clothing-hoodie",
  "clothing-jacket", "clothing-blazer", "clothing-raincoat", "clothing-overcoat", "clothing-mitten",
  "clothing-slipper", "clothing-beanie", "clothing-belt",
  "school-marker", "school-highlighter", "school-chalk", "school-eraser", "school-sharpener",
  "school-pencil-case", "school-pencil-box", "school-workbook", "school-dictionary", "school-storybook",
  "school-comic-book", "school-library-card", "school-water-bottle", "school-tape", "school-calculator",
  "toys-stuffed-animal", "toys-toy-car", "toys-toy-plane", "toys-building-set", "toys-spinning-top",
  "toys-hula-hoop", "toys-jump-rope", "toys-bubble-wand", "toys-rattle", "toys-pacifier",
  "toys-rocking-horse", "toys-tricycle", "toys-wagon", "toys-swing", "toys-seesaw", "toys-sandbox",
]);
const decks = { clothing, school, toys };

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
    if (/\bstroke\s*=/.test(tag)) expect(/\bfill\s*=/.test(tag), `${cardId} 描边元素缺少 fill`).toBe(true);
  }
}

describe("衣物、学习用品与玩具定制 SVG", () => {
  it("只将 44 个目标词条连接到同名安全资源", () => {
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
    expect(count).toBe(44);
  });

  it("同分类没有完全相同的 SVG", () => {
    for (const deck of Object.values(decks)) {
      const svgs = deck.cards.filter((card) => TARGET_IDS.has(card.id)).map((card) => getFlashcardIllustration(card.id));
      expect(new Set(svgs).size).toBe(svgs.length);
    }
  });
});
