/**
 * @file flashcardHomeIllustrationData.test.ts
 * @description 家具与家电定制 SVG 的词条引用、资源与线稿检查
 */

import { describe, expect, it } from "vitest";

import appliances from "../data/flashcards/appliances.json";
import furniture from "../data/flashcards/furniture.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";

const TARGET_IDS = new Set([
  "furniture-table", "furniture-coffee-table", "furniture-dining-table", "furniture-desk", "furniture-bookshelf",
  "furniture-bookcase", "furniture-cupboard", "furniture-drawer", "furniture-wardrobe", "furniture-closet",
  "furniture-rocking-chair", "furniture-stool", "furniture-bench", "furniture-ottoman", "furniture-nightstand",
  "furniture-dresser", "furniture-chest", "furniture-tv-stand", "furniture-shoe-rack", "furniture-coat-rack",
  "furniture-hanger", "furniture-cushion", "furniture-curtain",
  "appliances-refrigerator", "appliances-freezer", "appliances-washing-machine", "appliances-dryer",
  "appliances-dishwasher", "appliances-oven", "appliances-microwave", "appliances-stove", "appliances-rice-cooker",
  "appliances-pressure-cooker", "appliances-air-fryer", "appliances-blender", "appliances-juicer", "appliances-mixer",
  "appliances-toaster", "appliances-kettle", "appliances-coffee-maker", "appliances-fan", "appliances-air-conditioner",
  "appliances-heater", "appliances-humidifier", "appliances-dehumidifier", "appliances-air-purifier",
  "appliances-vacuum-cleaner", "appliances-iron", "appliances-hair-dryer",
]);
const decks = { furniture, appliances };

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

describe("家具与家电定制 SVG", () => {
  it("只将49个目标词条连接到同名安全资源", () => {
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
    expect(count).toBe(49);
  });

  it("同分类没有完全相同的 SVG", () => {
    for (const deck of Object.values(decks)) {
      const svgs = deck.cards.filter((card) => TARGET_IDS.has(card.id)).map((card) => getFlashcardIllustration(card.id));
      expect(new Set(svgs).size).toBe(svgs.length);
    }
  });
});
