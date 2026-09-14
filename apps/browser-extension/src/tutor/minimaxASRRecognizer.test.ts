import { describe, expect, it } from "vitest";

import { parseMiniMaxASRSSELine } from "./minimaxASRRecognizer";

describe("parseMiniMaxASRSSELine", () => {
  it("extracts delta text from a data line", () => {
    const line = 'data: {"index":0,"delta":"The","finish":false}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({
      type: "delta",
      text: "The",
      done: false,
    });
  });

  it("keeps delta text on the final event (finish:true carries text)", () => {
    // 实测：MiniMax 把最后一段文本和 finish:true 放在同一事件，
    // 先判 finish 会丢掉最后一段（"只能识别出半句"的根因）
    const line = 'data: {"index":1,"delta":" quick brown.","finish":true,"duration":0.85}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({
      type: "delta",
      text: " quick brown.",
      done: true,
    });
  });

  it("returns snapshot when event carries text without delta", () => {
    const line = 'data: {"text":"Good morning","finish":false}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({
      type: "snapshot",
      text: "Good morning",
      done: false,
    });
  });

  it("returns done when finish is true without text", () => {
    const line = 'data: {"finish":true,"duration":2.5}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({ type: "done" });
  });

  it("returns done for the [DONE] sentinel", () => {
    expect(parseMiniMaxASRSSELine("data: [DONE]")).toEqual({ type: "done" });
  });

  it("ignores non-data lines and empty lines", () => {
    expect(parseMiniMaxASRSSELine("")).toBeNull();
    expect(parseMiniMaxASRSSELine(": comment")).toBeNull();
    expect(parseMiniMaxASRSSELine("event: message")).toBeNull();
  });

  it("ignores malformed JSON without throwing", () => {
    expect(parseMiniMaxASRSSELine("data: {not json")).toBeNull();
  });

  it("returns null for events without delta or text", () => {
    expect(parseMiniMaxASRSSELine('data: {"finish":false}')).toBeNull();
  });
});
