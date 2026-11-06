/**
 * @file flashcardSpeech.ts
 * @description 认图卡片整段朗读文本：单词三遍加分类例句，一次交给 TTS 合成
 */

import type { FlashcardCategoryId } from "../model/flashcard";

const UNCOUNTABLE_WORDS = new Set([
  "bread",
  "rice",
  "water",
  "milk",
  "juice",
  "tea",
  "coffee",
  "lemonade",
  "soda",
]);

export function buildFlashcardSpeechText(
  category: FlashcardCategoryId,
  word: string
): string {
  const repeated = `${word}, ${word}, ${word}.`;
  const article = /^[aeiou]/i.test(word) ? "an" : "a";
  switch (category) {
    case "animals":
    case "shapes":
    case "transport":
    case "fruits":
    case "vegetables":
    case "food":
    case "drinks":
    case "clothing":
    case "school":
    case "toys":
    case "furniture":
    case "appliances":
    case "kitchen":
    case "bathroom":
      if (UNCOUNTABLE_WORDS.has(word)) {
        return `${repeated} This is ${word}.`;
      }
      return `${repeated} This is ${article} ${word}.`;
    case "colors":
      return `${repeated} This is ${word}.`;
    case "actions":
      return `${repeated} I can ${word}.`;
  }
}
