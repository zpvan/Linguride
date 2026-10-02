/**
 * @file storage.ts
 * @description 「语伴」历史会话与收藏的 chrome.storage.local 读写
 *
 * 页面直存（扩展页面有 storage 权限），不经 Background 中转。
 * 存储上限：历史 50 场（新→旧），收藏不设硬上限（用户主动行为）。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

import { CompanionSession, FavoriteItem } from "../types/companion";

const SESSIONS_KEY = "companion_sessions";
const FAVORITES_KEY = "companion_favorites";
const MAX_SESSIONS = 50;

/** 生成带前缀的唯一 id */
export function createCompanionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ====== 历史会话 ======

export async function loadSessions(
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<CompanionSession[]> {
  const result = await area.get(SESSIONS_KEY);
  const raw = result[SESSIONS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CompanionSession =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as CompanionSession).id === "string" &&
      Array.isArray((item as CompanionSession).messages)
  );
}

/** 保存会话（前插，截断到 MAX_SESSIONS） */
export async function saveSession(
  session: CompanionSession,
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<void> {
  const sessions = await loadSessions(area);
  sessions.unshift(session);
  await area.set({ [SESSIONS_KEY]: sessions.slice(0, MAX_SESSIONS) });
}

// ====== 收藏 ======

export async function loadFavorites(
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<FavoriteItem[]> {
  const result = await area.get(FAVORITES_KEY);
  const raw = result[FAVORITES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is FavoriteItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as FavoriteItem).id === "string" &&
      typeof (item as FavoriteItem).en === "string"
  );
}

/** 添加收藏（按 type+en 归一化去重，新收藏在前） */
export async function addFavorite(
  item: FavoriteItem,
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<void> {
  const favorites = await loadFavorites(area);
  const key = `${item.type}:${item.en.trim().toLowerCase()}`;
  const deduped = favorites.filter(
    (f) => `${f.type}:${f.en.trim().toLowerCase()}` !== key
  );
  deduped.unshift(item);
  await area.set({ [FAVORITES_KEY]: deduped });
}

/** 按 id 删除收藏 */
export async function removeFavorite(
  id: string,
  area: chrome.storage.StorageArea = chrome.storage.local
): Promise<void> {
  const favorites = await loadFavorites(area);
  await area.set({
    [FAVORITES_KEY]: favorites.filter((f) => f.id !== id),
  });
}
