/**
 * @file translationCache.ts
 * @description 页面级翻译缓存
 *
 * 在页面生命周期内缓存翻译、释义、混杂翻译结果，避免重复请求 API。
 * 使用内存存储，页面刷新后自动清空。
 *
 * 缓存策略：
 * - 翻译：以原文文本的哈希为键
 * - 释义/混杂：以原文哈希 + 用户等级为键（输出依赖用户等级）
 * - 不设置过期时间（页面刷新即清空）
 * - 提供命中率统计
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { CacheEntry, simpleHash, TranslationCache } from "../types";

/**
 * 翻译缓存存储
 */
const cache: TranslationCache = new Map();

/**
 * 释义缓存存储（键包含用户等级）
 */
const paraphraseCache: Map<string, CacheEntry> = new Map();

/**
 * 混杂翻译缓存存储（键包含用户等级）
 */
const mixedTranslateCache: Map<string, CacheEntry> = new Map();

/**
 * 统计信息
 */
const stats = {
  hits: 0,
  misses: 0,
};

/**
 * 生成缓存键（仅文本）
 *
 * @param text - 原始文本
 * @returns 缓存键
 */
function getCacheKey(text: string): string {
  return simpleHash(text);
}

/**
 * 生成带用户等级的缓存键
 *
 * 释义和混杂翻译的输出依赖用户 CEFR 等级，
 * 等级变化后旧缓存自动失效（键不匹配）。
 *
 * @param text - 原始文本
 * @param level - 用户 CEFR 等级（如 A1, A2, B1, B2, C1, C2）
 * @returns 缓存键
 */
function getLeveledCacheKey(text: string, level: string): string {
  return simpleHash(`${level}:${text}`);
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
 * 清空所有缓存（翻译、释义、混杂翻译）
 */
export function clearCache(): void {
  cache.clear();
  paraphraseCache.clear();
  mixedTranslateCache.clear();
  stats.hits = 0;
  stats.misses = 0;
  console.log("[Lingride] 所有缓存已清空");
}

/**
 * 获取缓存统计信息
 *
 * @returns 统计信息对象
 */
export function getCacheStats(): {
  size: number;
  translationSize: number;
  paraphraseSize: number;
  mixedTranslateSize: number;
  hits: number;
  misses: number;
  hitRate: string;
} {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : "0.0";

  return {
    size: cache.size + paraphraseCache.size + mixedTranslateCache.size,
    translationSize: cache.size,
    paraphraseSize: paraphraseCache.size,
    mixedTranslateSize: mixedTranslateCache.size,
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

// ====== 释义缓存 ======

/**
 * 获取缓存的释义
 *
 * @param originalText - 原始英文文本
 * @param level - 用户 CEFR 等级
 * @returns 缓存的释义结果，如果未命中返回 undefined
 */
export function getCachedParaphrase(
  originalText: string,
  level: string
): string | undefined {
  const key = getLeveledCacheKey(originalText, level);
  const entry = paraphraseCache.get(key);

  if (entry && entry.originalText === originalText) {
    stats.hits++;
    return entry.translation; // 复用 translation 字段存储释义结果
  }

  stats.misses++;
  return undefined;
}

/**
 * 存储释义到缓存
 *
 * @param originalText - 原始英文文本
 * @param paraphrase - 释义后的文本
 * @param level - 用户 CEFR 等级
 */
export function setCachedParaphrase(
  originalText: string,
  paraphrase: string,
  level: string
): void {
  const key = getLeveledCacheKey(originalText, level);
  const entry: CacheEntry = {
    originalText,
    translation: paraphrase, // 复用 translation 字段
    timestamp: Date.now(),
  };
  paraphraseCache.set(key, entry);
}

/**
 * 批量存储释义
 *
 * @param pairs - 原文和释义的对应数组
 * @param level - 用户 CEFR 等级
 */
export function setCachedParaphrases(
  pairs: Array<{ original: string; paraphrase: string }>,
  level: string
): void {
  for (const { original, paraphrase } of pairs) {
    setCachedParaphrase(original, paraphrase, level);
  }
}

// ====== 混杂翻译缓存 ======

/**
 * 获取缓存的混杂翻译
 *
 * @param originalText - 原始英文文本
 * @param level - 用户 CEFR 等级
 * @returns 缓存的混杂翻译结果，如果未命中返回 undefined
 */
export function getCachedMixedTranslation(
  originalText: string,
  level: string
): string | undefined {
  const key = getLeveledCacheKey(originalText, level);
  const entry = mixedTranslateCache.get(key);

  if (entry && entry.originalText === originalText) {
    stats.hits++;
    return entry.translation; // 复用 translation 字段存储混杂翻译结果
  }

  stats.misses++;
  return undefined;
}

/**
 * 存储混杂翻译到缓存
 *
 * @param originalText - 原始英文文本
 * @param mixedText - 混杂中英翻译后的文本
 * @param level - 用户 CEFR 等级
 */
export function setCachedMixedTranslation(
  originalText: string,
  mixedText: string,
  level: string
): void {
  const key = getLeveledCacheKey(originalText, level);
  const entry: CacheEntry = {
    originalText,
    translation: mixedText, // 复用 translation 字段
    timestamp: Date.now(),
  };
  mixedTranslateCache.set(key, entry);
}

/**
 * 批量存储混杂翻译
 *
 * @param pairs - 原文和混杂翻译的对应数组
 * @param level - 用户 CEFR 等级
 */
export function setCachedMixedTranslations(
  pairs: Array<{ original: string; mixedText: string }>,
  level: string
): void {
  for (const { original, mixedText } of pairs) {
    setCachedMixedTranslation(original, mixedText, level);
  }
}
