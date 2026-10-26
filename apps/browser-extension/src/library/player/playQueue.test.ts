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
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

  it("默认句间等待 2000ms，最后一句后不等待", async () => {
    const { player } = makeAutoPlayer();
    const waits: number[] = [];
    const queue = new PlayQueue(player, lines, RATE, {}, {
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });

    await queue.startFrom(0);

    expect(waits).toEqual([2000, 2000]);
  });

  it("句间暂停后重播刚结束的句子，再等待完整间隔", async () => {
    const { player, played } = makeAutoPlayer();
    const progress: number[] = [];
    const waits: Array<{ ms: number; resolve: () => void }> = [];
    const queue = new PlayQueue(player, lines, RATE, {
      onProgress: (playedCount) => progress.push(playedCount),
    }, {
      sleep: (ms) => new Promise<void>((resolve) => {
        waits.push({ ms, resolve });
      }),
    });

    const firstRun = queue.startFrom(0);
    await flush();
    expect(played).toEqual(["One."]);
    expect(progress).toEqual([1]);
    expect(waits.map((wait) => wait.ms)).toEqual([2000]);

    queue.pause();
    const resumed = queue.resume();
    await flush();
    expect(played).toEqual(["One.", "One."]);
    expect(progress).toEqual([1, 1]);
    expect(waits.map((wait) => wait.ms)).toEqual([2000, 2000]);

    waits[0].resolve();
    await firstRun;
    waits[1].resolve();
    await flush();
    expect(played).toEqual(["One.", "One.", "Two."]);
    expect(progress).toEqual([1, 1, 2]);
    expect(waits).toHaveLength(3);

    waits[2].resolve();
    await flush();
    expect(played).toEqual(["One.", "One.", "Two.", "Three."]);
    expect(progress).toEqual([1, 1, 2, 3]);
    expect(waits).toHaveLength(3);

    await resumed;
    expect(queue.getState()).toBe("idle");
  });

  it("句间 stop 后旧等待完成也不会推进索引", async () => {
    const { player, played } = makeAutoPlayer();
    let resolveWait: (() => void) | null = null;
    let finished = false;
    const queue = new PlayQueue(player, lines, RATE, {
      onFinish: () => (finished = true),
    }, {
      sleep: () => new Promise<void>((resolve) => {
        resolveWait = resolve;
      }),
    });

    const run = queue.startFrom(0);
    await flush();
    expect(played).toEqual(["One."]);

    queue.stop();
    resolveWait?.();
    await run;

    expect(queue.getState()).toBe("idle");
    expect(queue.getCurrentIndex()).toBe(0);
    expect(played).toEqual(["One."]);
    expect(finished).toBe(false);
  });
});
