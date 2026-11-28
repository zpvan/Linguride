/**
 * @file flashcard.ts
 * @description 文库认图卡片的数据模型、固定分类元数据与运行时守卫
 */

export const FLASHCARD_CATEGORY_IDS = [
  "animals",
  "shapes",
  "colors",
  "actions",
  "transport",
  "fruits",
  "vegetables",
  "food",
  "drinks",
  "clothing",
  "school",
  "toys",
  "furniture",
  "appliances",
  "kitchen",
  "bathroom",
  "sports",
  "bicycle-parts",
  "weather",
  "marine-animals",
  "jobs",
  "music",
  "places",
] as const;
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
  | { kind: "vector"; shape: FlashcardShape; color: string }
  | { kind: "illustration"; illustration: string };

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
  transport: { name: "交通工具", emoji: "🚗" },
  fruits: { name: "水果", emoji: "🍎" },
  vegetables: { name: "蔬菜", emoji: "🥕" },
  food: { name: "食物", emoji: "🍔" },
  drinks: { name: "饮品", emoji: "🥛" },
  clothing: { name: "衣物", emoji: "👕" },
  school: { name: "学习用品", emoji: "📚" },
  toys: { name: "玩具", emoji: "🪀" },
  furniture: { name: "家具", emoji: "🪑" },
  appliances: { name: "家电", emoji: "📺" },
  kitchen: { name: "厨房用品", emoji: "🍽️" },
  bathroom: { name: "浴室用品", emoji: "🛁" },
  sports: { name: "运动赛事", emoji: "🏆" },
  "bicycle-parts": { name: "自行车零部件", emoji: "🚲" },
  weather: { name: "天气气候", emoji: "🌦️" },
  "marine-animals": { name: "海洋动物", emoji: "🐋" },
  jobs: { name: "职业与工作", emoji: "💼" },
  music: { name: "乐器与音乐", emoji: "🎵" },
  places: { name: "城市与社区场所", emoji: "🏙️" },
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
  if (value.kind === "illustration") {
    return typeof value.illustration === "string" && /^[a-z]+(?:-[a-z]+)+$/.test(value.illustration);
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
      !/^[a-z]+(?:[ -][a-z]+)*$/.test(card.word) ||
      card.id !== `${value.id}-${card.word.replace(/ /g, "-")}` ||
      !isFlashcardArt(card.art) ||
      (card.art.kind === "illustration" && card.art.illustration !== card.id) ||
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
