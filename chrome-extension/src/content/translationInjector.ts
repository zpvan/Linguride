/**
 * @file translationInjector.ts
 * @description 翻译注入器
 *
 * 负责将翻译结果注入到页面 DOM 中，实现双语对照显示。
 *
 * 注入策略：
 * - 在原文元素下方插入翻译元素
 * - 使用特定 CSS 类名样式化翻译内容
 * - 支持加载状态和错误状态显示
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { TranslatableElement, TranslationStatus } from "../types";

/**
 * CSS 类名常量
 */
const CSS_CLASSES = {
  translation: "lingride-translation",
  error: "lingride-error",
  loading: "lingride-loading",
  // 释义相关
  paraphrase: "lingride-paraphrase",
  paraphraseError: "lingride-paraphrase-error",
  paraphraseLoading: "lingride-paraphrase-loading",
};

/**
 * 数据属性，关联翻译元素和原文元素
 */
const TRANSLATION_ID_ATTR = "data-lingride-id";

/**
 * 获取元素对应的翻译容器
 *
 * @param elementId - 原文元素 ID
 * @returns 翻译容器元素，如果不存在返回 null
 */
function getTranslationContainer(elementId: string): HTMLElement | null {
  return document.querySelector(`[${TRANSLATION_ID_ATTR}="${elementId}"]`);
}

/**
 * 创建翻译容器元素
 *
 * @param elementId - 原文元素 ID
 * @param className - CSS 类名
 * @returns 新创建的容器元素
 */
function createTranslationContainer(
  elementId: string,
  className: string
): HTMLElement {
  const container = document.createElement("div");
  container.setAttribute(TRANSLATION_ID_ATTR, elementId);
  container.className = className;
  return container;
}

/**
 * 显示加载状态
 *
 * 在原文下方显示「翻译中...」提示。
 *
 * @param element - 可翻译元素对象
 */
export function showLoading(element: TranslatableElement): void {
  // 移除已有的翻译容器
  removeTranslation(element.id);

  // 创建加载状态容器
  const container = createTranslationContainer(element.id, CSS_CLASSES.loading);
  container.textContent = "翻译中";

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);

  // 更新状态
  element.status = TranslationStatus.LOADING;
}

/**
 * 显示翻译结果
 *
 * 在原文下方显示中文翻译。
 *
 * @param element - 可翻译元素对象
 * @param translation - 翻译后的中文文本
 */
export function showTranslation(
  element: TranslatableElement,
  translation: string
): void {
  // 移除加载状态
  removeTranslation(element.id);

  // 创建翻译容器
  const container = createTranslationContainer(
    element.id,
    CSS_CLASSES.translation
  );
  container.textContent = translation;

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);

  // 更新元素状态
  element.status = TranslationStatus.SUCCESS;
  element.translation = translation;
}

/**
 * 显示错误信息
 *
 * 在原文下方显示错误提示。
 *
 * @param element - 可翻译元素对象
 * @param errorMessage - 错误信息
 */
export function showError(
  element: TranslatableElement,
  errorMessage: string
): void {
  // 移除加载状态
  removeTranslation(element.id);

  // 创建错误容器
  const container = createTranslationContainer(element.id, CSS_CLASSES.error);
  container.textContent = `翻译失败: ${errorMessage}`;

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);

  // 更新元素状态
  element.status = TranslationStatus.ERROR;
  element.error = errorMessage;
}

/**
 * 移除翻译显示
 *
 * 移除指定元素的翻译容器。
 *
 * @param elementId - 原文元素 ID
 */
export function removeTranslation(elementId: string): void {
  const container = getTranslationContainer(elementId);
  if (container) {
    container.remove();
  }
}

/**
 * 移除所有翻译
 *
 * 清除页面上所有的翻译显示。
 */
export function removeAllTranslations(): void {
  const containers = document.querySelectorAll(
    `.${CSS_CLASSES.translation}, .${CSS_CLASSES.error}, .${CSS_CLASSES.loading}`
  );

  for (const container of containers) {
    container.remove();
  }

  console.log(`[Lingride] 已移除 ${containers.length} 个翻译元素`);
}

/**
 * 更新元素的翻译显示
 *
 * 根据元素状态显示对应的内容。
 *
 * @param element - 可翻译元素对象
 */
export function updateDisplay(element: TranslatableElement): void {
  switch (element.status) {
    case TranslationStatus.LOADING:
      showLoading(element);
      break;
    case TranslationStatus.SUCCESS:
      if (element.translation) {
        showTranslation(element, element.translation);
      }
      break;
    case TranslationStatus.ERROR:
      showError(element, element.error || "未知错误");
      break;
    case TranslationStatus.PENDING:
      removeTranslation(element.id);
      break;
  }
}

// ====== 释义功能 ======

/**
 * 释义数据属性，关联释义元素和原文元素
 */
const PARAPHRASE_ID_ATTR = "data-lingride-paraphrase-id";

/**
 * 获取元素对应的释义容器
 */
function getParaphraseContainer(elementId: string): HTMLElement | null {
  return document.querySelector(`[${PARAPHRASE_ID_ATTR}="${elementId}"]`);
}

/**
 * 创建释义容器元素
 */
function createParaphraseContainer(
  elementId: string,
  className: string
): HTMLElement {
  const container = document.createElement("div");
  container.setAttribute(PARAPHRASE_ID_ATTR, elementId);
  container.className = className;
  return container;
}

/**
 * 显示释义加载状态
 */
export function showParaphraseLoading(element: TranslatableElement): void {
  // 移除已有的释义容器
  removeParaphrase(element.id);

  // 创建加载状态容器
  const container = createParaphraseContainer(
    element.id,
    CSS_CLASSES.paraphraseLoading
  );
  container.textContent = "Simplifying";

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 显示释义结果
 */
export function showParaphrase(
  element: TranslatableElement,
  paraphrase: string
): void {
  // 移除加载状态
  removeParaphrase(element.id);

  // 创建释义容器
  const container = createParaphraseContainer(
    element.id,
    CSS_CLASSES.paraphrase
  );
  container.textContent = paraphrase;

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 显示释义错误
 */
export function showParaphraseError(
  element: TranslatableElement,
  errorMessage: string
): void {
  // 移除加载状态
  removeParaphrase(element.id);

  // 创建错误容器
  const container = createParaphraseContainer(
    element.id,
    CSS_CLASSES.paraphraseError
  );
  container.textContent = `Paraphrase failed: ${errorMessage}`;

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 移除释义显示
 */
export function removeParaphrase(elementId: string): void {
  const container = getParaphraseContainer(elementId);
  if (container) {
    container.remove();
  }
}

/**
 * 移除所有释义
 */
export function removeAllParaphrases(): void {
  const containers = document.querySelectorAll(
    `.${CSS_CLASSES.paraphrase}, .${CSS_CLASSES.paraphraseError}, .${CSS_CLASSES.paraphraseLoading}`
  );

  for (const container of containers) {
    container.remove();
  }

  console.log(`[Lingride] 已移除 ${containers.length} 个释义元素`);
}
