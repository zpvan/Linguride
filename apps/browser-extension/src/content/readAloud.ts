/**
 * @file readAloud.ts
 * @description 阅读全文（朗读）的页面侧支持
 *
 * 职责：
 * - 从页面提取可朗读的英文句子，并记录每个句子对应的 DOM Range
 * - 通过 CSS Custom Highlight API 高亮当前朗读的句子（不改动 DOM）
 * - 高亮时自动滚动到可视区域
 *
 * 编排逻辑（逐句合成 + 播放 + 预取下一句）在 Background Service Worker，
 * 本模块只响应 READ_ALOUD_PREPARE / READ_ALOUD_HIGHLIGHT 两个消息。
 */

/** 高亮名称（与 styles.css 中的 ::highlight 对应） */
const READ_ALOUD_HIGHLIGHT_NAME = "lingride-read-aloud";

/** 可朗读的块级元素 */
const READABLE_SELECTORS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "figcaption",
].join(", ");

/** 排除的元素（含 Lingride 自身注入的容器） */
const EXCLUDED_SELECTOR = [
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
  "nav",
  "header",
  "footer",
  '[contenteditable="true"]',
  "[data-lingride-id]",
  "[data-lingride-paraphrase-id]",
  "[data-lingride-mixed-id]",
  '[class*="lingride"]',
].join(", ");

/** 单句最小字符数（过短的碎片不参与朗读） */
const MIN_SENTENCE_CHARS = 2;

/** 朗读句子总数上限（防止超长页面读不完） */
const MAX_SENTENCES = 300;

/** 朗读总字符上限 */
const MAX_TOTAL_CHARS = 30000;

interface ReadAloudSentence {
  text: string;
  ranges: Range[];
}

let sentences: ReadAloudSentence[] = [];

/**
 * 判断文本是否以英文为主（与 textExtractor 的判定保持一致的简化版）
 */
function isMostlyEnglish(text: string): boolean {
  const letters = text.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 10) return false;
  const nonAscii = text.match(/[^\u0020-\u007E\s]/g);
  return !nonAscii || letters.length > nonAscii.length * 2;
}

function isElementReadable(element: HTMLElement): boolean {
  if (element.closest(EXCLUDED_SELECTOR)) return false;
  if (element.offsetParent === null && element.tagName !== "BODY") return false;
  return true;
}

/**
 * 把块元素文本切分为句子，返回每句在块内 textContent 中的 [start, end) 区间。
 *
 * 规则：英文句读符号（. ! ? …）+ 紧随的引号/括号收尾算作句子边界。
 */
function splitSentenceSpans(text: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  const pattern = /[^.!?…\n]+[.!?…]+[\]»"'')\]]*\s*|[^.!?…\n]+$/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index + (raw.length - raw.trimStart().length);
    const end = match.index + raw.trimEnd().length;
    if (end - start >= MIN_SENTENCE_CHARS) {
      spans.push({ start, end });
    }
  }

  return spans;
}

/**
 * 把块内 [start, end) 区间映射为若干 DOM Range（跨文本节点时拆段）。
 */
function buildRangesForSpan(
  block: HTMLElement,
  start: number,
  end: number
): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);

  let offset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const nodeStart = offset;
    const nodeEnd = offset + node.data.length;
    offset = nodeEnd;

    const overlapStart = Math.max(start, nodeStart);
    const overlapEnd = Math.min(end, nodeEnd);
    if (overlapStart < overlapEnd) {
      const range = document.createRange();
      range.setStart(node, overlapStart - nodeStart);
      range.setEnd(node, overlapEnd - nodeStart);
      ranges.push(range);
    }

    if (nodeEnd >= end) break;
    node = walker.nextNode() as Text | null;
  }

  return ranges;
}

/**
 * 提取页面可朗读句子并建立 Range 映射。
 *
 * @returns 句子文本列表与是否截断
 */
export function prepareReadAloud(): { sentences: string[]; truncated: boolean } {
  clearReadAloudHighlight();
  sentences = [];

  let totalChars = 0;
  let truncated = false;

  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>(READABLE_SELECTORS)
  );

  for (const block of blocks) {
    if (sentences.length >= MAX_SENTENCES || totalChars >= MAX_TOTAL_CHARS) {
      truncated = true;
      break;
    }
    if (!isElementReadable(block)) continue;

    const text = block.textContent || "";
    if (!isMostlyEnglish(text)) continue;

    for (const span of splitSentenceSpans(text)) {
      if (sentences.length >= MAX_SENTENCES || totalChars >= MAX_TOTAL_CHARS) {
        truncated = true;
        break;
      }

      const sentenceText = text.slice(span.start, span.end).trim();
      const ranges = buildRangesForSpan(block, span.start, span.end);
      if (!sentenceText || ranges.length === 0) continue;

      sentences.push({ text: sentenceText, ranges });
      totalChars += sentenceText.length;
    }

    if (truncated) break;
  }

  return { sentences: sentences.map((s) => s.text), truncated };
}

/**
 * 高亮指定下标的句子并滚动到可视区域；index < 0 时清除高亮。
 */
export function highlightReadAloudSentence(index: number): void {
  clearReadAloudHighlight();

  if (index < 0 || index >= sentences.length) return;

  const sentence = sentences[index];
  if (!("highlights" in CSS)) return;

  const highlight = new Highlight(...sentence.ranges);
  CSS.highlights.set(READ_ALOUD_HIGHLIGHT_NAME, highlight);

  // 滚动到句子位置（垂直居中，平滑滚动）
  const rect = sentence.ranges[0]?.getBoundingClientRect();
  if (rect) {
    const targetY =
      window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
    window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
  }
}

/**
 * 清除朗读高亮。
 */
export function clearReadAloudHighlight(): void {
  if ("highlights" in CSS) {
    CSS.highlights.delete(READ_ALOUD_HIGHLIGHT_NAME);
  }
}
