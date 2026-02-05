/**
 * @file textExtractor.ts
 * @description 页面文本提取器
 *
 * 负责从页面中识别和提取可翻译的英文段落。
 *
 * 识别规则：
 * - 块级元素中的纯文本内容（p, h1-h6, li, td 等）
 * - 排除脚本、样式、输入框等非文本元素
 * - 排除已翻译的元素
 * - 只提取主要为英文的段落
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { TranslatableElement, TranslationStatus, simpleHash } from "../types";

/**
 * 需要提取的文本元素选择器
 */
const TEXT_SELECTORS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "td",
  "th",
  "blockquote",
  "figcaption",
  "article",
  "article > div",
  "section > div",
  "main p",
  "main div",
  ".content",
  ".prose",
  ".markdown",
  ".text",
  '[role="article"]',
  '[role="main"] p',
  '[role="main"] div',
  "div > p",
  "span",
].join(", ");

/**
 * 需要排除的元素选择器
 */
const EXCLUDED_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "input",
  "textarea",
  "select",
  "button",
  "code",
  "pre",
  "svg",
  '[contenteditable="true"]',
  ".lingride-translation",
  ".lingride-error",
  ".lingride-loading",
].join(", ");

/**
 * 数据属性名，用于标记已处理的元素
 */
const PROCESSED_ATTR = "data-lingride-processed";

/**
 * 判断文本是否主要为英文
 *
 * 使用简单的启发式规则：
 * - 英文字母占比超过 60%
 * - 文本长度至少 10 个字符
 *
 * @param text - 待检测的文本
 * @returns 是否为英文文本
 */
function isEnglishText(text: string): boolean {
  const trimmed = text.trim();

  // 太短的文本不处理
  if (trimmed.length < 10) {
    return false;
  }

  // 统计英文字母数量
  const englishChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const totalChars = trimmed.replace(/\s/g, "").length;

  // 英文字母占比超过 60%
  return totalChars > 0 && englishChars / totalChars > 0.6;
}

/**
 * 检查元素是否应该被排除
 *
 * @param element - DOM 元素
 * @returns 是否应该排除
 */
function shouldExclude(element: HTMLElement): boolean {
  // 检查元素本身
  if (element.matches(EXCLUDED_SELECTORS)) {
    return true;
  }

  // 检查是否已处理
  if (element.hasAttribute(PROCESSED_ATTR)) {
    return true;
  }

  // 检查是否在排除的父元素内
  if (element.closest(EXCLUDED_SELECTORS)) {
    return true;
  }

  // 检查是否隐藏
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return true;
  }

  return false;
}

/**
 * 获取元素的直接文本内容
 *
 * 只获取元素自身的文本，不包括子元素的文本。
 *
 * @param element - DOM 元素
 * @returns 直接文本内容
 */
function getDirectText(element: HTMLElement): string {
  // 对于简单元素，直接返回 textContent
  if (element.children.length === 0) {
    return element.textContent?.trim() || "";
  }

  // 对于有子元素的情况，获取直接子文本节点
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    }
  }

  // 如果直接文本很少，使用完整的 textContent
  if (text.trim().length < 20 && element.textContent) {
    text = element.textContent;
  }

  return text.trim();
}

/**
 * 生成元素的唯一 ID
 *
 * 基于元素位置和内容生成稳定的 ID。
 *
 * @param element - DOM 元素
 * @param text - 元素文本内容
 * @returns 唯一 ID
 */
function generateElementId(element: HTMLElement, text: string): string {
  // 获取元素在 DOM 中的路径作为一部分
  const tagName = element.tagName.toLowerCase();
  const index = element.parentElement
    ? Array.from(element.parentElement.children).indexOf(element)
    : 0;

  // 结合文本内容哈希
  const textHash = simpleHash(text.substring(0, 100));

  return `lingride_${tagName}_${index}_${textHash}`;
}

/**
 * 提取页面中的可翻译元素
 *
 * 扫描页面 DOM，识别并返回所有可翻译的英文段落。
 *
 * @returns 可翻译元素数组
 */
export function extractTranslatableElements(): TranslatableElement[] {
  const elements: TranslatableElement[] = [];
  const processedTexts = new Set<string>();

  // 查询所有目标元素
  const candidates = document.querySelectorAll<HTMLElement>(TEXT_SELECTORS);

  for (const element of candidates) {
    // 跳过排除的元素
    if (shouldExclude(element)) {
      continue;
    }

    // 获取文本内容
    const text = getDirectText(element);

    // 跳过非英文或重复的文本
    if (!isEnglishText(text) || processedTexts.has(text)) {
      continue;
    }

    // 标记为已处理
    processedTexts.add(text);
    element.setAttribute(PROCESSED_ATTR, "true");

    // 创建可翻译元素对象
    const id = generateElementId(element, text);
    elements.push({
      id,
      element,
      originalText: text,
      status: TranslationStatus.PENDING,
    });
  }

  console.log(`[Lingride] 提取到 ${elements.length} 个可翻译段落`);
  return elements;
}

/**
 * 清除所有处理标记
 *
 * 用于重新扫描页面时重置状态。
 */
export function clearProcessedMarks(): void {
  const processed = document.querySelectorAll(`[${PROCESSED_ATTR}]`);
  for (const element of processed) {
    element.removeAttribute(PROCESSED_ATTR);
  }
  console.log(`[Lingride] 已清除 ${processed.length} 个处理标记`);
}
