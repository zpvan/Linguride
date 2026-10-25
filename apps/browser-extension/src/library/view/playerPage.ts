/**
 * @file playerPage.ts
 * @description 资料库播放器页面组装：渲染 + 单句发音 + 连播队列 + 空格控制 + 划词发音协调
 */

import {
  isSelectionSpeechActive,
  stopSelectionSpeech,
} from "../../content/selectionToolbar";
import type { TTSSpeed } from "../../types";
import type { Story, StoryLine } from "../model/types";
import {
  resolveSpacePlaybackAction,
  shouldHandleSpaceKey,
} from "../player/interaction";
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
let playerDeps: PlayerPageDeps | null = null;
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

/** 弹窗开始发音时暂停资料库连播，不自动恢复 */
export function pausePlayerForExternalSpeech(): void {
  if (queue?.getState() === "playing") {
    queue.pause();
  }
  updateToggle();
}

function startQueueAt(index: number): void {
  if (!queue) return;
  stopSelectionSpeech();
  void queue.startFrom(index);
  updateToggle();
}

function resumeQueue(): void {
  if (!queue || queue.getState() !== "paused") return;
  stopSelectionSpeech();
  void queue.resume();
  updateToggle();
}

function pauseQueue(): void {
  if (!queue || queue.getState() !== "playing") return;
  queue.pause();
  updateToggle();
}

function toggleQueue(): void {
  if (!queue) return;
  const state = queue.getState();
  if (state === "playing") pauseQueue();
  else if (state === "paused") resumeQueue();
  else startQueueAt(0);
}

/** 处理播放器内空格；由 library.ts 在播放器可见时调用 */
export function handlePlayerSpace(event: KeyboardEvent): void {
  if (event.key !== " " && event.code !== "Space") return;

  const target = event.target;
  const interactiveTarget = Boolean(
    (target instanceof Element &&
      target.closest("button, input, textarea, select")) ||
      (target instanceof HTMLElement && target.isContentEditable)
  );
  if (
    !shouldHandleSpaceKey({
      defaultPrevented: event.defaultPrevented,
      repeat: event.repeat,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      interactiveTarget,
    })
  ) {
    return;
  }

  const action = resolveSpacePlaybackAction({
    selectionSpeechActive: isSelectionSpeechActive(),
    queueState: queue?.getState() ?? "idle",
    ttsAvailable: playerDeps?.ttsAvailable() ?? false,
  });
  if (action === "none") return;

  event.preventDefault();
  switch (action) {
    case "stop-selection":
      stopSelectionSpeech();
      updateToggle();
      return;
    case "pause":
      pauseQueue();
      return;
    case "resume":
      resumeQueue();
      return;
    case "start":
      startQueueAt(0);
      return;
  }
}

/** 离开播放器时停止两路发音并清理 */
export function stopPlayerPage(): void {
  queue?.stop();
  queue = null;
  playerDeps = null;
  setPlayingLine(scroll, null);
  stopSelectionSpeech();
  updateToggle();
}

export function renderPlayerPage(story: Story, deps: PlayerPageDeps): void {
  stopPlayerPage();
  playerDeps = deps;
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
      stopSelectionSpeech();
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
      if (index >= 0) startQueueAt(index);
    },
  });

  playToggleBtn.onclick = toggleQueue;
  updateToggle();
}
