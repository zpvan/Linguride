/**
 * @file companion.ts
 * @description 「语伴」页面主入口
 *
 * 职责（DOM 薄层）：
 * - Port 客户端：与 Background 建立长连接，收发流式对话
 * - 对话流程：选话题 → 开场白 → 用户发消息 → 流式渲染 → 朗读/翻译
 * - 结束对话：≥4 条用户消息生成总结卡，保存历史
 * - 话题：预设首屏 + AI 换一批 + 自定义
 *
 * 会话状态全部在 ChatController（纯 TS 已测）；本文件只做渲染与事件。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

// pickPresetTopics 是纯函数模块（无 SW API 依赖），由 vite 直接打包进页面
import { pickPresetTopics } from "../background/companionTopics";
import { createASRRecognizer } from "../shared/asr/createASRRecognizer";
import {
  createHybridTTSPlayer,
  HybridTTSPlayer,
} from "../shared/hybridTTSPlayer";
import { CEFRLevel, DEFAULT_CONFIG, LingridConfig, MessageType } from "../types";
import {
  buildOpeningUserInstruction,
  COMPANION_PORT_NAME,
  CompanionHint,
  CompanionPortEvent,
  CompanionPortRequest,
  CompanionSession,
  SummaryCard,
  TopicCard,
} from "../types/companion";
import {
  EndCompanionSessionResponse,
  EnglishDefinitionResponse,
  EnglishToChineseResponse,
  GenerateCompanionTopicsResponse,
  GetConfigResponse,
  RequestCompanionHintResponse,
} from "../types/messages";
import { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { DEFAULT_TTS_SPEED, TTSSpeed } from "../types/tts";
import { ChatController } from "./chatController";
import {
  addFavorite,
  createCompanionId,
  loadFavorites,
  loadSessions,
  removeFavorite,
  saveSession,
} from "./storage";
import { renderSummaryCard } from "./summaryCard";
import {
  renderFavoritesList,
  renderHistoryList,
  renderTopicCards,
} from "./topicPanel";

// ====== 状态 ======

let userConfig: LingridConfig = DEFAULT_CONFIG;
let currentLevel: CEFRLevel = DEFAULT_CONFIG.user_english_level ?? "A2";
let currentTopic: TopicCard | null = null;
let currentTopics: TopicCard[] = [];
let ttsAutoPlay = true;
let chatEnded = false;
const controller = new ChatController();
let ttsPlayer: HybridTTSPlayer | null = null;

// ====== 语音输入状态 ======

let recognizer: ISpeechRecognizer | null = null;
let isRecording = false;
let recordingTimer: ReturnType<typeof setInterval> | null = null;
let recordingSeconds = 0;

// ====== DOM 引用 ======

const currentTopicEl = document.getElementById("currentTopic") as HTMLSpanElement;
const levelSelect = document.getElementById("levelSelect") as HTMLSelectElement;
const ttsToggleBtn = document.getElementById("ttsToggleBtn") as HTMLButtonElement;
const endChatBtn = document.getElementById("endChatBtn") as HTMLButtonElement;
const topicsListEl = document.getElementById("topicsList") as HTMLElement;
const refreshTopicsBtn = document.getElementById("refreshTopicsBtn") as HTMLButtonElement;
const customTopicInput = document.getElementById("customTopicInput") as HTMLInputElement;
const customTopicBtn = document.getElementById("customTopicBtn") as HTMLButtonElement;
const clearMemoryBtn = document.getElementById("clearMemoryBtn") as HTMLButtonElement;
const messagesEl = document.getElementById("messagesEl") as HTMLElement;
const emptyState = document.getElementById("emptyState") as HTMLElement;
const statusEl = document.getElementById("statusEl") as HTMLElement;
const inputEl = document.getElementById("inputEl") as HTMLInputElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const hintBtn = document.getElementById("hintBtn") as HTMLButtonElement;
const micBtn = document.getElementById("micBtn") as HTMLButtonElement;
const hintCard = document.getElementById("hintCard") as HTMLElement;
const hintList = document.getElementById("hintList") as HTMLElement;
const hintCloseBtn = document.getElementById("hintCloseBtn") as HTMLButtonElement;
const recordingStatus = document.getElementById("recordingStatus") as HTMLElement;
const recordingTime = document.getElementById("recordingTime") as HTMLElement;
const recognitionPreview = document.getElementById("recognitionPreview") as HTMLElement;
const recognitionText = document.getElementById("recognitionText") as HTMLElement;
const historyPanel = document.getElementById("historyPanel") as HTMLElement;
const favoritesPanel = document.getElementById("favoritesPanel") as HTMLElement;
const historyList = document.getElementById("historyList") as HTMLElement;
const favoritesList = document.getElementById("favoritesList") as HTMLElement;
const wordPopup = document.getElementById("wordPopup") as HTMLElement;

// ====== 状态提示 ======

function setStatus(message: string, kind?: "info"): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("info", kind === "info");
}
function hideStatus(): void {
  statusEl.textContent = "";
}

// ====== Port 客户端 ======

interface PendingRequest {
  onDelta: (delta: string) => void;
  resolve: (fullText: string) => void;
  reject: (error: Error) => void;
}

let port: chrome.runtime.Port | null = null;
const pendingRequests = new Map<string, PendingRequest>();

function ensurePort(): chrome.runtime.Port {
  if (port) return port;
  const newPort = chrome.runtime.connect({ name: COMPANION_PORT_NAME });

  newPort.onMessage.addListener((event: CompanionPortEvent) => {
    const pending = pendingRequests.get(event.requestId);
    if (!pending) return;
    switch (event.type) {
      case "STREAM_CHUNK":
        pending.onDelta(event.delta);
        break;
      case "STREAM_DONE":
        pendingRequests.delete(event.requestId);
        pending.resolve(event.fullText);
        break;
      case "STREAM_ERROR":
        pendingRequests.delete(event.requestId);
        pending.reject(new Error(event.message));
        break;
    }
  });

  newPort.onDisconnect.addListener(() => {
    port = null;
    // SW 重启：历史在页面侧不丢，仅进行中的请求失败，可重试
    const error = new Error("与后台的连接中断，请点击重试");
    for (const pending of pendingRequests.values()) pending.reject(error);
    pendingRequests.clear();
  });

  port = newPort;
  return port;
}

function sendChatTurn(
  history: ReturnType<ChatController["getWindowedHistory"]>,
  topic: TopicCard,
  level: CEFRLevel,
  onDelta: (delta: string) => void
): Promise<string> {
  const requestId = createCompanionId("turn");
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { onDelta, resolve, reject });
    const request: CompanionPortRequest = {
      type: "CHAT_TURN",
      requestId,
      history,
      topic,
      level,
    };
    try {
      ensurePort().postMessage(request);
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

// ====== TTS 播放 ======

function currentTTSSpeed(): TTSSpeed {
  return userConfig.tts_speed ?? DEFAULT_TTS_SPEED;
}

function playText(text: string): void {
  if (!ttsPlayer) return;
  void ttsPlayer.playText({
    text,
    rate: currentTTSSpeed(),
    lang: "en-US",
    onAIError: (message) => setStatus(message),
  });
}

// ====== 消息渲染 ======

function scrollToBottom(): void {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function hideEmptyState(): void {
  emptyState.style.display = "none";
}

function appendUserBubble(text: string): void {
  const row = document.createElement("div");
  row.className = "message-row user";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

/** 把英文文本分词渲染：单词包 span.chat-word（供 Task 16 点查复用） */
function renderTextWithWordSpans(container: HTMLElement, text: string): void {
  const parts = text.split(/([A-Za-z]+(?:[-'][A-Za-z]+)*)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(part)) {
      const span = document.createElement("span");
      span.className = "chat-word";
      span.textContent = part;
      container.appendChild(span);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

interface AssistantBubbleHandle {
  setText(text: string): void;
  finalize(text: string): void;
  markError(message: string, onRetry: () => void): void;
}

function appendAssistantBubble(): AssistantBubbleHandle {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "😊";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const textEl = document.createElement("span");
  textEl.className = "typing-indicator";
  textEl.textContent = "Echo 正在输入…";
  bubble.appendChild(textEl);
  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();

  let firstChunk = true;
  return {
    setText(text: string) {
      if (firstChunk) {
        textEl.textContent = "";
        textEl.classList.remove("typing-indicator");
        firstChunk = false;
      }
      // 流式期间纯文本渲染（完成后才分词包装，避免重复拆 DOM）
      textEl.textContent = text;
      scrollToBottom();
    },
    finalize(text: string) {
      textEl.remove();
      renderTextWithWordSpans(bubble, text);

      const actions = document.createElement("div");
      actions.className = "message-actions";
      const replay = document.createElement("button");
      replay.className = "link-btn";
      replay.textContent = "🔊 朗读";
      replay.addEventListener("click", () => playText(text));
      const translate = document.createElement("button");
      translate.className = "link-btn";
      translate.textContent = "译";
      translate.addEventListener("click", () => {
        void toggleTranslation(bubble, text, translate);
      });
      actions.appendChild(replay);
      actions.appendChild(translate);
      bubble.appendChild(actions);
      scrollToBottom();
    },
    markError(message: string, onRetry: () => void) {
      textEl.remove();
      const note = document.createElement("div");
      note.className = "message-error-note";
      note.textContent = `回复中断：${message} `;
      const retry = document.createElement("button");
      retry.className = "link-btn";
      retry.textContent = "重试";
      retry.addEventListener("click", onRetry);
      note.appendChild(retry);
      bubble.appendChild(note);
      scrollToBottom();
    },
  };
}

/** 折叠式中文翻译（再次点击收起） */
async function toggleTranslation(
  bubble: HTMLElement,
  text: string,
  btn: HTMLButtonElement
): Promise<void> {
  const existing = bubble.querySelector(".message-translation");
  if (existing) {
    existing.remove();
    return;
  }
  btn.disabled = true;
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MessageType.ENGLISH_TO_CHINESE,
      payload: { text },
    })) as EnglishToChineseResponse;
    if (response.success && response.data) {
      const zh = document.createElement("div");
      zh.className = "message-translation";
      zh.textContent = response.data.translation;
      bubble.insertBefore(zh, bubble.querySelector(".message-actions"));
      scrollToBottom();
    } else {
      setStatus(response.error || "翻译失败，请重试");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "翻译失败，请重试");
  } finally {
    btn.disabled = false;
  }
}

// ====== 语音输入 ======

function updateMicButton(): void {
  micBtn.classList.toggle("recording", isRecording);
  const iconMic = micBtn.querySelector(".icon-mic") as SVGElement;
  const iconStop = micBtn.querySelector(".icon-stop") as SVGElement;
  iconMic.style.display = isRecording ? "none" : "";
  iconStop.style.display = isRecording ? "" : "none";
}

function formatRecordingTime(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

async function startRecording(): Promise<void> {
  if (isRecording || controller.isStreaming() || chatEnded) return;
  ttsPlayer?.stop();
  try {
    recognizer = createASRRecognizer(userConfig);
    recognizer.onInterimResult = (text) => {
      recognitionPreview.style.display = "";
      recognitionText.textContent = text;
    };
    recognizer.onError = (error) => setStatus(error.message);
    await recognizer.start();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "录音启动失败");
    recognizer = null;
    return;
  }

  isRecording = true;
  recordingSeconds = 0;
  recordingTime.textContent = "00:00";
  recordingStatus.style.display = "";
  recognitionPreview.style.display = "none";
  updateMicButton();
  recordingTimer = setInterval(() => {
    recordingSeconds += 1;
    recordingTime.textContent = formatRecordingTime(recordingSeconds);
  }, 1000);
}

async function stopRecording(): Promise<void> {
  if (!isRecording || !recognizer) return;
  isRecording = false;
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  recordingStatus.style.display = "none";
  recognitionPreview.style.display = "none";
  updateMicButton();

  setStatus("识别中…", "info");
  try {
    // 契约：不抛异常——出错走 onError 并返回空串
    const text = await recognizer.stop();
    hideStatus();
    if (text.trim()) {
      sendUserText(text);
    } else {
      setStatus("没听清，点 🎤 再说一次？");
    }
  } finally {
    recognizer = null;
  }
}

// ====== 帮我说一句 ======

async function requestHint(): Promise<void> {
  if (!currentTopic || controller.isStreaming() || chatEnded) return;
  hintBtn.disabled = true;
  setStatus("Echo 正在帮你想…", "info");
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MessageType.REQUEST_COMPANION_HINT,
      payload: {
        history: controller.getWindowedHistory(),
        topic: currentTopic,
        level: currentLevel,
      },
    })) as RequestCompanionHintResponse;
    hideStatus();
    if (response.success && response.data) {
      renderHintCard(response.data.hints);
    } else {
      setStatus(response.error || "提示生成失败，请重试");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "提示生成失败，请重试");
  } finally {
    hintBtn.disabled = false;
  }
}

function renderHintCard(hints: CompanionHint[]): void {
  hintList.innerHTML = "";
  for (const hint of hints) {
    const row = document.createElement("div");
    row.className = "hint-item";

    const body = document.createElement("div");
    body.className = "hint-item-body";
    const en = document.createElement("div");
    en.className = "hint-item-en";
    en.textContent = hint.en;
    const zh = document.createElement("div");
    zh.className = "hint-item-zh";
    zh.textContent = hint.zh;
    body.appendChild(en);
    body.appendChild(zh);

    const speak = document.createElement("button");
    speak.className = "link-btn";
    speak.textContent = "🔊";
    speak.title = "朗读示例";
    speak.addEventListener("click", () => playText(hint.en));
    const use = document.createElement("button");
    use.className = "link-btn";
    use.textContent = "使用";
    use.title = "填入输入框";
    use.addEventListener("click", () => {
      inputEl.value = hint.en;
      hintCard.style.display = "none";
      inputEl.focus();
    });

    row.appendChild(body);
    row.appendChild(speak);
    row.appendChild(use);
    hintList.appendChild(row);
  }
  hintCard.style.display = "";
}

// ====== 对话流程 ======

function setInputEnabled(enabled: boolean): void {
  const canChat = enabled && Boolean(currentTopic) && !chatEnded;
  inputEl.disabled = !canChat;
  sendBtn.disabled = !canChat;
  micBtn.disabled = !canChat;
  hintBtn.disabled = !canChat;
}

/** 发起一轮助手回复（流式）；失败时在气泡内标记可重试 */
async function runAssistantTurn(): Promise<void> {
  if (!currentTopic) return;
  controller.beginAssistantTurn();
  const bubble = appendAssistantBubble();
  setInputEnabled(false);

  try {
    const full = await sendChatTurn(
      controller.getWindowedHistory(),
      currentTopic,
      currentLevel,
      (delta) => {
        controller.appendAssistantDelta(delta);
        bubble.setText(controller.getPendingText());
      }
    );
    controller.completeAssistantTurn();
    bubble.finalize(full);
    if (ttsAutoPlay) playText(full);
  } catch (error) {
    controller.failAssistantTurn();
    bubble.markError(
      error instanceof Error ? error.message : String(error),
      () => {
        // 重试：历史未变（用户轮次仍在），直接重发同一轮
        void runAssistantTurn();
      }
    );
  } finally {
    setInputEnabled(true);
    inputEl.focus();
  }
}

function sendUserText(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !currentTopic || controller.isStreaming() || chatEnded) return;
  hideStatus();
  hintCard.style.display = "none";
  controller.addUserTurn(trimmed);
  appendUserBubble(trimmed);
  void runAssistantTurn();
}

/** 选择话题开始新对话（开场白 = 隐藏指令轮 + 流式回复） */
async function pickTopic(topic: TopicCard): Promise<void> {
  if (controller.isStreaming()) return;
  ttsPlayer?.stop();
  if (isRecording) void stopRecording();
  currentTopic = topic;
  chatEnded = false;
  controller.reset();
  messagesEl.innerHTML = "";
  hideEmptyState();
  hideStatus();
  currentTopicEl.textContent = `话题：${topic.titleZh} · ${topic.titleEn}`;
  endChatBtn.disabled = false;
  refreshTopicCardsActive(topic.id);

  controller.addUserTurn(buildOpeningUserInstruction(topic), { hidden: true });
  await runAssistantTurn();
}

function resetToTopicSelection(): void {
  ttsPlayer?.stop();
  currentTopic = null;
  chatEnded = false;
  controller.reset();
  messagesEl.innerHTML = "";
  messagesEl.appendChild(emptyState);
  emptyState.style.display = "";
  currentTopicEl.textContent = "选择一个话题开始聊天";
  endChatBtn.disabled = true;
  setInputEnabled(false);
  refreshTopicCardsActive("");
  hideStatus();
}

/** 结束对话：达标生成总结卡，保存历史 */
async function endChat(): Promise<void> {
  if (!currentTopic || controller.isStreaming()) return;
  const topic = currentTopic;

  if (controller.getUserTurnCount() === 0) {
    // 用户还没说过话（只有隐藏的开场指令）
    if (!confirm("还没开始聊呢，确定结束吗？")) return;
    resetToTopicSelection();
    return;
  }

  let summary: SummaryCard | undefined;
  if (controller.canSummarize()) {
    setStatus("Echo 正在回顾你们的聊天…", "info");
    setInputEnabled(false);
    endChatBtn.disabled = true;
    try {
      const response = (await chrome.runtime.sendMessage({
        type: MessageType.END_COMPANION_SESSION,
        payload: {
          history: controller.getTurns(),
          topic,
          level: currentLevel,
        },
      })) as EndCompanionSessionResponse;
      if (response.success && response.data) {
        summary = response.data.summary;
        renderSummaryCard(messagesEl, summary, topic.titleZh, {
          onSaveFavorite: (item) => {
            void addFavorite(item).then(() => {
              setStatus("已收藏，可在左侧「收藏」页查看", "info");
            });
          },
          onPlayText: playText,
          onNewChat: resetToTopicSelection,
        });
        hideStatus();
      } else {
        setStatus(response.error || "总结生成失败，但对话已保存");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "总结生成失败，但对话已保存");
    }
  } else if (!confirm("对话较短，本次不生成总结卡，确定结束吗？")) {
    return;
  }

  await saveSession({
    id: createCompanionId("session"),
    topic,
    level: currentLevel,
    // 存储只保留可见轮次；ts 统一取结束时间（轮次级时间戳 MVP 不需要）
    messages: controller
      .getVisibleTurns()
      .map((t) => ({ role: t.role, content: t.content, ts: Date.now() })),
    summary,
    endedAt: Date.now(),
  });
  void refreshHistory();

  chatEnded = true;
  setInputEnabled(false);
  endChatBtn.disabled = true;
  setStatus("对话已结束。挑个新话题，再聊一场吧！", "info");
  scrollToBottom();
}

// ====== 话题 ======

function refreshTopicCardsActive(activeId: string): void {
  topicsListEl.querySelectorAll(".topic-card").forEach((el) => {
    (el as HTMLElement).classList.toggle(
      "active",
      (el as HTMLElement).dataset.topicId === activeId
    );
  });
}

function renderTopics(): void {
  renderTopicCards(topicsListEl, currentTopics, {
    onPick: (topic) => void pickTopic(topic),
    activeId: currentTopic?.id ?? null,
  });
}

async function refreshTopics(): Promise<void> {
  refreshTopicsBtn.disabled = true;
  topicsListEl.innerHTML = '<div class="topics-loading">Echo 正在想话题…</div>';
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MessageType.GENERATE_COMPANION_TOPICS,
      payload: {
        level: currentLevel,
        exclude: currentTopics.map((t) => t.titleEn),
      },
    })) as GenerateCompanionTopicsResponse;
    if (response.success && response.data) {
      currentTopics = response.data.topics;
      if (response.data.fromPreset) {
        setStatus("AI 暂时不可用，已为你换了一批推荐话题");
      }
    } else {
      setStatus(response.error || "换一批失败，请重试");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "换一批失败，请重试");
  }
  renderTopics();
  refreshTopicsBtn.disabled = false;
}

function pickCustomTopic(): void {
  const value = customTopicInput.value.trim();
  if (!value || controller.isStreaming()) return;
  customTopicInput.value = "";
  void pickTopic({
    id: createCompanionId("custom"),
    titleZh: value,
    titleEn: value,
    openerEn: "",
  });
}

// ====== 事件绑定 ======

function bindEvents(): void {
  sendBtn.addEventListener("click", () => {
    sendUserText(inputEl.value);
    inputEl.value = "";
  });
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendUserText(inputEl.value);
      inputEl.value = "";
    }
  });
  endChatBtn.addEventListener("click", () => void endChat());
  refreshTopicsBtn.addEventListener("click", () => void refreshTopics());
  customTopicBtn.addEventListener("click", pickCustomTopic);
  customTopicInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") pickCustomTopic();
  });

  ttsToggleBtn.addEventListener("click", () => {
    ttsAutoPlay = !ttsAutoPlay;
    ttsToggleBtn.textContent = ttsAutoPlay ? "🔊" : "🔇";
    ttsToggleBtn.classList.toggle("muted", !ttsAutoPlay);
    if (!ttsAutoPlay) ttsPlayer?.stop();
  });

  levelSelect.addEventListener("change", () => {
    currentLevel = levelSelect.value as CEFRLevel;
    userConfig = { ...userConfig, user_english_level: currentLevel };
    void chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: userConfig,
    });
    setStatus(`已切换到 ${currentLevel}，Echo 会调整说话难度`, "info");
  });

  micBtn.addEventListener("click", () => {
    if (isRecording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  });
  hintBtn.addEventListener("click", () => void requestHint());
  hintCloseBtn.addEventListener("click", () => {
    hintCard.style.display = "none";
  });

  // Esc：停止录音 / 停止朗读（与划词朗读的全局习惯一致）
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (isRecording) void stopRecording();
    ttsPlayer?.stop();
  });

  bindClearMemory();

  // 历史 / 收藏 Tab 切换
  document.querySelectorAll(".panel-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".panel-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const panel = (tab as HTMLElement).dataset.panel;
      historyPanel.style.display = panel === "history" ? "" : "none";
      favoritesPanel.style.display = panel === "favorites" ? "" : "none";
      if (panel === "history") void refreshHistory();
      else void refreshFavorites();
    });
  });

  // 生词点查（事件委托）
  messagesEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("chat-word")) return;
    event.stopPropagation();
    void showWordPopup(target.textContent ?? "", target.getBoundingClientRect());
  });
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (
      wordPopup.style.display !== "none" &&
      !wordPopup.contains(target) &&
      !target.classList.contains("chat-word")
    ) {
      wordPopup.style.display = "none";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") wordPopup.style.display = "none";
  });

  window.addEventListener("beforeunload", () => ttsPlayer?.stop());
}

// ====== 历史 / 收藏面板 ======

async function refreshHistory(): Promise<void> {
  const sessions = await loadSessions();
  renderHistoryList(historyList, sessions, {
    onOpen: (session) => openHistorySession(session),
  });
}

async function refreshFavorites(): Promise<void> {
  const favorites = await loadFavorites();
  renderFavoritesList(favoritesList, favorites, {
    onPlay: playText,
    onRemove: (id) => {
      void removeFavorite(id).then(() => void refreshFavorites());
    },
  });
}

/** 历史只读回看（进行中对话需先结束，避免丢上下文） */
function openHistorySession(session: CompanionSession): void {
  if (controller.isStreaming()) return;
  if (currentTopic && !chatEnded) {
    setStatus("先结束当前对话，再来回看历史");
    return;
  }
  ttsPlayer?.stop();
  messagesEl.innerHTML = "";
  hideEmptyState();
  currentTopicEl.textContent = `历史回看：${session.topic.titleZh}（只读）`;
  setInputEnabled(false);
  endChatBtn.disabled = true;

  const backBar = document.createElement("div");
  backBar.className = "summary-new-chat";
  const back = document.createElement("button");
  back.className = "link-btn";
  back.textContent = "← 返回话题选择";
  back.addEventListener("click", resetToTopicSelection);
  backBar.appendChild(back);
  messagesEl.appendChild(backBar);

  for (const turn of session.messages) {
    if (turn.role === "user") {
      appendUserBubble(turn.content);
    } else {
      const bubble = appendAssistantBubble();
      bubble.finalize(turn.content);
    }
  }

  if (session.summary) {
    renderSummaryCard(messagesEl, session.summary, session.topic.titleZh, {
      onSaveFavorite: (item) => {
        void addFavorite(item).then(() => {
          setStatus("已收藏", "info");
          void refreshFavorites();
        });
      },
      onPlayText: playText,
      onNewChat: resetToTopicSelection,
    });
  }
  scrollToBottom();
}

// ====== 生词点查 ======

async function showWordPopup(word: string, rect: DOMRect): Promise<void> {
  wordPopup.textContent = "查询中…";
  wordPopup.className = "word-popup word-popup-loading";
  wordPopup.style.display = "";
  wordPopup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 300))}px`;
  wordPopup.style.top = `${rect.bottom + 6}px`;

  try {
    const response = (await chrome.runtime.sendMessage({
      type: MessageType.ENGLISH_DEFINITION,
      payload: { text: word, userLevel: currentLevel },
    })) as EnglishDefinitionResponse;

    wordPopup.className = "word-popup";
    wordPopup.innerHTML = "";
    if (!response.success || !response.data) {
      wordPopup.textContent = response.error || "查询失败，请重试";
      return;
    }

    const data = response.data;
    const title = document.createElement("div");
    title.className = "word-popup-title";
    title.textContent = word;
    const playBtn = document.createElement("button");
    playBtn.className = "link-btn";
    playBtn.textContent = "🔊";
    playBtn.addEventListener("click", () => playText(word));
    title.appendChild(playBtn);
    wordPopup.appendChild(title);

    const appendSection = (label: string, content: string): void => {
      if (!content.trim()) return;
      const section = document.createElement("div");
      section.className = "word-popup-section";
      const labelEl = document.createElement("span");
      labelEl.className = "word-popup-label";
      labelEl.textContent = `${label}：`;
      section.appendChild(labelEl);
      section.appendChild(document.createTextNode(content));
      wordPopup.appendChild(section);
    };
    appendSection("释义", data.definition);
    appendSection("例句", data.examples[0] ?? "");
    appendSection("用法", data.usageNotes);
  } catch (error) {
    wordPopup.textContent =
      error instanceof Error ? error.message : "查询失败，请重试";
  }
}

// ====== 清除语伴记忆 ======

function bindClearMemory(): void {
  clearMemoryBtn.addEventListener("click", () => {
    if (!confirm("清除后 Echo 将不再记得你之前聊过的内容，确定吗？")) return;
    void chrome.runtime
      .sendMessage({ type: MessageType.CLEAR_COMPANION_MEMORY })
      .then(() => setStatus("语伴记忆已清除", "info"));
  });
}

// ====== 初始化 ======

async function init(): Promise<void> {
  bindEvents();

  const response = (await chrome.runtime.sendMessage({
    type: MessageType.GET_CONFIG,
  })) as GetConfigResponse;
  if (response.success && response.data) {
    userConfig = response.data;
    currentLevel = userConfig.user_english_level ?? "A2";
    levelSelect.value = currentLevel;
  }

  ttsPlayer = createHybridTTSPlayer({
    isAIEnabled: () => {
      const selection = userConfig?.tts_selection;
      if (selection === "browser") return false;
      if (selection === "minimax" || selection === "xiaomi") return true;
      return Boolean(
        userConfig?.minimax_tts?.api_key?.trim() ||
          userConfig?.xiaomi_tts?.api_key?.trim()
      );
    },
  });

  // 首屏：预设话题零延迟
  currentTopics = pickPresetTopics([], 5);
  renderTopics();
  void refreshHistory();
  void refreshFavorites();
}

void init();
