/**
 * @file popup.ts
 * @description Popup 逻辑 — Apple 风格学习控制中心
 *
 * 设计哲学："自如 (Natural Flow)"
 * - 双视图：Main View（学习控制） + Settings View（配置面板）
 * - Segmented Control：3 段可取消选择的模式选择器
 * - 自动保存：配置变更即时生效，无需保存按钮
 *
 * @author Lingride Team
 * @since 2.0.0
 */

import {
  DEFAULT_DIFFICULTY_SYSTEM_PROMPT,
  DEFAULT_DIFFICULTY_USER_PROMPT,
} from "../constants/difficultyPrompts";
import {
  DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT,
  DEFAULT_MIXED_TRANSLATE_USER_PROMPT,
} from "../constants/mixedTranslatePrompts";
import {
  DEFAULT_PARAPHRASE_SYSTEM_PROMPT,
  DEFAULT_PARAPHRASE_USER_PROMPT,
} from "../constants/paraphrasePrompts";
import {
  AnalyzeDifficultyResponse,
  calculateTargetLevel,
  CEFRLevel,
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_ENGLISH_LEVEL,
  DEFAULT_USER_PROMPT_TEMPLATE,
  DifficultyResult,
  getRetentionPercent,
  LingridConfig,
  MessageType,
} from "../types";

// ====== 类型定义 ======

/** 阅读模式 */
type ReadingMode = "paraphrase" | "mixed" | "translate" | null;

/** 模式描述映射 */
const MODE_DESCRIPTIONS: Record<string, string> = {
  paraphrase: "将英文改写为适合您水平的版本",
  mixed: "保留能理解的英文，用中文替换超纲部分",
  translate: "在原文下方显示中文翻译",
};

const MODE_DEFAULT_DESC = "选择一种阅读模式开始学习";

// ====== DOM 元素引用 ======

// 视图
const viewport = document.querySelector(".viewport") as HTMLElement;

// Header
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const settingsBadge = document.getElementById("settingsBadge") as HTMLElement;
const backBtn = document.getElementById("backBtn") as HTMLButtonElement;

// 模式选择器
const modeSelector = document.getElementById("modeSelector") as HTMLElement;
const segmentIndicator = document.getElementById(
  "segmentIndicator"
) as HTMLElement;
const modeDesc = document.getElementById("modeDesc") as HTMLElement;
const configHint = document.getElementById("configHint") as HTMLElement;
const configHintBtn = document.getElementById(
  "configHintBtn"
) as HTMLButtonElement;

// 水平选择器
const levelSelector = document.getElementById("levelSelector") as HTMLElement;
const levelHint = document.getElementById("levelHint") as HTMLElement;

// 难度分析
const analyzeDifficultyBtn = document.getElementById(
  "analyzeDifficultyBtn"
) as HTMLButtonElement;
const difficultyStatus = document.getElementById(
  "difficultyStatus"
) as HTMLElement;
const difficultyResult = document.getElementById(
  "difficultyResult"
) as HTMLElement;
const difficultyBadge = document.getElementById(
  "difficultyBadge"
) as HTMLElement;
const cefrBadge = document.getElementById("cefrBadge") as HTMLElement;
const scoreProgress = document.getElementById("scoreProgress") as HTMLElement;
const scoreValue = document.getElementById("scoreValue") as HTMLElement;
const vocabMetric = document.getElementById("vocabMetric") as HTMLElement;
const sentenceMetric = document.getElementById("sentenceMetric") as HTMLElement;
const readingTime = document.getElementById("readingTime") as HTMLElement;
const wordCount = document.getElementById("wordCount") as HTMLElement;
const suggestionsList = document.getElementById(
  "suggestionsList"
) as HTMLElement;
const selectionHint = document.getElementById("selectionHint") as HTMLElement;

// Settings - API 配置
const apiBaseUrlInput = document.getElementById(
  "apiBaseUrl"
) as HTMLInputElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const showKeyBtn = document.getElementById("showKeyBtn") as HTMLButtonElement;
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
const customModelInput = document.getElementById(
  "customModel"
) as HTMLInputElement;
const testConnectionBtn = document.getElementById(
  "testConnectionBtn"
) as HTMLButtonElement;
const connectionStatus = document.getElementById(
  "connectionStatus"
) as HTMLElement;

// Settings - Prompt 配置
const systemPromptTextarea = document.getElementById(
  "systemPrompt"
) as HTMLTextAreaElement;
const userPromptTextarea = document.getElementById(
  "userPrompt"
) as HTMLTextAreaElement;
const difficultySystemPromptTextarea = document.getElementById(
  "difficultySystemPrompt"
) as HTMLTextAreaElement;
const difficultyUserPromptTextarea = document.getElementById(
  "difficultyUserPrompt"
) as HTMLTextAreaElement;
const paraphraseSystemPromptTextarea = document.getElementById(
  "paraphraseSystemPrompt"
) as HTMLTextAreaElement;
const paraphraseUserPromptTextarea = document.getElementById(
  "paraphraseUserPrompt"
) as HTMLTextAreaElement;
const mixedTranslateSystemPromptTextarea = document.getElementById(
  "mixedTranslateSystemPrompt"
) as HTMLTextAreaElement;
const mixedTranslateUserPromptTextarea = document.getElementById(
  "mixedTranslateUserPrompt"
) as HTMLTextAreaElement;

// Settings - 操作
const resetDefaultsBtn = document.getElementById(
  "resetDefaultsBtn"
) as HTMLButtonElement;

// ====== 状态 ======

let currentConfig: LingridConfig = { ...DEFAULT_CONFIG };
let currentMode: ReadingMode = null;

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride] Popup 已加载");

  await loadConfig();
  await loadModeState();

  bindEvents();
  updateBadge();
});

// ====== 配置加载 ======

async function loadConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });

    if (response.success && response.data) {
      currentConfig = response.data;
      updateSettingsForm();
      updateLevelSelector();
    }
  } catch (error) {
    console.error("[Lingride] 加载配置失败:", error);
  }
}

/**
 * 加载当前激活的模式状态
 * 从三个独立状态中确定当前 segmented control 的选中项
 */
async function loadModeState(): Promise<void> {
  try {
    const [translationRes, paraphraseRes, mixedRes] = await Promise.all([
      chrome.runtime.sendMessage({ type: MessageType.GET_TRANSLATION_STATE }),
      chrome.runtime.sendMessage({ type: MessageType.GET_PARAPHRASE_STATE }),
      chrome.runtime.sendMessage({
        type: MessageType.GET_MIXED_TRANSLATE_STATE,
      }),
    ]);

    if (paraphraseRes.success && paraphraseRes.data?.enabled) {
      currentMode = "paraphrase";
    } else if (mixedRes.success && mixedRes.data?.enabled) {
      currentMode = "mixed";
    } else if (translationRes.success && translationRes.data?.enabled) {
      currentMode = "translate";
    } else {
      currentMode = null;
    }

    updateSegmentedControl();
    updateModeDesc();
    updateLevelHint();
  } catch (error) {
    console.error("[Lingride] 加载模式状态失败:", error);
  }
}

// ====== 事件绑定 ======

function bindEvents(): void {
  // 视图切换
  settingsBtn.addEventListener("click", showSettings);
  backBtn.addEventListener("click", showMain);
  configHintBtn.addEventListener("click", showSettings);

  // 模式选择器（事件委托）
  modeSelector.addEventListener("click", handleModeClick);

  // 水平选择器（事件委托）
  levelSelector.addEventListener("click", handleLevelClick);

  // 难度分析
  analyzeDifficultyBtn.addEventListener("click", handleAnalyzeDifficulty);

  // Settings - API 配置自动保存
  apiBaseUrlInput.addEventListener("blur", autoSave);
  apiKeyInput.addEventListener("blur", autoSave);
  modelSelect.addEventListener("change", handleModelChange);
  customModelInput.addEventListener("blur", autoSave);

  // Settings - 显示/隐藏 API Key
  showKeyBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    showKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试连接
  testConnectionBtn.addEventListener("click", testConnection);

  // Settings - Accordion
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", handleAccordionClick);
  });

  // Settings - Prompt 自动保存
  const promptTextareas = [
    systemPromptTextarea,
    userPromptTextarea,
    difficultySystemPromptTextarea,
    difficultyUserPromptTextarea,
    paraphraseSystemPromptTextarea,
    paraphraseUserPromptTextarea,
    mixedTranslateSystemPromptTextarea,
    mixedTranslateUserPromptTextarea,
  ];
  promptTextareas.forEach((textarea) => {
    textarea.addEventListener("blur", autoSave);
  });

  // Settings - 恢复默认
  resetDefaultsBtn.addEventListener("click", resetDefaults);
}

// ====== 视图切换 ======

function showSettings(): void {
  viewport.classList.add("show-settings");
}

function showMain(): void {
  viewport.classList.remove("show-settings");
  updateBadge();
}

// ====== 模式选择器 ======

function handleModeClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(".segment") as HTMLElement;
  if (!target) return;

  const mode = target.dataset.mode as ReadingMode;

  // 可取消选择：点击已选中的段则取消
  if (mode === currentMode) {
    deactivateMode(currentMode);
    currentMode = null;
  } else {
    // 先关闭旧模式，再开启新模式
    if (currentMode) {
      deactivateMode(currentMode);
    }

    // 检查 API Key
    if (!currentConfig.api_key) {
      configHint.style.display = "flex";
      setTimeout(() => {
        configHint.style.display = "none";
      }, 4000);
      currentMode = null;
      updateSegmentedControl();
      updateModeDesc();
      return;
    }

    activateMode(mode);
    currentMode = mode;
  }

  updateSegmentedControl();
  updateModeDesc();
  updateLevelHint();
}

function activateMode(mode: ReadingMode): void {
  if (!mode) return;

  const messageMap: Record<string, string> = {
    paraphrase: MessageType.TOGGLE_PARAPHRASE,
    mixed: MessageType.TOGGLE_MIXED_TRANSLATE,
    translate: MessageType.TOGGLE_TRANSLATION,
  };

  chrome.runtime.sendMessage({
    type: messageMap[mode],
    payload: { enabled: true },
  });
}

function deactivateMode(mode: ReadingMode): void {
  if (!mode) return;

  const messageMap: Record<string, string> = {
    paraphrase: MessageType.TOGGLE_PARAPHRASE,
    mixed: MessageType.TOGGLE_MIXED_TRANSLATE,
    translate: MessageType.TOGGLE_TRANSLATION,
  };

  chrome.runtime.sendMessage({
    type: messageMap[mode],
    payload: { enabled: false },
  });
}

function updateSegmentedControl(): void {
  const segments = modeSelector.querySelectorAll(".segment");
  const modeIndex: Record<string, number> = {
    paraphrase: 0,
    mixed: 1,
    translate: 2,
  };

  // 更新 segment active 状态
  segments.forEach((seg) => {
    const segMode = (seg as HTMLElement).dataset.mode;
    seg.classList.toggle("active", segMode === currentMode);
  });

  // 更新滑动指示器
  if (currentMode) {
    const idx = modeIndex[currentMode];
    segmentIndicator.className = `segment-indicator active pos-${idx}`;
  } else {
    segmentIndicator.className = "segment-indicator";
  }
}

function updateModeDesc(): void {
  if (currentMode && MODE_DESCRIPTIONS[currentMode]) {
    modeDesc.textContent = MODE_DESCRIPTIONS[currentMode];
  } else {
    modeDesc.textContent = MODE_DEFAULT_DESC;
  }
}

// ====== 水平选择器 ======

function handleLevelClick(e: Event): void {
  const target = (e.target as HTMLElement).closest(".pill") as HTMLElement;
  if (!target) return;

  const level = target.dataset.level as CEFRLevel;
  if (!level) return;

  // 更新 UI
  setActiveLevel(level);

  // 更新配置
  currentConfig.user_english_level = level;
  updateLevelHint();

  // 立即保存并刷新模式
  handleEnglishLevelChange(level);
}

function setActiveLevel(level: CEFRLevel): void {
  levelSelector.querySelectorAll(".pill").forEach((pill) => {
    const pillLevel = (pill as HTMLElement).dataset.level;
    pill.classList.toggle("active", pillLevel === level);
  });
}

function updateLevelSelector(): void {
  const level = currentConfig.user_english_level || DEFAULT_USER_ENGLISH_LEVEL;
  setActiveLevel(level);
  updateLevelHint();
}

function updateLevelHint(): void {
  const userLevel = (currentConfig.user_english_level ||
    DEFAULT_USER_ENGLISH_LEVEL) as CEFRLevel;

  if (currentMode === "mixed") {
    const percent = getRetentionPercent(userLevel);
    levelHint.innerHTML = `将保留约 <strong>${percent}%</strong> 英文内容，其余用中文表达`;
  } else {
    const targetLevel = calculateTargetLevel(userLevel);
    levelHint.innerHTML = `目标水平: <strong>${targetLevel}</strong>（略高于您的水平）`;
  }
}

async function handleEnglishLevelChange(_newLevel: CEFRLevel): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: currentConfig,
    });

    if (response.success) {
      // 如果释义已开启，重新触发
      if (currentMode === "paraphrase") {
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_PARAPHRASE,
          payload: { enabled: false },
        });
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_PARAPHRASE,
          payload: { enabled: true },
        });
      }

      // 如果混杂中英已开启，重新触发
      if (currentMode === "mixed") {
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_MIXED_TRANSLATE,
          payload: { enabled: false },
        });
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_MIXED_TRANSLATE,
          payload: { enabled: true },
        });
      }
    }
  } catch (error) {
    console.error("[Lingride] 保存英文水平失败:", error);
  }
}

// ====== Badge 控制 ======

function updateBadge(): void {
  const hasApiKey = !!currentConfig.api_key;
  settingsBadge.style.display = hasApiKey ? "none" : "";
}

// ====== 自动保存 ======

async function autoSave(): Promise<void> {
  collectFormData();

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: currentConfig,
    });

    if (response.success) {
      updateBadge();
    }
  } catch (error) {
    console.error("[Lingride] 自动保存失败:", error);
  }
}

function collectFormData(): void {
  const model =
    modelSelect.value === "custom" ? customModelInput.value : modelSelect.value;

  currentConfig.api_base_url = apiBaseUrlInput.value.trim();
  currentConfig.api_key = apiKeyInput.value.trim();
  currentConfig.model = model.trim();
  currentConfig.prompts = {
    system_prompt: systemPromptTextarea.value,
    user_prompt_template: userPromptTextarea.value,
  };
  currentConfig.difficulty_prompts = {
    system_prompt: difficultySystemPromptTextarea.value,
    user_prompt_template: difficultyUserPromptTextarea.value,
  };
  currentConfig.paraphrase_prompts = {
    system_prompt: paraphraseSystemPromptTextarea.value,
    user_prompt_template: paraphraseUserPromptTextarea.value,
  };
  currentConfig.mixed_translate_prompts = {
    system_prompt: mixedTranslateSystemPromptTextarea.value,
    user_prompt_template: mixedTranslateUserPromptTextarea.value,
  };
}

// ====== Settings 表单更新 ======

function updateSettingsForm(): void {
  // API 配置
  apiBaseUrlInput.value = currentConfig.api_base_url || "";
  apiKeyInput.value = currentConfig.api_key || "";

  // 模型
  const modelValue = currentConfig.model || "deepseek-chat";
  const modelOption = Array.from(modelSelect.options).find(
    (opt) => opt.value === modelValue
  );

  if (modelOption) {
    modelSelect.value = modelValue;
    customModelInput.style.display = "none";
  } else {
    modelSelect.value = "custom";
    customModelInput.value = modelValue;
    customModelInput.style.display = "block";
  }

  // 翻译 Prompt
  systemPromptTextarea.value =
    currentConfig.prompts?.system_prompt || DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value =
    currentConfig.prompts?.user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

  // 难度分析 Prompt
  difficultySystemPromptTextarea.value =
    currentConfig.difficulty_prompts?.system_prompt ||
    DEFAULT_DIFFICULTY_SYSTEM_PROMPT;
  difficultyUserPromptTextarea.value =
    currentConfig.difficulty_prompts?.user_prompt_template ||
    DEFAULT_DIFFICULTY_USER_PROMPT;

  // 释义 Prompt
  paraphraseSystemPromptTextarea.value =
    currentConfig.paraphrase_prompts?.system_prompt ||
    DEFAULT_PARAPHRASE_SYSTEM_PROMPT;
  paraphraseUserPromptTextarea.value =
    currentConfig.paraphrase_prompts?.user_prompt_template ||
    DEFAULT_PARAPHRASE_USER_PROMPT;

  // 混杂中英 Prompt
  mixedTranslateSystemPromptTextarea.value =
    currentConfig.mixed_translate_prompts?.system_prompt ||
    DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT;
  mixedTranslateUserPromptTextarea.value =
    currentConfig.mixed_translate_prompts?.user_prompt_template ||
    DEFAULT_MIXED_TRANSLATE_USER_PROMPT;
}

// ====== 模型选择 ======

function handleModelChange(): void {
  if (modelSelect.value === "custom") {
    customModelInput.style.display = "block";
    customModelInput.focus();
  } else {
    customModelInput.style.display = "none";
    autoSave();
  }
}

// ====== 测试连接 ======

async function testConnection(): Promise<void> {
  testConnectionBtn.textContent = "测试中...";
  testConnectionBtn.style.pointerEvents = "none";
  showStatus(connectionStatus, "正在测试...", "loading");

  try {
    await autoSave();

    const response = await chrome.runtime.sendMessage({
      type: MessageType.TEST_CONNECTION,
    });

    if (response.success && response.data) {
      showStatus(
        connectionStatus,
        `连接成功！延迟: ${response.data.latency}ms`,
        "success"
      );
    } else {
      showStatus(connectionStatus, response.error || "连接失败", "error");
    }
  } catch (error) {
    showStatus(connectionStatus, "测试请求失败", "error");
  } finally {
    testConnectionBtn.textContent = "测试连接";
    testConnectionBtn.style.pointerEvents = "";
  }
}

// ====== Accordion ======

function handleAccordionClick(e: Event): void {
  const header = e.currentTarget as HTMLElement;
  const targetId = header.dataset.accordion;
  if (!targetId) return;

  const body = document.getElementById(targetId);
  if (!body) return;

  const isOpen = body.classList.contains("open");

  // Accordion 模式：关闭所有其他
  document.querySelectorAll(".accordion-body.open").forEach((openBody) => {
    openBody.classList.remove("open");
  });
  document.querySelectorAll(".accordion-header.expanded").forEach((h) => {
    h.classList.remove("expanded");
  });

  // 切换当前项
  if (!isOpen) {
    body.classList.add("open");
    header.classList.add("expanded");
  }
}

// ====== 恢复默认 ======

function resetDefaults(): void {
  // 翻译 Prompt
  systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value = DEFAULT_USER_PROMPT_TEMPLATE;

  // 难度分析 Prompt
  difficultySystemPromptTextarea.value = DEFAULT_DIFFICULTY_SYSTEM_PROMPT;
  difficultyUserPromptTextarea.value = DEFAULT_DIFFICULTY_USER_PROMPT;

  // 释义 Prompt
  paraphraseSystemPromptTextarea.value = DEFAULT_PARAPHRASE_SYSTEM_PROMPT;
  paraphraseUserPromptTextarea.value = DEFAULT_PARAPHRASE_USER_PROMPT;

  // 混杂中英 Prompt
  mixedTranslateSystemPromptTextarea.value =
    DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT;
  mixedTranslateUserPromptTextarea.value = DEFAULT_MIXED_TRANSLATE_USER_PROMPT;

  // 自动保存
  autoSave();

  showStatus(connectionStatus, "已恢复默认设置", "success");
}

// ====== 难度分析 ======

async function handleAnalyzeDifficulty(): Promise<void> {
  analyzeDifficultyBtn.disabled = true;
  analyzeDifficultyBtn.textContent = "分析中...";
  difficultyResult.style.display = "none";
  showStatus(difficultyStatus, "正在分析页面难度...", "loading");

  try {
    const response: AnalyzeDifficultyResponse =
      await chrome.runtime.sendMessage({
        type: MessageType.ANALYZE_DIFFICULTY,
      });

    if (response.success && response.data) {
      difficultyStatus.style.display = "none";
      renderDifficultyResult(response.data);
    } else {
      showStatus(difficultyStatus, response.error || "分析失败", "error");
    }
  } catch (error) {
    console.error("[Lingride] 难度分析失败:", error);
    showStatus(difficultyStatus, "分析请求失败", "error");
  } finally {
    analyzeDifficultyBtn.disabled = false;
    analyzeDifficultyBtn.textContent = "分析当前页面";
  }
}

function renderDifficultyResult(result: DifficultyResult): void {
  difficultyResult.style.display = "block";

  // 难度等级徽章
  const levelClass = result.difficultyLevel.toLowerCase();
  difficultyBadge.textContent = result.difficultyLevel;
  difficultyBadge.className = `difficulty-badge ${levelClass}`;

  // CEFR 徽章
  cefrBadge.textContent = result.cefrLevel;

  // 分数进度条
  scoreProgress.style.width = `${result.score}%`;
  scoreValue.textContent = result.score.toString();

  // 词汇复杂度
  const vocab = result.vocabularyComplexity;
  vocabMetric.textContent = `${vocab.rareWordCount} 罕见词 / ${vocab.academicWordCount} 学术词`;

  // 句子复杂度
  const sentence = result.sentenceComplexity;
  const complexRatio = Math.round(sentence.complexSentenceRatio * 100);
  sentenceMetric.textContent = `平均 ${sentence.avgSentenceLength.toFixed(
    1
  )} 词/句 (${complexRatio}% 复杂)`;

  // 阅读时间
  readingTime.textContent = `${result.estimatedReadingTime} 分钟`;

  // 采样词数
  wordCount.textContent = `${result.sampleWordCount} 词`;

  // 建议列表
  suggestionsList.innerHTML = "";
  for (const suggestion of result.suggestions) {
    const li = document.createElement("li");
    li.textContent = suggestion;
    suggestionsList.appendChild(li);
  }

  // 选中文本提示
  selectionHint.style.display = result.isSelection ? "block" : "none";
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
