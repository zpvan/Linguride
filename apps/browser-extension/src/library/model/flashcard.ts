/**
 * @file flashcard.ts
 * @description 文库认图卡片的数据模型、固定分类元数据与运行时守卫
 */

export const FLASHCARD_CATEGORY_IDS = ["animals", "shapes", "colors", "actions"] as const;
export type FlashcardCategoryId = (typeof FLASHCARD_CATEGORY_IDS)[number];

export const FLASHCARD_SHAPES = [
  "circle",
  "square",
  "triangle",
  "rectangle",
  "oval",
  "star",
  "heart",
  "diamond",
] as const;
export type FlashcardShape = (typeof FLASHCARD_SHAPES)[number];

export type FlashcardArt =
  | { kind: "emoji"; emoji: string }
  | { kind: "vector"; shape: FlashcardShape; color: string };

export interface Flashcard {
  id: string;
  word: string;
  art: FlashcardArt;
  background: [string, string];
}

export interface FlashcardDeck {
  schemaVersion: 1;
  id: FlashcardCategoryId;
  cards: Flashcard[];
}

export const FLASHCARD_CATEGORY_META: Record<
  FlashcardCategoryId,
  { name: string; emoji: string }
> = {
  animals: { name: "动物", emoji: "🐱" },
  shapes: { name: "形状", emoji: "🔷" },
  colors: { name: "颜色", emoji: "🎨" },
  actions: { name: "动作", emoji: "🏃" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isFlashcardCategoryId(value: unknown): value is FlashcardCategoryId {
  return (
    typeof value === "string" &&
    (FLASHCARD_CATEGORY_IDS as readonly string[]).includes(value)
  );
}

function isFlashcardArt(value: unknown): value is FlashcardArt {
  if (!isRecord(value)) return false;
  if (value.kind === "emoji") {
    return typeof value.emoji === "string" && value.emoji.trim().length > 0;
  }
  return (
    value.kind === "vector" &&
    typeof value.shape === "string" &&
    (FLASHCARD_SHAPES as readonly string[]).includes(value.shape) &&
    isHexColor(value.color)
  );
}

export function isFlashcardDeck(value: unknown): value is FlashcardDeck {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isFlashcardCategoryId(value.id) ||
    !Array.isArray(value.cards) ||
    value.cards.length === 0
  ) {
    return false;
  }

  const ids = new Set<string>();
  const words = new Set<string>();
  for (const card of value.cards) {
    if (
      !isRecord(card) ||
      typeof card.id !== "string" ||
      typeof card.word !== "string" ||
      !/^[a-z]+$/.test(card.word) ||
      card.id !== `${value.id}-${card.word}` ||
      !isFlashcardArt(card.art) ||
      !Array.isArray(card.background) ||
      card.background.length !== 2 ||
      !card.background.every(isHexColor) ||
      ids.has(card.id) ||
      words.has(card.word)
    ) {
      return false;
    }
    ids.add(card.id);
    words.add(card.word);
  }
  return true;
}
