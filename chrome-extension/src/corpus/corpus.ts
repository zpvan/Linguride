/**
 * @file corpus.ts
 * @description 语料库听力训练页面逻辑
 *
 * 功能流程：
 * 1. 用户粘贴英文语料 → AI 基于用户水平（i+1 理论）智能断句
 * 2. 系统朗读句子 → 用户输入听到的内容
 * 3. AI 分析用户答案 → 识别听力盲区并给出针对性建议
 *
 * 优雅降级策略：
 * - 语料过短：提示但允许继续
 * - AI 断句失败：按标点简单分割
 * - TTS 不可用：隐藏播放按钮，显示原文
 * - AI 分析失败：显示简单对比结果
 * - 网络中断：显示错误提示
 *
 * @author Lingride Team
 * @since 2.4.0
 */

import {
  AnalyzeListeningResponse,
  CEFRLevel,
  CorpusSentence,
  DEFAULT_TTS_SPEED,
  GetConfigResponse,
  isTTSSpeed,
  LingridConfig,
  ListeningAnalysisResult,
  ListeningError,
  MessageType,
  SegmentCorpusResponse,
  SegmentCorpusResult,
  STORAGE_KEY,
  TTSSpeed,
} from "../types";
import { createHybridTTSPlayer } from "../shared/hybridTTSPlayer";

// ====== 类型定义 ======

/** 语料库会话状态 */
interface CorpusState {
  /** 分割后的句子列表 */
  sentences: CorpusSentence[];
  /** 当前练习的句子索引 */
  currentIndex: number;
  /** 每句的分析结果 */
  results: (ListeningAnalysisResult | null)[];
  /** 文本整体难度评估 */
  overallLevel: string;
  /** 每句播放次数 */
  playCounts: number[];
}

/** 错误类型中文映射 */
const ERROR_TYPE_LABELS: Record<string, string> = {
  liaison: "连读识别",
  weakForm: "弱读理解",
  similarSound: "相似音混淆",
  stress: "重音位置",
  intonation: "语调理解",
  vocabulary: "词汇盲区",
  speed: "语速适应",
};
const TTS_FALLBACK_WARNING_MESSAGE =
  "小米语音合成暂不可用，已切换为浏览器朗读";
const TTS_PLAYBACK_ERROR_MESSAGE =
  "朗读失败，请检查语音合成配置或浏览器语音能力";

// ====== DOM 元素引用 ======

// Header
const levelBadge = document.getElementById("levelBadge") as HTMLButtonElement;
const levelDropdown = document.getElementById("levelDropdown") as HTMLElement;
const levelBadgeWrapper = document.getElementById("levelBadgeWrapper") as HTMLElement;

// Input Section
const inputSection = document.getElementById("inputSection") as HTMLElement;
const corpusInput = document.getElementById("corpusInput") as HTMLTextAreaElement;
const corpusWordCount = document.getElementById("corpusWordCount") as HTMLElement;
const startPracticeBtn = document.getElementById("startPracticeBtn") as HTMLButtonElement;
const inputStatus = document.getElementById("inputStatus") as HTMLElement;

// Practice Section
const practiceSection = document.getElementById("practiceSection") as HTMLElement;
const progressFill = document.getElementById("progressFill") as HTMLElement;
const progressText = document.getElementById("progressText") as HTMLElement;
const overallAccuracy = document.getElementById("overallAccuracy") as HTMLElement;
const currentSentenceNum = document.getElementById("currentSentenceNum") as HTMLElement;
const toggleOriginalBtn = document.getElementById("toggleOriginalBtn") as HTMLButtonElement;
const originalTextArea = document.getElementById("originalTextArea") as HTMLElement;
const originalText = document.getElementById("originalText") as HTMLElement;
const listeningTips = document.getElementById("listeningTips") as HTMLElement;
const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
const replayBtn = document.getElementById("replayBtn") as HTMLButtonElement;
const speedSelect = document.getElementById("speedSelect") as HTMLSelectElement;
const playCount = document.getElementById("playCount") as HTMLElement;
const dictationInput = document.getElementById("dictationInput") as HTMLTextAreaElement;
const submitAnswerBtn = document.getElementById("submitAnswerBtn") as HTMLButtonElement;
const skipBtn = document.getElementById("skipBtn") as HTMLButtonElement;
const practiceStatus = document.getElementById("practiceStatus") as HTMLElement;

// Result Section
const resultSection = document.getElementById("resultSection") as HTMLElement;
const sentenceAccuracy = document.getElementById("sentenceAccuracy") as HTMLElement;
const comparisonOriginal = document.getElementById("comparisonOriginal") as HTMLElement;
const comparisonUser = document.getElementById("comparisonUser") as HTMLElement;
const errorsSection = document.getElementById("errorsSection") as HTMLElement;
const errorsList = document.getElementById("errorsList") as HTMLElement;
const suggestionsSection = document.getElementById("suggestionsSection") as HTMLElement;
const suggestionsList = document.getElementById("suggestionsList") as HTMLElement;
const encouragementText = document.getElementById("encouragementText") as HTMLElement;
const retryBtn = document.getElementById("retryBtn") as HTMLButtonElement;
const nextSentenceBtn = document.getElementById("nextSentenceBtn") as HTMLButtonElement;

// Complete Section
const completeSection = document.getElementById("completeSection") as HTMLElement;
const totalSentences = document.getElementById("totalSentences") as HTMLElement;
const avgAccuracy = document.getElementById("avgAccuracy") as HTMLElement;
const blindSpotsSection = document.getElementById("blindSpotsSection") as HTMLElement;
const blindSpotsList = document.getElementById("blindSpotsList") as HTMLElement;
const practiceAdviceSection = document.getElementById("practiceAdviceSection") as HTMLElement;
const practiceAdviceList = document.getElementById("practiceAdviceList") as HTMLElement;
const newPracticeBtn = document.getElementById("newPracticeBtn") as HTMLButtonElement;

// ====== 状态 ======

let userLevel: CEFRLevel = "A2";
let state: CorpusState | null = null;
let isTTSAvailable = true;
let currentTTSSpeed: TTSSpeed = DEFAULT_TTS_SPEED;
let xiaomiTTSEnabled = false;
const corpusTTSPlayer = createHybridTTSPlayer({
  isAIEnabled: () => xiaomiTTSEnabled,
});

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Corpus] 页面已加载");

  // 检测 TTS 可用性
  checkTTSAvailability();

  // 加载用户配置
  await loadUserConfig();

  // 绑定事件
  bindEvents();
});

/**
 * 检测 TTS 可用性
 */
function checkTTSAvailability(): void {
  updateTTSAvailability();

  if (!isTTSAvailable) {
    console.warn("[Corpus] TTS 不可用");
  }
}

function applyXiaomiTTSConfig(config: Partial<LingridConfig>): void {
  xiaomiTTSEnabled = !!config.xiaomi_tts?.api_key?.trim();
  updateTTSAvailability();
}

function updateTTSAvailability(): void {
  isTTSAvailable = xiaomiTTSEnabled || "speechSynthesis" in window;
}

/**
 * 加载用户配置
 */
async function loadUserConfig(): Promise<void> {
  try {
    const response: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });

    if (response.success && response.data) {
      if (response.data.user_english_level) {
        userLevel = response.data.user_english_level;
        updateLevelBadge(userLevel);
      }

      applyXiaomiTTSConfig(response.data);
      applyTTSSpeed(resolveTTSSpeed(response.data.tts_speed));
    }
  } catch (error) {
    console.error("[Corpus] 加载配置失败:", error);
  }
}

function resolveTTSSpeed(value: unknown): TTSSpeed {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : Number.NaN;

  return isTTSSpeed(parsed) ? parsed : DEFAULT_TTS_SPEED;
}

function applyTTSSpeed(speed: TTSSpeed): void {
  currentTTSSpeed = speed;
  speedSelect.value = String(speed);
}

async function saveTTSSpeed(speed: TTSSpeed): Promise<void> {
  applyTTSSpeed(speed);

  try {
    const configResponse: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });

    if (configResponse.success && configResponse.data) {
      await chrome.runtime.sendMessage({
        type: MessageType.SAVE_CONFIG,
        payload: {
          ...configResponse.data,
          tts_speed: speed,
        },
      });
    }
  } catch (error) {
    console.error("[Corpus] 保存 TTS 语速失败:", error);
  }
}

function handleTTSSpeedStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== "local") return;

  const configChange = changes[STORAGE_KEY];
  if (!configChange?.newValue) return;

  const nextSpeed = resolveTTSSpeed(
    (configChange.newValue as Partial<LingridConfig>).tts_speed
  );
  applyTTSSpeed(nextSpeed);
  applyXiaomiTTSConfig(configChange.newValue as Partial<LingridConfig>);
}

function handleTTSSpeedMessage(message: {
  type?: MessageType;
  payload?: { speed?: TTSSpeed };
}): void {
  if (message.type !== MessageType.TTS_SPEED_CHANGED) return;
  applyTTSSpeed(resolveTTSSpeed(message.payload?.speed));
}

// ====== 事件绑定 ======

function bindEvents(): void {
  // 水平选择器
  levelBadge.addEventListener("click", toggleLevelDropdown);
  levelDropdown.addEventListener("click", handleLevelOptionClick);
  document.addEventListener("click", handleOutsideClick);

  // 语料输入
  corpusInput.addEventListener("input", handleCorpusInput);
  startPracticeBtn.addEventListener("click", handleStartPractice);

  // 练习控制
  toggleOriginalBtn.addEventListener("click", toggleOriginalText);
  playBtn.addEventListener("click", handlePlaySentence);
  replayBtn.addEventListener("click", handleReplaySentence);
  speedSelect.addEventListener("change", handleSpeedChange);
  dictationInput.addEventListener("input", handleDictationInput);
  submitAnswerBtn.addEventListener("click", handleSubmitAnswer);
  skipBtn.addEventListener("click", handleSkipSentence);

  // 结果操作
  retryBtn.addEventListener("click", handleRetry);
  nextSentenceBtn.addEventListener("click", handleNextSentence);

  // 完成操作
  newPracticeBtn.addEventListener("click", handleNewPractice);

  // 全局 TTS 语速同步
  chrome.storage.onChanged.addListener(handleTTSSpeedStorageChange);
  chrome.runtime.onMessage.addListener(handleTTSSpeedMessage);

  window.addEventListener("beforeunload", () => {
    corpusTTSPlayer.stop();
  });
}

// ====== 水平选择器 ======

function toggleLevelDropdown(e: Event): void {
  e.stopPropagation();
  const isOpen = levelDropdown.classList.contains("open");
  if (isOpen) {
    closeLevelDropdown();
  } else {
    openLevelDropdown();
  }
}

function openLevelDropdown(): void {
  levelDropdown.classList.add("open");
  levelBadge.classList.add("open");
}

function closeLevelDropdown(): void {
  levelDropdown.classList.remove("open");
  levelBadge.classList.remove("open");
}

function handleOutsideClick(e: Event): void {
  if (!levelBadgeWrapper.contains(e.target as Node)) {
    closeLevelDropdown();
  }
}

function handleLevelOptionClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(".level-option") as HTMLElement;
  if (!target) return;

  const level = target.dataset.level as CEFRLevel;
  if (!level) return;

  userLevel = level;
  updateLevelBadge(level);
  closeLevelDropdown();

  // 保存配置
  saveUserLevel(level);
}

function updateLevelBadge(level: CEFRLevel): void {
  levelBadge.textContent = `Lv.${level}`;

  levelDropdown.querySelectorAll(".level-option").forEach((option) => {
    const optionLevel = (option as HTMLElement).dataset.level;
    option.classList.toggle("active", optionLevel === level);
  });
}

async function saveUserLevel(level: CEFRLevel): Promise<void> {
  try {
    const configResponse: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });

    if (configResponse.success && configResponse.data) {
      await chrome.runtime.sendMessage({
        type: MessageType.SAVE_CONFIG,
        payload: {
          ...configResponse.data,
          user_english_level: level,
        },
      });
    }
  } catch (error) {
    console.error("[Corpus] 保存水平失败:", error);
  }
}

// ====== 语料输入 ======

function handleCorpusInput(): void {
  const text = corpusInput.value.trim();
  const wordCount = countWords(text);

  corpusWordCount.textContent = `${wordCount} 词`;
  startPracticeBtn.disabled = wordCount < 3;

  // 语料过短提示
  if (wordCount > 0 && wordCount < 10) {
    showStatus(inputStatus, "语料较短，建议至少 50 词以获得更好的练习效果", "warning");
  } else {
    hideStatus(inputStatus);
  }
}

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .length;
}

// ====== 开始练习 ======

async function handleStartPractice(): Promise<void> {
  const text = corpusInput.value.trim();
  if (!text) return;

  startPracticeBtn.disabled = true;
  showStatus(inputStatus, "正在分析语料，请稍候...", "loading");

  try {
    // 调用 AI 断句
    const response: SegmentCorpusResponse = await chrome.runtime.sendMessage({
      type: MessageType.SEGMENT_CORPUS,
      payload: {
        text,
        userLevel,
      },
    });

    if (response.success && response.data) {
      initializePractice(response.data);
    } else {
      // 优雅降级：使用简单分割
      console.warn("[Corpus] AI 断句失败，使用简单分割");
      showStatus(inputStatus, "智能分句暂不可用，使用简单分句模式", "warning");

      const fallbackResult = fallbackSegment(text);
      setTimeout(() => {
        initializePractice(fallbackResult);
      }, 1500);
    }
  } catch (error) {
    console.error("[Corpus] 断句请求失败:", error);
    showStatus(inputStatus, "网络连接失败，请检查网络后重试", "error");
    startPracticeBtn.disabled = false;
  }
}

/**
 * 简单断句降级方案
 */
function fallbackSegment(text: string): SegmentCorpusResult {
  // 按句号、问号、感叹号分割
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0)
    .map((s) => ({
      text: s.trim(),
      difficulty: "简单分句模式",
      keyWords: [],
      listeningTips: "注意句子的语调变化",
    }));

  return {
    sentences,
    overallLevel: "未知",
  };
}

/**
 * 初始化练习
 */
function initializePractice(data: SegmentCorpusResult): void {
  if (data.sentences.length === 0) {
    showStatus(inputStatus, "未能识别到有效句子，请检查语料内容", "error");
    startPracticeBtn.disabled = false;
    return;
  }

  // 初始化状态
  state = {
    sentences: data.sentences,
    currentIndex: 0,
    results: new Array(data.sentences.length).fill(null),
    overallLevel: data.overallLevel,
    playCounts: new Array(data.sentences.length).fill(0),
  };

  // 切换视图
  inputSection.style.display = "none";
  practiceSection.style.display = "block";
  resultSection.style.display = "none";
  completeSection.style.display = "none";

  // 显示第一句
  renderCurrentSentence();
}

// ====== 练习界面 ======

function renderCurrentSentence(): void {
  if (!state) return;

  const sentence = state.sentences[state.currentIndex];
  const total = state.sentences.length;
  const current = state.currentIndex + 1;

  // 更新进度
  const progress = (current / total) * 100;
  progressFill.style.width = `${progress}%`;
  progressText.textContent = `句子 ${current}/${total}`;
  currentSentenceNum.textContent = current.toString();

  // 更新整体准确率
  updateOverallAccuracy();

  // 重置原文显示状态
  originalTextArea.style.display = "none";
  toggleOriginalBtn.classList.remove("active");

  // 设置原文和提示
  originalText.textContent = sentence.text;
  listeningTips.textContent = sentence.listeningTips || "注意听清每个单词";

  // 重置播放次数显示
  playCount.textContent = `已播放 ${state.playCounts[state.currentIndex]} 次`;

  // 重置输入框
  dictationInput.value = "";
  submitAnswerBtn.disabled = true;

  // TTS 不可用时显示原文
  if (!isTTSAvailable) {
    originalTextArea.style.display = "block";
    toggleOriginalBtn.style.display = "none";
    playBtn.style.display = "none";
    replayBtn.style.display = "none";
    showStatus(practiceStatus, "朗读功能不可用，请直接查看原文输入", "warning");
  } else {
    toggleOriginalBtn.style.display = "";
    playBtn.style.display = "";
    replayBtn.style.display = "";
    hideStatus(practiceStatus);
  }

  // 自动播放第一次
  if (isTTSAvailable && state.playCounts[state.currentIndex] === 0) {
    setTimeout(() => handlePlaySentence(), 500);
  }
}

function updateOverallAccuracy(): void {
  if (!state) return;

  const validResults = state.results.filter((r) => r !== null);
  if (validResults.length === 0) {
    overallAccuracy.textContent = "准确率 --%";
    return;
  }

  const avgAcc = validResults.reduce((sum, r) => sum + (r?.accuracy || 0), 0) / validResults.length;
  overallAccuracy.textContent = `准确率 ${Math.round(avgAcc)}%`;
}

// ====== TTS 朗读 ======

function handleSpeedChange(): void {
  const speed = resolveTTSSpeed(speedSelect.value);
  void saveTTSSpeed(speed);
}

function handlePlaySentence(): void {
  if (!state || !isTTSAvailable) return;

  const sentence = state.sentences[state.currentIndex];
  const rate = currentTTSSpeed;

  // 停止当前播放
  corpusTTSPlayer.stop();

  void corpusTTSPlayer
    .playText({
      text: sentence.text,
      rate,
      onStart: () => {
        playBtn.classList.add("playing");
      },
      onEnd: () => {
        playBtn.classList.remove("playing");
        if (state) {
          state.playCounts[state.currentIndex]++;
          playCount.textContent = `已播放 ${state.playCounts[state.currentIndex]} 次`;
        }
      },
      onFallbackWarning: (message) => {
        showStatus(practiceStatus, message, "warning");
      },
      fallbackWarningMessage: TTS_FALLBACK_WARNING_MESSAGE,
    })
    .catch((error) => {
      playBtn.classList.remove("playing");
      showStatus(
        practiceStatus,
        error instanceof Error ? error.message : TTS_PLAYBACK_ERROR_MESSAGE,
        "error"
      );
    });
}

function handleReplaySentence(): void {
  handlePlaySentence();
}

// ====== 显示/隐藏原文 ======

function toggleOriginalText(): void {
  const isShowing = originalTextArea.style.display !== "none";

  if (isShowing) {
    originalTextArea.style.display = "none";
    toggleOriginalBtn.classList.remove("active");
  } else {
    originalTextArea.style.display = "block";
    toggleOriginalBtn.classList.add("active");
  }
}

// ====== 听写输入 ======

function handleDictationInput(): void {
  const text = dictationInput.value.trim();
  submitAnswerBtn.disabled = text.length === 0;
}

// ====== 提交答案 ======

async function handleSubmitAnswer(): Promise<void> {
  if (!state) return;

  const userInput = dictationInput.value.trim();
  if (!userInput) {
    showStatus(practiceStatus, "请输入听到的内容", "warning");
    return;
  }

  const sentence = state.sentences[state.currentIndex];

  submitAnswerBtn.disabled = true;
  showStatus(practiceStatus, "正在分析听写结果...", "loading");

  // 停止 TTS
  corpusTTSPlayer.stop();

  try {
    // 调用 AI 分析
    const response: AnalyzeListeningResponse = await chrome.runtime.sendMessage({
      type: MessageType.ANALYZE_LISTENING,
      payload: {
        original: sentence.text,
        userInput,
        userLevel,
      },
    });

    if (response.success && response.data) {
      state.results[state.currentIndex] = response.data;
      renderAnalysisResult(sentence.text, userInput, response.data);
    } else {
      // 优雅降级：显示简单对比
      console.warn("[Corpus] AI 分析失败，显示简单对比");
      showStatus(practiceStatus, "详细分析暂不可用，显示简单对比结果", "warning");

      const fallbackResult = fallbackAnalysis(sentence.text, userInput);
      state.results[state.currentIndex] = fallbackResult;

      setTimeout(() => {
        renderAnalysisResult(sentence.text, userInput, fallbackResult);
      }, 1000);
    }
  } catch (error) {
    console.error("[Corpus] 分析请求失败:", error);
    showStatus(practiceStatus, "网络连接失败，请检查网络后重试", "error");
    submitAnswerBtn.disabled = false;
  }
}

/**
 * 简单分析降级方案
 */
function fallbackAnalysis(original: string, userInput: string): ListeningAnalysisResult {
  const originalWords = original.toLowerCase().split(/\s+/);
  const userWords = userInput.toLowerCase().split(/\s+/);

  let matchCount = 0;
  for (const word of userWords) {
    if (originalWords.includes(word)) {
      matchCount++;
    }
  }

  const accuracy = Math.round((matchCount / originalWords.length) * 100);

  return {
    accuracy,
    errors: [],
    blindSpots: [],
    suggestions: ["建议多听几遍原文", "注意对比自己的答案和原文"],
    encouragement: accuracy >= 80 ? "做得不错！" : "继续加油！",
  };
}

// ====== 渲染分析结果 ======

function renderAnalysisResult(
  original: string,
  userInput: string,
  result: ListeningAnalysisResult
): void {
  hideStatus(practiceStatus);

  // 切换视图
  practiceSection.style.display = "none";
  resultSection.style.display = "block";

  // 准确率
  sentenceAccuracy.textContent = `${result.accuracy}%`;

  // 文本对比 - 原文
  comparisonOriginal.textContent = original;

  // 文本对比 - 用户答案（带错误高亮）
  renderUserAnswerWithHighlight(userInput, result.errors);

  // 错误列表
  if (result.errors && result.errors.length > 0) {
    errorsSection.style.display = "block";
    renderErrorsList(result.errors);
  } else {
    errorsSection.style.display = "none";
  }

  // 建议
  if (result.suggestions && result.suggestions.length > 0) {
    suggestionsSection.style.display = "block";
    suggestionsList.innerHTML = result.suggestions
      .map((s) => `<li>${s}</li>`)
      .join("");
  } else {
    suggestionsSection.style.display = "none";
  }

  // 鼓励语
  encouragementText.textContent = result.encouragement || "继续努力！";

  // 更新整体准确率
  updateOverallAccuracy();

  // 判断是否为最后一句
  if (state && state.currentIndex >= state.sentences.length - 1) {
    nextSentenceBtn.textContent = "查看总结";
  } else {
    nextSentenceBtn.innerHTML = `
      下一句
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    `;
  }
}

/**
 * 渲染带错误高亮的用户答案
 */
function renderUserAnswerWithHighlight(userInput: string, errors: ListeningError[]): void {
  if (!errors || errors.length === 0) {
    comparisonUser.textContent = userInput;
    return;
  }

  // 创建错误词映射
  const errorMap = new Map<string, ListeningError>();
  for (const error of errors) {
    const actual = error.actual.toLowerCase();
    errorMap.set(actual, error);
  }

  // 分词并高亮
  const words = userInput.split(/(\s+)/);
  let html = "";

  for (const word of words) {
    const lowerWord = word.toLowerCase().replace(/[.,!?;:]/g, "");
    const error = errorMap.get(lowerWord);

    if (error) {
      const tip = error.tip || error.explanation;
      html += `<span class="error-word" data-tip="${tip}">${word}</span>`;
    } else {
      html += word;
    }
  }

  comparisonUser.innerHTML = html;
}

/**
 * 渲染错误列表
 */
function renderErrorsList(errors: ListeningError[]): void {
  errorsList.innerHTML = errors
    .map(
      (error) => `
      <div class="error-item">
        <div class="error-item-header">
          <span class="error-expected">${error.expected}</span>
          <span class="error-arrow">→</span>
          <span class="error-actual">${error.actual}</span>
          <span class="error-type">${ERROR_TYPE_LABELS[error.type] || error.type}</span>
        </div>
        <p class="error-explanation">${error.explanation}</p>
        <p class="error-tip">💡 ${error.tip}</p>
      </div>
    `
    )
    .join("");
}

// ====== 跳过句子 ======

function handleSkipSentence(): void {
  if (!state) return;

  // 标记为跳过（null 结果）
  state.results[state.currentIndex] = null;

  // 下一句或完成
  if (state.currentIndex < state.sentences.length - 1) {
    state.currentIndex++;
    renderCurrentSentence();
  } else {
    showComplete();
  }
}

// ====== 重新听写 ======

function handleRetry(): void {
  if (!state) return;

  // 清除本句结果
  state.results[state.currentIndex] = null;

  // 切换回练习视图
  resultSection.style.display = "none";
  practiceSection.style.display = "block";

  // 重置输入
  dictationInput.value = "";
  submitAnswerBtn.disabled = true;

  // 重新播放
  if (isTTSAvailable) {
    setTimeout(() => handlePlaySentence(), 500);
  }
}

// ====== 下一句 ======

function handleNextSentence(): void {
  if (!state) return;

  if (state.currentIndex < state.sentences.length - 1) {
    state.currentIndex++;
    resultSection.style.display = "none";
    practiceSection.style.display = "block";
    renderCurrentSentence();
  } else {
    showComplete();
  }
}

// ====== 完成界面 ======

function showComplete(): void {
  if (!state) return;

  // 切换视图
  practiceSection.style.display = "none";
  resultSection.style.display = "none";
  completeSection.style.display = "block";

  // 统计
  const validResults = state.results.filter((r) => r !== null) as ListeningAnalysisResult[];
  const completedCount = validResults.length;
  const avgAcc =
    completedCount > 0
      ? Math.round(validResults.reduce((sum, r) => sum + r.accuracy, 0) / completedCount)
      : 0;

  totalSentences.textContent = state.sentences.length.toString();
  avgAccuracy.textContent = `${avgAcc}%`;

  // 收集听力盲区
  const allBlindSpots: string[] = [];
  const allSuggestions: string[] = [];

  for (const result of validResults) {
    if (result.blindSpots) {
      allBlindSpots.push(...result.blindSpots);
    }
    if (result.suggestions) {
      allSuggestions.push(...result.suggestions);
    }
  }

  // 去重
  const uniqueBlindSpots = [...new Set(allBlindSpots)].slice(0, 5);
  const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 5);

  // 显示听力盲区
  if (uniqueBlindSpots.length > 0) {
    blindSpotsSection.style.display = "block";
    blindSpotsList.innerHTML = uniqueBlindSpots.map((s) => `<li>${s}</li>`).join("");
  } else {
    blindSpotsSection.style.display = "none";
  }

  // 显示练习建议
  if (uniqueSuggestions.length > 0) {
    practiceAdviceSection.style.display = "block";
    practiceAdviceList.innerHTML = uniqueSuggestions.map((s) => `<li>${s}</li>`).join("");
  } else {
    practiceAdviceSection.style.display = "none";
  }
}

// ====== 开始新练习 ======

function handleNewPractice(): void {
  // 重置状态
  state = null;

  // 清空输入
  corpusInput.value = "";
  corpusWordCount.textContent = "0 词";
  startPracticeBtn.disabled = true;

  // 切换视图
  completeSection.style.display = "none";
  inputSection.style.display = "block";
  hideStatus(inputStatus);

  // 聚焦输入框
  corpusInput.focus();
}

// ====== 辅助函数 ======

function showStatus(element: HTMLElement, message: string, type: "success" | "error" | "loading" | "warning"): void {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = "block";

  if (type === "success" || type === "warning") {
    setTimeout(() => {
      element.style.display = "none";
    }, 3000);
  }
}

function hideStatus(element: HTMLElement): void {
  element.style.display = "none";
}
