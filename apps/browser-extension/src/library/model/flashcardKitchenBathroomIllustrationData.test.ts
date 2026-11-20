/**
 * @file flashcardKitchenBathroomIllustrationData.test.ts
 * @description 厨房、浴室SVG资源检查与全部224张定制插画完成度验证
 */

import { describe, expect, it } from "vitest";

import actions from "../data/flashcards/actions.json";
import animals from "../data/flashcards/animals.json";
import appliances from "../data/flashcards/appliances.json";
import bathroom from "../data/flashcards/bathroom.json";
import clothing from "../data/flashcards/clothing.json";
import colors from "../data/flashcards/colors.json";
import drinks from "../data/flashcards/drinks.json";
import food from "../data/flashcards/food.json";
import fruits from "../data/flashcards/fruits.json";
import furniture from "../data/flashcards/furniture.json";
import kitchen from "../data/flashcards/kitchen.json";
import school from "../data/flashcards/school.json";
import shapes from "../data/flashcards/shapes.json";
import toys from "../data/flashcards/toys.json";
import transport from "../data/flashcards/transport.json";
import vegetables from "../data/flashcards/vegetables.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";

const TARGET_IDS = new Set([
  "kitchen-ladle", "kitchen-spatula", "kitchen-whisk", "kitchen-tongs", "kitchen-peeler", "kitchen-grater",
  "kitchen-cutting-board", "kitchen-mixing-bowl", "kitchen-saucepan", "kitchen-skillet", "kitchen-kettle",
  "kitchen-lid", "kitchen-oven-mitt", "kitchen-apron", "kitchen-napkin", "kitchen-placemat", "kitchen-tray",
  "kitchen-teapot", "kitchen-coffee-pot", "kitchen-measuring-cup", "kitchen-measuring-spoon", "kitchen-strainer", "kitchen-colander",
  "bathroom-towel", "bathroom-bath-towel", "bathroom-hand-towel", "bathroom-washcloth", "bathroom-bath-mat",
  "bathroom-shower-curtain", "bathroom-showerhead", "bathroom-sink", "bathroom-tissue", "bathroom-toothpaste",
  "bathroom-mouthwash", "bathroom-shampoo", "bathroom-conditioner", "bathroom-body-wash", "bathroom-hand-soap",
  "bathroom-sanitizer", "bathroom-lotion", "bathroom-cream", "bathroom-shaving-cream", "bathroom-hairbrush",
  "bathroom-cotton-swab", "bathroom-cotton-ball",
]);
const decks = { kitchen, bathroom };

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

describe("厨房与浴室定制 SVG", () => {
  it("只将45个目标词条连接到同名安全资源", () => {
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
    expect(count).toBe(45);
  });

  it("同分类没有完全相同的 SVG", () => {
    for (const deck of Object.values(decks)) {
      const svgs = deck.cards.filter((card) => TARGET_IDS.has(card.id)).map((card) => getFlashcardIllustration(card.id));
      expect(new Set(svgs).size).toBe(svgs.length);
    }
  });

  it("全部224张组合Emoji已替换且16类仍为512张", () => {
    const allDecks = { animals, shapes, colors, actions, transport, fruits, vegetables, food, drinks, clothing, school, toys, furniture, appliances, kitchen, bathroom };
    const cards = Object.values(allDecks).flatMap((deck) => deck.cards);
    expect(cards).toHaveLength(512);
    expect(Object.values(allDecks).every((deck) => deck.cards.length === 32)).toBe(true);
    expect(cards.filter((card) => card.art.kind === "illustration")).toHaveLength(224);
  });
});
