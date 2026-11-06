/**
 * @file flashcardHome.ts
 * @description 认图卡片分类首页：固定分类顺序、数量与单分类异常降级
 */

import {
  FLASHCARD_CATEGORY_IDS,
  FLASHCARD_CATEGORY_META,
  type FlashcardCategoryId,
  type FlashcardDeck,
} from "../model/flashcard";

const CATEGORY_BACKGROUNDS: Record<FlashcardCategoryId, [string, string]> = {
  animals: ["#fff4d6", "#ffd7a8"],
  shapes: ["#e2f4ff", "#b9dcf5"],
  colors: ["#f0e6ff", "#d6c1f5"],
  actions: ["#e5f8ed", "#bce6cc"],
  transport: ["#e2f4ff", "#b9dcf5"],
  fruits: ["#fff0f5", "#f6c9da"],
  vegetables: ["#e5f8ed", "#bce6cc"],
  food: ["#fff4d6", "#ffd7a8"],
  drinks: ["#e0f7fa", "#b2ebf2"],
  clothing: ["#f0e6ff", "#d6c1f5"],
  school: ["#fff8d9", "#f3e2a4"],
  toys: ["#fff0e1", "#ffcfbf"],
  furniture: ["#f3eadf", "#dfc3a5"],
  appliances: ["#f0f0f5", "#d5d5e2"],
  kitchen: ["#fff0e1", "#ffcfbf"],
  bathroom: ["#e2f4ff", "#b9dcf5"],
};

export interface FlashcardHomeHandlers {
  onOpenCategory(category: FlashcardCategoryId): void;
}

export function renderFlashcardHome(
  title: HTMLElement,
  subtitle: HTMLElement,
  grid: HTMLElement,
  decks: ReadonlyMap<FlashcardCategoryId, FlashcardDeck>,
  invalidCategories: ReadonlySet<FlashcardCategoryId>,
  handlers: FlashcardHomeHandlers
): void {
  title.textContent = "认图卡片";
  subtitle.hidden = false;
  subtitle.textContent = invalidCategories.size > 0
    ? "部分分类数据加载失败，请检查卡片数据"
    : "选择一个分类，开始看图、听音、猜单词";
  grid.textContent = "";
  grid.className = "flashcard-category-grid";

  for (const id of FLASHCARD_CATEGORY_IDS) {
    const meta = FLASHCARD_CATEGORY_META[id];
    const deck = decks.get(id);
    const invalid = invalidCategories.has(id) || !deck;
    const [from, to] = CATEGORY_BACKGROUNDS[id];

    const card = document.createElement("button");
    card.type = "button";
    card.className = "flashcard-category-card";
    card.style.background = `linear-gradient(145deg, ${from}, ${to})`;
    card.disabled = invalid;
    card.setAttribute("aria-label", invalid ? `${meta.name}，暂不可用` : `打开${meta.name}卡片`);

    const emoji = document.createElement("span");
    emoji.className = "flashcard-category-emoji";
    emoji.textContent = meta.emoji;
    const name = document.createElement("span");
    name.className = "flashcard-category-name";
    name.textContent = meta.name;
    const count = document.createElement("span");
    count.className = "flashcard-category-count";
    count.textContent = deck && !invalid ? `${deck.cards.length} 张卡片` : "暂不可用";

    card.append(emoji, name, count);
    if (!invalid) card.addEventListener("click", () => handlers.onOpenCategory(id));
    grid.appendChild(card);
  }
}
