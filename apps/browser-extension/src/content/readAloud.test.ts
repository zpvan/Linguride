/**
 * @file readAloud.test.ts
 * @description 阅读全文断句逻辑的单元测试（纯函数部分）
 */

import { describe, expect, it } from "vitest";

import { splitSentenceSpans } from "./readAloud";

function split(text: string): string[] {
  return splitSentenceSpans(text).map((span) =>
    text.slice(span.start, span.end)
  );
}

describe("splitSentenceSpans", () => {
  it("splits plain sentences", () => {
    expect(split("Hello world. How are you? Fine!")).toEqual([
      "Hello world.",
      "How are you?",
      "Fine!",
    ]);
  });

  it("does not split URLs", () => {
    expect(split("See claude.ai/code for details. Then continue.")).toEqual([
      "See claude.ai/code for details.",
      "Then continue.",
    ]);
  });

  it("does not split version numbers", () => {
    expect(split("Requires v1.2.3 or later. Done.")).toEqual([
      "Requires v1.2.3 or later.",
      "Done.",
    ]);
  });

  it("does not split decimals", () => {
    expect(split("The value is 3.14 exactly. Next.")).toEqual([
      "The value is 3.14 exactly.",
      "Next.",
    ]);
  });

  it("keeps closing quotes and brackets with the sentence", () => {
    expect(split('He said "hello world." She left.')).toEqual([
      'He said "hello world."',
      "She left.",
    ]);
  });

  it("does not force-split on newlines (HTML source indentation)", () => {
    expect(split("First part of\n  the same sentence. Second one.")).toEqual([
      "First part of\n  the same sentence.",
      "Second one.",
    ]);
  });

  it("handles text without trailing punctuation", () => {
    expect(split("A complete sentence. A trailing fragment")).toEqual([
      "A complete sentence.",
      "A trailing fragment",
    ]);
  });

  it("skips fragments shorter than the minimum length", () => {
    expect(split("A. This is a real sentence.")).toEqual([
      "This is a real sentence.",
    ]);
  });

  it("handles ellipsis as boundary", () => {
    expect(split("Well… maybe not. Okay.")).toEqual([
      "Well…",
      "maybe not.",
      "Okay.",
    ]);
  });

  it("splits Chinese sentences without whitespace", () => {
    expect(split("这是第一句。这是第二句！还有第三句？")).toEqual([
      "这是第一句。",
      "这是第二句！",
      "还有第三句？",
    ]);
  });

  it("keeps Chinese closing quotes and brackets with the sentence", () => {
    expect(split("他说「你好。」就走了。下一句话。")).toEqual([
      "他说「你好。」",
      "就走了。",
      "下一句话。",
    ]);
  });

  it("splits mixed Chinese-English text", () => {
    expect(split("使用 Claude Code 开发。It works well. 就这么简单。")).toEqual([
      "使用 Claude Code 开发。",
      "It works well.",
      "就这么简单。",
    ]);
  });

  it("does not split Chinese enumeration comma or period in numbers", () => {
    expect(split("价格是 3.5 元。好的。")).toEqual(["价格是 3.5 元。", "好的。"]);
  });

  it("spans cover the full text (no gaps except whitespace)", () => {
    const text = "One sentence.  Two sentence!   Three?";
    const spans = splitSentenceSpans(text);
    expect(spans[0].start).toBe(0);
    expect(spans[spans.length - 1].end).toBe(text.length);
  });
});
