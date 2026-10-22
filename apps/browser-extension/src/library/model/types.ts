/**
 * @file types.ts
 * @description 资料库归一化数据模型与运行时类型守卫
 *
 * 数据由 scripts/library/sync-story-ppt.ts 生成，随扩展打包；
 * 页面加载时经守卫校验，防止损坏数据进入 UI。
 */

/** 说话人枚举（源 story-ppt 全量实测取值） */
export type Speaker = "mom" | "kimi" | "dad" | "friend";

export const SPEAKERS: readonly Speaker[] = ["mom", "kimi", "dad", "friend"];

/** 说话人 → 展示 emoji */
export const SPEAKER_EMOJI: Record<Speaker, string> = {
  mom: "👩🏻",
  kimi: "👧🏻",
  dad: "👨🏻",
  friend: "🧒🏻",
};

export interface StoryLine {
  /** 稳定 id：l<集>-<场景>-<句>，如 l01-1-1 */
  id: string;
  speaker: Speaker;
  text: string;
  /** sha1(text)，TTS 音频缓存 key 的组成部分 */
  textHash: string;
}

export interface StoryScene {
  /** s<n>，从 1 开始 */
  id: string;
  /** 原始场景标签，如 "SCENE 1" */
  tag: string;
  title: string;
  /** emoji 舞台，纯文本 \n 分隔（UI 以 pre-line 渲染） */
  art: string;
  caption: string;
  lines: StoryLine[];
}

export interface StoryIntroSlide {
  emoji: string;
  title: string;
  sub: string;
}

export interface StoryEnding {
  emoji: string;
  title: string;
  sub: string;
}

export interface StorySource {
  /** 源 HTML 文件名 */
  file: string;
  /** 源 HTML 内容的 sha1 */
  contentHash: string;
  /** 本 JSON 归一化内容（排除 source 块）的 sha1，sync 时写入，doctor --fix 可重算 */
  normalizedHash: string;
  /** 上次同步时间（ISO 8601） */
  syncedAt: string;
}

export interface Story {
  schemaVersion: 1;
  /** ep<NN>-<slug>，如 ep01-good-morning */
  id: string;
  category: "story";
  episode: number;
  /** 显示标题，派生自首个 title slide 的 sub */
  title: string;
  /** 卡片封面 emoji：首场景 art 的首个 emoji，回退 intro[0].emoji */
  emoji: string;
  intro: StoryIntroSlide[];
  scenes: StoryScene[];
  songs?: string[];
  ending?: StoryEnding;
  source: StorySource;
}

export interface LibraryItemMeta {
  id: string;
  category: "story";
  episode: number;
  title: string;
  emoji: string;
  sceneCount: number;
  lineCount: number;
  /** 相对 data/ 的文件路径 */
  file: string;
  sourceFile: string;
}

export interface LibraryCategory {
  id: "story";
  name: string;
  items: LibraryItemMeta[];
}

export interface LibraryIndex {
  version: 1;
  categories: LibraryCategory[];
}

// ====== 运行时守卫 ======

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSpeaker(value: unknown): value is Speaker {
  return typeof value === "string" && (SPEAKERS as readonly string[]).includes(value);
}

function isIntroSlide(value: unknown): value is StoryIntroSlide {
  return (
    isRecord(value) &&
    typeof value.emoji === "string" &&
    typeof value.title === "string" &&
    typeof value.sub === "string"
  );
}

function isEnding(value: unknown): value is StoryEnding {
  return isIntroSlide(value);
}

function isStoryLine(value: unknown): value is StoryLine {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isSpeaker(value.speaker) &&
    typeof value.text === "string" &&
    typeof value.textHash === "string"
  );
}

function isStoryScene(value: unknown): value is StoryScene {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tag === "string" &&
    typeof value.title === "string" &&
    typeof value.art === "string" &&
    typeof value.caption === "string" &&
    Array.isArray(value.lines) &&
    value.lines.every(isStoryLine)
  );
}

function isStorySource(value: unknown): value is StorySource {
  return (
    isRecord(value) &&
    typeof value.file === "string" &&
    typeof value.contentHash === "string" &&
    typeof value.normalizedHash === "string" &&
    typeof value.syncedAt === "string"
  );
}

export function isStory(value: unknown): value is Story {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    value.category === "story" &&
    typeof value.episode === "number" &&
    typeof value.title === "string" &&
    typeof value.emoji === "string" &&
    Array.isArray(value.intro) &&
    value.intro.every(isIntroSlide) &&
    Array.isArray(value.scenes) &&
    value.scenes.every(isStoryScene) &&
    (value.songs === undefined ||
      (Array.isArray(value.songs) && value.songs.every((s) => typeof s === "string"))) &&
    (value.ending === undefined || isEnding(value.ending)) &&
    isStorySource(value.source)
  );
}

function isLibraryItemMeta(value: unknown): value is LibraryItemMeta {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.category === "story" &&
    typeof value.episode === "number" &&
    typeof value.title === "string" &&
    typeof value.emoji === "string" &&
    typeof value.sceneCount === "number" &&
    typeof value.lineCount === "number" &&
    typeof value.file === "string" &&
    typeof value.sourceFile === "string"
  );
}

export function isLibraryIndex(value: unknown): value is LibraryIndex {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    Array.isArray(value.categories) &&
    value.categories.every(
      (c) =>
        isRecord(c) &&
        c.id === "story" &&
        typeof c.name === "string" &&
        Array.isArray(c.items) &&
        c.items.every(isLibraryItemMeta)
    )
  );
}
