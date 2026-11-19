/**
 * @file flashcardArt.ts
 * @description 本地认图卡片 SVG 资源索引、查询与 deck 完整性检查
 */

import type { FlashcardDeck } from "../model/flashcard";

const modules = import.meta.glob("./flashcards/*/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const FLASHCARD_ILLUSTRATIONS: ReadonlyMap<string, string> = new Map(
  Object.entries(modules).map(([path, svg]) => {
    const filename = path.split("/").pop();
    if (!filename) throw new Error(`非法插画路径：${path}`);
    return [filename.slice(0, -4), svg];
  })
);

export function getFlashcardIllustration(cardId: string): string | undefined {
  return FLASHCARD_ILLUSTRATIONS.get(cardId);
}

export function hasCompleteFlashcardIllustrations(deck: FlashcardDeck): boolean {
  return deck.cards.every(
    (card) => card.art.kind !== "illustration" || FLASHCARD_ILLUSTRATIONS.has(card.art.illustration)
  );
}
