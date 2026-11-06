/**
 * @file flashcardExpansionTypes.ts
 * @description 认图卡片扩充测试夹具的词条、图案和背景元组类型
 */

import type { FlashcardArt } from "../flashcard";

export type ExpansionEntry = readonly [
  word: string,
  art: FlashcardArt,
  background: readonly [string, string],
];
