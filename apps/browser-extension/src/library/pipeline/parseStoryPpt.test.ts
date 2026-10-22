import { describe, expect, it } from "vitest";

import { parseStoryPpt, StoryPptParseError } from "./parseStoryPpt";

const F = "episode-01-good-morning-kimi.html";

function wrap(slidesLiteral: string): string {
  return `<!DOCTYPE html><html><head></head><body><script>
/* 注释里的示例 { type:"title" } 不应被提取 */
const SLIDES = ${slidesLiteral};
</script></body></html>`;
}

describe("parseStoryPpt", () => {
  it("解析完整 SLIDES（四种 slide 类型）", () => {
    const html = wrap(`[
      { type: "title", emoji: "🌈", title: "Main", sub: "Episode 1 · T ☀️" },
      { type: "scene", tag: "SCENE 1", title: "S1", art: "🌞<br>🛏️", caption: "cap",
        lines: [ { who: "mom", text: "Hi." }, { who: "kimi", text: "Yo!" } ] },
      { type: "songs", title: "Songs", list: ["a", "b"] },
      { type: "end", emoji: "🌟", title: "E", sub: "To be continued..." },
    ]`);
    const slides = parseStoryPpt(html, F);
    expect(slides).toHaveLength(4);
    expect(slides[0]).toEqual({ type: "title", emoji: "🌈", title: "Main", sub: "Episode 1 · T ☀️" });
    expect(slides[1]).toMatchObject({ type: "scene", tag: "SCENE 1" });
    if (slides[1].type === "scene") {
      expect(slides[1].lines[0]).toEqual({ who: "mom", text: "Hi." });
      expect(slides[1].lines).toHaveLength(2);
    }
    expect(slides[2]).toEqual({ type: "songs", title: "Songs", list: ["a", "b"] });
    expect(slides[3]).toMatchObject({ type: "end" });
  });

  it("找不到 SLIDES 声明时报错并带文件名", () => {
    expect(() => parseStoryPpt("<html></html>", F)).toThrow(StoryPptParseError);
    expect(() => parseStoryPpt("<html></html>", F)).toThrow(F);
  });

  it("括号不配对时报错", () => {
    expect(() => parseStoryPpt("<script>const SLIDES = [ { a: 1 }", F)).toThrow(StoryPptParseError);
  });

  it("未知 slide type 报错并带序号", () => {
    const html = wrap(`[ { type: "video", x: 1 } ]`);
    expect(() => parseStoryPpt(html, F)).toThrow(/slide #0/);
  });

  it("未知字段报错（严格模式）", () => {
    const html = wrap(`[ { type: "title", emoji: "🌈", title: "t", sub: "s", extra: 1 } ]`);
    expect(() => parseStoryPpt(html, F)).toThrow(/extra/);
  });

  it("scene 缺 lines 报错", () => {
    const html = wrap(`[ { type: "scene", tag: "S", title: "t", art: "a", caption: "c" } ]`);
    expect(() => parseStoryPpt(html, F)).toThrow(/lines/);
  });

  it("lines 元素缺 text 报错", () => {
    const html = wrap(
      `[ { type: "scene", tag: "S", title: "t", art: "a", caption: "c", lines: [ { who: "mom" } ] } ]`
    );
    expect(() => parseStoryPpt(html, F)).toThrow(/text/);
  });
});
