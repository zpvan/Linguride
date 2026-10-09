import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createHybridTTSPlayer,
  selectNaturalBrowserVoice,
} from "./hybridTTSPlayer";
import { MessageType, SynthesizeSpeechResponse } from "../types";

function makeVoice(
  name: string,
  lang: string,
  isDefault = false
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: isDefault,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

describe("selectNaturalBrowserVoice", () => {
  it("returns null when no voices are available", () => {
    expect(selectNaturalBrowserVoice([], "en-US")).toBeNull();
  });

  it("excludes novelty voices like Whisper", () => {
    const voices = [
      makeVoice("Whisper", "en-US"),
      makeVoice("Samantha", "en-US"),
    ];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe("Samantha");
  });

  it("prefers the system default voice among natural voices", () => {
    const voices = [
      makeVoice("Samantha", "en-US"),
      makeVoice("Google US English", "en-US", true),
    ];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe(
      "Google US English"
    );
  });

  it("falls back to language prefix match when no exact match exists", () => {
    const voices = [makeVoice("Daniel", "en-GB")];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe("Daniel");
  });

  it("returns null when no voice matches the language", () => {
    const voices = [makeVoice("Tingting", "zh-CN")];
    expect(selectNaturalBrowserVoice(voices, "en-US")).toBeNull();
  });

  it("accepts voices when every match is a novelty voice", () => {
    const voices = [makeVoice("Whisper", "en-US")];
    expect(selectNaturalBrowserVoice(voices, "en-US")?.name).toBe("Whisper");
  });
});

// ====== AI 进度跟踪与取消 ======

type MockMessage = { type: string; payload?: Record<string, unknown> };

let sentMessages: MockMessage[] = [];
let messageHandler: (message: MockMessage) => unknown;

function installChromeMock(
  handler: (message: MockMessage) => unknown
): void {
  sentMessages = [];
  messageHandler = handler;
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      sendMessage: vi.fn((message: MockMessage) => {
        sentMessages.push(message);
        return Promise.resolve(messageHandler(message));
      }),
    },
  };
}

function installBrowserTTSMock(): { speakCalls: number } {
  const state = { speakCalls: 0 };
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = class {
    text: string;
    lang = "";
    rate = 1;
    voice: unknown = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  (globalThis as Record<string, unknown>).window = {
    speechSynthesis: {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: (utterance: {
        onstart: (() => void) | null;
        onend: (() => void) | null;
      }) => {
        state.speakCalls += 1;
        setTimeout(() => {
          utterance.onstart?.();
          utterance.onend?.();
        }, 0);
      },
    },
  };
  return state;
}

describe("createHybridTTSPlayer AI progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).chrome;
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
  });

  it("reports synthesis progress and defers onStart until ready", async () => {
    let statusCalls = 0;
    installChromeMock((message) => {
      if (message.type === "GET_TTS_SYNTHESIS_STATUS") {
        statusCalls += 1;
        return {
          success: true,
          data: {
            stage: statusCalls < 2 ? "synthesizing" : "ready",
            elapsedMs: statusCalls * 700,
          },
        };
      }
      if (message.type === "SYNTHESIZE_SPEECH") {
        return new Promise((resolve) =>
          setTimeout(
            () => resolve({ success: true, data: { provider: "minimax" } }),
            1500
          )
        );
      }
      return { success: false };
    });

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const stages: string[] = [];
    const events: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onStart: () => events.push("start"),
      onEnd: () => events.push("end"),
      onProgress: (progress) => stages.push(progress.stage),
    });

    await vi.advanceTimersByTimeAsync(3000);
    await playPromise;

    expect(stages).toContain("synthesizing");
    expect(stages).toContain("ready");
    expect(events).toEqual(["start", "end"]);

    const synthMessage = sentMessages.find(
      (m) => m.type === "SYNTHESIZE_SPEECH"
    );
    expect(synthMessage?.payload?.requestId).toMatch(/^tts-/);
  });

  it("cancelAIPlayback sends cancellation for the active request", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: false,
                errorCode: "TTS_CANCELLED",
                error: "朗读已取消",
              }),
            60_000
          )
        );
      }
      return { success: true, data: { stage: "synthesizing", elapsedMs: 100 } };
    });
    const browserTTS = installBrowserTTSMock();

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onProgress: () => {
        // 空实现：仅用于启用进度跟踪
      },
    });

    await vi.advanceTimersByTimeAsync(100);
    player.cancelAIPlayback();
    await vi.advanceTimersByTimeAsync(61_000);
    await playPromise;

    const cancelMessage = sentMessages.find(
      (m) => m.type === "CANCEL_TTS_SYNTHESIS"
    );
    expect(cancelMessage).toBeDefined();
    expect(cancelMessage?.payload?.requestId).toMatch(/^tts-/);
    // 取消即静默结束：不再回退浏览器朗读（避免重复出声）
    expect(browserTTS.speakCalls).toBe(0);
  });

  it("TTS_CANCELLED 时静默结束且不回退浏览器朗读", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return {
          success: false,
          errorCode: "TTS_CANCELLED",
          error: "朗读已取消",
        };
      }
      return { success: true, data: { stage: "unknown", elapsedMs: 0 } };
    });
    const browserTTS = installBrowserTTSMock();

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const warnings: string[] = [];
    const aiErrors: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onFallbackWarning: (message) => warnings.push(message),
      onAIError: (message) => aiErrors.push(message),
    });
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(warnings).toHaveLength(0);
    expect(aiErrors).toHaveLength(0);
    expect(browserTTS.speakCalls).toBe(0);
  });

  it("reports specific AI error via onAIError", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return {
          success: false,
          errorCode: "TTS_RATE_LIMIT",
          error: "请求过于频繁或额度受限",
        };
      }
      return { success: true, data: { stage: "unknown", elapsedMs: 0 } };
    });
    installBrowserTTSMock();

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const warnings: string[] = [];
    const aiErrors: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onFallbackWarning: (message) => warnings.push(message),
      onAIError: (message) => aiErrors.push(message),
    });
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(aiErrors).toEqual(["请求过于频繁或额度受限"]);
    expect(warnings).toHaveLength(0);
  });

  it("keeps legacy behavior when onProgress is not provided", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return { success: true, data: { provider: "minimax" } };
      }
      return { success: true, data: { stage: "unknown", elapsedMs: 0 } };
    });

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const events: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onStart: () => events.push("start"),
      onEnd: () => events.push("end"),
    });
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(events).toEqual(["start", "end"]);
    const synthMessage = sentMessages.find(
      (m) => m.type === "SYNTHESIZE_SPEECH"
    );
    expect(synthMessage?.payload?.requestId).toBeUndefined();
    expect(
      sentMessages.some((m) => m.type === "GET_TTS_SYNTHESIS_STATUS")
    ).toBe(false);
  });
});

// ====== AI 播放所有权与回退策略（重复朗读回归） ======

interface Deferred {
  resolve: (value: SynthesizeSpeechResponse) => void;
  promise: Promise<SynthesizeSpeechResponse>;
}

function createDeferred(): Deferred {
  let resolve!: (value: SynthesizeSpeechResponse) => void;
  const promise = new Promise<SynthesizeSpeechResponse>((res) => {
    resolve = res;
  });
  return { resolve, promise };
}

describe("createHybridTTSPlayer AI 播放所有权与回退策略", () => {
  let synthCalls: string[];
  let stopCalls: number;
  let deferreds: Deferred[];
  let speakCalls: string[];

  beforeEach(() => {
    synthCalls = [];
    stopCalls = 0;
    deferreds = [];
    speakCalls = [];

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(
          (message: { type: MessageType; payload?: { text?: string } }) => {
            if (message.type === MessageType.SYNTHESIZE_SPEECH) {
              synthCalls.push(message.payload?.text ?? "");
              const deferred = createDeferred();
              deferreds.push(deferred);
              return deferred.promise;
            }
            if (message.type === MessageType.STOP_TTS_PLAYBACK) {
              stopCalls += 1;
              return Promise.resolve({ success: true });
            }
            return Promise.resolve({ success: true });
          }
        ),
      },
    });

    vi.stubGlobal("window", {
      speechSynthesis: {
        speak: vi.fn((utterance: { text: string; onend?: () => void }) => {
          speakCalls.push(utterance.text);
          utterance.onend?.();
        }),
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
      },
    });

    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        rate = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stale run 的迟到响应不清除当前 run 的 AI 播放所有权", async () => {
    const player = createHybridTTSPlayer({ isAIEnabled: () => true });

    // run A 开始合成
    const runA = player.playText({ text: "alpha", rate: 1 });
    expect(synthCalls).toEqual(["alpha"]);

    // run B 抢占：stop 应发出 STOP（run A 持有所有权）
    const runB = player.playText({ text: "bravo", rate: 1 });
    expect(stopCalls).toBe(1);
    expect(synthCalls).toEqual(["alpha", "bravo"]);

    // run A 的响应迟到（已被 SW 作废）：不得清掉 run B 的所有权
    deferreds[0].resolve({
      success: false,
      errorCode: "TTS_CANCELLED",
      error: "朗读已取消",
    });
    await runA;

    // run C 再次抢占：所有权若被 run A 的 finally 误清，这里不会发 STOP（bug 回归）
    const runC = player.playText({ text: "charlie", rate: 1 });
    expect(stopCalls).toBe(2);

    deferreds[1].resolve({
      success: false,
      errorCode: "TTS_CANCELLED",
      error: "朗读已取消",
    });
    await runB;
    deferreds[2].resolve({ success: true, data: { provider: "minimax" } });
    await runC;

    expect(speakCalls).toEqual([]);
  });

  it("响应标记 audioPlayed 时不回退浏览器朗读", async () => {
    const player = createHybridTTSPlayer({ isAIEnabled: () => true });

    const run = player.playText({ text: "alpha", rate: 1 });
    deferreds[0].resolve({
      success: false,
      errorCode: "TTS_CANCELLED",
      error: "朗读已取消",
      audioPlayed: true,
    });
    await run;

    expect(speakCalls).toEqual([]);
  });

  it("合成失败（未播放）仍回退浏览器朗读一次", async () => {
    const player = createHybridTTSPlayer({ isAIEnabled: () => true });

    const run = player.playText({ text: "alpha", rate: 1 });
    deferreds[0].resolve({
      success: false,
      errorCode: "TTS_UNKNOWN_ERROR",
      error: "boom",
    });
    await run;

    expect(speakCalls).toEqual(["alpha"]);
  });

  it("AI 播放成功时不触发浏览器朗读", async () => {
    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const onEnd = vi.fn();

    const run = player.playText({
      text: "alpha",
      rate: 1,
      onEnd,
    });
    deferreds[0].resolve({ success: true, data: { provider: "minimax" } });
    await run;

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(speakCalls).toEqual([]);
  });
});
