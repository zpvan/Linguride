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

import { MessageType, TranslatableElement } from "../types";
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
    removeAllTranslations,
    showError,
    showLoading,
    showTranslation,
} from "./translationInjector";
import { ViewportObserver } from "./viewportObserver";

// ====== 状态管理 ======

/** 当前翻译是否启用 */
let isTranslationEnabled = false;

/** 当前页面的可翻译元素 */
let translatableElements: Map<string, TranslatableElement> = new Map();

/** 批量管理器实例 */
const batchManager = new BatchManager();

/** 视口观察器实例 */
let viewportObserver: ViewportObserver | null = null;

/** 正在翻译的批次 ID 集合 */
const pendingBatches: Set<string> = new Set();

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

// ====== 消息处理 ======

/**
 * 处理来自 Background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Lingride] Content Script 收到消息:", message.type);

  switch (message.type) {
    case "TRANSLATION_STATE_CHANGED":
      const { enabled } = message.payload;
      isTranslationEnabled = enabled;

      if (enabled) {
        startTranslation();
      } else {
        stopTranslation();
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: "未知消息类型" });
  }

  return true;
});

// ====== 页面可见性监听 ======

// 当页面变为可见时，如果翻译已启用，重新扫描新增内容
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isTranslationEnabled) {
    console.log("[Lingride] 页面重新可见，检查新内容...");
    // 延迟执行，等待动态内容加载
    setTimeout(() => {
      if (isTranslationEnabled) {
        startTranslation();
      }
    }, 500);
  }
});
