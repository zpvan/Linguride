/**
 * @file translationCache.ts
 * @description 页面级翻译缓存
 *
 * 在页面生命周期内缓存翻译结果，避免重复请求 API。
 * 使用内存存储，页面刷新后自动清空。
 *
 * 缓存策略：
 * - 以原文文本的哈希为键
 * - 不设置过期时间（页面刷新即清空）
 * - 提供命中率统计
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { CacheEntry, simpleHash, TranslationCache } from "../types";

/**
 * 缓存存储
 */
const cache: TranslationCache = new Map();

/**
 * 统计信息
 */
const stats = {
  hits: 0,
  misses: 0,
};

/**
 * 生成缓存键
 *
 * @param text - 原始文本
 * @returns 缓存键
 */
function getCacheKey(text: string): string {
  return simpleHash(text);
}

/**
 * 获取缓存的翻译
 *
 * @param originalText - 原始英文文本
 * @returns 缓存的翻译结果，如果未命中返回 undefined
 */
export function getCachedTranslation(originalText: string): string | undefined {
  const key = getCacheKey(originalText);
  const entry = cache.get(key);

  if (entry && entry.originalText === originalText) {
    stats.hits++;
    return entry.translation;
  }

  stats.misses++;
  return undefined;
}

/**
 * 存储翻译到缓存
 *
 * @param originalText - 原始英文文本
 * @param translation - 翻译后的中文文本
 */
export function setCachedTranslation(
  originalText: string,
  translation: string
): void {
  const key = getCacheKey(originalText);
  const entry: CacheEntry = {
    originalText,
    translation,
    timestamp: Date.now(),
  };
  cache.set(key, entry);
}

/**
 * 批量存储翻译
 *
 * @param pairs - 原文和翻译的对应数组
 */
export function setCachedTranslations(
  pairs: Array<{ original: string; translation: string }>
): void {
  for (const { original, translation } of pairs) {
    setCachedTranslation(original, translation);
  }
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  console.log("[Lingride] 缓存已清空");
}

/**
 * 获取缓存统计信息
 *
 * @returns 统计信息对象
 */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
} {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : "0.0";

  return {
    size: cache.size,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: `${hitRate}%`,
  };
}

/**
 * 检查文本是否已缓存
 *
 * @param originalText - 原始英文文本
 * @returns 是否已缓存
 */
export function isCached(originalText: string): boolean {
  const key = getCacheKey(originalText);
  const entry = cache.get(key);
  return !!entry && entry.originalText === originalText;
}
