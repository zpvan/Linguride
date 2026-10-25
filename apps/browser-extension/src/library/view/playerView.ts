/**
 * @file playerView.ts
 * @description 资料库播放器渲染：全剧滚动阅读（intro 卡 → 场景小节+台词行 → 儿歌 → 结尾卡）
 */

import { SPEAKER_EMOJI, type Story, type StoryLine } from "../model/types";
import { hasNonCollapsedTextSelection } from "../player/interaction";

export interface PlayerViewHandlers {
  /** 点 🔊：仅播本句 */
  onSpeakLine(line: StoryLine): void;
  /** 点台词文本：从本句开始连播 */
  onPlayFromLine(lineId: string): void;
  /** TTS 不可用时隐藏发音按钮 */
  ttsAvailable: boolean;
}

function renderLine(line: StoryLine, handlers: PlayerViewHandlers): HTMLElement {
  const row = document.createElement("div");
  row.className = "player-line";
  row.dataset.lineId = line.id;

  const speaker = document.createElement("span");
  speaker.className = "player-line-speaker";
  speaker.textContent = SPEAKER_EMOJI[line.speaker] ?? "🗨️";

  const text = document.createElement("span");
  text.className = "player-line-text";
  text.textContent = line.text;

  if (handlers.ttsAvailable) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "player-line-speak";
    btn.setAttribute("aria-label", "朗读本句");
    btn.textContent = "🔊";
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onSpeakLine(line);
    });
    row.append(btn, speaker, text);
    row.addEventListener("click", () => {
      // 拖选文本后的 click 只用于划词弹窗，不触发连播
      if (hasNonCollapsedTextSelection(window.getSelection())) return;
      handlers.onPlayFromLine(line.id);
    });
  } else {
    row.append(speaker, text);
  }
  return row;
}

/** 渲染整集到 scroll 容器（清空后重建） */
export function renderPlayerView(
  scroll: HTMLElement,
  story: Story,
  handlers: PlayerViewHandlers
): void {
  scroll.textContent = "";

  for (const slide of story.intro) {
    const card = document.createElement("section");
    card.className = "player-intro-card";
    const emoji = document.createElement("div");
    emoji.className = "player-intro-emoji";
    emoji.textContent = slide.emoji;
    const title = document.createElement("h2");
    title.textContent = slide.title;
    const sub = document.createElement("p");
    sub.className = "player-intro-sub";
    sub.textContent = slide.sub;
    card.append(emoji, title, sub);
    scroll.appendChild(card);
  }

  for (const scene of story.scenes) {
    const section = document.createElement("section");
    section.className = "player-scene";

    const head = document.createElement("div");
    head.className = "player-scene-head";
    const tag = document.createElement("span");
    tag.className = "player-scene-tag";
    tag.textContent = scene.tag;
    const title = document.createElement("h3");
    title.textContent = scene.title;
    const art = document.createElement("span");
    art.className = "player-scene-art";
    art.textContent = scene.art;
    head.append(tag, title, art);
    section.appendChild(head);

    if (scene.caption) {
      const caption = document.createElement("p");
      caption.className = "player-scene-caption";
      caption.textContent = scene.caption;
      section.appendChild(caption);
    }

    for (const line of scene.lines) {
      section.appendChild(renderLine(line, handlers));
    }
    scroll.appendChild(section);
  }

  if (story.songs && story.songs.length > 0) {
    const section = document.createElement("section");
    section.className = "player-songs";
    const title = document.createElement("h3");
    title.textContent = "🎵 儿歌";
    section.appendChild(title);
    for (const song of story.songs) {
      const item = document.createElement("div");
      item.className = "player-song";
      item.textContent = song;
      section.appendChild(item);
    }
    scroll.appendChild(section);
  }

  if (story.ending) {
    const card = document.createElement("section");
    card.className = "player-ending-card";
    const emoji = document.createElement("div");
    emoji.className = "player-ending-emoji";
    emoji.textContent = story.ending.emoji;
    const title = document.createElement("h2");
    title.textContent = story.ending.title;
    const sub = document.createElement("p");
    sub.className = "player-ending-sub";
    sub.textContent = story.ending.sub;
    card.append(emoji, title, sub);
    scroll.appendChild(card);
  }
}

/** 高亮当前播放行并滚入视野；传 null 清除高亮 */
export function setPlayingLine(scroll: HTMLElement, lineId: string | null): void {
  scroll
    .querySelectorAll(".player-line.playing")
    .forEach((el) => el.classList.remove("playing"));
  if (!lineId) return;
  const el = scroll.querySelector(`[data-line-id="${CSS.escape(lineId)}"]`);
  if (el) {
    el.classList.add("playing");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
