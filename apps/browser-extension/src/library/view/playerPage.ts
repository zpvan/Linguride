/**
 * @file playerPage.ts
 * @description 资料库播放器页面组装：渲染 + 单句发音 + 连播队列 + 播放条
 */

import type { TTSSpeed } from "../../types";
import type { Story, StoryLine } from "../model/types";
import { PlayQueue, type QueueTTSPlayer } from "../player/playQueue";
import { renderPlayerView, setPlayingLine } from "./playerView";

export interface PlayerPageDeps {
  player: QueueTTSPlayer;
  getRate(): TTSSpeed;
  ttsAvailable(): boolean;
}

const playerTitle = document.getElementById("playerTitle") as HTMLElement;
const scroll = document.getElementById("playerScroll") as HTMLElement;
const playToggleBtn = document.getElementById("playToggleBtn") as HTMLButtonElement;
const playProgress = document.getElementById("playProgress") as HTMLElement;

let queue: PlayQueue | null = null;
let totalLines = 0;

function updateToggle(): void {
  if (!queue || queue.getState() === "idle") {
    playToggleBtn.textContent = "▶ 连播";
  } else if (queue.getState() === "playing") {
    playToggleBtn.textContent = "⏸ 暂停";
  } else {
    playToggleBtn.textContent = "▶ 继续";
  }
}

/** 离开播放器时停止播放并清理（路由回首页时调用） */
export function stopPlayerPage(): void {
  queue?.stop();
  queue = null;
  setPlayingLine(scroll, null);
}

export function renderPlayerPage(story: Story, deps: PlayerPageDeps): void {
  stopPlayerPage();
  playerTitle.textContent = `Ep.${story.episode} ${story.title}`;

  const lines: StoryLine[] = story.scenes.flatMap((scene) => scene.lines);
  totalLines = lines.length;

  const available = deps.ttsAvailable();
  playToggleBtn.hidden = !available;
  playProgress.textContent = available
    ? `共 ${totalLines} 句`
    : "请先在设置里配置语音合成";

  queue = new PlayQueue(deps.player, lines, deps.getRate(), {
    onLineStart: (lineId) => setPlayingLine(scroll, lineId),
    onProgress: (played, total) => {
      playProgress.textContent = `已播 ${played}/${total}`;
    },
    onFinish: () => {
      setPlayingLine(scroll, null);
      playProgress.textContent = `已播完 ${totalLines} 句`;
      updateToggle();
    },
    onError: (message) => {
      setPlayingLine(scroll, null);
      playProgress.textContent = `播放失败：${message}`;
      updateToggle();
    },
  });

  renderPlayerView(scroll, story, {
    ttsAvailable: available,
    onSpeakLine: (line) => {
      queue?.stop();
      updateToggle();
      setPlayingLine(scroll, line.id);
      void deps.player
        .playText({ text: line.text, rate: deps.getRate() })
        .catch(() => {
          playProgress.textContent = "播放失败";
        })
        .finally(() => setPlayingLine(scroll, null));
    },
    onPlayFromLine: (lineId) => {
      const index = lines.findIndex((l) => l.id === lineId);
      if (index >= 0 && queue) {
        void queue.startFrom(index);
        updateToggle();
      }
    },
  });

  playToggleBtn.onclick = () => {
    if (!queue) return;
    const state = queue.getState();
    if (state === "playing") queue.pause();
    else if (state === "paused") void queue.resume();
    else void queue.startFrom(0);
    updateToggle();
  };
  updateToggle();
}
