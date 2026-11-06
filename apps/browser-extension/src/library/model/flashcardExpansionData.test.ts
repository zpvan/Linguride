/**
 * @file flashcardExpansionData.test.ts
 * @description 逐批精确校验认图卡片新增后缀、完整数量与分类内图案唯一性
 */

import { describe, expect, it } from "vitest";

import actions from "../data/flashcards/actions.json";
import clothing from "../data/flashcards/clothing.json";
import colors from "../data/flashcards/colors.json";
import drinks from "../data/flashcards/drinks.json";
import food from "../data/flashcards/food.json";
import fruits from "../data/flashcards/fruits.json";
import school from "../data/flashcards/school.json";
import shapes from "../data/flashcards/shapes.json";
import toys from "../data/flashcards/toys.json";
import vegetables from "../data/flashcards/vegetables.json";
import { basicExpansion } from "./__fixtures__/flashcardBasicExpansion";
import { dailyExpansion } from "./__fixtures__/flashcardDailyExpansion";
import type { ExpansionEntry } from "./__fixtures__/flashcardExpansionTypes";
import { foodExpansion } from "./__fixtures__/flashcardFoodExpansion";
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

describe("第二批饮食认图卡片", () => {
  it("水果、蔬菜、食物、饮品各补足 32 张", () => {
    expectExpansion(fruits, "fruits", foodExpansion.fruits);
    expectExpansion(vegetables, "vegetables", foodExpansion.vegetables);
    expectExpansion(food, "food", foodExpansion.food);
    expectExpansion(drinks, "drinks", foodExpansion.drinks);
  });
});

describe("第三批日常物品认图卡片", () => {
  it("衣物、学习用品、玩具各补足 32 张", () => {
    expectExpansion(clothing, "clothing", dailyExpansion.clothing);
    expectExpansion(school, "school", dailyExpansion.school);
    expectExpansion(toys, "toys", dailyExpansion.toys);
  });
});
