/**
 * @file flashcardCategoryLayout.test.ts
 * @description 认图卡片分类首页固定四列及窄屏尺寸契约测试
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./library.css", import.meta.url), "utf8");
const narrowCss = css.slice(
  css.indexOf("@media (max-width: 640px)"),
  css.indexOf("/* ====== 亮色主题")
);

function getRule(selector: string, source = css): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `找不到 ${selector}`).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("}", start) + 1);
}

describe("认图卡片分类首页布局", () => {
  it("默认使用四列和紧凑卡片尺寸", () => {
    expect(getRule(".flashcard-category-grid")).toContain(
      "grid-template-columns: repeat(4, minmax(0, 1fr))"
    );
    expect(getRule(".flashcard-category-grid")).toContain("gap: 12px");
    expect(getRule(".flashcard-category-card")).toContain("min-height: 124px");
    expect(getRule(".flashcard-category-card")).toContain("gap: 6px");
    expect(getRule(".flashcard-category-emoji")).toContain("font-size: 40px");
    expect(getRule(".flashcard-category-name")).toContain("font-size: 15px");
    expect(getRule(".flashcard-category-count")).toContain("font-size: 11px");
    for (const selector of [".flashcard-category-name", ".flashcard-category-count"]) {
      expect(getRule(selector)).toContain("max-width: 100%");
      expect(getRule(selector)).toContain("overflow-wrap: anywhere");
    }
  });

  it("窄屏仍保持四列并进一步压缩内容", () => {
    expect(getRule(".flashcard-category-grid", narrowCss)).not.toContain("grid-template-columns");
    expect(getRule(".flashcard-category-grid", narrowCss)).toContain("gap: 8px");
    expect(getRule(".flashcard-category-card", narrowCss)).toContain("min-height: 96px");
    expect(getRule(".flashcard-category-emoji", narrowCss)).toContain("font-size: 24px");
    expect(getRule(".flashcard-category-name", narrowCss)).toContain("font-size: 13px");
    expect(getRule(".flashcard-category-count", narrowCss)).toContain("font-size: 10px");
  });

  it("具体单词卡片网格保持现有自适应规则", () => {
    expect(getRule(".flashcard-word-grid")).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(135px, 1fr))"
    );
    expect(getRule(".flashcard-word-grid", narrowCss)).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(108px, 1fr))"
    );
  });
});
