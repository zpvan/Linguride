import { describe, expect, it } from "vitest";

import {
  hasNonCollapsedTextSelection,
  resolveIdlePlaybackAction,
  resolveSpacePlaybackAction,
  shouldHandleSpaceKey,
  shouldRestartStoryOnEnter,
} from "./interaction";

function selection(text: string, collapsed = false): Selection {
  return {
    isCollapsed: collapsed,
    toString: () => text,
  } as Selection;
}

describe("hasNonCollapsedTextSelection", () => {
  it("无 Selection / 折叠 / 空白选区均不抑制点击", () => {
    expect(hasNonCollapsedTextSelection(null)).toBe(false);
    expect(hasNonCollapsedTextSelection(selection("hello", true))).toBe(false);
    expect(hasNonCollapsedTextSelection(selection("  \n "))).toBe(false);
  });
  it("非空文本选区抑制台词行点击", () => {
    expect(hasNonCollapsedTextSelection(selection("Good morning"))).toBe(true);
  });
});

describe("resolveSpacePlaybackAction", () => {
  it("弹窗发音优先于资料库队列", () => {
    expect(resolveSpacePlaybackAction({
      selectionSpeechActive: true,
      queueState: "playing",
      ttsAvailable: true,
    })).toBe("stop-selection");
  });
  it("播放中暂停、暂停中继续、空闲启动", () => {
    expect(resolveSpacePlaybackAction({ selectionSpeechActive: false, queueState: "playing", ttsAvailable: true })).toBe("pause");
    expect(resolveSpacePlaybackAction({ selectionSpeechActive: false, queueState: "paused", ttsAvailable: true })).toBe("resume");
    expect(resolveSpacePlaybackAction({ selectionSpeechActive: false, queueState: "idle", ttsAvailable: true })).toBe("start");
  });
  it("TTS 不可用时不启动/恢复，但仍可暂停", () => {
    expect(resolveSpacePlaybackAction({ selectionSpeechActive: false, queueState: "idle", ttsAvailable: false })).toBe("none");
    expect(resolveSpacePlaybackAction({ selectionSpeechActive: false, queueState: "paused", ttsAvailable: false })).toBe("none");
    expect(resolveSpacePlaybackAction({ selectionSpeechActive: false, queueState: "playing", ttsAvailable: false })).toBe("pause");
  });
});

describe("resolveIdlePlaybackAction", () => {
  it("未开始或中途停止时仍从第一句连播", () => {
    expect(resolveIdlePlaybackAction(0, 20)).toBe("start");
    expect(resolveIdlePlaybackAction(5, 20)).toBe("start");
  });

  it("播放完成后只复读最后一句", () => {
    expect(resolveIdlePlaybackAction(20, 20)).toBe("replay");
    expect(resolveIdlePlaybackAction(21, 20)).toBe("replay");
  });

  it("空故事不启动播放", () => {
    expect(resolveIdlePlaybackAction(0, 0)).toBe("none");
  });
});

describe("shouldRestartStoryOnEnter", () => {
  const finished = {
    key: "Enter",
    queueState: "idle",
    currentIndex: 20,
    totalLines: 20,
  } as const;

  it("播放完成后按 Enter 从第一句重新连播", () => {
    expect(shouldRestartStoryOnEnter(finished)).toBe(true);
  });

  it("空格、未播完或播放中按 Enter 均不触发从头连播", () => {
    expect(shouldRestartStoryOnEnter({ ...finished, key: " " })).toBe(false);
    expect(shouldRestartStoryOnEnter({ ...finished, currentIndex: 5 })).toBe(false);
    expect(shouldRestartStoryOnEnter({ ...finished, queueState: "playing" })).toBe(false);
  });
});

describe("shouldHandleSpaceKey", () => {
  const clean = {
    defaultPrevented: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    interactiveTarget: false,
  };
  it("普通空格可处理", () => {
    expect(shouldHandleSpaceKey(clean)).toBe(true);
  });
  const blockedCases: Array<[string, Partial<typeof clean>]> = [
    ["defaultPrevented", { defaultPrevented: true }],
    ["repeat", { repeat: true }],
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["alt", { altKey: true }],
    ["interactive", { interactiveTarget: true }],
  ];
  it.each(blockedCases)("过滤 %s", (_name, patch) => {
    expect(shouldHandleSpaceKey({ ...clean, ...patch })).toBe(false);
  });
  it("Shift 不过滤", () => {
    const shifted = { ...clean, shiftKey: true };
    expect(shouldHandleSpaceKey(shifted)).toBe(true);
  });
});
