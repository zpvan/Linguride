/**
 * @file tabState.ts
 * @description Tab 状态管理
 *
 * 管理每个 Tab 的翻译、释义和混杂中英翻译开关状态。
 * 使用内存存储（非持久化），Tab 关闭或刷新后状态重置。
 *
 * 设计说明：
 * - 每个 Tab 独立维护三种模式状态
 * - 三种模式互斥（开启一个自动关闭其他两个）
 * - 状态仅在 Service Worker 生命周期内有效
 * - Tab 关闭时自动清理状态
 *
 * @author Lingride Team
 * @since 1.0.0
 */

/**
 * Tab 状态接口
 */
interface TabState {
  /** 翻译是否启用 */
  translationEnabled: boolean;
  /** 释义是否启用 */
  paraphraseEnabled: boolean;
  /** 混杂中英翻译是否启用 */
  mixedTranslateEnabled: boolean;
  /** 状态更新时间戳 */
  updatedAt: number;
}

/**
 * Tab 状态存储
 *
 * 使用 Map 存储每个 Tab 的状态，键为 Tab ID。
 */
const tabStates = new Map<number, TabState>();

/**
 * 获取 Tab 的完整状态
 *
 * @param tabId - Chrome Tab ID
 * @returns Tab 状态对象，如果不存在则返回 undefined
 */
export function getFullTabState(tabId: number): TabState | undefined {
  return tabStates.get(tabId);
}

/**
 * 获取 Tab 的翻译状态
 *
 * @param tabId - Chrome Tab ID
 * @returns 翻译是否启用，默认为 false
 */
export function getTabState(tabId: number): boolean {
  const state = tabStates.get(tabId);
  return state?.translationEnabled ?? false;
}

/**
 * 获取 Tab 的释义状态
 *
 * @param tabId - Chrome Tab ID
 * @returns 释义是否启用，默认为 false
 */
export function getParaphraseState(tabId: number): boolean {
  const state = tabStates.get(tabId);
  return state?.paraphraseEnabled ?? false;
}

/**
 * 获取 Tab 的混杂中英翻译状态
 *
 * @param tabId - Chrome Tab ID
 * @returns 混杂中英翻译是否启用，默认为 false
 */
export function getMixedTranslateState(tabId: number): boolean {
  const state = tabStates.get(tabId);
  return state?.mixedTranslateEnabled ?? false;
}

/**
 * 设置 Tab 的翻译状态
 *
 * 三模式互斥：开启翻译时自动关闭释义和混杂中英
 *
 * @param tabId - Chrome Tab ID
 * @param enabled - 是否启用翻译
 */
export function setTabState(tabId: number, enabled: boolean): void {
  const currentState = tabStates.get(tabId);
  tabStates.set(tabId, {
    translationEnabled: enabled,
    // 互斥：开启翻译时关闭释义和混杂
    paraphraseEnabled: enabled
      ? false
      : currentState?.paraphraseEnabled ?? false,
    mixedTranslateEnabled: enabled
      ? false
      : currentState?.mixedTranslateEnabled ?? false,
    updatedAt: Date.now(),
  });
  console.log(`[Lingride] Tab ${tabId} 翻译状态: ${enabled ? "开启" : "关闭"}`);
}

/**
 * 设置 Tab 的释义状态
 *
 * 三模式互斥：开启释义时自动关闭翻译和混杂中英
 *
 * @param tabId - Chrome Tab ID
 * @param enabled - 是否启用释义
 */
export function setParaphraseState(tabId: number, enabled: boolean): void {
  const currentState = tabStates.get(tabId);
  tabStates.set(tabId, {
    // 互斥：开启释义时关闭翻译和混杂
    translationEnabled: enabled
      ? false
      : currentState?.translationEnabled ?? false,
    paraphraseEnabled: enabled,
    mixedTranslateEnabled: enabled
      ? false
      : currentState?.mixedTranslateEnabled ?? false,
    updatedAt: Date.now(),
  });
  console.log(`[Lingride] Tab ${tabId} 释义状态: ${enabled ? "开启" : "关闭"}`);
}

/**
 * 设置 Tab 的混杂中英翻译状态
 *
 * 三模式互斥：开启混杂中英时自动关闭翻译和释义
 *
 * @param tabId - Chrome Tab ID
 * @param enabled - 是否启用混杂中英翻译
 */
export function setMixedTranslateState(tabId: number, enabled: boolean): void {
  const currentState = tabStates.get(tabId);
  tabStates.set(tabId, {
    // 互斥：开启混杂时关闭翻译和释义
    translationEnabled: enabled
      ? false
      : currentState?.translationEnabled ?? false,
    paraphraseEnabled: enabled
      ? false
      : currentState?.paraphraseEnabled ?? false,
    mixedTranslateEnabled: enabled,
    updatedAt: Date.now(),
  });
  console.log(
    `[Lingride] Tab ${tabId} 混杂中英状态: ${enabled ? "开启" : "关闭"}`
  );
}

/**
 * 清理 Tab 状态
 *
 * 当 Tab 关闭时调用，释放内存。
 *
 * @param tabId - Chrome Tab ID
 */
export function clearTabState(tabId: number): void {
  if (tabStates.has(tabId)) {
    tabStates.delete(tabId);
    console.log(`[Lingride] Tab ${tabId} 状态已清理`);
  }
}

/**
 * 获取所有活跃 Tab 状态
 *
 * 用于调试和状态监控。
 *
 * @returns Tab 状态映射的副本
 */
export function getAllTabStates(): Map<number, TabState> {
  return new Map(tabStates);
}

/**
 * 初始化 Tab 状态监听器
 *
 * 监听 Tab 关闭事件，自动清理对应状态。
 */
export function initTabStateListeners(): void {
  // 监听 Tab 关闭事件
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId);
  });

  // 监听 Tab 更新事件（页面刷新）
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // 页面开始加载时重置状态
    if (changeInfo.status === "loading") {
      clearTabState(tabId);
    }
  });

  console.log("[Lingride] Tab 状态监听器已初始化");
}
