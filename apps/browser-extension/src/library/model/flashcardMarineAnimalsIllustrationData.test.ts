/**
 * @file flashcardMarineAnimalsIllustrationData.test.ts
 * @description 海洋动物定制 SVG 的词条、资源完整性、唯一性与安全检查
 */

import { describe, expect, it } from "vitest";

import marineAnimals from "../data/flashcards/marine-animals.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";
import { marineAnimalsExpansion } from "./__fixtures__/flashcardMarineAnimalsExpansion";

const EXPECTED_IDS = new Set(marineAnimalsExpansion.map(([word]) => `marine-animals-${word.replace(/ /g, "-")}`));

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

describe("海洋动物定制 SVG", () => {
  it("32 个海洋动物词条都有同名安全插画", () => {
    expect(marineAnimals.id).toBe("marine-animals");
    expect(marineAnimals.cards).toHaveLength(32);
    for (const card of marineAnimals.cards) {
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
    const svgs = marineAnimals.cards.map((card) => getFlashcardIllustration(card.id));
    expect(new Set(svgs).size).toBe(32);
  });
});
