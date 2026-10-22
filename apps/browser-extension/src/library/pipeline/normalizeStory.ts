/**
 * @file normalizeStory.ts
 * @description 归一化：RawSlide[] → Story + LibraryItemMeta
 *
 * 严格规则（spec §3.4）：
 * - art/caption 的 <br> 一律转为 \n，不留任何 HTML；
 * - 台词 trim + 连续空白折叠为单空格；
 * - speaker 小写化（未知值留给 validate 报错）；
 * - 标题从首个 title slide 的 sub 派生，派生失败 loudly 抛错；
 * - 封面 emoji 取首场景 art 的首个 emoji，回退 intro[0].emoji。
 */

import { sha1Hex } from "../../shared/sha1";
import type { LibraryItemMeta, Speaker, Story } from "../model/types";
import type { RawSlide } from "./parseStoryPpt";
import { computeNormalizedHash } from "./storyHash";

export class NormalizeStoryError extends Error {
  constructor(
    public readonly fileName: string,
    detail: string
  ) {
    super(`${fileName}: ${detail}`);
    this.name = "NormalizeStoryError";
  }
}

export interface NormalizeOptions {
  fileName: string;
  contentHash: string;
  syncedAt: string;
}

/** 多行文本（art/caption）：<br> → \n，逐行 trim，行内空白折叠 */
function cleanMultiline(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter(
      (line, index, arr) =>
        !(line === "" && (index === 0 || index === arr.length - 1 || arr[index - 1] === ""))
    )
    .join("\n")
    .trim();
}

/** 单行文本（台词/标题）：trim + 全部空白折叠为单空格 */
function cleanInline(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** 提取字符串中第一个 emoji（含变体选择符） */
function firstEmoji(input: string): string | null {
  const match = /\p{Extended_Pictographic}\u{FE0F}?/u.exec(input);
  return match ? match[0] : null;
}

/**
 * 从首个 title slide 的 sub 派生显示标题：
 * `Episode 1 · Good Morning, Kimi! ☀️` → `Good Morning, Kimi!`
 * 剥离前缀 → 剥离尾部括号注释 → 剥离尾部非 ASCII（emoji）→ trim
 */
function deriveTitle(sub: string, fileName: string): string {
  let rest = sub.replace(/^Episode\s+\d+\s*·\s*/, "");
  rest = rest.replace(/\s*\([^)]*\)\s*$/, "");
  rest = rest.replace(/[^\x00-\x7F\s]+\s*$/, "").trim();
  if (!rest) {
    throw new NormalizeStoryError(
      fileName,
      `无法从首个 title slide 的 sub 派生标题："${sub}"`
    );
  }
  return rest;
}

/** 从归一化后的 Story 派生索引元信息（sync/doctor 共用） */
export function storyToMeta(story: Story): LibraryItemMeta {
  return {
    id: story.id,
    category: "story",
    episode: story.episode,
    title: story.title,
    emoji: story.emoji,
    sceneCount: story.scenes.length,
    lineCount: story.scenes.reduce((sum, scene) => sum + scene.lines.length, 0),
    file: `stories/${story.id}.json`,
    sourceFile: story.source.file,
  };
}

export async function normalizeStory(
  slides: RawSlide[],
  options: NormalizeOptions
): Promise<{ story: Story; meta: LibraryItemMeta }> {
  const { fileName, contentHash, syncedAt } = options;

  const nameMatch = /^episode-(\d+)-(.+)\.html$/.exec(fileName);
  if (!nameMatch) {
    throw new NormalizeStoryError(fileName, "文件名不符合 episode-NN-<slug>.html");
  }
  const episode = parseInt(nameMatch[1], 10);
  const episodePad = nameMatch[1].padStart(2, "0");
  const slug = nameMatch[2].replace(/-kimi$/, "");
  const id = `ep${episodePad}-${slug}`;

  const introSlides = slides.filter(
    (s): s is Extract<RawSlide, { type: "title" }> => s.type === "title"
  );
  const sceneSlides = slides.filter(
    (s): s is Extract<RawSlide, { type: "scene" }> => s.type === "scene"
  );
  const songsSlides = slides.filter(
    (s): s is Extract<RawSlide, { type: "songs" }> => s.type === "songs"
  );
  const endSlides = slides.filter(
    (s): s is Extract<RawSlide, { type: "end" }> => s.type === "end"
  );

  if (introSlides.length === 0) {
    throw new NormalizeStoryError(fileName, "缺少 title slide");
  }
  if (sceneSlides.length === 0) {
    throw new NormalizeStoryError(fileName, "缺少 scene slide");
  }

  const title = deriveTitle(introSlides[0].sub, fileName);

  const scenes = sceneSlides.map((scene, sceneIndex) => ({
    id: `s${sceneIndex + 1}`,
    tag: cleanInline(scene.tag),
    title: cleanInline(scene.title),
    art: cleanMultiline(scene.art),
    caption: cleanMultiline(scene.caption),
    lines: [] as Story["scenes"][number]["lines"],
  }));

  for (const [sceneIndex, scene] of sceneSlides.entries()) {
    for (const [lineIndex, line] of scene.lines.entries()) {
      const text = cleanInline(line.text);
      scenes[sceneIndex].lines.push({
        id: `l${episodePad}-${sceneIndex + 1}-${lineIndex + 1}`,
        speaker: line.who.trim().toLowerCase() as Speaker,
        text,
        textHash: await sha1Hex(text),
      });
    }
  }

  const songs = songsSlides.flatMap((s) => s.list.map(cleanInline));
  const ending = endSlides.length > 0 ? endSlides[endSlides.length - 1] : undefined;

  const coverEmoji =
    (scenes.length > 0 ? firstEmoji(scenes[0].art) : null) ??
    firstEmoji(introSlides[0].emoji) ??
    "📖";

  const storyWithoutHash: Omit<Story, "source"> & {
    source: Omit<Story["source"], "normalizedHash">;
  } = {
    schemaVersion: 1,
    id,
    category: "story",
    episode,
    title,
    emoji: coverEmoji,
    intro: introSlides.map((s) => ({
      emoji: cleanInline(s.emoji),
      title: cleanInline(s.title),
      sub: cleanInline(s.sub),
    })),
    scenes,
    ...(songs.length > 0 ? { songs } : {}),
    ...(ending
      ? {
          ending: {
            emoji: cleanInline(ending.emoji),
            title: cleanInline(ending.title),
            sub: cleanInline(ending.sub),
          },
        }
      : {}),
    source: { file: fileName, contentHash, syncedAt },
  };

  // normalizedHash 基于「不含 source 块」的内容计算
  const normalizedHash = await computeNormalizedHash(storyWithoutHash as Story);

  const story: Story = {
    ...storyWithoutHash,
    source: { ...storyWithoutHash.source, normalizedHash },
  };
  return { story, meta: storyToMeta(story) };
}
