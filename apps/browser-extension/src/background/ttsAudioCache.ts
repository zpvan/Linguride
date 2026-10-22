/**
 * @file ttsAudioCache.ts
 * @description TTS 句子音频缓存：IndexedDB 持久化 + LRU（默认 50MB 上限）
 *
 * 缓存在 service worker 侧（页面拿不到音频字节），接入 requestTTSAudioWithPriority
 * 合成漏斗，对全体调用方（资料库/语料库/语镜/划词）透明生效。
 * key = sha1(tts_selection + 各 provider 配置 JSON + text)；语速不参与（播放时才应用）。
 * 所有读写失败静默降级为不缓存，绝不影响播放。
 */

import { sha1Hex } from "../shared/sha1";
import type { LingridConfig } from "../types/config";

export interface TTSAudioCacheEntry {
  key: string;
  audioBase64: string;
  mimeType: string;
  provider: string;
  /** 以 base64 字符串长度近似（≈实际字节 4/3），仅用于容量控制 */
  bytes: number;
  lastUsedAt: number;
}

export interface TTSAudioCacheStore {
  get(key: string): Promise<TTSAudioCacheEntry | undefined>;
  put(entry: TTSAudioCacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<TTSAudioCacheEntry[]>;
}

export const TTS_AUDIO_CACHE_MAX_BYTES = 50 * 1024 * 1024;

/** 缓存 key：sha1(TTS 相关配置 + 文本)。任一 provider 配置变化即整体失效，简单可靠。 */
export async function makeTTSAudioCacheKey(
  config: LingridConfig,
  text: string
): Promise<string> {
  return sha1Hex(
    JSON.stringify({
      s: config.tts_selection ?? "browser",
      m: config.minimax_tts ?? null,
      x: config.xiaomi_tts ?? null,
      d: config.doubao_tts ?? null,
      t: text,
    })
  );
}

/** 纯函数：总量超限时返回待删除 key（lastUsedAt 最旧优先，删到上限内为止） */
export function selectEvictionKeys(
  entries: TTSAudioCacheEntry[],
  maxBytes: number = TTS_AUDIO_CACHE_MAX_BYTES
): string[] {
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= maxBytes) return [];
  const sorted = [...entries].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  const keys: string[] = [];
  let bytes = total;
  for (const entry of sorted) {
    if (bytes <= maxBytes) break;
    keys.push(entry.key);
    bytes -= entry.bytes;
  }
  return keys;
}

export interface TTSAudioCache {
  get(key: string): Promise<TTSAudioCacheEntry | undefined>;
  put(entry: Omit<TTSAudioCacheEntry, "lastUsedAt">): Promise<void>;
}

/** 带 lastUsedAt 维护与 LRU 清理的缓存门面；存储异常全部静默降级 */
export function createTTSAudioCache(
  store: TTSAudioCacheStore,
  now: () => number = Date.now,
  maxBytes: number = TTS_AUDIO_CACHE_MAX_BYTES
): TTSAudioCache {
  return {
    async get(key) {
      try {
        const entry = await store.get(key);
        if (!entry) return undefined;
        await store.put({ ...entry, lastUsedAt: now() });
        return entry;
      } catch (error) {
        console.warn("[Lingride] TTS 音频缓存读取失败，按未缓存处理:", error);
        return undefined;
      }
    },
    async put(entry) {
      try {
        await store.put({ ...entry, lastUsedAt: now() });
        const all = await store.getAll();
        for (const key of selectEvictionKeys(all, maxBytes)) {
          await store.delete(key);
        }
      } catch (error) {
        console.warn("[Lingride] TTS 音频缓存写入失败:", error);
      }
    },
  };
}

// ====== IndexedDB 实现 ======

const DB_NAME = "lingride-tts-audio-cache";
const STORE_NAME = "audios";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class IndexedDBTTSAudioCacheStore implements TTSAudioCacheStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  async get(key: string): Promise<TTSAudioCacheEntry | undefined> {
    const db = await this.db();
    const tx = db.transaction(STORE_NAME, "readonly");
    const result = await requestToPromise(
      tx.objectStore(STORE_NAME).get(key) as IDBRequest<TTSAudioCacheEntry | undefined>
    );
    await txDone(tx);
    return result;
  }

  async put(entry: TTSAudioCacheEntry): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    await txDone(tx);
  }

  async delete(key: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    await txDone(tx);
  }

  async getAll(): Promise<TTSAudioCacheEntry[]> {
    const db = await this.db();
    const tx = db.transaction(STORE_NAME, "readonly");
    const result = await requestToPromise(
      tx.objectStore(STORE_NAME).getAll() as IDBRequest<TTSAudioCacheEntry[]>
    );
    await txDone(tx);
    return result;
  }
}
