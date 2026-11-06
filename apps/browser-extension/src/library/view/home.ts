/**
 * @file home.ts
 * @description 文库左侧顶层导航与故事首页渲染；认图卡片首页由独立组件负责
 */

import { getLibraryCategoryTitle, type LibraryIndex } from "../model/types";

export type LibraryHomeTab = "story" | "cards";

export interface LibraryNavHandlers {
  onOpenStories(): void;
  onOpenCards(): void;
}

function createNavItem(
  label: string,
  active: boolean,
  onClick: () => void
): HTMLButtonElement {
  const item = document.createElement("button");
  item.type = "button";
  item.className = `category-item${active ? " active" : ""}`;
  item.textContent = label;
  if (active) item.setAttribute("aria-current", "page");
  item.addEventListener("click", onClick);
  return item;
}

export function renderLibraryNav(
  nav: HTMLElement,
  active: LibraryHomeTab,
  handlers: LibraryNavHandlers
): void {
  nav.textContent = "";
  nav.append(
    createNavItem("📚 故事幻灯片", active === "story", handlers.onOpenStories),
    createNavItem("🖼️ 认图卡片", active === "cards", handlers.onOpenCards)
  );
}

export function renderStoryHome(
  title: HTMLElement,
  subtitle: HTMLElement,
  grid: HTMLElement,
  index: LibraryIndex,
  onOpenStory: (id: string) => void
): void {
  grid.textContent = "";
  grid.className = "story-grid";
  subtitle.hidden = true;
  subtitle.textContent = "";
  title.textContent = getLibraryCategoryTitle(index);

  for (const category of index.categories) {
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
      card.addEventListener("click", () => onOpenStory(meta.id));
      grid.appendChild(card);
    }
  }
}
