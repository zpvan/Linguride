import { describe, expect, it } from "vitest";

import { parseXiaomiASRSSELine } from "./xiaomiASRRecognizer";

describe("parseXiaomiASRSSELine", () => {
  it("extracts delta content from a data line", () => {
    const line =
      'data: {"id":"x","choices":[{"delta":{"content":"Good "},"index":0,"finish_reason":null}]}';
    expect(parseXiaomiASRSSELine(line)).toEqual({ type: "delta", text: "Good " });
  });

  it("returns done for the [DONE] sentinel", () => {
    expect(parseXiaomiASRSSELine("data: [DONE]")).toEqual({ type: "done" });
  });

  it("returns done when finish_reason is stop", () => {
    const line =
      'data: {"id":"x","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}';
    expect(parseXiaomiASRSSELine(line)).toEqual({ type: "done" });
  });

  it("ignores non-data lines and empty lines", () => {
    expect(parseXiaomiASRSSELine("")).toBeNull();
    expect(parseXiaomiASRSSELine(": comment")).toBeNull();
    expect(parseXiaomiASRSSELine("event: message")).toBeNull();
  });

  it("ignores malformed JSON without throwing", () => {
    expect(parseXiaomiASRSSELine("data: {not json")).toBeNull();
  });
});
