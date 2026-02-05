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
  getCachedTranslation,
  getCacheStats,
  setCachedTranslations,
} from "./translationCache";
import {
  removeAllMixedTranslations,
  removeAllParaphrases,
  removeAllTranslations,
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
import { ViewportObserver } from "./viewportObserver";

// ====== 状态管理 ======

/** 当前翻译是否启用 */
let isTranslationEnabled = false;

/** 当前释义是否启用 */
let isParaphraseEnabled = false;

/** 当前混杂中英翻译是否启用 */
let isMixedTranslateEnabled = false;

/** 当前页面的可翻译元素 */
let translatableElements: Map<string, TranslatableElement> = new Map();

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

// ====== 初始化 ======

console.log("[Lingride] Content Script 已加载");

// ====== 核心功能 ======

/**
 * 开始翻译页面
 *
 * 提取页面元素，设置视口观察器，按需翻译。
 */
async function startTranslation(): Promise<void> {
  console.log("[Lingride] 开始翻译页面...");

  try {
    // 1. 提取可翻译元素
    const elements = extractTranslatableElements();

    if (elements.length === 0) {
      console.log("[Lingride] 未找到可翻译内容");
      return;
    }

    // 存储到 Map 以便后续查找
    translatableElements.clear();
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
    if (viewportObserver) {
      viewportObserver.destroy();
    }

    viewportObserver = new ViewportObserver((visibleElements) => {
      // 当元素进入视口时触发翻译
      translateVisibleElements(visibleElements);
    });

    // 5. 开始观察所有需要翻译的元素
    viewportObserver.observe(needsTranslation);
  } catch (error) {
    console.error("[Lingride] 翻译过程出错:", error);
  }
}

/**
 * 翻译进入视口的元素
 *
 * @param elements - 进入视口的元素数组
 */
async function translateVisibleElements(
  elements: TranslatableElement[]
): Promise<void> {
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
        translateBatch(batch.batchId, batch.texts, batch.elementIds)
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
 */
async function translateBatch(
  batchId: string,
  texts: string[],
  elementIds: string[]
): Promise<void> {
  // 避免重复请求
  if (pendingBatches.has(batchId)) return;
  pendingBatches.add(batchId);

  try {
    // 发送翻译请求到 Background
    const response = await chrome.runtime.sendMessage({
      type: MessageType.TRANSLATE,
      payload: { texts, batchId },
    });

    if (response.success && response.data) {
      // 处理翻译结果
      const { translations } = response.data;

      // 缓存翻译结果
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
 */
async function startParaphrase(): Promise<void> {
  console.log("[Lingride] 开始释义页面...");

  try {
    // 1. 提取可释义元素
    const elements = extractTranslatableElements();

    if (elements.length === 0) {
      console.log("[Lingride] 未找到可释义内容");
      return;
    }

    // 存储到 Map 以便后续查找
    translatableElements.clear();
    for (const element of elements) {
      translatableElements.set(element.id, element);
    }

    console.log(`[Lingride] 找到 ${elements.length} 个可释义元素`);

    // 2. 创建视口观察器，按需释义
    if (paraphraseViewportObserver) {
      paraphraseViewportObserver.destroy();
    }

    paraphraseViewportObserver = new ViewportObserver((visibleElements) => {
      // 当元素进入视口时触发释义
      paraphraseVisibleElements(visibleElements);
    });

    // 3. 开始观察所有元素
    paraphraseViewportObserver.observe(elements);
  } catch (error) {
    console.error("[Lingride] 释义过程出错:", error);
  }
}

/**
 * 释义进入视口的元素
 */
async function paraphraseVisibleElements(
  elements: TranslatableElement[]
): Promise<void> {
  // 过滤掉已经在处理中的元素
  const toParaphrase = elements.filter(
    (el) => !pendingParaphraseBatches.has(el.id)
  );

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
        paraphraseBatch(batch.batchId, batch.texts, batch.elementIds)
      )
    );
  }

  console.log("[Lingride] 释义批次完成");
}

/**
 * 释义单个批次
 */
async function paraphraseBatch(
  batchId: string,
  texts: string[],
  elementIds: string[]
): Promise<void> {
  // 避免重复请求
  if (pendingParaphraseBatches.has(batchId)) return;
  pendingParaphraseBatches.add(batchId);

  try {
    // 发送释义请求到 Background
    const response = await chrome.runtime.sendMessage({
      type: MessageType.PARAPHRASE,
      payload: { texts, batchId },
    });

    if (response.success && response.data) {
      // 处理释义结果
      const { paraphrases } = response.data;

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
 * 不使用缓存（输出依赖用户 CEFR 等级，等级变化后需重新生成）。
 */
async function startMixedTranslate(): Promise<void> {
  console.log("[Lingride] 开始混杂中英翻译...");

  try {
    // 1. 提取可翻译元素
    const elements = extractTranslatableElements();

    if (elements.length === 0) {
      console.log("[Lingride] 未找到可翻译内容");
      return;
    }

    // 存储到 Map 以便后续查找
    translatableElements.clear();
    for (const element of elements) {
      translatableElements.set(element.id, element);
    }

    console.log(`[Lingride] 找到 ${elements.length} 个可翻译元素`);

    // 2. 创建视口观察器，按需翻译
    if (mixedTranslateViewportObserver) {
      mixedTranslateViewportObserver.destroy();
    }

    mixedTranslateViewportObserver = new ViewportObserver((visibleElements) => {
      // 当元素进入视口时触发混杂翻译
      mixedTranslateVisibleElements(visibleElements);
    });

    // 3. 开始观察所有元素
    mixedTranslateViewportObserver.observe(elements);
  } catch (error) {
    console.error("[Lingride] 混杂中英翻译过程出错:", error);
  }
}

/**
 * 混杂中英翻译进入视口的元素
 */
async function mixedTranslateVisibleElements(
  elements: TranslatableElement[]
): Promise<void> {
  // 过滤掉已经在处理中的元素
  const toTranslate = elements.filter(
    (el) => !pendingMixedTranslateBatches.has(el.id)
  );

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
        mixedTranslateBatch(batch.batchId, batch.texts, batch.elementIds)
      )
    );
  }

  console.log("[Lingride] 混杂中英翻译批次完成");
}

/**
 * 混杂中英翻译单个批次
 */
async function mixedTranslateBatch(
  batchId: string,
  texts: string[],
  elementIds: string[]
): Promise<void> {
  // 避免重复请求
  if (pendingMixedTranslateBatches.has(batchId)) return;
  pendingMixedTranslateBatches.add(batchId);

  try {
    // 发送混杂翻译请求到 Background
    const response = await chrome.runtime.sendMessage({
      type: MessageType.MIXED_TRANSLATE,
      payload: { texts, batchId },
    });

    if (response.success && response.data) {
      // 处理混杂翻译结果
      const { mixedTexts } = response.data;

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

// ====== 消息处理 ======

/**
 * 处理来自 Background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Lingride] Content Script 收到消息:", message.type);

  switch (message.type) {
    case "TRANSLATION_STATE_CHANGED": {
      const { enabled } = message.payload;
      isTranslationEnabled = enabled;

      if (enabled) {
        // 互斥：开启翻译时关闭释义和混杂中英
        if (isParaphraseEnabled) {
          stopParaphrase();
          isParaphraseEnabled = false;
        }
        if (isMixedTranslateEnabled) {
          stopMixedTranslate();
          isMixedTranslateEnabled = false;
        }
        startTranslation();
      } else {
        stopTranslation();
      }
      sendResponse({ success: true });
      break;
    }

    case "PARAPHRASE_STATE_CHANGED": {
      const { enabled } = message.payload;
      isParaphraseEnabled = enabled;

      if (enabled) {
        // 互斥：开启释义时关闭翻译和混杂中英
        if (isTranslationEnabled) {
          stopTranslation();
          isTranslationEnabled = false;
        }
        if (isMixedTranslateEnabled) {
          stopMixedTranslate();
          isMixedTranslateEnabled = false;
        }
        startParaphrase();
      } else {
        stopParaphrase();
      }
      sendResponse({ success: true });
      break;
    }

    case "MIXED_TRANSLATE_STATE_CHANGED": {
      const { enabled } = message.payload;
      isMixedTranslateEnabled = enabled;

      if (enabled) {
        // 互斥：开启混杂中英时关闭翻译和释义
        if (isTranslationEnabled) {
          stopTranslation();
          isTranslationEnabled = false;
        }
        if (isParaphraseEnabled) {
          stopParaphrase();
          isParaphraseEnabled = false;
        }
        startMixedTranslate();
      } else {
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

// 当页面变为可见时，如果翻译或释义已启用，重新扫描新增内容
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("[Lingride] 页面重新可见，检查新内容...");
    // 延迟执行，等待动态内容加载
    setTimeout(() => {
      if (isTranslationEnabled) {
        startTranslation();
      } else if (isParaphraseEnabled) {
        startParaphrase();
      } else if (isMixedTranslateEnabled) {
        startMixedTranslate();
      }
    }, 500);
  }
});
