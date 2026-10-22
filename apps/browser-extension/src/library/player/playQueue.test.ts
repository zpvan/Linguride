import { describe, expect, it } from "vitest";

import { DEFAULT_TTS_SPEED } from "../../types";
import { PlayQueue, type QueueLine, type QueueTTSPlayer } from "./playQueue";

const lines: QueueLine[] = [
  { id: "l01-1-1", text: "One." },
  { id: "l01-1-2", text: "Two." },
  { id: "l01-1-3", text: "Three." },
];

const RATE = DEFAULT_TTS_SPEED;

function makeAutoPlayer() {
  const played: string[] = [];
  const player: QueueTTSPlayer = {
    async playText(options) {
      played.push(options.text);
    },
    stop: () => undefined,
  };
  return { player, played };
}

const noSleep = () => Promise.resolve();

describe("PlayQueue", () => {
  it("从头连播到结束：顺序、进度、onFinish", async () => {
    const { player, played } = makeAutoPlayer();
    const progress: [number, number][] = [];
    let finished = false;
    const queue = new PlayQueue(player, lines, RATE, {
      onProgress: (a, b) => progress.push([a, b]),
      onFinish: () => (finished = true),
    }, { sleep: noSleep });
    await queue.startFrom(0);
    expect(played).toEqual(["One.", "Two.", "Three."]);
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(finished).toBe(true);
    expect(queue.getState()).toBe("idle");
  });

  it("startFrom(1) 从第二句开始", async () => {
    const { player, played } = makeAutoPlayer();
    const queue = new PlayQueue(player, lines, RATE, {}, { sleep: noSleep });
    await queue.startFrom(1);
    expect(played).toEqual(["Two.", "Three."]);
  });

  it("onLineStart 逐句回调", async () => {
    const { player } = makeAutoPlayer();
    const started: string[] = [];
    const queue = new PlayQueue(player, lines, RATE, { onLineStart: (id) => started.push(id) }, { sleep: noSleep });
    await queue.startFrom(0);
    expect(started).toEqual(["l01-1-1", "l01-1-2", "l01-1-3"]);
  });

  it("暂停后恢复：当前句重播，后续继续", async () => {
    const played: string[] = [];
    let resolveCurrent: (() => void) | null = null;
    const player: QueueTTSPlayer = {
      playText(options) {
        played.push(options.text);
        return new Promise<void>((r) => {
          resolveCurrent = r;
        });
      },
      stop: () => resolveCurrent?.(),
    };
    const queue = new PlayQueue(player, lines, RATE, {}, { sleep: noSleep });
    const run = queue.startFrom(0);
    await Promise.resolve(); // 让首句开始
    queue.pause();
    await run;
    expect(queue.getState()).toBe("paused");
    expect(played).toEqual(["One."]);

    const resumed = queue.resume();
    await Promise.resolve();
    expect(played).toEqual(["One.", "One."]); // 当前句重播
    resolveCurrent?.(); // 播完重播的第一句
    await new Promise((r) => setTimeout(r, 0));
    // 剩余句子需要逐句 resolve
    resolveCurrent?.();
    await new Promise((r) => setTimeout(r, 0));
    resolveCurrent?.();
    await resumed;
    expect(queue.getState()).toBe("idle");
  });

  it("stop 复位为 idle 且不再推进", async () => {
    const { player } = makeAutoPlayer();
    const queue = new PlayQueue(player, lines, RATE, {}, { sleep: noSleep });
    const run = queue.startFrom(0);
    queue.stop();
    await run;
    expect(queue.getState()).toBe("idle");
  });

  it("播放出错走 onError 并复位", async () => {
    const player: QueueTTSPlayer = {
      playText: () => Promise.reject(new Error("TTS 炸了")),
      stop: () => undefined,
    };
    let errorMessage = "";
    const queue = new PlayQueue(player, lines, RATE, { onError: (m) => (errorMessage = m) }, { sleep: noSleep });
    await queue.startFrom(0);
    expect(errorMessage).toBe("TTS 炸了");
    expect(queue.getState()).toBe("idle");
  });
});
