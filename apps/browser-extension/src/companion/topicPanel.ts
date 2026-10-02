/**
 * @file topicPanel.ts
 * @description 「语伴」左侧栏面板渲染：话题卡 / 历史 / 收藏
 *
 * 本文件当前实现话题卡渲染；历史与收藏渲染在后续任务补充。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { TopicCard } from "../types/companion";

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
