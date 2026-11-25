/**
 * @file flashcardIllustrationData.test.ts
 * @description 第一批定制 SVG 的词条引用、资源完整性与内容安全检查
 */

import { describe, expect, it } from "vitest";

import actions from "../data/flashcards/actions.json";
import shapes from "../data/flashcards/shapes.json";
import transport from "../data/flashcards/transport.json";
import {
  getFlashcardIllustration,
  hasCompleteFlashcardIllustrations,
} from "../assets/flashcardArt";
import type { FlashcardDeck } from "./flashcard";

const FIRST_BATCH_IDS = new Set([
  "shapes-octagon", "shapes-cube", "shapes-sphere", "shapes-cone", "shapes-cylinder", "shapes-pyramid", "shapes-prism",
  "shapes-right-triangle", "shapes-zigzag",
  "actions-eat", "actions-drink", "actions-read", "actions-sit",
  "actions-wake-up", "actions-get-up", "actions-go", "actions-come",
  "actions-listen", "actions-watch", "actions-ask", "actions-answer",
  "actions-open", "actions-close",
  "transport-school-bus", "transport-monorail", "transport-kayak",
  "transport-bulldozer", "transport-excavator", "transport-camper",
]);
const decks = { shapes, actions, transport };

function expectSafeSvg(svg: string, cardId: string): void {
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

describe("第一批定制 SVG 插画", () => {
  it("词条引用与资源一一对应且内容安全", () => {
    for (const deck of Object.values(decks)) {
      for (const card of deck.cards) {
        if (!FIRST_BATCH_IDS.has(card.id)) {
          expect(card.art.kind).not.toBe("illustration");
          continue;
        }
        expect(card.art).toEqual({ kind: "illustration", illustration: card.id });
        const svg = getFlashcardIllustration(card.id);
        expect(svg, `${card.id} 缺少 SVG`).toBeDefined();
        if (!svg) throw new Error(`${card.id} 缺少 SVG`);
        expectSafeSvg(svg, card.id);
      }
    }
  });

  it("同分类没有重复构图", () => {
    for (const [category, deck] of Object.entries(decks)) {
      const svgs = deck.cards
        .filter((card) => FIRST_BATCH_IDS.has(card.id))
        .map((card) => getFlashcardIllustration(card.id));
      expect(new Set(svgs).size, `${category} 插画重复`).toBe(svgs.length);
    }
  });

  it("交通工具不再同时教授 subway 和 metro", () => {
    const words = new Set(transport.cards.map((card) => card.word));
    expect(words.has("metro")).toBe(false);
    expect(words.has("subway")).toBe(true);
    expect(words.has("monorail")).toBe(true);
    for (const retained of ["car", "taxi", "ship", "boat", "canoe", "kayak", "bulldozer", "excavator"]) {
      expect(words.has(retained)).toBe(true);
    }
  });

  it("动作不再并排使用难以区分的感知和说话近义词", () => {
    const words = new Set(actions.cards.map((card) => card.word));
    for (const removed of ["see", "hear", "talk"]) expect(words.has(removed)).toBe(false);
    for (const added of ["point", "smell", "wave"]) expect(words.has(added)).toBe(true);
    for (const retained of ["look", "watch", "listen", "speak", "wake up", "get up", "go", "come", "ask", "answer"]) {
      expect(words.has(retained)).toBe(true);
    }
  });

  it("形状使用几何图形而非不相关物品", () => {
    const words = new Set(shapes.cards.map((card) => card.word));
    expect(words.has("frame")).toBe(false);
    expect(words.has("right triangle")).toBe(true);
    for (const upgraded of ["octagon", "cube", "sphere", "cone", "cylinder", "prism", "zigzag"]) {
      const card = shapes.cards.find((item) => item.word === upgraded);
      expect(card?.art).toEqual({ kind: "illustration", illustration: `shapes-${upgraded.replace(/ /g, "-")}` });
    }
  });

  it("deck 完整时通过，缺少资源时拒绝", () => {
    expect(hasCompleteFlashcardIllustrations(shapes as unknown as FlashcardDeck)).toBe(true);
    const missing = JSON.parse(JSON.stringify(shapes)) as FlashcardDeck;
    missing.cards[0].art = { kind: "illustration", illustration: "missing" };
    expect(hasCompleteFlashcardIllustrations(missing)).toBe(false);
  });
});
