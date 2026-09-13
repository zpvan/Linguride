import { describe, expect, it } from "vitest";

import { parseMiniMaxASRSSELine } from "./minimaxASRRecognizer";

describe("parseMiniMaxASRSSELine", () => {
  it("extracts delta text from a data line", () => {
    const line = 'data: {"delta":"Good ","finish":false}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({ type: "delta", text: "Good " });
  });

  it("returns snapshot when event carries text without delta", () => {
    const line = 'data: {"text":"Good morning","finish":false}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({
      type: "snapshot",
      text: "Good morning",
    });
  });

  it("returns done when finish is true", () => {
    const line = 'data: {"delta":"","finish":true,"duration":2.5}';
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
