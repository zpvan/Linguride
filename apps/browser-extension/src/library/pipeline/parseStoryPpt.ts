/**
 * @file parseStoryPpt.ts
 * @description 解析 story-ppt HTML：提取 SLIDES 数组字面量并严格校验为 RawSlide[]
 */

import { JsLiteralSyntaxError, parseJsLiteral } from "./jsLiteral";

export class StoryPptParseError extends Error {
  constructor(
    public readonly fileName: string,
    detail: string
  ) {
    super(`${fileName}: ${detail}`);
    this.name = "StoryPptParseError";
  }
}

export type RawSlide =
  | { type: "title"; emoji: string; title: string; sub: string }
  | {
      type: "scene";
      tag: string;
      title: string;
      art: string;
      caption: string;
      lines: { who: string; text: string }[];
    }
  | { type: "songs"; title: string; list: string[] }
  | { type: "end"; emoji: string; title: string; sub: string };

/** 提取 `const SLIDES = [...]` 的数组字面量（配对扫描，跳过字符串内部括号） */
function extractSlidesLiteral(html: string, fileName: string): string {
  const match = /const\s+SLIDES\s*=\s*\[/.exec(html);
  if (!match) {
    throw new StoryPptParseError(fileName, "找不到 SLIDES 数组声明");
  }
  const start = match.index + match[0].length - 1; // 指向 '['
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new StoryPptParseError(fileName, "SLIDES 数组括号不配对");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  fileName: string,
  index: number
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new StoryPptParseError(fileName, `slide #${index} 含未知字段 "${key}"`);
    }
  }
}

function assertString(
  value: unknown,
  field: string,
  fileName: string,
  index: number
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new StoryPptParseError(fileName, `slide #${index} 的 ${field} 缺失或不是非空字符串`);
  }
  return value;
}

function toRawSlide(raw: unknown, index: number, fileName: string): RawSlide {
  if (!isRecord(raw)) {
    throw new StoryPptParseError(fileName, `slide #${index} 不是对象`);
  }
  const type = raw.type;
  switch (type) {
    case "title":
    case "end": {
      assertKeys(raw, ["type", "emoji", "title", "sub"], fileName, index);
      return {
        type,
        emoji: assertString(raw.emoji, "emoji", fileName, index),
        title: assertString(raw.title, "title", fileName, index),
        sub: assertString(raw.sub, "sub", fileName, index),
      };
    }
    case "scene": {
      assertKeys(raw, ["type", "tag", "title", "art", "caption", "lines"], fileName, index);
      if (!Array.isArray(raw.lines) || raw.lines.length === 0) {
        throw new StoryPptParseError(fileName, `slide #${index} 的 lines 缺失或为空`);
      }
      const lines = raw.lines.map((line, lineIndex) => {
        if (!isRecord(line)) {
          throw new StoryPptParseError(fileName, `slide #${index} lines[${lineIndex}] 不是对象`);
        }
        assertKeys(line, ["who", "text"], fileName, index);
        return {
          who: assertString(line.who, `lines[${lineIndex}].who`, fileName, index),
          text: assertString(line.text, `lines[${lineIndex}].text`, fileName, index),
        };
      });
      return {
        type: "scene",
        tag: assertString(raw.tag, "tag", fileName, index),
        title: assertString(raw.title, "title", fileName, index),
        art: assertString(raw.art, "art", fileName, index),
        caption: typeof raw.caption === "string" ? raw.caption : "",
        lines,
      };
    }
    case "songs": {
      assertKeys(raw, ["type", "title", "list"], fileName, index);
      if (
        !Array.isArray(raw.list) ||
        !raw.list.every((item) => typeof item === "string" && item.length > 0)
      ) {
        throw new StoryPptParseError(fileName, `slide #${index} 的 list 缺失或含非字符串项`);
      }
      return {
        type: "songs",
        title: assertString(raw.title, "title", fileName, index),
        list: raw.list as string[],
      };
    }
    default:
      throw new StoryPptParseError(
        fileName,
        `slide #${index} 的 type 未知：${JSON.stringify(type)}`
      );
  }
}

/** 解析 story-ppt HTML 全文，返回严格校验后的 RawSlide 数组 */
export function parseStoryPpt(html: string, fileName: string): RawSlide[] {
  const literal = extractSlidesLiteral(html, fileName);
  let value: unknown;
  try {
    value = parseJsLiteral(literal);
  } catch (error) {
    if (error instanceof JsLiteralSyntaxError) {
      throw new StoryPptParseError(fileName, `SLIDES 字面量语法错误：${error.message}`);
    }
    throw error;
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new StoryPptParseError(fileName, "SLIDES 不是非空数组");
  }
  return value.map((raw, index) => toRawSlide(raw, index, fileName));
}
