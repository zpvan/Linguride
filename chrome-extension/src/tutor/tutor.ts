/**
 * @file tutor.ts
 * @description 外教标签页逻辑 — AI 助手多模式功能
 *
 * 从 popup.ts 迁移而来，提供更大的操作空间和更好的用户体验。
 * 功能：中译英、英译中、英英释义、长难句分析、语音朗读、录音练习、发音评估。
 *
 * @author Lingride Team
 * @since 2.2.0
 */

import {
  AnalyzeSentenceResponse,
  AssessPronunciationResponse,
  CEFRLevel,
  ChineseToEnglishResponse,
  EnglishDefinitionResponse,
  EnglishToChineseResponse,
  GetConfigResponse,
  ISpeechRecognizer,
  MessageType,
  PronunciationAssessmentResult,
  SentenceAnalysisResult,
} from "../types";

// ====== 类型定义 ======

/** 外教助手模式 */
type TutorMode = "cn2en" | "en2cn" | "definition" | "analyze";

/** 模式配置 */
interface ModeConfig {
  placeholder: string;
  btnText: string;
}

/** 模式配置映射 */
const MODE_CONFIG: Record<TutorMode, ModeConfig> = {
  cn2en: { placeholder: "输入中文，点击翻译成英文...", btnText: "翻译" },
  en2cn: { placeholder: "输入英文，点击翻译成中文...", btnText: "翻译" },
  definition: {
    placeholder: "输入英文单词或句子，获取英英释义...",
    btnText: "释义",
  },
  analyze: { placeholder: "输入英文长难句，点击分析...", btnText: "语法分析" },
};

// ====== 状态变量 ======

/** 当前模式 */
let currentMode: TutorMode = "cn2en";

/** 用户 CEFR 水平 */
let userLevel: CEFRLevel = "A2";

// ====== DOM 元素引用 ======

// 模式选择器
const modeSelector = document.getElementById("modeSelector") as HTMLElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;

// 输入区域
const sentenceInput = document.getElementById(
  "sentenceInput"
) as HTMLTextAreaElement;
const sentenceCharCount = document.getElementById(
  "sentenceCharCount"
) as HTMLElement;

// 翻译结果
const translationResult = document.getElementById(
  "translationResult"
) as HTMLElement;
const translationText = document.getElementById(
  "translationText"
) as HTMLElement;
const copyTranslationBtn = document.getElementById(
  "copyTranslationBtn"
) as HTMLButtonElement;

// 英英释义结果
const definitionResult = document.getElementById(
  "definitionResult"
) as HTMLElement;
const definitionText = document.getElementById(
  "definitionText"
) as HTMLElement;
const examplesSection = document.getElementById(
  "examplesSection"
) as HTMLElement;
const examplesList = document.getElementById("examplesList") as HTMLElement;
const synonymsSection = document.getElementById(
  "synonymsSection"
) as HTMLElement;
const synonymsText = document.getElementById("synonymsText") as HTMLElement;
const usageSection = document.getElementById("usageSection") as HTMLElement;
const usageText = document.getElementById("usageText") as HTMLElement;
const copyDefinitionBtn = document.getElementById(
  "copyDefinitionBtn"
) as HTMLButtonElement;

// 长难句分析结果（保留原有引用）
const sentenceStatus = document.getElementById("sentenceStatus") as HTMLElement;
const sentenceResultEl = document.getElementById(
  "sentenceResult"
) as HTMLElement;
const sentenceTranslation = document.getElementById(
  "sentenceTranslation"
) as HTMLElement;
const sentenceStructure = document.getElementById(
  "sentenceStructure"
) as HTMLElement;
const clausesSection = document.getElementById("clausesSection") as HTMLElement;
const sentenceClauses = document.getElementById(
  "sentenceClauses"
) as HTMLElement;
const sentenceKeyPhrases = document.getElementById(
  "sentenceKeyPhrases"
) as HTMLElement;
const sentenceGrammarPoints = document.getElementById(
  "sentenceGrammarPoints"
) as HTMLElement;
const sentenceSimplified = document.getElementById(
  "sentenceSimplified"
) as HTMLElement;

// 语音朗读
const speakSentenceBtn = document.getElementById(
  "speakSentenceBtn"
) as HTMLButtonElement;

// 录音练习
const recordSentenceBtn = document.getElementById(
  "recordSentenceBtn"
) as HTMLButtonElement;
const recordingStatus = document.getElementById(
  "recordingStatus"
) as HTMLElement;
const recordingTime = document.getElementById("recordingTime") as HTMLElement;
const recognitionPreview = document.getElementById(
  "recognitionPreview"
) as HTMLElement;
const recognitionText = document.getElementById(
  "recognitionText"
) as HTMLElement;
const pronunciationStatus = document.getElementById(
  "pronunciationStatus"
) as HTMLElement;

// 发音评估结果
const pronunciationResult = document.getElementById(
  "pronunciationResult"
) as HTMLElement;
const pronunciationScore = document.getElementById(
  "pronunciationScore"
) as HTMLElement;
const accuracyBar = document.getElementById("accuracyBar") as HTMLElement;
const accuracyValue = document.getElementById("accuracyValue") as HTMLElement;
const fluencyBar = document.getElementById("fluencyBar") as HTMLElement;
const fluencyValue = document.getElementById("fluencyValue") as HTMLElement;
const comparisonOriginal = document.getElementById(
  "comparisonOriginal"
) as HTMLElement;
const comparisonRecognized = document.getElementById(
  "comparisonRecognized"
) as HTMLElement;
const matchRate = document.getElementById("matchRate") as HTMLElement;
const issuesSection = document.getElementById("issuesSection") as HTMLElement;
const issuesList = document.getElementById("issuesList") as HTMLElement;
const suggestionsSection = document.getElementById(
  "suggestionsSection"
) as HTMLElement;
const encouragementText = document.getElementById(
  "encouragementText"
) as HTMLElement;
const speakFeedbackBtn = document.getElementById(
  "speakFeedbackBtn"
) as HTMLButtonElement;

// 自由练习结果
const freeRecognitionResult = document.getElementById(
  "freeRecognitionResult"
) as HTMLElement;
const freeRecognitionText = document.getElementById(
  "freeRecognitionText"
) as HTMLElement;

// ====== 录音相关状态 ======

let recognizer: ISpeechRecognizer | null = null;
let recordingTimer: number | null = null;
let recordingSeconds = 0;
const MAX_RECORDING_SECONDS = 60;
let lastPronunciationResult: PronunciationAssessmentResult | null = null;

// ====== Web Speech API 语音识别器 ======

/**
 * Web Speech API 语音识别器
 *
 * 实时识别，无需录音文件。
 */
class WebSpeechRecognizer implements ISpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private finalTranscript = "";
  private _isRecognizing = false;

  onInterimResult?: (text: string) => void;
  onError?: (error: Error) => void;

  async start(): Promise<void> {
    // 检查浏览器支持
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error("当前浏览器不支持语音识别，请使用 Chrome 浏览器");
    }

    // 先请求麦克风权限（触发浏览器权限对话框）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 获取权限后立即停止，只是为了触发权限请求
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          // 打开授权页面
          openMicrophoneAuthPage();
          throw new Error("需要麦克风权限，已打开授权页面");
        } else if (err.name === "NotFoundError") {
          throw new Error("未检测到麦克风设备，请检查麦克风连接");
        }
      }
      throw new Error(
        "无法访问麦克风：" +
          (err instanceof Error ? err.message : String(err))
      );
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.finalTranscript = "";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
      // 回调实时结果
      this.onInterimResult?.(this.finalTranscript + interimTranscript);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this._isRecognizing = false;
      const errorMap: Record<string, string> = {
        "no-speech": "未检测到语音，请对着麦克风说话",
        "audio-capture": "无法访问麦克风，请检查权限设置",
        "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许",
        network: "网络错误，语音识别需要网络连接",
      };
      const message = errorMap[event.error] || `语音识别错误: ${event.error}`;
      this.onError?.(new Error(message));
    };

    this.recognition.onend = () => {
      // 如果仍在录音状态但识别意外结束，尝试重启
      if (this._isRecognizing) {
        console.log("[Lingride Tutor] 语音识别意外结束，尝试重启...");
        try {
          this.recognition?.start();
        } catch (e) {
          console.error("[Lingride Tutor] 重启语音识别失败:", e);
          this._isRecognizing = false;
        }
      }
    };

    this.recognition.start();
    this._isRecognizing = true;
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;
    if (this.recognition) {
      this.recognition.stop();
    }
    return this.finalTranscript.trim();
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }
}

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride Tutor] 外教标签页已加载");

  // 获取用户配置
  await loadUserConfig();

  // 绑定事件
  bindEvents();

  // 初始化 UI
  updateModeUI();
});

/**
 * 加载用户配置
 *
 * 获取用户 CEFR 水平，用于英英释义功能。
 */
async function loadUserConfig(): Promise<void> {
  try {
    const response: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });
    if (response.success && response.data?.user_english_level) {
      userLevel = response.data.user_english_level;
      console.log(`[Lingride Tutor] 用户水平: ${userLevel}`);
    }
  } catch (error) {
    console.error("[Lingride Tutor] 获取用户配置失败:", error);
  }
}

// ====== 事件绑定 ======

function bindEvents(): void {
  // 模式选择器（事件委托）
  modeSelector.addEventListener("click", handleModeClick);

  // 提交按钮
  submitBtn.addEventListener("click", handleSubmit);

  // 输入框
  sentenceInput.addEventListener("input", handleSentenceInput);

  // 复制按钮
  copyTranslationBtn?.addEventListener("click", () =>
    handleCopy(translationText.textContent || "", copyTranslationBtn)
  );
  copyDefinitionBtn?.addEventListener("click", () =>
    handleCopy(getDefinitionCopyText(), copyDefinitionBtn)
  );

  // 语音朗读
  speakSentenceBtn.addEventListener("click", handleSpeakSentence);

  // 录音练习
  recordSentenceBtn.addEventListener("click", handleRecordSentence);
  speakFeedbackBtn?.addEventListener("click", handleSpeakFeedback);

  // 页面关闭时停止朗读和录音
  window.addEventListener("beforeunload", () => {
    speechSynthesis.cancel();
    stopRecordingCleanup();
  });
}

// ====== 模式切换 ======

/**
 * 处理模式按钮点击
 */
function handleModeClick(e: Event): void {
  const target = e.target as HTMLElement;
  if (!target.classList.contains("mode-btn")) return;

  const mode = target.dataset.mode as TutorMode;
  if (!mode || mode === currentMode) return;

  currentMode = mode;
  updateModeUI();
  clearAllResults();
}

/**
 * 更新模式 UI
 *
 * 更新模式按钮样式、placeholder 和提交按钮文本。
 */
function updateModeUI(): void {
  // 更新模式按钮样式
  modeSelector.querySelectorAll(".mode-btn").forEach((btn) => {
    const btnMode = (btn as HTMLElement).dataset.mode;
    btn.classList.toggle("active", btnMode === currentMode);
  });

  // 更新 placeholder 和按钮文本
  const config = MODE_CONFIG[currentMode];
  sentenceInput.placeholder = config.placeholder;
  submitBtn.textContent = config.btnText;
}

/**
 * 清除所有结果区域
 */
function clearAllResults(): void {
  // 隐藏所有结果区域
  translationResult.style.display = "none";
  definitionResult.style.display = "none";
  sentenceResultEl.style.display = "none";
  pronunciationResult.style.display = "none";
  freeRecognitionResult.style.display = "none";

  // 清除状态消息
  sentenceStatus.style.display = "none";
  pronunciationStatus.style.display = "none";
}

// ====== 统一提交处理 ======

/**
 * 处理提交按钮点击
 */
async function handleSubmit(): Promise<void> {
  const text = sentenceInput.value.trim();
  if (!text) return;

  // 停止正在进行的朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
  }

  // 根据当前模式调用对应的处理函数
  switch (currentMode) {
    case "cn2en":
      await handleChineseToEnglish(text);
      break;
    case "en2cn":
      await handleEnglishToChinese(text);
      break;
    case "definition":
      await handleEnglishDefinition(text);
      break;
    case "analyze":
      await handleAnalyzeSentence();
      break;
  }
}

// ====== 中译英 ======

/**
 * 处理中译英
 */
async function handleChineseToEnglish(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "翻译中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在翻译...", "loading");

  try {
    const response: ChineseToEnglishResponse = await chrome.runtime.sendMessage(
      {
        type: MessageType.CHINESE_TO_ENGLISH,
        payload: { text },
      }
    );

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderTranslationResult(response.data.translation);
    } else {
      showStatus(sentenceStatus, response.error || "翻译失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 中译英失败:", error);
    showStatus(sentenceStatus, "翻译请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

// ====== 英译中 ======

/**
 * 处理英译中
 */
async function handleEnglishToChinese(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "翻译中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在翻译...", "loading");

  try {
    const response: EnglishToChineseResponse = await chrome.runtime.sendMessage(
      {
        type: MessageType.ENGLISH_TO_CHINESE,
        payload: { text },
      }
    );

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderTranslationResult(response.data.translation);
    } else {
      showStatus(sentenceStatus, response.error || "翻译失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 英译中失败:", error);
    showStatus(sentenceStatus, "翻译请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

/**
 * 渲染翻译结果
 */
function renderTranslationResult(translation: string): void {
  translationText.textContent = translation;
  translationResult.style.display = "block";
}

// ====== 英英释义 ======

/**
 * 处理英英释义
 */
async function handleEnglishDefinition(text: string): Promise<void> {
  submitBtn.disabled = true;
  submitBtn.textContent = "释义中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在获取释义...", "loading");

  try {
    const response: EnglishDefinitionResponse =
      await chrome.runtime.sendMessage({
        type: MessageType.ENGLISH_DEFINITION,
        payload: { text, userLevel },
      });

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderDefinitionResult(response.data);
    } else {
      showStatus(sentenceStatus, response.error || "获取释义失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 英英释义失败:", error);
    showStatus(sentenceStatus, "释义请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

/**
 * 渲染英英释义结果
 */
function renderDefinitionResult(
  data: EnglishDefinitionResponse["data"]
): void {
  if (!data) return;

  // 释义
  definitionText.textContent = data.definition;

  // 例句
  if (data.examples && data.examples.length > 0) {
    examplesList.innerHTML = data.examples
      .map((ex) => `<li>${ex}</li>`)
      .join("");
    examplesSection.style.display = "block";
  } else {
    examplesSection.style.display = "none";
  }

  // 同义词
  if (data.synonyms && data.synonyms.length > 0) {
    synonymsText.textContent = data.synonyms.join(", ");
    synonymsSection.style.display = "block";
  } else {
    synonymsSection.style.display = "none";
  }

  // 用法说明
  if (data.usageNotes) {
    usageText.textContent = data.usageNotes;
    usageSection.style.display = "block";
  } else {
    usageSection.style.display = "none";
  }

  definitionResult.style.display = "block";
}

/**
 * 获取英英释义的复制文本
 */
function getDefinitionCopyText(): string {
  const parts = [definitionText.textContent || ""];

  if (examplesSection.style.display !== "none") {
    const examples = Array.from(examplesList.querySelectorAll("li"))
      .map((li) => `• ${li.textContent}`)
      .join("\n");
    parts.push(`\nExamples:\n${examples}`);
  }

  if (synonymsSection.style.display !== "none") {
    parts.push(`\nSynonyms: ${synonymsText.textContent}`);
  }

  if (usageSection.style.display !== "none") {
    parts.push(`\nUsage: ${usageText.textContent}`);
  }

  return parts.join("");
}

// ====== 复制功能 ======

/**
 * 处理复制
 */
async function handleCopy(
  text: string,
  button: HTMLButtonElement
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    button.classList.add("copied");
    setTimeout(() => button.classList.remove("copied"), 1500);
  } catch (error) {
    console.error("[Lingride Tutor] 复制失败:", error);
  }
}

// ====== 长难句分析 ======

// ====== 输入处理 ======

/**
 * 处理输入框的 input 事件
 *
 * 更新字符计数器和按钮 disabled 状态。
 */
function handleSentenceInput(): void {
  const length = sentenceInput.value.length;
  sentenceCharCount.textContent = `${length}/500`;
  submitBtn.disabled = length === 0;
  speakSentenceBtn.disabled = length === 0;

  // 输入内容修改时停止正在进行的朗读
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
  }
}

/**
 * 处理语音朗读
 *
 * 使用浏览器原生 Web Speech API (speechSynthesis) 朗读输入框中的英文内容。
 * 点击切换：未朗读 → 开始朗读；朗读中 → 停止朗读。
 */
function handleSpeakSentence(): void {
  // 如果正在朗读，则停止
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakSentenceBtn.classList.remove("speaking");
    return;
  }

  const text = sentenceInput.value.trim();
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9; // 略慢，适合学习者

  utterance.onstart = () => speakSentenceBtn.classList.add("speaking");
  utterance.onend = () => speakSentenceBtn.classList.remove("speaking");
  utterance.onerror = () => speakSentenceBtn.classList.remove("speaking");

  speechSynthesis.speak(utterance);
}

/**
 * 处理长难句分析
 *
 * 空输入校验 -> 禁用按钮 + 显示"分析中..." -> 发送消息 -> 处理结果 -> 恢复按钮
 */
async function handleAnalyzeSentence(): Promise<void> {
  const sentence = sentenceInput.value.trim();
  if (!sentence) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "分析中...";
  clearAllResults();
  showStatus(sentenceStatus, "正在分析句子结构...", "loading");

  try {
    const response: AnalyzeSentenceResponse = await chrome.runtime.sendMessage({
      type: MessageType.ANALYZE_SENTENCE,
      payload: { sentence },
    });

    if (response.success && response.data) {
      sentenceStatus.style.display = "none";
      renderSentenceAnalysisResult(response.data);
    } else {
      showStatus(sentenceStatus, response.error || "分析失败", "error");
    }
  } catch (error) {
    console.error("[Lingride Tutor] 长难句分析失败:", error);
    showStatus(sentenceStatus, "分析请求失败", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = MODE_CONFIG[currentMode].btnText;
  }
}

/**
 * 渲染长难句分析结果
 */
function renderSentenceAnalysisResult(result: SentenceAnalysisResult): void {
  sentenceResultEl.style.display = "block";

  // 翻译
  sentenceTranslation.textContent = result.translation;

  // 主干结构（彩色标签）
  sentenceStructure.innerHTML = "";
  const structureParts: Array<{ label: string; value: string; cls: string }> = [
    { label: "S", value: result.structure.subject, cls: "tag-subject" },
    { label: "V", value: result.structure.predicate, cls: "tag-predicate" },
  ];
  if (result.structure.object) {
    structureParts.push({
      label: "O",
      value: result.structure.object,
      cls: "tag-object",
    });
  }
  if (result.structure.complement) {
    structureParts.push({
      label: "C",
      value: result.structure.complement,
      cls: "tag-complement",
    });
  }
  for (const part of structureParts) {
    const tag = document.createElement("div");
    tag.className = `structure-tag ${part.cls}`;
    tag.innerHTML = `<span class="tag-label">${part.label}</span><span class="tag-value">${part.value}</span>`;
    sentenceStructure.appendChild(tag);
  }

  // 从句拆解（有从句时显示，无从句时隐藏）
  if (result.clauses && result.clauses.length > 0) {
    clausesSection.style.display = "block";
    sentenceClauses.innerHTML = "";
    for (const clause of result.clauses) {
      const item = document.createElement("div");
      item.className = "clause-item";
      item.innerHTML = `<span class="clause-type">${clause.type}</span><p class="clause-content">${clause.content}</p><p class="clause-function">${clause.function}</p>`;
      sentenceClauses.appendChild(item);
    }
  } else {
    clausesSection.style.display = "none";
  }

  // 重点短语
  sentenceKeyPhrases.innerHTML = "";
  if (result.keyPhrases) {
    for (const kp of result.keyPhrases) {
      const item = document.createElement("div");
      item.className = "phrase-item";
      item.innerHTML = `<span class="phrase-text">${kp.phrase}</span><span class="phrase-meaning">${kp.meaning}</span>`;
      sentenceKeyPhrases.appendChild(item);
    }
  }

  // 语法要点
  sentenceGrammarPoints.innerHTML = "";
  if (result.grammarPoints) {
    for (const point of result.grammarPoints) {
      const li = document.createElement("li");
      li.textContent = point;
      sentenceGrammarPoints.appendChild(li);
    }
  }

  // 简化改写
  sentenceSimplified.textContent = result.simplifiedVersion;
}

// ====== 辅助函数 ======

function showStatus(
  element: HTMLElement,
  message: string,
  type: "success" | "error" | "loading"
): void {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = "block";

  if (type === "success") {
    setTimeout(() => {
      element.style.display = "none";
    }, 3000);
  }
}

// ====== 录音练习功能 ======

/**
 * 打开麦克风授权页面
 *
 * 在新标签页中打开专门的授权页面，让用户为扩展授权麦克风。
 */
function openMicrophoneAuthPage(): void {
  const authPageUrl = chrome.runtime.getURL("src/permissions/permissions.html");
  chrome.tabs.create({ url: authPageUrl });
}

/**
 * 停止录音时的清理函数（供异常或页面关闭时调用）
 */
function stopRecordingCleanup(): void {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  recognizer?.stop();
  recognizer = null;
  recordingSeconds = 0;
}

/**
 * 处理录音按钮点击
 *
 * 点击切换：未录音 → 开始录音；录音中 → 停止并处理。
 */
async function handleRecordSentence(): Promise<void> {
  // 如果正在录音，停止并处理
  if (recognizer?.isRecognizing()) {
    await stopRecordingAndProcess();
    return;
  }

  // 开始录音
  await startRecording();
}

/**
 * 开始录音
 */
async function startRecording(): Promise<void> {
  try {
    // 隐藏之前的结果
    pronunciationResult.style.display = "none";
    freeRecognitionResult.style.display = "none";
    pronunciationStatus.style.display = "none";

    // 初始化识别器
    recognizer = new WebSpeechRecognizer();
    recognizer.onInterimResult = (text) => {
      updateRecognitionPreview(text);
    };
    recognizer.onError = (error) => {
      stopRecordingUI();
      showStatus(pronunciationStatus, error.message, "error");
    };

    await recognizer.start();

    // 更新 UI 状态
    startRecordingUI();

    // 启动计时器
    recordingSeconds = 0;
    updateRecordingTime(0);
    recordingTimer = window.setInterval(() => {
      recordingSeconds++;
      updateRecordingTime(recordingSeconds);

      // 自动停止（超时保护）
      if (recordingSeconds >= MAX_RECORDING_SECONDS) {
        showStatus(
          pronunciationStatus,
          "录音已达最大时长，自动停止",
          "loading"
        );
        stopRecordingAndProcess();
      }
    }, 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "录音启动失败";
    showStatus(pronunciationStatus, message, "error");
  }
}

/**
 * 停止录音并处理结果
 */
async function stopRecordingAndProcess(): Promise<void> {
  // 防止重复点击：立即禁用按钮
  recordSentenceBtn.disabled = true;

  // 清理计时器
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  // 获取识别结果
  const recognizedText = (await recognizer?.stop()) || "";
  stopRecordingUI();

  // 检查录音时长
  if (recordingSeconds < 1) {
    showStatus(pronunciationStatus, "录音时间太短，请至少说 1 秒", "error");
    recordSentenceBtn.disabled = false;
    return;
  }

  // 检查识别结果
  if (!recognizedText) {
    showStatus(pronunciationStatus, "未识别到语音内容，请重试", "error");
    recordSentenceBtn.disabled = false;
    return;
  }

  const originalText = sentenceInput.value.trim();

  if (originalText) {
    // 模式 A：对照练习 - 调用 AI 评估
    await assessPronunciation(originalText, recognizedText);
  } else {
    // 模式 B：自由练习 - 仅显示识别结果
    showFreeRecognitionResult(recognizedText);
  }

  recordSentenceBtn.disabled = false;
}

/**
 * 更新录音时间显示
 */
function updateRecordingTime(seconds: number): void {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  recordingTime.textContent = `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * 更新实时识别预览
 */
function updateRecognitionPreview(text: string): void {
  if (text) {
    recognitionPreview.style.display = "block";
    recognitionText.textContent = text;
  } else {
    recognitionPreview.style.display = "none";
  }
}

/**
 * 开始录音时的 UI 更新
 */
function startRecordingUI(): void {
  recordSentenceBtn.classList.add("recording");
  recordSentenceBtn.classList.remove("processing");
  recordingStatus.style.display = "flex";
  recognitionPreview.style.display = "none";
}

/**
 * 停止录音时的 UI 更新
 */
function stopRecordingUI(): void {
  recordSentenceBtn.classList.remove("recording");
  recordingStatus.style.display = "none";
  recognitionPreview.style.display = "none";
}

/**
 * 调用 AI 进行发音评估
 */
async function assessPronunciation(
  original: string,
  recognized: string
): Promise<void> {
  recordSentenceBtn.classList.add("processing");
  showStatus(pronunciationStatus, "正在评估发音...", "loading");

  try {
    const response: AssessPronunciationResponse =
      await chrome.runtime.sendMessage({
        type: MessageType.ASSESS_PRONUNCIATION,
        payload: { original, recognized },
      });

    if (response.success && response.data) {
      pronunciationStatus.style.display = "none";
      lastPronunciationResult = response.data;
      renderPronunciationResult(response.data);
    } else {
      showStatus(
        pronunciationStatus,
        response.error || "评估失败，请重试",
        "error"
      );
      // 降级：仍显示识别结果
      showFreeRecognitionResult(recognized);
    }
  } catch (error) {
    console.error("[Lingride Tutor] 发音评估失败:", error);
    showStatus(pronunciationStatus, "评估请求失败", "error");
    // 降级：仍显示识别结果
    showFreeRecognitionResult(recognized);
  } finally {
    recordSentenceBtn.classList.remove("processing");
  }
}

/**
 * 渲染发音评估结果
 */
function renderPronunciationResult(
  result: PronunciationAssessmentResult
): void {
  pronunciationResult.style.display = "block";
  freeRecognitionResult.style.display = "none";

  // 评分
  pronunciationScore.textContent = result.score.toString();
  pronunciationScore.className = `score-value-large ${getScoreClass(result.score)}`;

  // 准确度和流利度条
  accuracyBar.style.width = `${result.accuracy}%`;
  accuracyValue.textContent = result.accuracy.toString();
  fluencyBar.style.width = `${result.fluency}%`;
  fluencyValue.textContent = result.fluency.toString();

  // 文本对比
  comparisonOriginal.textContent = result.comparison.original;
  comparisonRecognized.textContent = result.comparison.recognized;
  matchRate.textContent = `${Math.round(result.comparison.matchRate * 100)}%`;

  // 问题列表
  if (result.issues && result.issues.length > 0) {
    issuesSection.style.display = "block";
    issuesList.innerHTML = "";
    for (const issue of result.issues) {
      const item = document.createElement("div");
      item.className = `issue-item ${issue.severity}`;
      item.innerHTML = `
        <div class="issue-word">${issue.word}</div>
        <div class="issue-desc">${issue.issue}</div>
        <div class="issue-correction">${issue.correction}</div>
      `;
      issuesList.appendChild(item);
    }
  } else {
    issuesSection.style.display = "none";
  }

  // 改进建议
  const pronSuggestionsList = document.getElementById(
    "pronunciationSuggestionsList"
  ) as HTMLElement;
  if (result.suggestions && result.suggestions.length > 0) {
    suggestionsSection.style.display = "block";
    if (pronSuggestionsList) {
      pronSuggestionsList.innerHTML = "";
      for (const suggestion of result.suggestions) {
        const li = document.createElement("li");
        li.textContent = suggestion;
        pronSuggestionsList.appendChild(li);
      }
    }
  } else {
    suggestionsSection.style.display = "none";
  }

  // 鼓励语
  encouragementText.textContent = result.encouragement;
}

/**
 * 获取评分对应的 CSS 类名
 */
function getScoreClass(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * 显示自由练习结果（无原文时）
 */
function showFreeRecognitionResult(text: string): void {
  pronunciationResult.style.display = "none";
  freeRecognitionResult.style.display = "block";
  freeRecognitionText.textContent = text;
}

/**
 * 处理示范发音按钮点击
 *
 * 挑选最需要改进的单词，用英语语音示范两遍，帮助用户针对性练习。
 * - 有问题时：示范 severity 最高的问题单词
 * - 无问题时：说一句英语鼓励语
 */
function handleSpeakFeedback(): void {
  if (!lastPronunciationResult) return;

  // 如果正在朗读，则停止
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }

  // 找到最需要改进的单词（按 severity 排序）
  const issues = lastPronunciationResult.issues || [];
  const severityOrder: Record<string, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  };
  const sorted = [...issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  if (sorted.length > 0) {
    // 有问题：示范问题单词两遍
    speakWordTwice(sorted[0].word);
  } else {
    // 无问题：说一句英语鼓励语
    speakEncouragement();
  }
}

/**
 * 用英语语音示范单词两遍
 *
 * 慢速朗读，两遍之间间隔 500ms，便于用户跟读学习。
 */
function speakWordTwice(word: string): void {
  const utterance1 = new SpeechSynthesisUtterance(word);
  utterance1.lang = "en-US";
  utterance1.rate = 0.8; // 稍慢，便于学习

  const utterance2 = new SpeechSynthesisUtterance(word);
  utterance2.lang = "en-US";
  utterance2.rate = 0.8;

  // 第一遍结束后，稍等再读第二遍
  utterance1.onend = () => {
    setTimeout(() => {
      speechSynthesis.speak(utterance2);
    }, 500); // 500ms 间隔
  };

  speechSynthesis.speak(utterance1);
}

/**
 * 说一句英语鼓励语
 *
 * 用于发音完美时给予正面反馈。
 */
function speakEncouragement(): void {
  const utterance = new SpeechSynthesisUtterance("Perfect! Great job!");
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
}
