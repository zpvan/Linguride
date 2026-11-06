/**
 * @file flashcardSpeech.ts
 * @description 认图卡片整段朗读文本：单词三遍加分类例句，一次交给 TTS 合成
 */

import type { FlashcardCategoryId } from "../model/flashcard";

export function buildFlashcardSpeechText(
  category: FlashcardCategoryId,
  word: string
): string {
  const repeated = `${word}, ${word}, ${word}.`;
  switch (category) {
    case "animals":
    case "shapes":
      return `${repeated} This is a ${word}.`;
    case "colors":
      return `${repeated} This is ${word}.`;
    case "actions":
      return `${repeated} I can ${word}.`;
  }
}
