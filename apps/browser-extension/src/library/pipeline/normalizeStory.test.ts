import { describe, expect, it } from "vitest";

import type { RawSlide } from "./parseStoryPpt";
import { normalizeStory, NormalizeStoryError, storyToMeta } from "./normalizeStory";
import { computeNormalizedHash } from "./storyHash";

const OPTS = {
  fileName: "episode-01-good-morning-kimi.html",
  contentHash: "deadbeef",
  syncedAt: "2026-10-23T00:00:00.000Z",
};

function makeSlides(): RawSlide[] {
  return [
    { type: "title", emoji: "🌈", title: "Kimi's English Story Time", sub: "Episode 1 · Good Morning, Kimi! ☀️" },
    { type: "title", emoji: "👧🏻", title: "Meet Kimi!", sub: "A little girl." },
    {
      type: "scene",
      tag: "SCENE 1",
      title: "Wake Up, Sleepyhead!",
      art: "🌞🐓<br>🛏️😴",
      caption: "The sun is up.<br>Someone is dreaming...",
      lines: [
        { who: "mom", text: "  Good morning.  Time to wake up! " },
        { who: "kimi", text: "Just five more minutes... 😴" },
      ],
    },
    { type: "songs", title: "🎵 Songs 🎵", list: ["🐓 Good Morning, Mr. Rooster"] },
    { type: "end", emoji: "🌟", title: "What a Morning!", sub: "To be continued..." },
  ];
}

describe("normalizeStory", () => {
  it("文件名归一化为 id 与 episode", async () => {
    const { story } = await normalizeStory(makeSlides(), OPTS);
    expect(story.id).toBe("ep01-good-morning");
    expect(story.episode).toBe(1);
  });

  it("标题从首个 title slide 的 sub 派生（剥前缀/emoji/括号注释）", async () => {
    const { story } = await normalizeStory(makeSlides(), OPTS);
    expect(story.title).toBe("Good Morning, Kimi!");
    const cases: [string, string][] = [
      ["Episode 9 · Funny Body Noises! 🎺 (Season 2 Begins!)", "Funny Body Noises!"],
      ["Episode 14 · What Day Is It? 🚌 (Season 2 Finale!)", "What Day Is It?"],
      ["Episode 3 · Kimi's Weather Adventure! ☀️🌧️⛄", "Kimi's Weather Adventure!"],
    ];
    for (const [sub, expected] of cases) {
      const slides = makeSlides();
      slides[0] = { type: "title", emoji: "🌈", title: "X", sub };
      const { story: s } = await normalizeStory(slides, OPTS);
      expect(s.title).toBe(expected);
    }
  });

  it("art/caption 的 <br> 归一化为 \\n，台词空白折叠", async () => {
    const { story } = await normalizeStory(makeSlides(), OPTS);
    expect(story.scenes[0].art).toBe("🌞🐓\n🛏️😴");
    expect(story.scenes[0].caption).toBe("The sun is up.\nSomeone is dreaming...");
    expect(story.scenes[0].lines[0].text).toBe("Good morning. Time to wake up!");
  });

  it("行 id 为 l<集>-<场景>-<句>，textHash 为 sha1(text)", async () => {
    const { story } = await normalizeStory(makeSlides(), OPTS);
    expect(story.scenes[0].lines.map((l) => l.id)).toEqual(["l01-1-1", "l01-1-2"]);
    expect(story.scenes[0].lines[0].textHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("speaker 小写化；封面 emoji 取首场景 art 的首个 emoji", async () => {
    const slides = makeSlides();
    (slides[2] as RawSlide & { type: "scene" }).lines[0] = { who: "Dad", text: "Hi." };
    const { story } = await normalizeStory(slides, OPTS);
    expect(story.scenes[0].lines[0].speaker).toBe("dad");
    expect(story.emoji).toBe("🌞");
  });

  it("songs/ending/intro 完整保留", async () => {
    const { story } = await normalizeStory(makeSlides(), OPTS);
    expect(story.intro).toHaveLength(2);
    expect(story.songs).toEqual(["🐓 Good Morning, Mr. Rooster"]);
    expect(story.ending?.title).toBe("What a Morning!");
  });

  it("normalizedHash 稳定且排除 source 块", async () => {
    const { story: a } = await normalizeStory(makeSlides(), OPTS);
    const { story: b } = await normalizeStory(makeSlides(), {
      ...OPTS,
      contentHash: "other",
      syncedAt: "2026-10-24T00:00:00.000Z",
    });
    expect(a.source.normalizedHash).toBe(b.source.normalizedHash);
    expect(a.source.normalizedHash).toBe(await computeNormalizedHash(a));
  });

  it("meta 由 storyToMeta 派生且统计正确", async () => {
    const { story, meta } = await normalizeStory(makeSlides(), OPTS);
    expect(meta).toEqual(storyToMeta(story));
    expect(meta.sceneCount).toBe(1);
    expect(meta.lineCount).toBe(2);
    expect(meta.file).toBe("stories/ep01-good-morning.json");
    expect(meta.sourceFile).toBe(OPTS.fileName);
  });

  it("文件名不合规抛 NormalizeStoryError", async () => {
    await expect(normalizeStory(makeSlides(), { ...OPTS, fileName: "random.html" })).rejects.toThrow(
      NormalizeStoryError
    );
  });

  it("title slide 全部缺失或 sub 不符合规律时 loudly 失败", async () => {
    const slides = makeSlides().filter((s) => s.type !== "title");
    await expect(normalizeStory(slides, OPTS)).rejects.toThrow(NormalizeStoryError);
    const bad = makeSlides();
    bad[0] = { type: "title", emoji: "🌈", title: "X", sub: "没有规律" };
    await expect(normalizeStory(bad, OPTS)).rejects.toThrow(NormalizeStoryError);
  });

  it("没有任何 scene 抛错", async () => {
    const slides = makeSlides().filter((s) => s.type !== "scene");
    await expect(normalizeStory(slides, OPTS)).rejects.toThrow(NormalizeStoryError);
  });
});
