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
  // 混杂中英相关
  mixedTranslate: "lingride-mixed-translate",
  mixedTranslateError: "lingride-mixed-translate-error",
  mixedTranslateLoading: "lingride-mixed-translate-loading",
};

// ====== 内联代码格式保留 ======

/**
 * HTML 转义
 *
 * 将特殊字符转义为 HTML 实体，防止 XSS。
 *
 * @param text - 原始文本
 * @returns 转义后的安全 HTML 字符串
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 正则特殊字符转义
 *
 * 将字符串中的正则特殊字符转义，使其可安全用于 RegExp 构造。
 *
 * @param str - 原始字符串
 * @returns 转义后的正则安全字符串
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 将译文中的 code 词汇包裹为 <code> 标签
 *
 * 安全流程：
 * 1. 先 HTML 转义全文（防 XSS）
 * 2. 对 codeWords 中的每个词进行 HTML 转义 + 正则转义
 * 3. 在已转义的文本中匹配并包裹 <code class="lingride-inline-code">
 * 4. 未匹配到的词不做处理（退化为纯文本）
 *
 * @param text - 译文纯文本
 * @param codeWords - 原文中 <code> 标签内的词汇
 * @returns 包含 <code> 标签的 HTML 字符串
 */
function applyCodeWrapping(text: string, codeWords: string[]): string {
  let html = escapeHtml(text);

  for (const word of codeWords) {
    const escapedWord = escapeHtml(word);
    const pattern = new RegExp(escapeRegExp(escapedWord), "g");
    html = html.replace(
      pattern,
      `<code class="lingride-inline-code">${escapedWord}</code>`
    );
  }

  return html;
}

/**
 * 在已高亮的 HTML 中嵌套 <code> 标签包裹 codeWords
 *
 * 用于 showMixedTranslation：先 highlightEnglishParts 产出高亮 HTML，
 * 后在结果上为 codeWords 嵌套 <code> 标签。
 * 因为 highlightEnglishParts 内部已做 HTML 转义，此函数直接操作已转义的文本。
 *
 * @param html - highlightEnglishParts 产出的 HTML
 * @param codeWords - 原文中 <code> 标签内的词汇
 * @returns 嵌套了 <code> 标签的 HTML
 */
function nestCodeWrappingInHighlightedHtml(
  html: string,
  codeWords: string[]
): string {
  let result = html;

  for (const word of codeWords) {
    // codeWords 在 highlightEnglishParts 中已被 HTML 转义
    const escapedWord = escapeHtml(word);
    const pattern = new RegExp(escapeRegExp(escapedWord), "g");
    result = result.replace(
      pattern,
      `<code class="lingride-inline-code">${escapedWord}</code>`
    );
  }

  return result;
}

// ====== 翻译注入 ======

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

  // 如果有 codeWords，用 innerHTML 保留 code 格式；否则用 textContent
  if (element.codeWords && element.codeWords.length > 0) {
    container.innerHTML = applyCodeWrapping(translation, element.codeWords);
  } else {
    container.textContent = translation;
  }

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
 * 移除过期的翻译容器（仅 error 和 loading 状态）
 *
 * 智能清理：保留已成功的翻译容器，仅移除错误和加载状态的容器。
 * 用于 startTranslation() 重启时避免视觉闪烁。
 */
export function removeStaleTranslations(): void {
  const stale = document.querySelectorAll(
    `.${CSS_CLASSES.error}, .${CSS_CLASSES.loading}`
  );
  for (const el of stale) {
    el.remove();
  }
  if (stale.length > 0) {
    console.log(`[Lingride] 已移除 ${stale.length} 个过期翻译容器`);
  }
}

/**
 * 移除过期的释义容器（仅 error 和 loading 状态）
 *
 * 智能清理：保留已成功的释义容器，仅移除错误和加载状态的容器。
 * 用于 startParaphrase() 重启时避免视觉闪烁。
 */
export function removeStaleParaphrases(): void {
  const stale = document.querySelectorAll(
    `.${CSS_CLASSES.paraphraseError}, .${CSS_CLASSES.paraphraseLoading}`
  );
  for (const el of stale) {
    el.remove();
  }
  if (stale.length > 0) {
    console.log(`[Lingride] 已移除 ${stale.length} 个过期释义容器`);
  }
}

/**
 * 移除过期的混杂翻译容器（仅 error 和 loading 状态）
 *
 * 智能清理：保留已成功的混杂翻译容器，仅移除错误和加载状态的容器。
 * 用于 startMixedTranslate() 重启时避免视觉闪烁。
 */
export function removeStaleMixedTranslations(): void {
  const stale = document.querySelectorAll(
    `.${CSS_CLASSES.mixedTranslateError}, .${CSS_CLASSES.mixedTranslateLoading}`
  );
  for (const el of stale) {
    el.remove();
  }
  if (stale.length > 0) {
    console.log(`[Lingride] 已移除 ${stale.length} 个过期混杂翻译容器`);
  }
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
 *
 * @param elementId - 原文元素 ID
 * @returns 释义容器元素，如果不存在返回 null
 */
function getParaphraseContainer(elementId: string): HTMLElement | null {
  return document.querySelector(`[${PARAPHRASE_ID_ATTR}="${elementId}"]`);
}

/**
 * 创建释义容器元素
 *
 * @param elementId - 原文元素 ID
 * @param className - CSS 类名
 * @returns 新创建的容器元素
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
 *
 * 在原文下方显示「Simplifying...」提示。
 *
 * @param element - 可翻译元素对象
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
 *
 * 在原文下方显示改写后的英文。
 *
 * @param element - 可翻译元素对象
 * @param paraphrase - 释义后的英文文本
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

  // 如果有 codeWords，用 innerHTML 保留 code 格式；否则用 textContent
  if (element.codeWords && element.codeWords.length > 0) {
    container.innerHTML = applyCodeWrapping(paraphrase, element.codeWords);
  } else {
    container.textContent = paraphrase;
  }

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 显示释义错误
 *
 * 在原文下方显示释义错误提示。
 *
 * @param element - 可翻译元素对象
 * @param errorMessage - 错误信息
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
 *
 * 移除指定元素的释义容器。
 *
 * @param elementId - 原文元素 ID
 */
export function removeParaphrase(elementId: string): void {
  const container = getParaphraseContainer(elementId);
  if (container) {
    container.remove();
  }
}

/**
 * 移除所有释义
 *
 * 清除页面上所有的释义显示。
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

// ====== 混杂中英翻译功能 ======

/**
 * 混杂中英数据属性，关联混杂翻译元素和原文元素
 */
const MIXED_TRANSLATE_ID_ATTR = "data-lingride-mixed-id";

/**
 * 获取元素对应的混杂翻译容器
 *
 * @param elementId - 原文元素 ID
 * @returns 混杂翻译容器元素，如果不存在返回 null
 */
function getMixedTranslateContainer(elementId: string): HTMLElement | null {
  return document.querySelector(`[${MIXED_TRANSLATE_ID_ATTR}="${elementId}"]`);
}

/**
 * 创建混杂翻译容器元素
 *
 * @param elementId - 原文元素 ID
 * @param className - CSS 类名
 * @returns 新创建的容器元素
 */
function createMixedTranslateContainer(
  elementId: string,
  className: string
): HTMLElement {
  const container = document.createElement("div");
  container.setAttribute(MIXED_TRANSLATE_ID_ATTR, elementId);
  container.className = className;
  return container;
}

/**
 * 高亮混杂文本中的英文部分
 *
 * 安全流程：先转义 HTML 防止 XSS，再用正则包裹英文序列。
 * 英文序列会被包裹在 <span class="lingride-en-highlight"> 中，
 * 以不同颜色和字重展示，帮助学习者辨识。
 *
 * @param text - AI 返回的混杂中英文本（纯文本）
 * @returns 包含高亮 HTML 标签的字符串
 */
function highlightEnglishParts(text: string): string {
  // 1. 转义 HTML 实体，防止 XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // 2. 匹配连续的英文单词序列（含单词间空格和常见标点）
  // 起始字符：字母或数字
  // 中间字符：字母、数字、空格、逗号、句号、撇号、连字符
  // 结束字符：字母或数字
  return escaped.replace(
    /([a-zA-Z0-9](?:[a-zA-Z0-9\s,.'\u2019-]*[a-zA-Z0-9])?)/g,
    '<span class="lingride-en-highlight">$1</span>'
  );
}

/**
 * 显示混杂中英翻译加载状态
 *
 * 在原文下方显示「混杂翻译中...」提示。
 *
 * @param element - 可翻译元素对象
 */
export function showMixedTranslateLoading(element: TranslatableElement): void {
  // 移除已有的混杂翻译容器
  removeMixedTranslation(element.id);

  // 创建加载状态容器
  const container = createMixedTranslateContainer(
    element.id,
    CSS_CLASSES.mixedTranslateLoading
  );
  container.textContent = "混杂翻译中";

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 显示混杂中英翻译结果
 *
 * 使用 innerHTML 注入以支持英文高亮。
 * 文本在高亮处理前已经过 HTML 转义，安全可控。
 */
export function showMixedTranslation(
  element: TranslatableElement,
  mixedText: string
): void {
  // 移除加载状态
  removeMixedTranslation(element.id);

  // 创建混杂翻译容器
  const container = createMixedTranslateContainer(
    element.id,
    CSS_CLASSES.mixedTranslate
  );

  // 先高亮英文部分
  let html = highlightEnglishParts(mixedText);

  // 后嵌套 code 标签包裹 codeWords
  if (element.codeWords && element.codeWords.length > 0) {
    html = nestCodeWrappingInHighlightedHtml(html, element.codeWords);
  }

  container.innerHTML = html;

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 显示混杂中英翻译错误
 *
 * 在原文下方显示混杂翻译错误提示。
 *
 * @param element - 可翻译元素对象
 * @param errorMessage - 错误信息
 */
export function showMixedTranslateError(
  element: TranslatableElement,
  errorMessage: string
): void {
  // 移除加载状态
  removeMixedTranslation(element.id);

  // 创建错误容器
  const container = createMixedTranslateContainer(
    element.id,
    CSS_CLASSES.mixedTranslateError
  );
  container.textContent = `混杂翻译失败: ${errorMessage}`;

  // 插入到原文后面
  element.element.insertAdjacentElement("afterend", container);
}

/**
 * 移除混杂翻译显示
 *
 * 移除指定元素的混杂翻译容器。
 *
 * @param elementId - 原文元素 ID
 */
function removeMixedTranslation(elementId: string): void {
  const container = getMixedTranslateContainer(elementId);
  if (container) {
    container.remove();
  }
}

/**
 * 移除所有混杂翻译
 *
 * 清除页面上所有的混杂翻译显示。
 */
export function removeAllMixedTranslations(): void {
  const containers = document.querySelectorAll(
    `.${CSS_CLASSES.mixedTranslate}, .${CSS_CLASSES.mixedTranslateError}, .${CSS_CLASSES.mixedTranslateLoading}`
  );

  for (const container of containers) {
    container.remove();
  }

  console.log(`[Lingride] 已移除 ${containers.length} 个混杂翻译元素`);
}

/**
 * 移除所有模式的结果
 *
 * 统一清除页面上所有三种模式（翻译、释义、混杂中英）的显示结果。
 * 用于模式切换时确保互斥显示。
 */
export function removeAllModeResults(): void {
  const allSelectors = [
    `.${CSS_CLASSES.translation}`,
    `.${CSS_CLASSES.error}`,
    `.${CSS_CLASSES.loading}`,
    `.${CSS_CLASSES.paraphrase}`,
    `.${CSS_CLASSES.paraphraseError}`,
    `.${CSS_CLASSES.paraphraseLoading}`,
    `.${CSS_CLASSES.mixedTranslate}`,
    `.${CSS_CLASSES.mixedTranslateError}`,
    `.${CSS_CLASSES.mixedTranslateLoading}`,
  ];

  const elements = document.querySelectorAll(allSelectors.join(", "));
  elements.forEach((el) => el.remove());

  console.log(`[Lingride] 模式切换：已清除 ${elements.length} 个旧模式元素`);
}
