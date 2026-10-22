import { describe, expect, it } from "vitest";

import type { LibraryIndex, Story } from "../model/types";
import { storyToMeta } from "./normalizeStory";
import { computeNormalizedHash } from "./storyHash";
import { sha1Hex } from "../../shared/sha1";
import {
  fixStoryInPlace,
  lintStoryContent,
  validateLibraryIndex,
  validateStoryShape,
} from "./validate";

async function makeStory(): Promise<Story> {
  const story: Story = {
    schemaVersion: 1,
    id: "ep01-good-morning",
    category: "story",
    episode: 1,
    title: "Good Morning, Kimi!",
    emoji: "🌞",
    intro: [{ emoji: "🌈", title: "T", sub: "Episode 1 · Good Morning, Kimi! ☀️" }],
    scenes: [
      {
        id: "s1",
        tag: "SCENE 1",
        title: "Wake Up",
        art: "🌞🐓",
        caption: "cap",
        lines: [
          { id: "l01-1-1", speaker: "mom", text: "Good morning.", textHash: await sha1Hex("Good morning.") },
          { id: "l01-1-2", speaker: "kimi", text: "Five more minutes.", textHash: await sha1Hex("Five more minutes.") },
        ],
      },
    ],
    songs: ["a"],
    ending: { emoji: "🌟", title: "E", sub: "S" },
    source: { file: "episode-01-good-morning-kimi.html", contentHash: "h", normalizedHash: "n", syncedAt: "t" },
  };
  return story;
}

describe("validateStoryShape", () => {
  it("合法 story 无 issue", async () => {
    expect(validateStoryShape(await makeStory(), "f.json")).toEqual([]);
  });
  it("非对象 → INVALID_JSON_SHAPE", () => {
    const issues = validateStoryShape("broken", "f.json");
    expect(issues[0].code).toBe("INVALID_JSON_SHAPE");
    expect(issues[0].level).toBe("error");
  });
  it("speaker 非法 → BAD_SPEAKER error 并指出位置", async () => {
    const story = await makeStory();
    (story.scenes[0].lines[1] as { speaker: string }).speaker = "grandma";
    const issues = validateStoryShape(story, "f.json");
    expect(issues.some((i) => i.code === "BAD_SPEAKER" && i.message.includes("l01-1-2"))).toBe(true);
  });
});

describe("lintStoryContent", () => {
  it("台词含中文 → CJK_TEXT error", async () => {
    const story = await makeStory();
    story.scenes[0].lines[0].text = "Good morning 早上好";
    const issues = lintStoryContent(story);
    expect(issues.some((i) => i.code === "CJK_TEXT" && i.level === "error")).toBe(true);
  });
  it("art 残留 HTML 标签 → HTML_RESIDUE error", async () => {
    const story = await makeStory();
    story.scenes[0].art = "🌞<b>bold</b>";
    const issues = lintStoryContent(story);
    expect(issues.some((i) => i.code === "HTML_RESIDUE" && i.level === "error")).toBe(true);
  });
  it("首尾空白/连续空格 → fixable", async () => {
    const story = await makeStory();
    story.scenes[0].lines[0].text = "  Good  morning. ";
    const issues = lintStoryContent(story);
    expect(issues.some((i) => i.code === "TRIM_WHITESPACE" && i.level === "fixable")).toBe(true);
    expect(issues.some((i) => i.code === "COLLAPSE_SPACE" && i.level === "fixable")).toBe(true);
  });
  it("行 id 重复 → DUP_LINE_ID error", async () => {
    const story = await makeStory();
    story.scenes[0].lines[1].id = story.scenes[0].lines[0].id;
    const issues = lintStoryContent(story);
    expect(issues.some((i) => i.code === "DUP_LINE_ID" && i.level === "error")).toBe(true);
  });
  it("缺 songs → NO_SONGS warning；空 caption → EMPTY_CAPTION warning", async () => {
    const story = await makeStory();
    delete story.songs;
    story.scenes[0].caption = "";
    const issues = lintStoryContent(story);
    expect(issues.some((i) => i.code === "NO_SONGS" && i.level === "warning")).toBe(true);
    expect(issues.some((i) => i.code === "EMPTY_CAPTION" && i.level === "warning")).toBe(true);
  });
});

describe("fixStoryInPlace", () => {
  it("修复空白并重算 textHash/normalizedHash，返回修复描述", async () => {
    const story = await makeStory();
    story.scenes[0].lines[0].text = "  Good  morning. ";
    story.source.normalizedHash = "stale";
    const applied = await fixStoryInPlace(story);
    expect(story.scenes[0].lines[0].text).toBe("Good morning.");
    expect(story.scenes[0].lines[0].textHash).toMatch(/^[0-9a-f]{40}$/);
    expect(story.source.normalizedHash).toMatch(/^[0-9a-f]{40}$/);
    expect(applied.length).toBeGreaterThan(0);
  });
  it("干净 story 返回空数组且不动字段", async () => {
    const story = await makeStory();
    story.source.normalizedHash = await computeNormalizedHash(story);
    const before = JSON.stringify(story);
    const applied = await fixStoryInPlace(story);
    expect(applied).toEqual([]);
    expect(JSON.stringify(story)).toBe(before);
  });
});

describe("validateLibraryIndex", () => {
  it("index 与文件集一致 → 无 issue", async () => {
    const story = await makeStory();
    const index: LibraryIndex = { version: 1, categories: [{ id: "story", name: "故事幻灯片", items: [storyToMeta(story)] }] };
    expect(validateLibraryIndex(index, [story])).toEqual([]);
  });
  it("缺条目/多余条目/统计过期 → INDEX_MISMATCH fixable", async () => {
    const story = await makeStory();
    const empty: LibraryIndex = { version: 1, categories: [{ id: "story", name: "故事幻灯片", items: [] }] };
    const issues = validateLibraryIndex(empty, [story]);
    expect(issues.some((i) => i.code === "INDEX_MISMATCH" && i.level === "fixable")).toBe(true);
  });
});
