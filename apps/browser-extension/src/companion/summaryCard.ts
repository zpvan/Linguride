/**
 * @file summaryCard.ts
 * @description 「语伴」课后总结卡渲染：整体点评 + 亮点/改进（可收藏）
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import {
  FavoriteItem,
  SummaryCard,
  SummaryHighlight,
  SummaryImprovement,
} from "../types/companion";
import { createCompanionId } from "./storage";

export interface SummaryCardCallbacks {
  onSaveFavorite: (item: FavoriteItem) => void;
  onPlayText: (text: string) => void;
  onNewChat: () => void;
}

function buildActionButton(
  label: string,
  title: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "link-btn";
  btn.textContent = label;
  btn.title = title;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderHighlightItem(
  item: SummaryHighlight,
  sourceTopic: string,
  callbacks: SummaryCardCallbacks
): HTMLElement {
  const row = document.createElement("div");
  row.className = "summary-item";
  const body = document.createElement("div");
  body.className = "summary-item-body";
  const en = document.createElement("div");
  en.className = "summary-item-en";
  en.textContent = item.en;
  const note = document.createElement("div");
  note.className = "summary-item-note";
  note.textContent = item.note;
  body.appendChild(en);
  body.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "summary-item-actions";
  actions.appendChild(
    buildActionButton("🔊", "朗读", () => callbacks.onPlayText(item.en))
  );
  actions.appendChild(
    buildActionButton("☆", "收藏", () =>
      callbacks.onSaveFavorite({
        id: createCompanionId("fav"),
        type: "highlight",
        en: item.en,
        note: item.note,
        sourceTopic,
        savedAt: Date.now(),
      })
    )
  );

  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

function renderImprovementItem(
  item: SummaryImprovement,
  sourceTopic: string,
  callbacks: SummaryCardCallbacks
): HTMLElement {
  const row = document.createElement("div");
  row.className = "summary-item";
  const body = document.createElement("div");
  body.className = "summary-item-body";
  const en = document.createElement("div");
  en.className = "summary-item-en";
  en.textContent = item.original;
  const better = document.createElement("div");
  better.className = "summary-item-better";
  better.textContent = `→ ${item.better}`;
  const note = document.createElement("div");
  note.className = "summary-item-note";
  note.textContent = item.note;
  body.appendChild(en);
  body.appendChild(better);
  body.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "summary-item-actions";
  actions.appendChild(
    buildActionButton("🔊", "朗读地道说法", () => callbacks.onPlayText(item.better))
  );
  actions.appendChild(
    buildActionButton("☆", "收藏", () =>
      callbacks.onSaveFavorite({
        id: createCompanionId("fav"),
        type: "improvement",
        en: item.original,
        better: item.better,
        note: item.note,
        sourceTopic,
        savedAt: Date.now(),
      })
    )
  );

  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

/** 把总结卡渲染到消息流末尾 */
export function renderSummaryCard(
  container: HTMLElement,
  summary: SummaryCard,
  sourceTopic: string,
  callbacks: SummaryCardCallbacks
): void {
  const card = document.createElement("div");
  card.className = "summary-card";

  const title = document.createElement("div");
  title.className = "summary-title";
  title.textContent = "📒 本次对话小结";
  card.appendChild(title);

  const comment = document.createElement("div");
  comment.className = "summary-comment";
  comment.textContent = summary.fluencyComment;
  card.appendChild(comment);

  if (summary.highlights.length > 0) {
    const label = document.createElement("div");
    label.className = "summary-section-label";
    label.textContent = "✨ 说得漂亮";
    card.appendChild(label);
    for (const item of summary.highlights) {
      card.appendChild(renderHighlightItem(item, sourceTopic, callbacks));
    }
  }

  if (summary.improvements.length > 0) {
    const label = document.createElement("div");
    label.className = "summary-section-label";
    label.textContent = "🌱 可以更地道";
    card.appendChild(label);
    for (const item of summary.improvements) {
      card.appendChild(renderImprovementItem(item, sourceTopic, callbacks));
    }
  }

  const footer = document.createElement("div");
  footer.className = "summary-new-chat";
  footer.appendChild(
    buildActionButton("开始新对话", "回到话题选择", callbacks.onNewChat)
  );
  card.appendChild(footer);

  container.appendChild(card);
}
