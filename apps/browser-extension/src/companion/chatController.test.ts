import { describe, expect, it } from "vitest";

import {
  COMPANION_HISTORY_WINDOW,
  MIN_SUMMARY_USER_TURNS,
} from "../types/companion";
import { ChatController } from "./chatController";

describe("ChatController", () => {
  it("完整的用户→助手轮次流程", () => {
    const c = new ChatController();
    c.addUserTurn("hello");
    c.beginAssistantTurn();
    c.appendAssistantDelta("Hi");
    c.appendAssistantDelta(" there");
    const full = c.completeAssistantTurn();

    expect(full).toBe("Hi there");
    expect(c.getTurns()).toEqual([
      { role: "user", content: "hello", hidden: undefined },
      { role: "assistant", content: "Hi there", hidden: undefined },
    ]);
    expect(c.isStreaming()).toBe(false);
    expect(c.getPendingText()).toBe("");
  });

  it("隐藏轮次（开场指令）记录在历史但可被渲染层过滤", () => {
    const c = new ChatController();
    c.addUserTurn("(OOC: start)", { hidden: true });
    expect(c.getTurns()[0].hidden).toBe(true);
    expect(c.getVisibleTurns()).toEqual([]);
  });

  it("流式中的保护：重复 begin 抛错；未 begin 时 append 抛错", () => {
    const c = new ChatController();
    expect(() => c.appendAssistantDelta("x")).toThrow();
    c.beginAssistantTurn();
    expect(() => c.beginAssistantTurn()).toThrow();
  });

  it("failAssistantTurn 丢弃 pending 文本，历史不变", () => {
    const c = new ChatController();
    c.addUserTurn("hello");
    c.beginAssistantTurn();
    c.appendAssistantDelta("par");
    c.failAssistantTurn();
    expect(c.getTurns()).toHaveLength(1);
    expect(c.isStreaming()).toBe(false);
    expect(c.getPendingText()).toBe("");
  });

  it("getWindowedHistory 截断为最近 COMPANION_HISTORY_WINDOW 条", () => {
    const c = new ChatController();
    for (let i = 0; i < COMPANION_HISTORY_WINDOW + 6; i++) {
      c.addUserTurn(`u${i}`);
    }
    const windowed = c.getWindowedHistory();
    expect(windowed).toHaveLength(COMPANION_HISTORY_WINDOW);
    expect(windowed[0].content).toBe("u6");
  });

  it("getUserTurnCount 与 canSummarize 门槛（隐藏的开场指令不计入）", () => {
    const c = new ChatController();
    c.addUserTurn("(OOC)", { hidden: true });
    expect(c.getUserTurnCount()).toBe(0);
    expect(c.canSummarize()).toBe(false);
    for (let i = 0; i < MIN_SUMMARY_USER_TURNS - 1; i++) {
      c.addUserTurn(`u${i}`);
      expect(c.canSummarize()).toBe(false);
    }
    c.addUserTurn("u-final");
    expect(c.getUserTurnCount()).toBe(MIN_SUMMARY_USER_TURNS);
    expect(c.canSummarize()).toBe(true);
  });

  it("reset 清空全部状态", () => {
    const c = new ChatController();
    c.addUserTurn("x");
    c.reset();
    expect(c.getTurns()).toEqual([]);
    expect(c.getUserTurnCount()).toBe(0);
  });
});
