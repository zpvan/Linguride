import { describe, expect, it } from "vitest";

import {
  isLibraryIndex,
  isSpeaker,
  isStory,
  SPEAKERS,
  SPEAKER_EMOJI,
  type LibraryIndex,
  type Story,
} from "./types";

function makeStory(): Story {
  return {
    schemaVersion: 1,
    id: "ep01-good-morning",
    category: "story",
    episode: 1,
    title: "Good Morning, Kimi!",
    emoji: "🌞",
    intro: [{ emoji: "🌈", title: "Kimi's English Story Time", sub: "Episode 1 · Good Morning, Kimi! ☀️" }],
    scenes: [
      {
        id: "s1",
        tag: "SCENE 1",
        title: "Wake Up, Sleepyhead!",
        art: "🌞🐓\n🛏️😴",
        caption: "The sun is up.",
        lines: [
          { id: "l01-1-1", speaker: "mom", text: "Good morning. Time to wake up!", textHash: "abc123" },
        ],
      },
    ],
    songs: ["🐓 Good Morning, Mr. Rooster"],
    ending: { emoji: "🌟", title: "What a Morning, Kimi!", sub: "To be continued..." },
    source: { file: "episode-01-good-morning-kimi.html", contentHash: "h1", normalizedHash: "h2", syncedAt: "2026-10-23T00:00:00.000Z" },
  };
}

describe("isSpeaker", () => {
  it("接受全部实测 speaker 取值", () => {
    for (const s of ["mom", "kimi", "dad", "friend"]) {
      expect(isSpeaker(s)).toBe(true);
    }
  });
  it("拒绝未知取值", () => {
    expect(isSpeaker("grandma")).toBe(false);
    expect(isSpeaker(1)).toBe(false);
  });
  it("每个 speaker 都有 emoji 映射", () => {
    for (const s of SPEAKERS) {
      expect(SPEAKER_EMOJI[s]).toBeTruthy();
    }
  });
});

describe("isStory", () => {
  it("接受合法 story", () => {
    expect(isStory(makeStory())).toBe(true);
  });
  it("songs/ending 可缺省", () => {
    const story = makeStory();
    delete story.songs;
    delete story.ending;
    expect(isStory(story)).toBe(true);
  });
  const invalidCases: Array<[string, (s: Story) => void]> = [
    ["schemaVersion 错误", (s) => ((s as { schemaVersion: number }).schemaVersion = 2)],
    ["category 错误", (s) => ((s as { category: string }).category = "song")],
    ["lines 缺 textHash", (s) => delete (s.scenes[0].lines[0] as { textHash?: string }).textHash],
    ["speaker 非法", (s) => ((s.scenes[0].lines[0] as { speaker: string }).speaker = "grandma")],
    ["source 缺 contentHash", (s) => delete (s.source as { contentHash?: string }).contentHash],
  ];
  it.each(invalidCases)("拒绝：%s", (_name, mutate) => {
    const story = makeStory();
    mutate(story);
    expect(isStory(story)).toBe(false);
  });
});

describe("isLibraryIndex", () => {
  it("接受合法 index", () => {
    const index: LibraryIndex = {
      version: 1,
      categories: [
        {
          id: "story",
          name: "故事幻灯片",
          items: [
            {
              id: "ep01-good-morning",
              category: "story",
              episode: 1,
              title: "Good Morning, Kimi!",
              emoji: "🌞",
              sceneCount: 6,
              lineCount: 24,
              file: "stories/ep01-good-morning.json",
              sourceFile: "episode-01-good-morning-kimi.html",
            },
          ],
        },
      ],
    };
    expect(isLibraryIndex(index)).toBe(true);
  });
  it("拒绝 version 错误", () => {
    expect(isLibraryIndex({ version: 2, categories: [] })).toBe(false);
  });
});
