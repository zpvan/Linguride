/**
 * @file companionMemory.ts
 * @description 「语伴」轻量跨对话记忆：用户事实的存储与增删合并
 *
 * 存储于 chrome.storage.local（key: companion_memory），上限
 * MAX_MEMORY_FACTS 条，超限时按 lastSeenAt 淘汰最旧。
 * 事实的提炼由 companionSummary 在对话结束时完成，
 * 本模块只负责合并与持久化。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { MemoryFact } from "../types/companion";

/** 记忆存储 key */
export const MEMORY_STORAGE_KEY = "companion_memory";

/** 记忆事实上限 */
export const MAX_MEMORY_FACTS = 30;

/** 记忆增量（由总结调用一次性产出） */
export interface MemoryUpdate {
  add?: string[];
  remove?: string[];
}

/** 归一化事实文本：小写 + 压缩空白，用于去重与删除匹配 */
export function normalizeFactText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 应用记忆增量，返回合并后的新事实列表
 *
 * - add：归一化去重；重复项刷新 lastSeenAt（视为"再次被提及"）
 * - remove：按归一化文本精确删除（LLM 从旧列表中原文选取）
 * - 合并后按 lastSeenAt 降序截断到 MAX_MEMORY_FACTS
 *
 * @param existing - 现有事实列表
 * @param update - 增量
 * @param now - 当前时间戳（注入便于测试）
 */
export function applyMemoryUpdate(
  existing: MemoryFact[],
  update: MemoryUpdate,
  now: number
): MemoryFact[] {
  const removed = new Set((update.remove ?? []).map(normalizeFactText));
  const facts = existing.filter((f) => !removed.has(normalizeFactText(f.text)));

  for (const raw of update.add ?? []) {
    const text = raw.trim();
    if (!text) continue;
    const key = normalizeFactText(text);
    const dup = facts.find((f) => normalizeFactText(f.text) === key);
    if (dup) {
      dup.lastSeenAt = now;
    } else {
      facts.push({ text, createdAt: now, lastSeenAt: now });
    }
  }

  return facts
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MAX_MEMORY_FACTS);
}

/** 读取记忆事实（坏数据回退为空数组，不抛错） */
export async function loadMemoryFacts(
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<MemoryFact[]> {
  const result = await area.get(MEMORY_STORAGE_KEY);
  const raw = result[MEMORY_STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is MemoryFact =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as MemoryFact).text === "string" &&
      typeof (item as MemoryFact).createdAt === "number" &&
      typeof (item as MemoryFact).lastSeenAt === "number"
  );
}

/** 保存记忆事实 */
export async function saveMemoryFacts(
  facts: MemoryFact[],
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<void> {
  await area.set({ [MEMORY_STORAGE_KEY]: facts });
}

/** 清空记忆（「清除语伴记忆」按钮） */
export async function clearCompanionMemory(
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<void> {
  await area.remove(MEMORY_STORAGE_KEY);
}
