import { describe, expect, it } from "vitest";

import type { LingridConfig } from "../types/config";
import {
  createTTSAudioCache,
  makeTTSAudioCacheKey,
  selectEvictionKeys,
  type TTSAudioCacheEntry,
  type TTSAudioCacheStore,
} from "./ttsAudioCache";

function makeConfig(overrides: Partial<LingridConfig> = {}): LingridConfig {
  return {
    tts_selection: "minimax",
    minimax_tts: { api_key: "k1" },
    ...overrides,
  } as unknown as LingridConfig;
}

class MemoryStore implements TTSAudioCacheStore {
  map = new Map<string, TTSAudioCacheEntry>();
  async get(key: string) {
    return this.map.get(key);
  }
  async put(entry: TTSAudioCacheEntry) {
    this.map.set(entry.key, entry);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async getAll() {
    return [...this.map.values()];
  }
}

describe("makeTTSAudioCacheKey", () => {
  it("同配置同文本 key 相同；换文本/换 provider 配置 key 不同", async () => {
    const a = await makeTTSAudioCacheKey(makeConfig(), "Hello.");
    expect(a).toBe(await makeTTSAudioCacheKey(makeConfig(), "Hello."));
    expect(a).not.toBe(await makeTTSAudioCacheKey(makeConfig(), "Hello!"));
    expect(a).not.toBe(await makeTTSAudioCacheKey(makeConfig({ tts_selection: "doubao" }), "Hello."));
    const otherKey = makeConfig();
    (otherKey as { minimax_tts: { api_key: string } }).minimax_tts.api_key = "k2";
    expect(a).not.toBe(await makeTTSAudioCacheKey(otherKey, "Hello."));
  });
  it("与 TTS 无关的配置字段不影响 key", async () => {
    const c1 = makeConfig();
    const c2 = { ...makeConfig(), model: "another-model" } as LingridConfig;
    expect(await makeTTSAudioCacheKey(c1, "Hi")).toBe(await makeTTSAudioCacheKey(c2, "Hi"));
  });
});

describe("selectEvictionKeys", () => {
  const entry = (key: string, bytes: number, lastUsedAt: number): TTSAudioCacheEntry => ({
    key,
    audioBase64: "",
    mimeType: "audio/mpeg",
    provider: "minimax",
    bytes,
    lastUsedAt,
  });
  it("总量未超限不清理", () => {
    expect(selectEvictionKeys([entry("a", 100, 1)], 1000)).toEqual([]);
  });
  it("超限时按 lastUsedAt 最旧优先清理到上限内", () => {
    const entries = [entry("a", 60, 1), entry("b", 60, 2), entry("c", 60, 3)];
    expect(selectEvictionKeys(entries, 100)).toEqual(["a", "b"]);
  });
});

describe("createTTSAudioCache", () => {
  it("put 后可 get；get 会刷新 lastUsedAt", async () => {
    let now = 1000;
    const store = new MemoryStore();
    const cache = createTTSAudioCache(store, () => now);
    await cache.put({ key: "k", audioBase64: "AA", mimeType: "audio/mpeg", provider: "minimax", bytes: 2 });
    now = 2000;
    await cache.get("k");
    expect(store.map.get("k")?.lastUsedAt).toBe(2000);
  });
  it("put 后总量超限自动清理最旧", async () => {
    let now = 0;
    const store = new MemoryStore();
    const cache = createTTSAudioCache(store, () => (now += 10), 100);
    await cache.put({ key: "old", audioBase64: "A".repeat(60), mimeType: "m", provider: "p", bytes: 60 });
    await cache.put({ key: "new", audioBase64: "B".repeat(60), mimeType: "m", provider: "p", bytes: 60 });
    expect(store.map.has("old")).toBe(false);
    expect(store.map.has("new")).toBe(true);
  });
  it("存储抛错时 get 返回 undefined、put 静默（不阻断播放）", async () => {
    const broken: TTSAudioCacheStore = {
      get: () => Promise.reject(new Error("idb broken")),
      put: () => Promise.reject(new Error("idb broken")),
      delete: () => Promise.reject(new Error("idb broken")),
      getAll: () => Promise.reject(new Error("idb broken")),
    };
    const cache = createTTSAudioCache(broken);
    await expect(cache.get("k")).resolves.toBeUndefined();
    await expect(
      cache.put({ key: "k", audioBase64: "A", mimeType: "m", provider: "p", bytes: 1 })
    ).resolves.toBeUndefined();
  });
});
