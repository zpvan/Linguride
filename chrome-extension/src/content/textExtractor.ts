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
  // "span" 已移除 —— span 在 p 内部时通过 INLINE_TAGS 自然覆盖
].join(", ");

/**
 * 需要排除的元素选择器
 *
 * 包含所有 Lingride 注入的 DOM 元素（翻译/释义/混杂翻译），
 * 防止注入的翻译容器及其子元素被二次提取导致嵌套翻译。
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
  // 排除所有 Lingride 注入的容器（通过 data 属性，最可靠）
  "[data-lingride-id]",
  "[data-lingride-paraphrase-id]",
  "[data-lingride-mixed-id]",
  // 排除翻译相关类名
  ".lingride-translation",
  ".lingride-error",
  ".lingride-loading",
  // 排除释义相关类名
  ".lingride-paraphrase",
  ".lingride-paraphrase-error",
  ".lingride-paraphrase-loading",
  // 排除混杂中英相关类名
  ".lingride-mixed-translate",
  ".lingride-mixed-translate-error",
  ".lingride-mixed-translate-loading",
  // 排除注入容器内部的子元素
  ".lingride-en-highlight",
  ".lingride-inline-code",
  // ---- 元数据 & 导航区域排除 ----
  "nav",
  // 注意：不添加通用 "header"/"footer"，因为文章级 <header>/<footer> 可能包含合法正文
  // 仅通过 ARIA role 排除页面级 header/footer
  '[role="navigation"]',
  '[role="toolbar"]',
  '[role="menubar"]',
  '[role="banner"]', // 页面级 header
  '[role="contentinfo"]', // 页面级 footer
  '[role="menu"]',
  // 常见时间戳元素
  "time",
  // 常见 UI 元素
  "label",
].join(", ");

/**
 * 内联元素标签白名单
 *
 * 这些元素是段落内的行内格式化元素，其文本内容应被视为
 * 父段落文本的一部分。提取文本时需要包含这些元素的内容，
 * 而非跳过它们。
 */
const INLINE_TAGS = new Set([
  "code",
  "strong",
  "em",
  "b",
  "i",
  "a",
  "span",
  "mark",
  "sub",
  "sup",
  "abbr",
  "small",
  "time",
  "kbd",
  "samp",
  "var",
  "cite",
  "q",
]);

/**
 * 块级子元素选择器
 *
 * 如果一个元素包含这些块级子元素，说明它是容器而非叶子内容元素，
 * 应跳过以避免合并多个段落的文本。
 */
const BLOCK_CHILD_SELECTORS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ul",
  "ol",
  "blockquote",
  "table",
  "figure",
  "pre",
  "div",
  "section",
  "article",
  "aside",
  "nav",
  "header",
  "footer",
].join(", ");

/**
 * 数据属性名，用于标记已处理的元素
 */
const PROCESSED_ATTR = "data-lingride-processed";

/**
 * 检查元素是否包含块级子元素
 *
 * 如果元素包含 p、div、h1-h6 等块级子元素，说明它是容器元素，
 * 其子元素会被单独提取，无需重复提取容器本身。
 *
 * @param element - DOM 元素
 * @returns 是否包含块级子元素
 */
function hasBlockChildren(element: HTMLElement): boolean {
  return element.querySelector(BLOCK_CHILD_SELECTORS) !== null;
}

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
 * 内容型元素标签集合
 *
 * 这些标签的语义表明它们大概率包含正文内容，
 * 因此对短文本使用更宽松的阈值。
 */
const CONTENT_TAGS = new Set([
  "p",
  "blockquote",
  "li",
  "td",
  "th",
  "figcaption",
]);

/**
 * 启发式检测元素是否为元数据/UI 文本
 *
 * 在 shouldExclude() 之后执行，处理"标签/区域上合法但语义上是元数据"的情况。
 *
 * 检查维度：
 * 1. 短文本 + 标签类型分层判断
 * 2. 极小视觉尺寸兜底（放在最后，避免不必要的 reflow）
 *
 * @param element - DOM 元素
 * @param text - 元素的直接文本内容
 * @returns 是否应视为元数据并跳过翻译
 */
function isMetadataLike(element: HTMLElement, text: string): boolean {
  const words = text.trim().split(/\s+/);
  const tag = element.tagName.toLowerCase();

  // 1. 标题元素：全部豁免
  if (/^h[1-6]$/.test(tag)) return false;

  // 2. 内容型标签（p/blockquote/li/td/th）：>= 2 词即保留
  if (CONTENT_TAGS.has(tag)) {
    if (words.length < 2) return true;
    // 通过词数检查，继续后续判断
  } else {
    // 3. 容器型标签（div/article/section 等）：< 4 词视为元数据
    if (words.length < 4) return true;
  }

  // 4. 兜底：极小视觉尺寸（< 10px 高度）大概率是辅助 UI 文本
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0 && rect.height < 10) return true;

  return false;
}

/**
 * 获取元素的直接文本内容
 *
 * 获取元素自身的文本及内联子元素（如 <code>、<strong>、<em> 等）的文本，
 * 但不包括块级子元素的文本（避免与单独提取的段落重复）。
 *
 * @param element - DOM 元素
 * @returns 直接文本内容
 */
function getDirectText(element: HTMLElement): string {
  // 对于简单元素，直接返回 textContent
  if (element.children.length === 0) {
    return element.textContent?.trim() || "";
  }

  // 对于有子元素的情况，获取直接子文本节点 + 内联元素文本
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (INLINE_TAGS.has(tag)) {
        text += el.textContent || "";
      }
    }
  }

  // 如果直接文本很少，使用完整的 textContent
  if (text.trim().length < 20 && element.textContent) {
    text = element.textContent;
  }

  return text.trim();
}

/**
 * 提取元素中 <code> 子元素的文本内容
 *
 * 收集段落中所有内联 <code> 标签的文本，用于后续在译文中
 * 恢复 code 格式包裹。
 *
 * @param element - DOM 元素
 * @returns code 标签内的词汇数组（去重）
 */
function extractInlineCodeWords(element: HTMLElement): string[] {
  const codeElements = element.querySelectorAll("code");
  if (codeElements.length === 0) return [];

  const words = new Set<string>();
  for (const code of codeElements) {
    const word = code.textContent?.trim();
    if (word) {
      words.add(word);
    }
  }

  return Array.from(words);
}

/**
 * 生成元素的唯一 ID
 *
 * 基于元素位置和内容生成稳定的 ID。
 * 计算 sibling index 时跳过 Lingride 注入的翻译容器，
 * 确保无论 DOM 中存在多少注入容器，原始元素的 ID 始终一致。
 *
 * @param element - DOM 元素
 * @param text - 元素文本内容
 * @returns 唯一 ID
 */
function generateElementId(element: HTMLElement, text: string): string {
  const tagName = element.tagName.toLowerCase();

  // 计算稳定的 sibling index：跳过 Lingride 注入的容器元素
  let index = 0;
  if (element.parentElement) {
    for (const sibling of element.parentElement.children) {
      if (sibling === element) break;
      // 跳过 Lingride 注入的容器，保证 index 不受注入影响
      if (
        sibling.hasAttribute("data-lingride-id") ||
        sibling.hasAttribute("data-lingride-paraphrase-id") ||
        sibling.hasAttribute("data-lingride-mixed-id")
      ) {
        continue;
      }
      index++;
    }
  }

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

    // 跳过容器元素（含块级子元素），只提取最细粒度的叶子段落
    if (hasBlockChildren(element)) {
      continue;
    }

    // 获取文本内容
    const text = getDirectText(element);

    // 跳过非英文或重复的文本
    if (!isEnglishText(text) || processedTexts.has(text)) {
      continue;
    }

    // 跳过元数据/UI 文本
    if (isMetadataLike(element, text)) {
      continue;
    }

    // 标记为已处理
    processedTexts.add(text);
    element.setAttribute(PROCESSED_ATTR, "true");

    // 提取 code 标签内的词汇（用于译文格式保留）
    const codeWords = extractInlineCodeWords(element);

    // 创建可翻译元素对象
    const id = generateElementId(element, text);
    elements.push({
      id,
      element,
      originalText: text,
      status: TranslationStatus.PENDING,
      codeWords: codeWords.length > 0 ? codeWords : undefined,
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
