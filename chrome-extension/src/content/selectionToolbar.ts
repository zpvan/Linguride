/**
 * @file selectionToolbar.ts
 * @description 划词工具条与结果卡片
 *
 * 在用户选中文本后于选区附近展示功能工具条，支持：
 * - 英译中
 * - 英英释义
 * - 长难句分析
 */

import {
  AnalyzeSentenceResponse,
  CEFRLevel,
  DEFAULT_TTS_SPEED,
  EnglishDefinitionResponse,
  GetConfigResponse,
  isTTSSpeed,
  LingridConfig,
  MessageType,
  SentenceAnalysisResult,
  STORAGE_KEY,
  TTSSpeed,
  TranslateResponse,
} from "../types";
import { getCachedTranslation, setCachedTranslation } from "./translationCache";

type CardAction = "translate" | "definition" | "analyze";
type ToolbarAction = CardAction | "pronounce";
type SpeechLanguage = "en-US" | "zh-CN";

type SelectionEvaluationState = "none" | "valid" | "disabled";

interface SelectionEvaluation {
  state: SelectionEvaluationState;
  text: string;
  range: Range | null;
  rect: DOMRect | null;
  reason?: string;
}

interface CardSpeakConfig {
  text: string;
  lang: SpeechLanguage;
}

const MIN_SELECTION_CHARS = 2;
const MAX_SELECTION_CHARS = 500;
const MIN_ENGLISH_RATIO = 0.6;
const TOOLBAR_MARGIN = 8;
const VIEWPORT_MARGIN = 12;
const COPY_FEEDBACK_DURATION = 1500;
const SELECTION_UPDATE_DEDUPE_MS = 160;

const ACTION_LABELS: Record<ToolbarAction, string> = {
  translate: "翻译",
  definition: "释义",
  analyze: "句法",
  pronounce: "发音",
};

const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CARD_ACTIONS: CardAction[] = ["translate", "definition", "analyze"];
const TOOLBAR_ACTIONS: ToolbarAction[] = [
  "translate",
  "definition",
  "analyze",
  "pronounce",
];

let isInitialized = false;
let hasPendingInit = false;

let rootEl: HTMLDivElement | null = null;
let messageEl: HTMLDivElement | null = null;
let cardEl: HTMLDivElement | null = null;
let selectionDebounceTimer: number | null = null;
let repositionRaf: number | null = null;
let copyFeedbackTimer: number | null = null;

let currentText = "";
let currentRange: Range | null = null;
let fallbackRect: DOMRect | null = null;
let disabledReason = "";
let requestToken = 0;
let isLoading = false;
let ignoreSelectionChangeUntil = 0;
let cachedUserLevel: CEFRLevel | null = null;
let lastSelectionUpdateText = "";
let lastSelectionUpdateAt = 0;
let currentTTSSpeed: TTSSpeed = DEFAULT_TTS_SPEED;
let activeSpeechButton: HTMLButtonElement | null = null;
let speechRequestId = 0;

const buttonMap: Record<ToolbarAction, HTMLButtonElement | null> = {
  translate: null,
  definition: null,
  analyze: null,
  pronounce: null,
};

/**
 * 初始化划词工具条
 */
export function initSelectionToolbar(): void {
  if (isInitialized) return;
  if (!document.body) {
    if (!hasPendingInit) {
      hasPendingInit = true;
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          hasPendingInit = false;
          initSelectionToolbar();
        },
        { once: true }
      );
    }
    return;
  }

  createToolbarUi();
  bindEvents();
  void loadSelectionPreferences();
  isInitialized = true;

  console.log("[Lingride] 划词工具条已初始化");
}

/**
 * 销毁划词工具条
 */
export function destroySelectionToolbar(): void {
  if (!isInitialized) return;

  unbindEvents();

  if (selectionDebounceTimer !== null) {
    clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = null;
  }

  if (repositionRaf !== null) {
    cancelAnimationFrame(repositionRaf);
    repositionRaf = null;
  }

  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }

  stopSelectionSpeech();

  if (rootEl) {
    rootEl.remove();
  }

  rootEl = null;
  messageEl = null;
  cardEl = null;

  buttonMap.translate = null;
  buttonMap.definition = null;
  buttonMap.analyze = null;
  buttonMap.pronounce = null;

  currentText = "";
  currentRange = null;
  fallbackRect = null;
  disabledReason = "";
  requestToken = 0;
  isLoading = false;
  hasPendingInit = false;
  lastSelectionUpdateText = "";
  lastSelectionUpdateAt = 0;

  isInitialized = false;
}

function createToolbarUi(): void {
  if (rootEl || !document.body) return;

  const root = document.createElement("div");
  root.className = "lingride-selection-root";
  root.setAttribute("data-lingride-selection-root", "true");
  root.style.display = "none";

  const toolbar = document.createElement("div");
  toolbar.className = "lingride-selection-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Lingride 划词工具栏");

  buttonMap.translate = createActionButton("translate");
  buttonMap.definition = createActionButton("definition");
  buttonMap.analyze = createActionButton("analyze");
  buttonMap.pronounce = createActionButton("pronounce");

  toolbar.append(
    buttonMap.translate,
    buttonMap.definition,
    buttonMap.analyze,
    buttonMap.pronounce
  );

  const message = document.createElement("div");
  message.className = "lingride-selection-message";
  message.setAttribute("aria-live", "polite");

  const card = document.createElement("div");
  card.className = "lingride-selection-card";
  card.style.display = "none";

  root.append(toolbar, message, card);
  document.body.appendChild(root);

  rootEl = root;
  messageEl = message;
  cardEl = card;

  root.addEventListener("pointerdown", handleRootPointerDown, true);
  root.addEventListener("click", handleRootClick);
}

function isToolbarMounted(): boolean {
  if (!rootEl || !messageEl || !cardEl || !document.body) {
    return false;
  }

  return (
    rootEl.isConnected &&
    messageEl.isConnected &&
    cardEl.isConnected &&
    document.body.contains(rootEl)
  );
}

function ensureToolbarMounted(): boolean {
  if (isToolbarMounted()) {
    return true;
  }

  if (!document.body) {
    return false;
  }

  const shouldWarn = !!rootEl || !!messageEl || !!cardEl;

  rootEl = null;
  messageEl = null;
  cardEl = null;
  buttonMap.translate = null;
  buttonMap.definition = null;
  buttonMap.analyze = null;
  buttonMap.pronounce = null;

  createToolbarUi();

  if (shouldWarn && rootEl) {
    console.warn("[Lingride] 划词工具条节点丢失，已自动重建");
  }

  return isToolbarMounted();
}

function createActionButton(action: ToolbarAction): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lingride-selection-button";
  button.dataset.action = action;
  button.textContent = ACTION_LABELS[action];
  return button;
}

function bindEvents(): void {
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("selectionchange", handleSelectionChange);
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
  document.addEventListener("scroll", handleViewportChanged, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("resize", handleViewportChanged);
  chrome.storage.onChanged.addListener(handleConfigStorageChange);
}

function unbindEvents(): void {
  document.removeEventListener("mouseup", handleMouseUp, true);
  document.removeEventListener("selectionchange", handleSelectionChange);
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  document.removeEventListener("scroll", handleViewportChanged, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  window.removeEventListener("resize", handleViewportChanged);
  chrome.storage.onChanged.removeListener(handleConfigStorageChange);
}

function handleMouseUp(event: MouseEvent): void {
  if (!ensureToolbarMounted() || !rootEl) return;

  const target = event.target;
  if (target instanceof Node && rootEl.contains(target)) {
    return;
  }

  window.setTimeout(() => {
    updateToolbarFromSelection();
  }, 0);
}

function handleSelectionChange(): void {
  if (Date.now() < ignoreSelectionChangeUntil) return;

  if (!ensureToolbarMounted()) return;

  if (selectionDebounceTimer !== null) {
    clearTimeout(selectionDebounceTimer);
  }

  selectionDebounceTimer = window.setTimeout(() => {
    selectionDebounceTimer = null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (!isLoading) hideToolbar();
      return;
    }

    // 允许在结果卡片内自由选中文本进行复制，不触发重算/隐藏
    if (isSelectionInsideToolbar(selection)) {
      return;
    }

    const selectedText = normalizeSelectionText(selection.toString());
    if (!selectedText) {
      if (!isLoading) hideToolbar();
      return;
    }

    // 键盘选择时也刷新工具条位置和内容
    updateToolbarFromSelection();
  }, 80);
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!isVisible() || !rootEl) return;

  const target = event.target;
  if (target instanceof Node && rootEl.contains(target)) {
    return;
  }

  hideToolbar();
}

function handleRootPointerDown(): void {
  // 点击工具条内部会触发 selectionchange，短暂忽略避免闪退
  ignoreSelectionChangeUntil = Date.now() + 220;
}

function handleRootClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest("button[data-action]");
  if (!(button instanceof HTMLButtonElement)) return;

  const action = button.dataset.action;
  if (!isToolbarAction(action)) return;

  if (disabledReason) return;
  if (!currentText) return;

  if (action === "pronounce") {
    toggleSpeakText(currentText, "en-US", button);
    return;
  }

  void runAction(action);
}

function isSelectionInsideToolbar(selection: Selection): boolean {
  if (!rootEl || !rootEl.isConnected) return false;

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) return false;

  return rootEl.contains(anchorNode) && rootEl.contains(focusNode);
}

function handleViewportChanged(): void {
  if (!isVisible()) return;
  scheduleReposition();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!isVisible()) return;
  if (event.key === "Escape") {
    hideToolbar();
  }
}

function updateToolbarFromSelection(): void {
  const evaluation = evaluateCurrentSelection();

  if (evaluation.state === "none") {
    hideToolbar();
    return;
  }

  const now = Date.now();
  const isDuplicateUpdate =
    evaluation.text === lastSelectionUpdateText &&
    now - lastSelectionUpdateAt < SELECTION_UPDATE_DEDUPE_MS;

  if (isDuplicateUpdate && isVisible()) {
    return;
  }

  lastSelectionUpdateText = evaluation.text;
  lastSelectionUpdateAt = now;

  const textChanged = evaluation.text !== currentText;

  currentText = evaluation.text;
  currentRange = evaluation.range;
  fallbackRect = evaluation.rect;

  if (textChanged) {
    // 切换选区时使旧请求失效，防止异步结果串写到新选区
    requestToken++;
    isLoading = false;
    stopSelectionSpeech();
    resetCard();
    setActiveAction(null);
  }

  if (evaluation.state === "disabled") {
    setDisabledState(evaluation.reason || "仅支持英文文本");
  } else {
    setEnabledState();
  }

  showToolbar();
}

function evaluateCurrentSelection(): SelectionEvaluation {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return { state: "none", text: "", range: null, rect: null };
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rawText = normalizeSelectionText(selection.toString());

  if (!rawText || rawText.length < MIN_SELECTION_CHARS) {
    return { state: "none", text: "", range: null, rect: null };
  }

  if (isEditableSelection(range)) {
    return { state: "none", text: "", range: null, rect: null };
  }

  const rect = getRangeRect(range);
  if (!rect) {
    return { state: "none", text: "", range: null, rect: null };
  }

  if (rawText.length > MAX_SELECTION_CHARS) {
    return {
      state: "disabled",
      text: rawText,
      range,
      rect,
      reason: `文本过长（最多 ${MAX_SELECTION_CHARS} 字符）`,
    };
  }

  const englishRatio = getEnglishRatio(rawText);
  if (englishRatio < MIN_ENGLISH_RATIO) {
    return {
      state: "disabled",
      text: rawText,
      range,
      rect,
      reason: "仅支持英文文本",
    };
  }

  return {
    state: "valid",
    text: rawText,
    range,
    rect,
  };
}

function normalizeSelectionText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isEditableSelection(range: Range): boolean {
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;

  if (!element) return false;

  return !!element.closest(
    "input, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']"
  );
}

function getRangeRect(range: Range): DOMRect | null {
  const rect = range.getBoundingClientRect();
  if (isFiniteRect(rect) && (rect.width > 0 || rect.height > 0)) {
    return rect;
  }

  const rects = Array.from(range.getClientRects());
  if (rects.length === 0) {
    return null;
  }

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const clientRect of rects) {
    left = Math.min(left, clientRect.left);
    top = Math.min(top, clientRect.top);
    right = Math.max(right, clientRect.right);
    bottom = Math.max(bottom, clientRect.bottom);
  }

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }

  return new DOMRect(left, top, right - left, bottom - top);
}

function isFiniteRect(rect: DOMRect | DOMRectReadOnly): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom)
  );
}

function getEnglishRatio(text: string): number {
  const totalChars = text.replace(/\s/g, "").length;
  if (totalChars === 0) return 0;

  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  return englishChars / totalChars;
}

function setDisabledState(reason: string): void {
  disabledReason = reason;
  requestToken++;
  isLoading = false;
  stopSelectionSpeech();

  setButtonsDisabled(true);
  setMessage(reason, true);
  resetCard();
}

function setEnabledState(): void {
  disabledReason = "";
  setButtonsDisabled(false);
  setMessage("", false);
}

function setButtonsDisabled(disabled: boolean): void {
  for (const action of TOOLBAR_ACTIONS) {
    const button = buttonMap[action];
    if (!button) continue;

    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
}

function setMessage(message: string, visible: boolean): void {
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.classList.toggle("is-visible", visible);
}

function showToolbar(): void {
  if (!ensureToolbarMounted() || !rootEl) return;

  rootEl.style.display = "block";
  rootEl.classList.add("is-visible");
  scheduleReposition();
}

function hideToolbar(): void {
  requestToken++;
  isLoading = false;
  stopSelectionSpeech();

  currentText = "";
  currentRange = null;
  fallbackRect = null;
  disabledReason = "";
  lastSelectionUpdateText = "";
  lastSelectionUpdateAt = 0;

  if (!rootEl) return;

  setMessage("", false);
  setActiveAction(null);
  resetCard();

  rootEl.classList.remove("is-visible", "has-card");
  rootEl.style.display = "none";
}

function isVisible(): boolean {
  return !!rootEl && rootEl.isConnected && rootEl.style.display !== "none";
}

function scheduleReposition(): void {
  if (repositionRaf !== null) return;

  repositionRaf = window.requestAnimationFrame(() => {
    repositionRaf = null;
    repositionToolbar();
  });
}

function repositionToolbar(): void {
  if (!rootEl || !isVisible()) return;

  const anchor = getAnchorRect();
  if (!anchor) {
    hideToolbar();
    return;
  }

  rootEl.style.visibility = "hidden";

  const toolbarWidth = rootEl.offsetWidth;
  const toolbarHeight = rootEl.offsetHeight;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const centerX = anchor.left + anchor.width / 2;
  const maxLeft = viewportWidth - toolbarWidth - VIEWPORT_MARGIN;
  const left = clamp(centerX - toolbarWidth / 2, VIEWPORT_MARGIN, maxLeft);

  let top = anchor.bottom + TOOLBAR_MARGIN;
  if (top + toolbarHeight + VIEWPORT_MARGIN > viewportHeight) {
    top = anchor.top - toolbarHeight - TOOLBAR_MARGIN;
  }

  top = clamp(top, VIEWPORT_MARGIN, viewportHeight - toolbarHeight - VIEWPORT_MARGIN);

  rootEl.style.left = `${Math.round(left)}px`;
  rootEl.style.top = `${Math.round(top)}px`;
  rootEl.style.visibility = "visible";
}

function getAnchorRect(): DOMRect | null {
  if (currentRange) {
    const rect = getRangeRect(currentRange);
    if (rect) {
      fallbackRect = rect;
      return rect;
    }
  }

  return fallbackRect;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function setActiveAction(action: CardAction | null): void {
  for (const key of CARD_ACTIONS) {
    const button = buttonMap[key];
    if (!button) continue;

    const isActive = action === key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

function resetCard(): void {
  if (!cardEl || !rootEl) return;

  cardEl.innerHTML = "";
  cardEl.style.display = "none";
  rootEl.classList.remove("has-card");
}

function showCardContainer(): void {
  if (!cardEl || !rootEl) return;

  cardEl.style.display = "block";
  rootEl.classList.add("has-card");
}

function showCardLoading(action: CardAction): void {
  if (!cardEl) return;

  setActiveAction(action);
  showCardContainer();

  cardEl.innerHTML = "";

  const loading = document.createElement("div");
  loading.className = "lingride-selection-loading";
  loading.textContent = `${ACTION_LABELS[action]}中...`;
  cardEl.appendChild(loading);
}

function showCardError(action: CardAction, message: string): void {
  if (!cardEl) return;

  setActiveAction(action);
  showCardContainer();

  cardEl.innerHTML = "";

  const title = createCardTitle(ACTION_LABELS[action]);
  const error = document.createElement("div");
  error.className = "lingride-selection-error";
  error.textContent = message;

  cardEl.append(title, error);
}

async function runAction(action: CardAction): Promise<void> {
  const text = currentText;
  if (!text) return;

  stopSelectionSpeech();

  const token = ++requestToken;
  isLoading = true;
  showCardLoading(action);
  scheduleReposition();

  try {
    if (action === "translate") {
      const translation = await requestTranslate(text);
      if (token !== requestToken) return;
      renderTranslateResult(translation);
    } else if (action === "definition") {
      const definition = await requestDefinition(text);
      if (token !== requestToken) return;
      renderDefinitionResult(definition);
    } else {
      const analysis = await requestSentenceAnalysis(text);
      if (token !== requestToken) return;
      renderSentenceAnalysisResult(analysis);
    }
  } catch (error) {
    if (token !== requestToken) return;

    const message =
      error instanceof Error ? error.message : "请求失败，请稍后重试";
    showCardError(action, message);
  } finally {
    if (token === requestToken) {
      isLoading = false;
      setActiveAction(action);
      scheduleReposition();
    }
  }
}

async function requestTranslate(text: string): Promise<string> {
  const cached = getCachedTranslation(text);
  if (cached) {
    return cached;
  }

  const batchId = `selection-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const response = (await chrome.runtime.sendMessage({
    type: MessageType.TRANSLATE,
    payload: {
      texts: [text],
      batchId,
    },
  })) as TranslateResponse;

  if (!response.success || !response.data) {
    throw new Error(response.error || "翻译失败");
  }

  const translation = response.data.translations[0]?.trim();
  if (!translation) {
    throw new Error("翻译结果为空");
  }

  setCachedTranslation(text, translation);
  return translation;
}

async function requestDefinition(
  text: string
): Promise<NonNullable<EnglishDefinitionResponse["data"]>> {
  const userLevel = await getUserLevel();

  const response = (await chrome.runtime.sendMessage({
    type: MessageType.ENGLISH_DEFINITION,
    payload: {
      text,
      userLevel,
    },
  })) as EnglishDefinitionResponse;

  if (!response.success || !response.data) {
    throw new Error(response.error || "获取释义失败");
  }

  return response.data;
}

async function requestSentenceAnalysis(
  text: string
): Promise<SentenceAnalysisResult> {
  const response = (await chrome.runtime.sendMessage({
    type: MessageType.ANALYZE_SENTENCE,
    payload: {
      sentence: text,
    },
  })) as AnalyzeSentenceResponse;

  if (!response.success || !response.data) {
    throw new Error(response.error || "句法分析失败");
  }

  return response.data;
}

async function getUserLevel(): Promise<CEFRLevel> {
  if (cachedUserLevel) {
    return cachedUserLevel;
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    })) as GetConfigResponse;

    const candidate = response.data?.user_english_level;
    if (response.success && candidate && CEFR_LEVELS.includes(candidate)) {
      cachedUserLevel = candidate;
      return candidate;
    }
  } catch (error) {
    console.warn("[Lingride] 获取用户等级失败，使用默认 A2", error);
  }

  cachedUserLevel = "A2";
  return cachedUserLevel;
}

function renderTranslateResult(translation: string): void {
  if (!cardEl) return;

  showCardContainer();
  cardEl.innerHTML = "";

  const header = createCardHeader("翻译", {
    text: translation,
    lang: "zh-CN",
  });
  const content = document.createElement("p");
  content.className = "lingride-selection-paragraph";
  content.textContent = translation;

  cardEl.append(header, content);
}

function renderDefinitionResult(
  data: NonNullable<EnglishDefinitionResponse["data"]>
): void {
  if (!cardEl) return;

  showCardContainer();
  cardEl.innerHTML = "";

  const copyBtn = createCopyButton();
  copyBtn.addEventListener("click", () => {
    void handleCopyDefinition(data, copyBtn);
  });

  const header = createCardHeader(
    "英英释义",
    data.definition
      ? {
          text: data.definition,
          lang: "en-US",
        }
      : null,
    [copyBtn]
  );

  cardEl.appendChild(header);

  if (data.definition) {
    cardEl.appendChild(createTextSection("Definition", data.definition));
  }

  if (data.examples && data.examples.length > 0) {
    cardEl.appendChild(createListSection("Examples", data.examples));
  }

  if (data.synonyms && data.synonyms.length > 0) {
    cardEl.appendChild(createInlineSection("Synonyms", data.synonyms.join(", ")));
  }

  if (data.usageNotes) {
    cardEl.appendChild(createTextSection("Usage", data.usageNotes));
  }
}

function createCopyButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "lingride-selection-card-action-btn lingride-selection-copy-btn";
  button.textContent = "Copy";
  button.title = "复制释义";
  button.setAttribute("aria-label", "复制释义");
  return button;
}

function buildDefinitionCopyText(
  data: NonNullable<EnglishDefinitionResponse["data"]>
): string {
  const parts: string[] = [];

  if (data.definition) {
    parts.push(`Definition:\n${data.definition}`);
  }

  if (data.examples && data.examples.length > 0) {
    const examples = data.examples.map((item) => `- ${item}`).join("\n");
    parts.push(`Examples:\n${examples}`);
  }

  if (data.synonyms && data.synonyms.length > 0) {
    parts.push(`Synonyms:\n${data.synonyms.join(", ")}`);
  }

  if (data.usageNotes) {
    parts.push(`Usage:\n${data.usageNotes}`);
  }

  return parts.join("\n\n").trim();
}

async function handleCopyDefinition(
  data: NonNullable<EnglishDefinitionResponse["data"]>,
  button: HTMLButtonElement
): Promise<void> {
  const text = buildDefinitionCopyText(data);
  if (!text) return;

  const success = await copyTextToClipboard(text);
  if (!success) return;

  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }

  button.classList.add("copied");
  button.textContent = "Copied";

  copyFeedbackTimer = window.setTimeout(() => {
    button.classList.remove("copied");
    button.textContent = "Copy";
    copyFeedbackTimer = null;
  }, COPY_FEEDBACK_DURATION);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API 失败时回退到 execCommand 方案
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function renderSentenceAnalysisResult(result: SentenceAnalysisResult): void {
  if (!cardEl) return;

  showCardContainer();
  cardEl.innerHTML = "";

  const speakConfig = getSentenceAnalysisSpeakConfig(result);
  const header = createCardHeader("句法分析", speakConfig);
  cardEl.appendChild(header);

  if (result.translation) {
    cardEl.appendChild(createTextSection("翻译", result.translation));
  }

  const structureSection = document.createElement("section");
  structureSection.className = "lingride-selection-section";
  const structureTitle = document.createElement("h4");
  structureTitle.className = "lingride-selection-section-title";
  structureTitle.textContent = "主干结构";

  const structureContainer = document.createElement("div");
  structureContainer.className = "lingride-selection-structure";

  appendStructureTag(structureContainer, "S", result.structure?.subject || "-");
  appendStructureTag(structureContainer, "V", result.structure?.predicate || "-");

  if (result.structure?.object) {
    appendStructureTag(structureContainer, "O", result.structure.object);
  }

  if (result.structure?.complement) {
    appendStructureTag(structureContainer, "C", result.structure.complement);
  }

  structureSection.append(structureTitle, structureContainer);
  cardEl.appendChild(structureSection);

  if (result.clauses && result.clauses.length > 0) {
    const clausesSection = document.createElement("section");
    clausesSection.className = "lingride-selection-section";

    const clausesTitle = document.createElement("h4");
    clausesTitle.className = "lingride-selection-section-title";
    clausesTitle.textContent = "从句拆解";

    const list = document.createElement("ul");
    list.className = "lingride-selection-list";

    for (const clause of result.clauses) {
      const li = document.createElement("li");
      const line = [clause.type, clause.content, clause.function]
        .filter(Boolean)
        .join(" | ");
      li.textContent = line;
      list.appendChild(li);
    }

    clausesSection.append(clausesTitle, list);
    cardEl.appendChild(clausesSection);
  }

  if (result.keyPhrases && result.keyPhrases.length > 0) {
    const phrasesSection = document.createElement("section");
    phrasesSection.className = "lingride-selection-section";

    const phrasesTitle = document.createElement("h4");
    phrasesTitle.className = "lingride-selection-section-title";
    phrasesTitle.textContent = "重点短语";

    const list = document.createElement("ul");
    list.className = "lingride-selection-list";

    for (const phrase of result.keyPhrases) {
      const li = document.createElement("li");
      li.textContent = `${phrase.phrase}: ${phrase.meaning}`;
      list.appendChild(li);
    }

    phrasesSection.append(phrasesTitle, list);
    cardEl.appendChild(phrasesSection);
  }

  if (result.grammarPoints && result.grammarPoints.length > 0) {
    cardEl.appendChild(createListSection("语法要点", result.grammarPoints));
  }

  if (result.simplifiedVersion) {
    cardEl.appendChild(createTextSection("简化改写", result.simplifiedVersion));
  }
}

function createCardHeader(
  titleText: string,
  speakConfig: CardSpeakConfig | null,
  extraActions: HTMLButtonElement[] = []
): HTMLDivElement {
  const header = document.createElement("div");
  header.className = "lingride-selection-card-header";

  const title = createCardTitle(titleText);
  header.appendChild(title);

  if (!speakConfig && extraActions.length === 0) {
    return header;
  }

  const actions = document.createElement("div");
  actions.className = "lingride-selection-card-actions";

  if (speakConfig?.text) {
    const speakButton = createSpeakButton();
    speakButton.addEventListener("click", () => {
      toggleSpeakText(speakConfig.text, speakConfig.lang, speakButton);
    });
    actions.appendChild(speakButton);
  }

  for (const action of extraActions) {
    actions.appendChild(action);
  }

  header.appendChild(actions);
  return header;
}

function createCardTitle(text: string): HTMLHeadingElement {
  const title = document.createElement("h3");
  title.className = "lingride-selection-card-title";
  title.textContent = text;
  return title;
}

function createSpeakButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "lingride-selection-card-action-btn lingride-selection-speak-btn";
  button.textContent = "发音";
  button.title = "朗读当前内容";
  button.setAttribute("aria-label", "朗读当前内容");
  return button;
}

function createTextSection(title: string, text: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "lingride-selection-section";

  const heading = document.createElement("h4");
  heading.className = "lingride-selection-section-title";
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.className = "lingride-selection-paragraph";
  paragraph.textContent = text;

  section.append(heading, paragraph);
  return section;
}

function createInlineSection(title: string, text: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "lingride-selection-section";

  const heading = document.createElement("h4");
  heading.className = "lingride-selection-section-title";
  heading.textContent = title;

  const inline = document.createElement("p");
  inline.className = "lingride-selection-inline";
  inline.textContent = text;

  section.append(heading, inline);
  return section;
}

function createListSection(title: string, items: string[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "lingride-selection-section";

  const heading = document.createElement("h4");
  heading.className = "lingride-selection-section-title";
  heading.textContent = title;

  const list = document.createElement("ul");
  list.className = "lingride-selection-list";

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }

  section.append(heading, list);
  return section;
}

function appendStructureTag(
  container: HTMLElement,
  label: string,
  value: string
): void {
  const tag = document.createElement("div");
  tag.className = "lingride-selection-structure-tag";

  const tagLabel = document.createElement("span");
  tagLabel.className = "lingride-selection-structure-label";
  tagLabel.textContent = label;

  const tagValue = document.createElement("span");
  tagValue.className = "lingride-selection-structure-value";
  tagValue.textContent = value;

  tag.append(tagLabel, tagValue);
  container.appendChild(tag);
}

function getSentenceAnalysisSpeakConfig(
  result: SentenceAnalysisResult
): CardSpeakConfig | null {
  const simplifiedVersion = result.simplifiedVersion?.trim();
  if (simplifiedVersion) {
    return {
      text: simplifiedVersion,
      lang: "en-US",
    };
  }

  const fallbackText = currentText.trim();
  if (!fallbackText) {
    return null;
  }

  return {
    text: fallbackText,
    lang: "en-US",
  };
}

function toggleSpeakText(
  text: string,
  lang: SpeechLanguage,
  button: HTMLButtonElement
): void {
  const normalizedText = text.trim();
  if (!normalizedText) return;

  if (!canSpeak()) {
    setMessage("当前页面不支持发音", true);
    return;
  }

  const isCurrentButtonActive =
    activeSpeechButton === button && (speechSynthesis.speaking || speechSynthesis.pending);

  if (isCurrentButtonActive) {
    stopSelectionSpeech();
    return;
  }

  startSelectionSpeech(normalizedText, lang, button);
}

function startSelectionSpeech(
  text: string,
  lang: SpeechLanguage,
  button: HTMLButtonElement
): void {
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechRequestId++;
    speechSynthesis.cancel();
  }

  clearSpeakingButton();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = currentTTSSpeed;

  const requestId = ++speechRequestId;
  activeSpeechButton = button;
  setSpeakingButtonState(button, true);

  utterance.onend = () => {
    if (requestId !== speechRequestId) return;
    clearSpeakingButton();
  };

  utterance.onerror = () => {
    if (requestId !== speechRequestId) return;
    clearSpeakingButton();
  };

  speechSynthesis.speak(utterance);
}

function stopSelectionSpeech(): void {
  speechRequestId++;

  if (canSpeak() && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
  }

  clearSpeakingButton();
}

function clearSpeakingButton(): void {
  if (!activeSpeechButton) return;

  setSpeakingButtonState(activeSpeechButton, false);
  activeSpeechButton = null;
}

function setSpeakingButtonState(
  button: HTMLButtonElement,
  speaking: boolean
): void {
  button.classList.toggle("is-speaking", speaking);
  button.setAttribute("aria-pressed", speaking ? "true" : "false");
}

function canSpeak(): boolean {
  return (
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

async function loadSelectionPreferences(): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    })) as GetConfigResponse;

    if (!response.success || !response.data) {
      return;
    }

    applySelectionConfig(response.data);
  } catch (error) {
    console.warn("[Lingride] 加载划词发音配置失败，使用默认值", error);
  }
}

function handleConfigStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== "local") return;

  const configChange = changes[STORAGE_KEY];
  if (!configChange?.newValue) return;

  applySelectionConfig(configChange.newValue as Partial<LingridConfig>);
}

function applySelectionConfig(config: Partial<LingridConfig>): void {
  const nextLevel = config.user_english_level;
  if (nextLevel && CEFR_LEVELS.includes(nextLevel)) {
    cachedUserLevel = nextLevel;
  }

  const nextSpeed = config.tts_speed;
  if (typeof nextSpeed === "number" && isTTSSpeed(nextSpeed)) {
    currentTTSSpeed = nextSpeed;
  } else if (typeof nextSpeed === "string") {
    const parsed = parseFloat(nextSpeed);
    currentTTSSpeed = isTTSSpeed(parsed) ? parsed : DEFAULT_TTS_SPEED;
  }
}

function isToolbarAction(value: string | undefined): value is ToolbarAction {
  return TOOLBAR_ACTIONS.includes(value as ToolbarAction);
}
