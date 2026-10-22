/**
 * @file validate.ts
 * @description 资料库校验与自动修复
 *
 * 三级问题（spec §4.2）：
 * - error：结构损坏/业务违规，只报告（doctor 退出码非零，sync 拒绝落盘）；
 * - fixable：首尾空白、连续空格、hash 过期、index 不一致，doctor --fix 自动修；
 * - warning：缺 songs、空 caption、跨集疑似重复句，只报告。
 */

import { sha1Hex } from "../../shared/sha1";
import { isStory, SPEAKERS, type LibraryIndex, type Story } from "../model/types";
import { storyToMeta } from "./normalizeStory";
import { computeNormalizedHash } from "./storyHash";

export type IssueLevel = "error" | "warning" | "fixable";

export type IssueCode =
  | "INVALID_JSON_SHAPE"
  | "BAD_SPEAKER"
  | "EMPTY_TEXT"
  | "CJK_TEXT"
  | "HTML_RESIDUE"
  | "DUP_LINE_ID"
  | "BAD_LINE_ID"
  | "TRIM_WHITESPACE"
  | "COLLAPSE_SPACE"
  | "STALE_HASH"
  | "INDEX_MISMATCH"
  | "ORPHAN_STORY"
  | "NO_SONGS"
  | "EMPTY_CAPTION"
  | "DUP_LINE_TEXT"
  | "SOURCE_DRIFT";

export interface Issue {
  level: IssueLevel;
  code: IssueCode;
  /** 相关文件（相对 data/ 的路径或文件名） */
  file: string;
  message: string;
}

const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/;
const LINE_ID_RE = /^l\d{2,}-\d+-\d+$/;

/** 结构校验：isStory 守卫 + 精确到字段的错误信息 */
export function validateStoryShape(data: unknown, file: string): Issue[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [
      {
        level: "error",
        code: "INVALID_JSON_SHAPE",
        file,
        message: "不是合法的 story JSON 对象",
      },
    ];
  }
  const issues: Issue[] = [];
  if (isStory(data)) return issues;

  const story = data as Partial<Story>;
  if (story.schemaVersion !== 1) {
    issues.push({ level: "error", code: "INVALID_JSON_SHAPE", file, message: "schemaVersion 必须为 1" });
  }
  if (Array.isArray(story.scenes)) {
    for (const scene of story.scenes) {
      if (!Array.isArray(scene?.lines)) continue;
      for (const line of scene.lines) {
        if (line && !SPEAKERS.includes(line.speaker)) {
          issues.push({
            level: "error",
            code: "BAD_SPEAKER",
            file,
            message: `行 ${line.id ?? "?"} 的 speaker 非法：${JSON.stringify(line.speaker)}`,
          });
        }
      }
    }
  }
  if (issues.length === 0) {
    issues.push({
      level: "error",
      code: "INVALID_JSON_SHAPE",
      file,
      message: "字段缺失或类型错误（对照 model/types.ts 的 Story 结构）",
    });
  }
  return issues;
}

/** 内容 lint：业务规则（基于已通过结构校验的 Story） */
export function lintStoryContent(story: Story): Issue[] {
  const issues: Issue[] = [];
  const file = story.source.file;
  const seenIds = new Set<string>();

  for (const scene of story.scenes) {
    if (HTML_TAG_RE.test(scene.art) || HTML_TAG_RE.test(scene.caption)) {
      issues.push({ level: "error", code: "HTML_RESIDUE", file, message: `${scene.id} 的 art/caption 残留 HTML 标签` });
    }
    if (scene.caption === "") {
      issues.push({ level: "warning", code: "EMPTY_CAPTION", file, message: `${scene.id} 的 caption 为空` });
    }
    for (const line of scene.lines) {
      if (seenIds.has(line.id)) {
        issues.push({ level: "error", code: "DUP_LINE_ID", file, message: `行 id 重复：${line.id}` });
      }
      seenIds.add(line.id);
      if (!LINE_ID_RE.test(line.id)) {
        issues.push({ level: "error", code: "BAD_LINE_ID", file, message: `行 id 格式非法：${line.id}` });
      }
      if (line.text.length === 0) {
        issues.push({ level: "error", code: "EMPTY_TEXT", file, message: `${line.id} 文本为空` });
        continue;
      }
      if (CJK_RE.test(line.text)) {
        issues.push({ level: "error", code: "CJK_TEXT", file, message: `${line.id} 含中文字符："${line.text}"` });
      }
      if (line.text !== line.text.trim()) {
        issues.push({ level: "fixable", code: "TRIM_WHITESPACE", file, message: `${line.id} 首尾空白` });
      }
      if (/ {2,}|\t|\n/.test(line.text)) {
        issues.push({ level: "fixable", code: "COLLAPSE_SPACE", file, message: `${line.id} 含连续空白` });
      }
    }
  }

  if (!story.songs || story.songs.length === 0) {
    issues.push({ level: "warning", code: "NO_SONGS", file, message: "缺少 songs" });
  }
  return issues;
}

/**
 * 自动修复可修项：trim/空白折叠 + 重算 textHash 与 normalizedHash。
 * 返回实际执行的修复描述（无修复返回空数组）。
 */
export async function fixStoryInPlace(story: Story): Promise<string[]> {
  const applied: string[] = [];
  for (const scene of story.scenes) {
    for (const line of scene.lines) {
      const fixed = line.text.trim().replace(/\s+/g, " ");
      if (fixed !== line.text) {
        line.text = fixed;
        applied.push(`${line.id}: 空白归一化`);
      }
      const hash = await sha1Hex(line.text);
      if (hash !== line.textHash) {
        line.textHash = hash;
        applied.push(`${line.id}: textHash 重算`);
      }
    }
  }
  const normalizedHash = await computeNormalizedHash(story);
  if (normalizedHash !== story.source.normalizedHash) {
    story.source.normalizedHash = normalizedHash;
    applied.push("normalizedHash 重算");
  }
  return applied;
}

/** 校验 index 与实际 story 文件集一致（不一致为 fixable，由 doctor/sync 重建） */
export function validateLibraryIndex(index: LibraryIndex, stories: Story[]): Issue[] {
  const issues: Issue[] = [];
  const storyCategory = index.categories.find((c) => c.id === "story");
  const actual = stories.map(storyToMeta).sort((a, b) => a.episode - b.episode);
  const recorded = [...(storyCategory?.items ?? [])].sort((a, b) => a.episode - b.episode);
  if (JSON.stringify(recorded) !== JSON.stringify(actual)) {
    issues.push({
      level: "fixable",
      code: "INDEX_MISMATCH",
      file: "index.json",
      message: `index 与实际数据不一致（记录 ${recorded.length} 条 / 实际 ${actual.length} 条）`,
    });
  }
  return issues;
}

/** 重建 index（sync 与 doctor --fix 共用） */
export function buildLibraryIndex(stories: Story[]): LibraryIndex {
  const items = stories.map(storyToMeta).sort((a, b) => a.episode - b.episode);
  return { version: 1, categories: [{ id: "story", name: "故事幻灯片", items }] };
}
