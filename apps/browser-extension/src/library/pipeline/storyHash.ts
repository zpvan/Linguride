/**
 * @file storyHash.ts
 * @description 资料库哈希工具：源 HTML 内容哈希与归一化内容哈希（key 排序的稳定序列化）
 */

import { sha1Hex } from "../../shared/sha1";
import type { Story } from "../model/types";

/** 稳定序列化：对象 key 排序、undefined 字段跳过，保证同一内容哈希一致 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

/** 源 HTML 内容哈希 */
export async function computeContentHash(html: string): Promise<string> {
  return sha1Hex(html);
}

/** 归一化内容哈希（排除 source 块，使 contentHash/syncedAt 变化不影响） */
export async function computeNormalizedHash(story: Story): Promise<string> {
  const rest: Partial<Story> = { ...story };
  delete rest.source;
  return sha1Hex(stableStringify(rest));
}
