/**
 * @file home.ts
 * @description 资料库首页渲染：左侧分类导航 + 右侧剧集卡片网格
 */

import type { LibraryIndex } from "../model/types";

export interface HomeHandlers {
  onOpenStory(id: string): void;
}

export function renderHome(
  nav: HTMLElement,
  title: HTMLElement,
  grid: HTMLElement,
  index: LibraryIndex,
  handlers: HomeHandlers
): void {
  nav.textContent = "";
  grid.textContent = "";
  title.textContent = "";

  for (const category of index.categories) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "category-item active";
    item.textContent = `📚 ${category.name}`;
    nav.appendChild(item);

    title.textContent = category.name;
    for (const meta of category.items) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "story-card";

      const cover = document.createElement("span");
      cover.className = "story-card-emoji";
      cover.textContent = meta.emoji;

      const name = document.createElement("span");
      name.className = "story-card-title";
      name.textContent = meta.title;

      const sub = document.createElement("span");
      sub.className = "story-card-meta";
      sub.textContent = `Ep.${meta.episode} · ${meta.sceneCount} 场景 · ${meta.lineCount} 句`;

      card.append(cover, name, sub);
      card.addEventListener("click", () => handlers.onOpenStory(meta.id));
      grid.appendChild(card);
    }
  }
}
