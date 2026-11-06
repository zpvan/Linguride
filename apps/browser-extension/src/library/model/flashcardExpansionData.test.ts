/**
 * @file flashcardExpansionData.test.ts
 * @description 逐批精确校验认图卡片新增后缀、完整数量与分类内图案唯一性
 */

import { describe, expect, it } from "vitest";

import actions from "../data/flashcards/actions.json";
import colors from "../data/flashcards/colors.json";
import shapes from "../data/flashcards/shapes.json";
import { basicExpansion } from "./__fixtures__/flashcardBasicExpansion";
import type { ExpansionEntry } from "./__fixtures__/flashcardExpansionTypes";
import { isFlashcardDeck, type FlashcardCategoryId } from "./flashcard";

function expectExpansion(
  value: unknown,
  category: FlashcardCategoryId,
  entries: readonly ExpansionEntry[]
): void {
  expect(isFlashcardDeck(value), `${category} 应通过守卫`).toBe(true);
  if (!isFlashcardDeck(value)) return;
  expect(value.id).toBe(category);
  expect(value.cards, `${category} 应有 32 张`).toHaveLength(32);
  expect(value.cards.slice(-entries.length)).toEqual(
    entries.map(([word, art, background]) => ({
      id: `${category}-${word.replace(/ /g, "-")}`,
      word,
      art,
      background,
    }))
  );
  expect(new Set(value.cards.map((card) => JSON.stringify(card.art))).size).toBe(32);
}

describe("第一批基础认图卡片", () => {
  it("形状、颜色、动作各补足 32 张", () => {
    expectExpansion(shapes, "shapes", basicExpansion.shapes);
    expectExpansion(colors, "colors", basicExpansion.colors);
    expectExpansion(actions, "actions", basicExpansion.actions);
  });
});
