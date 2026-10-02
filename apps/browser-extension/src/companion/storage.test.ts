import { describe, expect, it } from "vitest";

import { CompanionSession, FavoriteItem } from "../types/companion";
import {
  addFavorite,
  createCompanionId,
  loadFavorites,
  loadSessions,
  removeFavorite,
  saveSession,
} from "./storage";

function createFakeStorageArea(): chrome.storage.StorageArea {
  const data = new Map<string, unknown>();
  return {
    get: async (key?: string | string[] | null) => {
      if (typeof key === "string") {
        return data.has(key) ? { [key]: data.get(key) } : {};
      }
      return Object.fromEntries(data);
    },
    set: async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k);
    },
    clear: async () => data.clear(),
  } as unknown as chrome.storage.StorageArea;
}

const topic = { id: "t", titleZh: "话题", titleEn: "Topic", openerEn: "?" };

function makeSession(id: string, endedAt: number): CompanionSession {
  return {
    id,
    topic,
    level: "B1",
    messages: [{ role: "user", content: "hi", ts: endedAt - 1000 }],
    endedAt,
  };
}

function makeFavorite(id: string, en: string): FavoriteItem {
  return { id, type: "highlight", en, note: "n", sourceTopic: "话题", savedAt: 1 };
}

describe("storage", () => {
  it("createCompanionId 带前缀且互不相同", () => {
    const a = createCompanionId("s");
    const b = createCompanionId("s");
    expect(a).toMatch(/^s-/);
    expect(a).not.toBe(b);
  });

  it("saveSession 前插并截断到 50 条；load 坏数据回退空数组", async () => {
    const area = createFakeStorageArea();
    for (let i = 0; i < 55; i++) {
      await saveSession(makeSession(`s${i}`, i), area);
    }
    const sessions = await loadSessions(area);
    expect(sessions).toHaveLength(50);
    expect(sessions[0].id).toBe("s54"); // 最新在前

    await area.set({ companion_sessions: "broken" });
    expect(await loadSessions(area)).toEqual([]);
  });

  it("addFavorite 按 type+en 去重（大小写不敏感）；removeFavorite 按 id 删除", async () => {
    const area = createFakeStorageArea();
    await addFavorite(makeFavorite("f1", "It went well"), area);
    await addFavorite(makeFavorite("f2", "it WENT well"), area);
    await addFavorite(makeFavorite("f3", "Another one"), area);

    let favorites = await loadFavorites(area);
    // f2 与 f1 归一化后同 key：f1 被去重替换，f2 进入最前
    expect(favorites).toHaveLength(2);
    expect(favorites[0].id).toBe("f3"); // 新收藏在前

    await removeFavorite("f3", area);
    favorites = await loadFavorites(area);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe("f2");
  });
});
