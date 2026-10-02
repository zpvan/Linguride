/**
 * @file topicPanel.ts
 * @description 「语伴」左侧栏面板渲染：话题卡 / 历史 / 收藏
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { CompanionSession, FavoriteItem, TopicCard } from "../types/companion";

export interface TopicCardsOptions {
  onPick: (topic: TopicCard) => void;
  activeId: string | null;
}

/** 渲染话题卡列表 */
export function renderTopicCards(
  container: HTMLElement,
  topics: TopicCard[],
  options: TopicCardsOptions
): void {
  container.innerHTML = "";
  for (const topic of topics) {
    const card = document.createElement("button");
    card.className =
      "topic-card" + (topic.id === options.activeId ? " active" : "");
    card.dataset.topicId = topic.id;

    const title = document.createElement("span");
    title.className = "topic-card-title";
    title.textContent = topic.titleZh;
    const opener = document.createElement("span");
    opener.className = "topic-card-opener";
    opener.textContent = topic.openerEn || topic.titleEn;

    card.appendChild(title);
    card.appendChild(opener);
    card.addEventListener("click", () => options.onPick(topic));
    container.appendChild(card);
  }
}

// ====== 历史对话 ======

export interface HistoryListOptions {
  onOpen: (session: CompanionSession) => void;
}

/** 渲染历史对话列表（只读回看入口） */
export function renderHistoryList(
  container: HTMLElement,
  sessions: CompanionSession[],
  options: HistoryListOptions
): void {
  container.innerHTML = "";
  if (sessions.length === 0) {
    container.innerHTML =
      '<div class="record-empty">还没有历史对话，去聊一场吧</div>';
    return;
  }
  for (const session of sessions) {
    const item = document.createElement("div");
    item.className = "record-item";

    const title = document.createElement("div");
    title.className = "record-item-title";
    title.textContent = session.topic.titleZh;

    const meta = document.createElement("div");
    meta.className = "record-item-meta";
    const userTurns = session.messages.filter((m) => m.role === "user").length;
    const date = new Date(session.endedAt);
    meta.textContent =
      `${date.toLocaleDateString("zh-CN")} · ${session.level} · ${userTurns} 句` +
      (session.summary ? " · 📒 有总结" : "");

    item.appendChild(title);
    item.appendChild(meta);
    item.addEventListener("click", () => options.onOpen(session));
    container.appendChild(item);
  }
}

// ====== 收藏 ======

export interface FavoritesListOptions {
  onPlay: (text: string) => void;
  onRemove: (id: string) => void;
}

/** 渲染收藏列表 */
export function renderFavoritesList(
  container: HTMLElement,
  favorites: FavoriteItem[],
  options: FavoritesListOptions
): void {
  container.innerHTML = "";
  if (favorites.length === 0) {
    container.innerHTML =
      '<div class="record-empty">还没有收藏——聊完一场，在总结卡里点 ☆</div>';
    return;
  }
  for (const fav of favorites) {
    const item = document.createElement("div");
    item.className = "record-item";

    const text = document.createElement("div");
    text.className = "record-item-text";
    text.textContent = fav.en;
    item.appendChild(text);

    if (fav.better) {
      const better = document.createElement("div");
      better.className = "record-item-text";
      better.style.color = "var(--success)";
      better.textContent = `→ ${fav.better}`;
      item.appendChild(better);
    }

    const note = document.createElement("div");
    note.className = "record-item-note";
    note.textContent = `${fav.note} · 来自「${fav.sourceTopic}」`;
    item.appendChild(note);

    const actions = document.createElement("div");
    actions.className = "record-item-actions";
    const play = document.createElement("button");
    play.className = "link-btn";
    play.textContent = "🔊 朗读";
    play.addEventListener("click", () => options.onPlay(fav.better ?? fav.en));
    const remove = document.createElement("button");
    remove.className = "link-btn link-danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => options.onRemove(fav.id));
    actions.appendChild(play);
    actions.appendChild(remove);
    item.appendChild(actions);

    container.appendChild(item);
  }
}
