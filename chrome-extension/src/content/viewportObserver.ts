/**
 * @file viewportObserver.ts
 * @description 视口观察器
 *
 * 使用 Intersection Observer API 监测元素是否进入视口，
 * 实现按需翻译，只翻译用户当前可见的内容。
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { TranslatableElement } from "../types";

/**
 * 视口观察器回调函数类型
 */
export type ViewportCallback = (elements: TranslatableElement[]) => void;

/**
 * 视口观察器类
 *
 * 监测元素进入视口，批量触发翻译回调。
 */
export class ViewportObserver {
  /** Intersection Observer 实例 */
  private observer: IntersectionObserver | null = null;

  /** 元素映射：DOM 元素 -> TranslatableElement */
  private elementMap: Map<Element, TranslatableElement> = new Map();

  /** 待处理的可见元素队列 */
  private pendingElements: Set<TranslatableElement> = new Set();

  /** 防抖定时器 */
  private debounceTimer: number | null = null;

  /** 防抖延迟（毫秒） */
  private readonly debounceDelay = 200;

  /** 进入视口时的回调 */
  private onVisible: ViewportCallback;

  /**
   * 构造函数
   *
   * @param onVisible - 元素进入视口时的回调函数
   */
  constructor(onVisible: ViewportCallback) {
    this.onVisible = onVisible;
    this.initObserver();
  }

  /**
   * 初始化 Intersection Observer
   */
  private initObserver(): void {
    // 配置：元素进入视口 10% 时触发，提前一屏预加载
    const options: IntersectionObserverInit = {
      root: null, // 使用视口作为根
      rootMargin: "100% 0px 100% 0px", // 上下各扩展一屏，提前预加载
      threshold: 0.1, // 10% 可见时触发
    };

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const element = this.elementMap.get(entry.target);
          if (element) {
            this.pendingElements.add(element);
            // 停止观察已进入视口的元素
            this.observer?.unobserve(entry.target);
          }
        }
      }

      // 防抖处理，批量触发回调
      this.scheduleBatchCallback();
    }, options);

    console.log("[Lingride] 视口观察器已初始化");
  }

  /**
   * 调度批量回调（防抖）
   */
  private scheduleBatchCallback(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.flushPendingElements();
    }, this.debounceDelay);
  }

  /**
   * 处理待翻译的元素
   */
  private flushPendingElements(): void {
    if (this.pendingElements.size === 0) return;

    const elements = Array.from(this.pendingElements);
    this.pendingElements.clear();

    console.log(`[Lingride] 视口内发现 ${elements.length} 个待翻译元素`);
    this.onVisible(elements);
  }

  /**
   * 开始观察元素
   *
   * @param elements - 要观察的可翻译元素数组
   */
  observe(elements: TranslatableElement[]): void {
    if (!this.observer) return;

    for (const element of elements) {
      this.elementMap.set(element.element, element);
      this.observer.observe(element.element);
    }

    console.log(`[Lingride] 开始观察 ${elements.length} 个元素`);
  }

  /**
   * 停止观察所有元素
   */
  disconnect(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.observer?.disconnect();
    this.elementMap.clear();
    this.pendingElements.clear();

    console.log("[Lingride] 视口观察器已断开");
  }

  /**
   * 销毁观察器
   */
  destroy(): void {
    this.disconnect();
    this.observer = null;
  }
}
