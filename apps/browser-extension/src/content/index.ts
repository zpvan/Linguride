/**
 * @file index.ts
 * @description Content Script 入口
 *
 * 注入到网页中的脚本，负责：
 * - 文本提取：识别页面中的英文段落
 * - 翻译注入：在原文下方插入中文翻译
 * - 页面缓存：缓存已翻译的文本
 * - 视口优先：只翻译用户可见区域，滚动时动态加载
 *
 * 工作流程：
 * 1. 收到翻译开启消息
 * 2. 提取页面中的英文段落
 * 3. 使用 Intersection Observer 监测视口
 * 4. 只翻译进入视口的内容
 * 5. 滚动时动态翻译新内容
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import {
  ExtractPageTextResponse,
  MessageType,
  TranslatableElement,
} from "../types";
import { BatchManager } from "./batchManager";
import {
  clearProcessedMarks,
  extractTranslatableElements,
} from "./textExtractor";
import {
  getCachedMixedTranslation,
  getCachedParaphrase,
  getCachedTranslation,
  getCacheStats,
  setCachedMixedTranslations,
  setCachedParaphrases,
  setCachedTranslations,
} from "./translationCache";
import {
  removeAllMixedTranslations,
  removeAllModeResults,
  removeAllParaphrases,
  removeAllTranslations,
  removeStaleMixedTranslations,
  removeStaleParaphrases,
  removeStaleTranslations,
  showError,
  showLoading,
  showMixedTranslateError,
  showMixedTranslateLoading,
  showMixedTranslation,
  showParaphrase,
  showParaphraseError,
  showParaphraseLoading,
  showTranslation,
} from "./translationInjector";
import { initSelectionToolbar } from "./selectionToolbar";
import { ViewportObserver } from "./viewportObserver";

// ====== 状态管理 ======

/** 当前翻译是否启用 */
let isTranslationEnabled = false;

/** 当前释义是否启用 */
let isParaphraseEnabled = false;

/** 当前混杂中英翻译是否启用 */
let isMixedTranslateEnabled = false;

/** 翻译是否正在运行中（重入保护） */
let isTranslationRunning = false;

/** 释义是否正在运行中（重入保护） */
let isParaphraseRunning = false;

/** 混杂中英翻译是否正在运行中（重入保护） */
let isMixedTranslateRunning = false;

/**
 * Epoch 计数器（翻译）
 *
 * 每次 startTranslation() 调用时递增。
 * 用于丢弃过期的 in-flight API 回调，防止旧结果写入已清理/重建的 DOM。
 */
let translationEpoch = 0;

/** Epoch 计数器（释义） */
let paraphraseEpoch = 0;

/** Epoch 计数器（混杂中英翻译） */
let mixedTranslateEpoch = 0;

/**
 * 当前用户 CEFR 等级
 * 从 Background 消息中获取，用于释义和混杂翻译的缓存键。
 */
let currentUserLevel = "A2";

/** 当前页面的可翻译元素 */
const translatableElements: Map<string, TranslatableElement> = new Map();

/** 批量管理器实例 */
const batchManager = new BatchManager();

/** 视口观察器实例（翻译用） */
let viewportObserver: ViewportObserver | null = null;

/** 视口观察器实例（释义用） */
let paraphraseViewportObserver: ViewportObserver | null = null;

/** 视口观察器实例（混杂中英翻译用） */
let mixedTranslateViewportObserver: ViewportObserver | null = null;

/** 正在翻译的批次 ID 集合 */
const pendingBatches: Set<string> = new Set();

/** 正在释义的批次 ID 集合 */
const pendingParaphraseBatches: Set<string> = new Set();

/** 正在混杂中英翻译的批次 ID 集合 */
const pendingMixedTranslateBatches: Set<string> = new Set();

// ====== 注入去重 ======

/**
 * 防止 Service Worker 通过 chrome.scripting.executeScript() 重复注入。
 * 重复注入会创建多套独立的消息监听器和状态，导致翻译重复执行。
 * 若已加载，跳过后续所有副作用注册（消息监听器、事件监听器）。
 */
const __lingride_already_loaded__ = !!(
  window as unknown as Record<string, boolean>
).__lingride_loaded__;
(window as unknown as Record<string, boolean>).__lingride_loaded__ = true;

// ====== 初始化 ======

if (__lingride_already_loaded__) {
  console.log("[Lingride] Content Script 已加载，跳过重复注入");
} else {
  console.log("[Lingride] Content Script 已加载");
}

const isTopFrame = window.top === window;

// ====== 核心功能 ======

/**
 * 开始翻译页面
 *
 * 提取页面元素，设置视口观察器，按需翻译。
 * 包含重入保护和 epoch 机制，防止重复翻译和过期回调写入。
 */
async function startTranslation(): Promise<void> {
  if (isTranslationRunning) {
    console.log("[Lingride] 翻译已在运行中，跳过");
    return;
  }
  isTranslationRunning = true;

  // 递增 epoch，使所有 in-flight 回调失效
  const currentEpoch = ++translationEpoch;

  console.log("[Lingride] 开始翻译页面...");

  try {
    // 0. 智能清理：仅移除 error/loading 容器，保留已成功的翻译
    removeStaleTranslations();
    clearProcessedMarks();
    translatableElements.clear();
    pendingBatches.clear();

    // 销毁旧的视口观察器
    if (viewportObserver) {
      viewportObserver.destroy();
      viewportObserver = null;
    }

    // 1. 提取可翻译元素
    const elements = extractTranslatableElements();

    if (elements.length === 0) {
      console.log("[Lingride] 未找到可翻译内容");
      return;
    }

    // 存储到 Map 以便后续查找
    for (const element of elements) {
      translatableElements.set(element.id, element);
    }

    // 2. 分离已缓存和需要翻译的元素
    const needsTranslation: TranslatableElement[] = [];
    let cachedCount = 0;

    for (const element of elements) {
      const cached = getCachedTranslation(element.originalText);
      if (cached) {
        // 直接显示缓存的翻译
        showTranslation(element, cached);
        cachedCount++;
      } else {
        needsTranslation.push(element);
      }
    }

    console.log(
      `[Lingride] ${elements.length} 个元素中，` +
        `${cachedCount} 个命中缓存，` +
        `${needsTranslation.length} 个需要翻译`
    );

    // 3. 如果没有需要翻译的内容，直接返回
    if (needsTranslation.length === 0) {
      console.log("[Lingride] 所有内容已缓存，无需翻译");
      return;
    }

    // 4. 创建视口观察器，按需翻译
    viewportObserver = new ViewportObserver((visibleElements) => {
      // 当元素进入视口时触发翻译，传递当前 epoch
      translateVisibleElements(visibleElements, currentEpoch);
    });

    // 5. 开始观察所有需要翻译的元素
    viewportObserver.observe(needsTranslation);
  } catch (error) {
    console.error("[Lingride] 翻译过程出错:", error);
  } finally {
    isTranslationRunning = false;
  }
}

/**
 * 翻译进入视口的元素
 *
 * @param elements - 进入视口的元素数组
 * @param epoch - 当前翻译 epoch，用于丢弃过期回调
 */
async function translateVisibleElements(
  elements: TranslatableElement[],
  epoch: number
): Promise<void> {
  // epoch 检查：如果已过期，丢弃
  if (epoch !== translationEpoch) return;

  // 过滤掉已经在处理中或已完成的元素
  const toTranslate = elements.filter((el) => {
    const cached = getCachedTranslation(el.originalText);
    if (cached) {
      showTranslation(el, cached);
      return false;
    }
    return true;
  });

  if (toTranslate.length === 0) return;

  // 显示加载状态
  for (const element of toTranslate) {
    showLoading(element);
  }

  // 创建批次并翻译
  const batches = batchManager.createBatches(toTranslate);

  // 并行发送所有批次请求（限制并发数）
  const concurrencyLimit = 3;
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchSlice = batches.slice(i, i + concurrencyLimit);
    await Promise.all(
      batchSlice.map((batch) =>
        translateBatch(batch.batchId, batch.texts, batch.elementIds, epoch)
      )
    );
  }

  // 打印缓存统计
  const stats = getCacheStats();
  console.log(
    `[Lingride] 翻译完成，缓存: 大小=${stats.size}, 命中率=${stats.hitRate}`
  );
}

/**
 * 翻译单个批次
 *
 * @param batchId - 批次 ID
 * @param texts - 待翻译文本数组
 * @param elementIds - 对应的元素 ID 数组
 * @param epoch - 当前翻译 epoch，用于丢弃过期回调
 */
async function translateBatch(
  batchId: string,
  texts: string[],
  elementIds: string[],
  epoch: number
): Promise<void> {
  // epoch 检查：发送前确认未过期
  if (epoch !== translationEpoch) return;

  // 避免重复请求
  if (pendingBatches.has(batchId)) return;
  pendingBatches.add(batchId);

  try {
    // 发送翻译请求到 Background
    const response = await chrome.runtime.sendMessage({
      type: MessageType.TRANSLATE,
      payload: { texts, batchId },
    });

    // epoch 检查：响应返回后再次确认未过期
    if (epoch !== translationEpoch) return;

    if (response.success && response.data) {
      // 处理翻译结果
      const { translations } = response.data;

      // 缓存翻译结果（即使 epoch 过期，缓存仍有价值）
      const pairs = texts.map((text, i) => ({
        original: text,
        translation: translations[i],
      }));
      setCachedTranslations(pairs);

      // 更新页面显示
      for (let i = 0; i < elementIds.length; i++) {
        const element = translatableElements.get(elementIds[i]);
        if (element && translations[i]) {
          showTranslation(element, translations[i]);
        }
      }
    } else {
      // 显示错误
      const errorMessage = response.error || "翻译失败";
      for (const elementId of elementIds) {
        const element = translatableElements.get(elementId);
        if (element) {
          showError(element, errorMessage);
        }
      }
    }
  } catch (error) {
    // epoch 检查：异常时也确认是否过期
    if (epoch !== translationEpoch) return;

    const errorMessage = error instanceof Error ? error.message : "请求失败";
    console.error("[Lingride] 批次翻译失败:", errorMessage);

    // 显示错误
    for (const elementId of elementIds) {
      const element = translatableElements.get(elementId);
      if (element) {
        showError(element, errorMessage);
      }
    }
  } finally {
    pendingBatches.delete(batchId);
  }
}

/**
 * 停止翻译
 *
 * 移除所有翻译显示，清理状态。
 */
function stopTranslation(): void {
  console.log("[Lingride] 停止翻译");

  // 停止视口观察
  if (viewportObserver) {
    viewportObserver.destroy();
    viewportObserver = null;
  }

  // 移除所有翻译显示
  removeAllTranslations();

  // 清除处理标记
  clearProcessedMarks();

  // 清空元素记录
  translatableElements.clear();
  pendingBatches.clear();

  // 注意：不清空缓存，以便重新开启时使用
}

// ====== 释义功能 ======

/**
 * 开始释义页面
 *
 * 提取页面元素，设置视口观察器，按需释义。
 * 支持缓存：缓存键 = 原文哈希 + 用户等级。
 * 包含重入保护和 epoch 机制，防止重复释义和过期回调写入。
 */
async function startParaphrase(): Promise<void> {
  if (isParaphraseRunning) {
    console.log("[Lingride] 释义已在运行中，跳过");
    return;
  }
  isParaphraseRunning = true;

  // 递增 epoch，使所有 in-flight 回调失效
  const currentEpoch = ++paraphraseEpoch;

  console.log("[Lingride] 开始释义页面...");

  try {
    // 0. 智能清理：仅移除 error/loading 容器，保留已成功的释义
    removeStaleParaphrases();
    clearProcessedMarks();
    translatableElements.clear();
    pendingParaphraseBatches.clear();

    // 销毁旧的视口观察器
    if (paraphraseViewportObserver) {
      paraphraseViewportObserver.destroy();
      paraphraseViewportObserver = null;
    }

    // 1. 提取可释义元素
    const elements = extractTranslatableElements();

    if (elements.length === 0) {
      console.log("[Lingride] 未找到可释义内容");
      return;
    }

    // 存储到 Map 以便后续查找
    for (const element of elements) {
      translatableElements.set(element.id, element);
    }

    // 2. 分离已缓存和需要释义的元素
    const needsParaphrase: TranslatableElement[] = [];
    let cachedCount = 0;

    for (const element of elements) {
      const cached = getCachedParaphrase(element.originalText, currentUserLevel);
      if (cached) {
        // 直接显示缓存的释义
        showParaphrase(element, cached);
        cachedCount++;
      } else {
        needsParaphrase.push(element);
      }
    }

    console.log(
      `[Lingride] ${elements.length} 个元素中，` +
        `${cachedCount} 个命中缓存，` +
        `${needsParaphrase.length} 个需要释义 (等级: ${currentUserLevel})`
    );

    // 3. 如果没有需要释义的内容，直接返回
    if (needsParaphrase.length === 0) {
      console.log("[Lingride] 所有内容已缓存，无需释义");
      return;
    }

    // 4. 创建视口观察器，按需释义
    paraphraseViewportObserver = new ViewportObserver((visibleElements) => {
      // 当元素进入视口时触发释义，传递当前 epoch
      paraphraseVisibleElements(visibleElements, currentEpoch);
    });

    // 5. 开始观察所有需要释义的元素
    paraphraseViewportObserver.observe(needsParaphrase);
  } catch (error) {
    console.error("[Lingride] 释义过程出错:", error);
  } finally {
    isParaphraseRunning = false;
  }
}

/**
 * 释义进入视口的元素
 *
 * @param elements - 进入视口的元素数组
 * @param epoch - 当前释义 epoch，用于丢弃过期回调
 */
async function paraphraseVisibleElements(
  elements: TranslatableElement[],
  epoch: number
): Promise<void> {
  // epoch 检查：如果已过期，丢弃
  if (epoch !== paraphraseEpoch) return;

  // 过滤掉已经在处理中或已缓存的元素
  const toParaphrase = elements.filter((el) => {
    // 检查是否在处理中
    if (pendingParaphraseBatches.has(el.id)) return false;

    // 检查缓存
    const cached = getCachedParaphrase(el.originalText, currentUserLevel);
    if (cached) {
      showParaphrase(el, cached);
      return false;
    }
    return true;
  });

  if (toParaphrase.length === 0) return;

  // 显示加载状态
  for (const element of toParaphrase) {
    showParaphraseLoading(element);
  }

  // 创建批次并释义
  const batches = batchManager.createBatches(toParaphrase);

  // 并行发送所有批次请求（限制并发数）
  const concurrencyLimit = 3;
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchSlice = batches.slice(i, i + concurrencyLimit);
    await Promise.all(
      batchSlice.map((batch) =>
        paraphraseBatch(batch.batchId, batch.texts, batch.elementIds, epoch)
      )
    );
  }

  // 打印缓存统计
  const stats = getCacheStats();
  console.log(
    `[Lingride] 释义完成，缓存: 释义=${stats.paraphraseSize}, 命中率=${stats.hitRate}`
  );
}

/**
 * 释义单个批次
 *
 * @param batchId - 批次 ID
 * @param texts - 待释义文本数组
 * @param elementIds - 对应的元素 ID 数组
 * @param epoch - 当前释义 epoch，用于丢弃过期回调
 */
async function paraphraseBatch(
  batchId: string,
  texts: string[],
  elementIds: string[],
  epoch: number
): Promise<void> {
  // epoch 检查：发送前确认未过期
  if (epoch !== paraphraseEpoch) return;

  // 避免重复请求
  if (pendingParaphraseBatches.has(batchId)) return;
  pendingParaphraseBatches.add(batchId);

  try {
    // 发送释义请求到 Background
    const response = await chrome.runtime.sendMessage({
      type: MessageType.PARAPHRASE,
      payload: { texts, batchId },
    });

    // epoch 检查：响应返回后再次确认未过期
    if (epoch !== paraphraseEpoch) return;

    if (response.success && response.data) {
      // 处理释义结果
      const { paraphrases } = response.data;

      // 缓存释义结果（即使 epoch 过期，缓存仍有价值）
      const pairs = texts.map((text, i) => ({
        original: text,
        paraphrase: paraphrases[i],
      }));
      setCachedParaphrases(pairs, currentUserLevel);

      // 更新页面显示
      for (let i = 0; i < elementIds.length; i++) {
        const element = translatableElements.get(elementIds[i]);
        if (element && paraphrases[i]) {
          showParaphrase(element, paraphrases[i]);
        }
      }
    } else {
      // 显示错误
      const errorMessage = response.error || "释义失败";
      for (const elementId of elementIds) {
        const element = translatableElements.get(elementId);
        if (element) {
          showParaphraseError(element, errorMessage);
        }
      }
    }
  } catch (error) {
    // epoch 检查：异常时也确认是否过期
    if (epoch !== paraphraseEpoch) return;

    const errorMessage = error instanceof Error ? error.message : "请求失败";
    console.error("[Lingride] 批次释义失败:", errorMessage);

    // 显示错误
    for (const elementId of elementIds) {
      const element = translatableElements.get(elementId);
      if (element) {
        showParaphraseError(element, errorMessage);
      }
    }
  } finally {
    pendingParaphraseBatches.delete(batchId);
  }
}

/**
 * 停止释义
 *
 * 移除所有释义显示，清理状态。
 */
function stopParaphrase(): void {
  console.log("[Lingride] 停止释义");

  // 停止视口观察
  if (paraphraseViewportObserver) {
    paraphraseViewportObserver.destroy();
    paraphraseViewportObserver = null;
  }

  // 移除所有释义显示
  removeAllParaphrases();

  // 清除处理标记
  clearProcessedMarks();

  // 清空元素记录
  translatableElements.clear();
  pendingParaphraseBatches.clear();
}

// ====== 混杂中英翻译功能 ======

/**
 * 开始混杂中英翻译
 *
 * 提取页面元素，设置视口观察器，按需生成中英混杂文本。
 * 支持缓存：缓存键 = 原文哈希 + 用户等级（等级变化后旧缓存自动失效）。
 * 包含重入保护和 epoch 机制，防止重复翻译和过期回调写入。
 */
async function startMixedTranslate(): Promise<void> {
  if (isMixedTranslateRunning) {
    console.log("[Lingride] 混杂中英翻译已在运行中，跳过");
    return;
  }
  isMixedTranslateRunning = true;

  // 递增 epoch，使所有 in-flight 回调失效
  const currentEpoch = ++mixedTranslateEpoch;

  console.log("[Lingride] 开始混杂中英翻译...");

  try {
    // 0. 智能清理：仅移除 error/loading 容器，保留已成功的混杂翻译
    removeStaleMixedTranslations();
    clearProcessedMarks();
    translatableElements.clear();
    pendingMixedTranslateBatches.clear();

    // 销毁旧的视口观察器
    if (mixedTranslateViewportObserver) {
      mixedTranslateViewportObserver.destroy();
      mixedTranslateViewportObserver = null;
    }

    // 1. 提取可翻译元素
    const elements = extractTranslatableElements();

    if (elements.length === 0) {
      console.log("[Lingride] 未找到可翻译内容");
      return;
    }

    // 存储到 Map 以便后续查找
    for (const element of elements) {
      translatableElements.set(element.id, element);
    }

    // 2. 分离已缓存和需要混杂翻译的元素
    const needsMixedTranslate: TranslatableElement[] = [];
    let cachedCount = 0;

    for (const element of elements) {
      const cached = getCachedMixedTranslation(
        element.originalText,
        currentUserLevel
      );
      if (cached) {
        // 直接显示缓存的混杂翻译
        showMixedTranslation(element, cached);
        cachedCount++;
      } else {
        needsMixedTranslate.push(element);
      }
    }

    console.log(
      `[Lingride] ${elements.length} 个元素中，` +
        `${cachedCount} 个命中缓存，` +
        `${needsMixedTranslate.length} 个需要混杂翻译 (等级: ${currentUserLevel})`
    );

    // 3. 如果没有需要混杂翻译的内容，直接返回
    if (needsMixedTranslate.length === 0) {
      console.log("[Lingride] 所有内容已缓存，无需混杂翻译");
      return;
    }

    // 4. 创建视口观察器，按需翻译
    mixedTranslateViewportObserver = new ViewportObserver((visibleElements) => {
      // 当元素进入视口时触发混杂翻译，传递当前 epoch
      mixedTranslateVisibleElements(visibleElements, currentEpoch);
    });

    // 5. 开始观察所有需要混杂翻译的元素
    mixedTranslateViewportObserver.observe(needsMixedTranslate);
  } catch (error) {
    console.error("[Lingride] 混杂中英翻译过程出错:", error);
  } finally {
    isMixedTranslateRunning = false;
  }
}

/**
 * 混杂中英翻译进入视口的元素
 *
 * @param elements - 进入视口的元素数组
 * @param epoch - 当前混杂翻译 epoch，用于丢弃过期回调
 */
async function mixedTranslateVisibleElements(
  elements: TranslatableElement[],
  epoch: number
): Promise<void> {
  // epoch 检查：如果已过期，丢弃
  if (epoch !== mixedTranslateEpoch) return;

  // 过滤掉已经在处理中或已缓存的元素
  const toTranslate = elements.filter((el) => {
    // 检查是否在处理中
    if (pendingMixedTranslateBatches.has(el.id)) return false;

    // 检查缓存
    const cached = getCachedMixedTranslation(el.originalText, currentUserLevel);
    if (cached) {
      showMixedTranslation(el, cached);
      return false;
    }
    return true;
  });

  if (toTranslate.length === 0) return;

  // 显示加载状态
  for (const element of toTranslate) {
    showMixedTranslateLoading(element);
  }

  // 创建批次并翻译
  const batches = batchManager.createBatches(toTranslate);

  // 并行发送所有批次请求（限制并发数）
  const concurrencyLimit = 3;
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchSlice = batches.slice(i, i + concurrencyLimit);
    await Promise.all(
      batchSlice.map((batch) =>
        mixedTranslateBatch(batch.batchId, batch.texts, batch.elementIds, epoch)
      )
    );
  }

  // 打印缓存统计
  const stats = getCacheStats();
  console.log(
    `[Lingride] 混杂翻译完成，缓存: 混杂=${stats.mixedTranslateSize}, 命中率=${stats.hitRate}`
  );
}

/**
 * 混杂中英翻译单个批次
 *
 * @param batchId - 批次 ID
 * @param texts - 待翻译文本数组
 * @param elementIds - 对应的元素 ID 数组
 * @param epoch - 当前混杂翻译 epoch，用于丢弃过期回调
 */
async function mixedTranslateBatch(
  batchId: string,
  texts: string[],
  elementIds: string[],
  epoch: number
): Promise<void> {
  // epoch 检查：发送前确认未过期
  if (epoch !== mixedTranslateEpoch) return;

  // 避免重复请求
  if (pendingMixedTranslateBatches.has(batchId)) return;
  pendingMixedTranslateBatches.add(batchId);

  try {
    // 发送混杂翻译请求到 Background
    const response = await chrome.runtime.sendMessage({
      type: MessageType.MIXED_TRANSLATE,
      payload: { texts, batchId },
    });

    // epoch 检查：响应返回后再次确认未过期
    if (epoch !== mixedTranslateEpoch) return;

    if (response.success && response.data) {
      // 处理混杂翻译结果
      const { mixedTexts } = response.data;

      // 缓存混杂翻译结果（即使 epoch 过期，缓存仍有价值）
      const pairs = texts.map((text, i) => ({
        original: text,
        mixedText: mixedTexts[i],
      }));
      setCachedMixedTranslations(pairs, currentUserLevel);

      // 更新页面显示
      for (let i = 0; i < elementIds.length; i++) {
        const element = translatableElements.get(elementIds[i]);
        if (element && mixedTexts[i]) {
          showMixedTranslation(element, mixedTexts[i]);
        }
      }
    } else {
      // 显示错误
      const errorMessage = response.error || "混杂中英翻译失败";
      for (const elementId of elementIds) {
        const element = translatableElements.get(elementId);
        if (element) {
          showMixedTranslateError(element, errorMessage);
        }
      }
    }
  } catch (error) {
    // epoch 检查：异常时也确认是否过期
    if (epoch !== mixedTranslateEpoch) return;

    const errorMessage = error instanceof Error ? error.message : "请求失败";
    console.error("[Lingride] 批次混杂中英翻译失败:", errorMessage);

    // 显示错误
    for (const elementId of elementIds) {
      const element = translatableElements.get(elementId);
      if (element) {
        showMixedTranslateError(element, errorMessage);
      }
    }
  } finally {
    pendingMixedTranslateBatches.delete(batchId);
  }
}

/**
 * 停止混杂中英翻译
 *
 * 移除所有混杂翻译显示，清理状态。
 */
function stopMixedTranslate(): void {
  console.log("[Lingride] 停止混杂中英翻译");

  // 停止视口观察
  if (mixedTranslateViewportObserver) {
    mixedTranslateViewportObserver.destroy();
    mixedTranslateViewportObserver = null;
  }

  // 移除所有混杂翻译显示
  removeAllMixedTranslations();

  // 清除处理标记
  clearProcessedMarks();

  // 清空元素记录
  translatableElements.clear();
  pendingMixedTranslateBatches.clear();
}

// ====== 难度分析辅助函数 ======

/**
 * 统计文本中的单词数量
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * 采样页面文本
 *
 * 从可翻译元素中采样文本，限制最大字符数。
 *
 * @param elements - 可翻译元素数组
 * @param maxChars - 最大字符数
 * @returns 采样后的文本
 */
function samplePageText(
  elements: TranslatableElement[],
  maxChars: number
): string {
  let result = "";

  for (const element of elements) {
    if (result.length + element.originalText.length > maxChars) {
      // 如果添加这段会超过限制，尝试截取
      const remaining = maxChars - result.length;
      if (remaining > 100) {
        result += element.originalText.substring(0, remaining) + "...";
      }
      break;
    }
    result += element.originalText + "\n\n";
  }

  return result.trim();
}

/**
 * 处理页面文本提取请求
 *
 * 优先返回选中文本，否则采样整页内容。
 */
function handleExtractPageText(): ExtractPageTextResponse {
  // 1. 检查是否有选中文本
  const selection = window.getSelection()?.toString().trim();
  if (selection && selection.length >= 50) {
    console.log(`[Lingride] 使用选中文本，长度: ${selection.length}`);
    return {
      success: true,
      data: {
        text: selection,
        wordCount: countWords(selection),
        isSelection: true,
      },
    };
  }

  // 2. 无选中文本，采样整页
  // 临时清除处理标记以便重新提取
  clearProcessedMarks();
  const elements = extractTranslatableElements();
  clearProcessedMarks(); // 清除刚添加的标记，不影响翻译功能

  if (elements.length === 0) {
    return {
      success: false,
      error: "页面中未找到英文内容",
    };
  }

  const sampledText = samplePageText(elements, 2000);
  console.log(
    `[Lingride] 采样页面文本，元素数: ${elements.length}，字符数: ${sampledText.length}`
  );

  return {
    success: true,
    data: {
      text: sampledText,
      wordCount: countWords(sampledText),
      isSelection: false,
    },
  };
}

// ====== 消息处理与事件监听（仅首次注入时注册） ======

if (!__lingride_already_loaded__) {
  // 初始化划词工具条（独立于整页模式）
  initSelectionToolbar();

  if (isTopFrame) {
    /**
     * 处理来自 Background 的消息
     */
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log("[Lingride] Content Script 收到消息:", message.type);

      switch (message.type) {
        case "TRANSLATION_STATE_CHANGED": {
          const { enabled } = message.payload;

          if (enabled) {
            // 统一清除所有模式结果，确保互斥
            removeAllModeResults();

            // 使所有 in-flight 回调失效，防止旧模式的响应写入 DOM
            translationEpoch++;
            paraphraseEpoch++;
            mixedTranslateEpoch++;

            // 重置状态
            isParaphraseEnabled = false;
            isMixedTranslateEnabled = false;
            isTranslationEnabled = true;

            startTranslation();
          } else {
            isTranslationEnabled = false;
            stopTranslation();
          }
          sendResponse({ success: true });
          break;
        }

        case "PARAPHRASE_STATE_CHANGED": {
          const { enabled, userLevel } = message.payload;

          if (enabled) {
            // 保存用户等级（用于缓存键）
            if (userLevel) {
              currentUserLevel = userLevel;
            }

            // 统一清除所有模式结果，确保互斥
            removeAllModeResults();

            // 使所有 in-flight 回调失效，防止旧模式的响应写入 DOM
            translationEpoch++;
            paraphraseEpoch++;
            mixedTranslateEpoch++;

            // 重置状态
            isTranslationEnabled = false;
            isMixedTranslateEnabled = false;
            isParaphraseEnabled = true;

            startParaphrase();
          } else {
            isParaphraseEnabled = false;
            stopParaphrase();
          }
          sendResponse({ success: true });
          break;
        }

        case "MIXED_TRANSLATE_STATE_CHANGED": {
          const { enabled, userLevel } = message.payload;

          if (enabled) {
            // 保存用户等级（用于缓存键）
            if (userLevel) {
              currentUserLevel = userLevel;
            }

            // 统一清除所有模式结果，确保互斥
            removeAllModeResults();

            // 使所有 in-flight 回调失效，防止旧模式的响应写入 DOM
            translationEpoch++;
            paraphraseEpoch++;
            mixedTranslateEpoch++;

            // 重置状态
            isTranslationEnabled = false;
            isParaphraseEnabled = false;
            isMixedTranslateEnabled = true;

            startMixedTranslate();
          } else {
            isMixedTranslateEnabled = false;
            stopMixedTranslate();
          }
          sendResponse({ success: true });
          break;
        }

        case MessageType.EXTRACT_PAGE_TEXT: {
          const extractResult = handleExtractPageText();
          sendResponse(extractResult);
          break;
        }

        default:
          sendResponse({ success: false, error: "未知消息类型" });
      }

      return true;
    });

    // ====== 页面可见性监听 ======

    /** visibilitychange 去抖动定时器 */
    let visibilityTimer: number | null = null;

    // 当页面变为可见时，如果翻译或释义已启用，重新扫描新增内容
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        console.log("[Lingride] 页面重新可见，检查新内容...");

        // 去抖动：防止短时间内多次触发
        if (visibilityTimer !== null) {
          clearTimeout(visibilityTimer);
        }

        visibilityTimer = window.setTimeout(() => {
          visibilityTimer = null;

          // 检查运行状态，避免与正在执行的 start*() 冲突。
          // 同时检查 translatableElements 是否为空：非空说明翻译已完成且仍有效，
          // 无需重新执行（避免无谓的 DOM 移除+重插入循环）。
          // 为空则说明从未翻译或已被 stop 清理，需要重新运行。
          if (
            isTranslationEnabled &&
            !isTranslationRunning &&
            translatableElements.size === 0
          ) {
            startTranslation();
          } else if (
            isParaphraseEnabled &&
            !isParaphraseRunning &&
            translatableElements.size === 0
          ) {
            startParaphrase();
          } else if (
            isMixedTranslateEnabled &&
            !isMixedTranslateRunning &&
            translatableElements.size === 0
          ) {
            startMixedTranslate();
          }
        }, 500);
      }
    });
  } else {
    console.log("[Lingride] 子 frame：仅启用划词工具条");
  }
} // end of !__lingride_already_loaded__ guard
