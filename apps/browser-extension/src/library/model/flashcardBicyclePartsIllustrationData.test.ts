/**
 * @file flashcardBicyclePartsIllustrationData.test.ts
 * @description 自行车零部件定制 SVG 的词条、资源完整性、唯一性与安全检查
 */

import { describe, expect, it } from "vitest";

import bicycleParts from "../data/flashcards/bicycle-parts.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";
import { bicyclePartsExpansion } from "./__fixtures__/flashcardBicyclePartsExpansion";

const EXPECTED_IDS = new Set(bicyclePartsExpansion.map(([word]) => `bicycle-parts-${word.replace(/ /g, "-")}`));

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
  for (const match of svg.matchAll(/<(?:path|g|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/g)) {
    const tag = match[0];
    if (/\bstroke\s*=/.test(tag)) expect(/\bfill\s*=/.test(tag), `${cardId} 描边元素缺少 fill`).toBe(true);
  }
}

describe("自行车零部件定制 SVG", () => {
  it("32 个零部件都有同名安全插画", () => {
    expect(bicycleParts.id).toBe("bicycle-parts");
    expect(bicycleParts.cards).toHaveLength(32);
    for (const card of bicycleParts.cards) {
      expect(EXPECTED_IDS.has(card.id)).toBe(true);
      expect(card.art).toEqual({ kind: "illustration", illustration: card.id });
      const svg = getFlashcardIllustration(card.id);
      expect(svg, `${card.id} 缺少 SVG`).toBeDefined();
      if (!svg) throw new Error(`${card.id} 缺少 SVG`);
      expectSafeSvg(svg, card.id);
    }
    expect(EXPECTED_IDS.size).toBe(32);
  });

  it("没有完全相同的 SVG", () => {
    const svgs = bicycleParts.cards.map((card) => getFlashcardIllustration(card.id));
    expect(new Set(svgs).size).toBe(32);
  });
});
