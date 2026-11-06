/**
 * @file route.ts
 * @description 文库 hash 路由纯解析：故事首页/播放器与认图卡片分类/网格
 */

import { isFlashcardCategoryId, type FlashcardCategoryId } from "./flashcard";

export type LibraryRoute =
  | { kind: "storyHome" }
  | { kind: "storyPlayer"; storyId: string }
  | { kind: "cardsHome" }
  | { kind: "cardsCategory"; category: FlashcardCategoryId };

function decodePart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

export function parseLibraryRoute(hash: string): LibraryRoute {
  if (hash === "#/cards") return { kind: "cardsHome" };
  if (hash.startsWith("#/cards/")) {
    const match = /^#\/cards\/([^/]+)$/.exec(hash);
    const category = match ? decodePart(match[1]) : null;
    if (isFlashcardCategoryId(category)) {
      return { kind: "cardsCategory", category };
    }
    return { kind: "cardsHome" };
  }

  const storyMatch = /^#\/story\/([^/]+)$/.exec(hash);
  if (storyMatch) {
    const storyId = decodePart(storyMatch[1]);
    if (storyId) return { kind: "storyPlayer", storyId };
  }
  return { kind: "storyHome" };
}
