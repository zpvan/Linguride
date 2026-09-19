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
 *
 * 页面解析要点：
 * - 作用域限定 main / [role="main"] / article，避开侧栏目录等重复内容
 * - 嵌套块（li>p、blockquote>p）只取叶子块文本，避免段落重复
 * - 句子按规范化文本去重，避免同一内容被朗读两遍
 * - 断句要求标点后跟空白或结尾，避免 URL / 版本号 / 缩写被误切
 */

/** 高亮名称（与 styles.css 中的 ::highlight 对应） */
const READ_ALOUD_HIGHLIGHT_NAME = "lingride-read-aloud";

/** 主内容容器（存在时只在其中提取，避开侧栏/导航的重复文本） */
const MAIN_CONTENT_SELECTOR = 'main, [role="main"], article';

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

/**
 * 文本节点的排除祖先（朗读噪音来源）
 *
 * pre 排除（代码块不朗读）；行内 code 保留，避免句子缺词。
 * nav/aside 即便误入作用域也在这里兜底排除。
 */
const EXCLUDED_ANCESTOR_SELECTOR = [
  "script",
  "style",
  "noscript",
  "iframe",
  "input",
  "textarea",
  "select",
  "button",
  "pre",
  "svg",
  "nav",
  "aside",
  '[contenteditable="true"]',
  '[aria-hidden="true"]',
  "[data-lingride-id]",
  "[data-lingride-paraphrase-id]",
  "[data-lingride-mixed-id]",
  '[class*="lingride"]',
].join(", ");

/** 单句最小字符数（过短的碎片不参与朗读，如 "A." 这类缩写残渣） */
const MIN_SENTENCE_CHARS = 3;

/** 朗读句子总数上限（防止超长页面读不完） */
const MAX_SENTENCES = 300;

/** 朗读总字符上限 */
const MAX_TOTAL_CHARS = 30000;

/** 零宽字符（清理朗读文本；offset 映射仍基于原始文本） */
const ZERO_WIDTH_PATTERN = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;

/** 文本节点在块内拼接文本中的区间 */
interface TextSegment {
  node: Text;
  /** 拼接文本中的起始 offset */
  start: number;
  /** 拼接文本中的结束 offset */
  end: number;
}

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
  const nonAscii = text.match(/[^ -~\s]/g);
  return !nonAscii || letters.length > nonAscii.length * 2;
}

function isVisible(element: Element): boolean {
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({ checkVisibilityCSS: true });
  }
  return (element as HTMLElement).offsetParent !== null;
}

/** 句读符号 */
const SENTENCE_PUNCTUATION = ".!?…";

/** 句读符号后允许的收尾字符（引号、括号等） */
const CLOSING_CHARS = "\"')]»”’";

function isWhitespaceChar(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

/**
 * 把文本切分为句子区间（逐字符扫描，非正则回溯）。
 *
 * 断句规则：
 * - 英文句读符号（. ! ? …）后必须紧跟空白或结尾才算边界
 *   （避免 claude.ai、v1.2.3、3.14 等被误切）
 * - 换行视为普通空白，不强制断句（textContent 保留源码缩进换行）
 *
 * 纯函数，独立导出便于测试。
 */
export function splitSentenceSpans(
  text: string
): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];

  let start = 0;
  let i = 0;

  const pushSpan = (rawStart: number, rawEnd: number) => {
    // 去掉首尾空白，得到有效区间
    let s = rawStart;
    let e = rawEnd;
    while (s < e && isWhitespaceChar(text[s])) s++;
    while (e > s && isWhitespaceChar(text[e - 1])) e--;
    if (e - s >= MIN_SENTENCE_CHARS) {
      spans.push({ start: s, end: e });
    }
  };

  while (i < text.length) {
    if (SENTENCE_PUNCTUATION.includes(text[i])) {
      // 连续的句读符号 + 收尾引号/括号一并吃掉
      let j = i;
      while (j < text.length && SENTENCE_PUNCTUATION.includes(text[j])) j++;
      while (j < text.length && CLOSING_CHARS.includes(text[j])) j++;

      if (isWhitespaceChar(text[j])) {
        // 边界成立：标点后是空白或文本结尾
        pushSpan(start, j);
        while (j < text.length && isWhitespaceChar(text[j])) j++;
        start = j;
        i = j;
        continue;
      }

      // 非边界（URL / 版本号 / 小数等），跳过该标点继续扫描
      i = j;
      continue;
    }
    i++;
  }

  pushSpan(start, text.length);
  return spans;
}

/** 规范化朗读文本：去零宽字符、折叠空白 */
function normalizeSentenceText(text: string): string {
  return text.replace(ZERO_WIDTH_PATTERN, "").replace(/\s+/g, " ").trim();
}

/** 收集主内容作用域内的候选块元素 */
function collectReadableBlocks(): HTMLElement[] {
  const mains = document.querySelectorAll<HTMLElement>(MAIN_CONTENT_SELECTOR);
  const scopes: HTMLElement[] = mains.length
    ? Array.from(mains)
    : [document.body];

  const blocks: HTMLElement[] = [];
  for (const scope of scopes) {
    for (const el of Array.from(scope.querySelectorAll(READABLE_SELECTORS))) {
      blocks.push(el as HTMLElement);
    }
  }
  return blocks;
}

/**
 * 收集块内的朗读文本节点。
 *
 * 拒绝三类节点：
 * - 父链命中排除选择器（按钮、pre、aria-hidden、Lingride 注入物等）
 * - 不可见节点（display:none 的行内元素等）
 * - 属于后代可读块的节点（嵌套块的内容交给后代块处理，避免重复）
 */
function collectTextSegments(block: HTMLElement): TextSegment[] {
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);

  let offset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    const excluded =
      !parent ||
      !!parent.closest(EXCLUDED_ANCESTOR_SELECTOR) ||
      !isVisible(parent) ||
      parent.closest(READABLE_SELECTORS) !== block;

    if (!excluded && node.data.trim()) {
      segments.push({ node, start: offset, end: offset + node.data.length });
      offset += node.data.length;
    }

    node = walker.nextNode() as Text | null;
  }

  return segments;
}

/**
 * 把拼接文本中的 [start, end) 区间映射为若干 DOM Range（跨文本节点拆段）。
 */
function buildRangesForSpan(
  segments: TextSegment[],
  start: number,
  end: number
): Range[] {
  const ranges: Range[] = [];

  for (const segment of segments) {
    const overlapStart = Math.max(start, segment.start);
    const overlapEnd = Math.min(end, segment.end);
    if (overlapStart < overlapEnd) {
      const range = document.createRange();
      range.setStart(segment.node, overlapStart - segment.start);
      range.setEnd(segment.node, overlapEnd - segment.start);
      ranges.push(range);
    }
    if (segment.end >= end) break;
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
  const seen = new Set<string>();

  for (const block of collectReadableBlocks()) {
    if (sentences.length >= MAX_SENTENCES || totalChars >= MAX_TOTAL_CHARS) {
      truncated = true;
      break;
    }
    if (!isVisible(block)) continue;

    const segments = collectTextSegments(block);
    if (segments.length === 0) continue;

    const combined = segments.map((s) => s.node.data).join("");
    if (!isMostlyEnglish(combined)) continue;

    for (const span of splitSentenceSpans(combined)) {
      if (sentences.length >= MAX_SENTENCES || totalChars >= MAX_TOTAL_CHARS) {
        truncated = true;
        break;
      }

      const sentenceText = normalizeSentenceText(
        combined.slice(span.start, span.end)
      );
      if (!sentenceText) continue;

      // 按规范化文本去重（目录/正文重复渲染、响应式重复块只读一次）
      const dedupeKey = sentenceText.toLowerCase();
      if (seen.has(dedupeKey)) continue;

      const ranges = buildRangesForSpan(segments, span.start, span.end);
      if (ranges.length === 0) continue;

      seen.add(dedupeKey);
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
