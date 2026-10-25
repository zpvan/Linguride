import { describe, expect, it } from "vitest";

import {
  hasNonCollapsedTextSelection,
  resolveSpacePlaybackAction,
  shouldHandleSpaceKey,
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
