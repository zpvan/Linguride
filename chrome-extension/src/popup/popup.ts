/**
 * @file popup.ts
 * @description Popup 逻辑
 *
 * 负责：
 * - 加载和显示配置
 * - 处理用户输入
 * - 保存配置到 Chrome Storage
 * - 测试 API 连接
 * - 控制翻译开关
 *
 * @author Lingride Team
 * @since 1.0.0
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

// ====== DOM 元素引用 ======

// 翻译开关
const toggleSwitch = document.getElementById(
  "translationToggle"
) as HTMLInputElement;

// 配置警告
const configWarning = document.getElementById("configWarning") as HTMLElement;

// API 配置表单
const apiBaseUrlInput = document.getElementById(
  "apiBaseUrl"
) as HTMLInputElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const showKeyBtn = document.getElementById("showKeyBtn") as HTMLButtonElement;
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
const customModelInput = document.getElementById(
  "customModel"
) as HTMLInputElement;

// 测试连接
const testConnectionBtn = document.getElementById(
  "testConnectionBtn"
) as HTMLButtonElement;
const connectionStatus = document.getElementById(
  "connectionStatus"
) as HTMLElement;

// 高级设置
const advancedToggle = document.getElementById(
  "advancedToggle"
) as HTMLButtonElement;
const advancedContent = document.getElementById(
  "advancedContent"
) as HTMLElement;
const systemPromptTextarea = document.getElementById(
  "systemPrompt"
) as HTMLTextAreaElement;
const userPromptTextarea = document.getElementById(
  "userPrompt"
) as HTMLTextAreaElement;

// 操作按钮
const resetDefaultsBtn = document.getElementById(
  "resetDefaultsBtn"
) as HTMLButtonElement;
const saveSettingsBtn = document.getElementById(
  "saveSettingsBtn"
) as HTMLButtonElement;

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

// 难度分析 Prompt
const difficultySystemPromptTextarea = document.getElementById(
  "difficultySystemPrompt"
) as HTMLTextAreaElement;
const difficultyUserPromptTextarea = document.getElementById(
  "difficultyUserPrompt"
) as HTMLTextAreaElement;

// 英文水平
const englishLevelSelect = document.getElementById(
  "englishLevel"
) as HTMLSelectElement;
const levelHint = document.getElementById("levelHint") as HTMLElement;

// 释义开关
const paraphraseToggle = document.getElementById(
  "paraphraseToggle"
) as HTMLInputElement;
const paraphraseStatus = document.getElementById(
  "paraphraseStatus"
) as HTMLElement;

// 释义 Prompt
const paraphraseSystemPromptTextarea = document.getElementById(
  "paraphraseSystemPrompt"
) as HTMLTextAreaElement;
const paraphraseUserPromptTextarea = document.getElementById(
  "paraphraseUserPrompt"
) as HTMLTextAreaElement;

// 混杂中英开关
const mixedTranslateToggle = document.getElementById(
  "mixedTranslateToggle"
) as HTMLInputElement;
const mixedTranslateStatus = document.getElementById(
  "mixedTranslateStatus"
) as HTMLElement;

// 混杂中英 Prompt
const mixedTranslateSystemPromptTextarea = document.getElementById(
  "mixedTranslateSystemPrompt"
) as HTMLTextAreaElement;
const mixedTranslateUserPromptTextarea = document.getElementById(
  "mixedTranslateUserPrompt"
) as HTMLTextAreaElement;

// ====== 状态 ======

let currentConfig: LingridConfig = { ...DEFAULT_CONFIG };
let isTranslationEnabled = false;
let isParaphraseEnabled = false;
let isMixedTranslateEnabled = false;

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride] Popup 已加载");

  // 加载配置
  await loadConfig();

  // 加载翻译、释义和混杂中英状态
  await Promise.all([
    loadTranslationState(),
    loadParaphraseState(),
    loadMixedTranslateState(),
  ]);

  // 绑定事件
  bindEvents();
});

// ====== 配置加载 ======

/**
 * 从 Background 加载配置
 */
async function loadConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });

    if (response.success && response.data) {
      currentConfig = response.data;
      updateFormFromConfig();
      updateConfigWarning();
    }
  } catch (error) {
    console.error("[Lingride] 加载配置失败:", error);
    showStatus(connectionStatus, "加载配置失败", "error");
  }
}

/**
 * 从配置更新表单
 */
function updateFormFromConfig(): void {
  // API 配置
  apiBaseUrlInput.value = currentConfig.api_base_url || "";
  apiKeyInput.value = currentConfig.api_key || "";

  // 模型选择
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

  // 翻译 Prompt 配置
  systemPromptTextarea.value =
    currentConfig.prompts?.system_prompt || DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value =
    currentConfig.prompts?.user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

  // 难度分析 Prompt 配置
  difficultySystemPromptTextarea.value =
    currentConfig.difficulty_prompts?.system_prompt ||
    DEFAULT_DIFFICULTY_SYSTEM_PROMPT;
  difficultyUserPromptTextarea.value =
    currentConfig.difficulty_prompts?.user_prompt_template ||
    DEFAULT_DIFFICULTY_USER_PROMPT;

  // 英文水平配置
  const userLevel =
    currentConfig.user_english_level || DEFAULT_USER_ENGLISH_LEVEL;
  englishLevelSelect.value = userLevel;
  updateLevelHint(userLevel);

  // 释义 Prompt 配置
  paraphraseSystemPromptTextarea.value =
    currentConfig.paraphrase_prompts?.system_prompt ||
    DEFAULT_PARAPHRASE_SYSTEM_PROMPT;
  paraphraseUserPromptTextarea.value =
    currentConfig.paraphrase_prompts?.user_prompt_template ||
    DEFAULT_PARAPHRASE_USER_PROMPT;

  // 混杂中英 Prompt 配置
  mixedTranslateSystemPromptTextarea.value =
    currentConfig.mixed_translate_prompts?.system_prompt ||
    DEFAULT_MIXED_TRANSLATE_SYSTEM_PROMPT;
  mixedTranslateUserPromptTextarea.value =
    currentConfig.mixed_translate_prompts?.user_prompt_template ||
    DEFAULT_MIXED_TRANSLATE_USER_PROMPT;
}

/**
 * 更新配置警告显示
 */
function updateConfigWarning(): void {
  const hasApiKey = !!currentConfig.api_key;
  configWarning.style.display = hasApiKey ? "none" : "flex";
}

// ====== 翻译状态 ======

/**
 * 加载翻译状态
 */
async function loadTranslationState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_TRANSLATION_STATE,
    });

    if (response.success && response.data) {
      isTranslationEnabled = response.data.enabled;
      toggleSwitch.checked = isTranslationEnabled;
    }
  } catch (error) {
    console.error("[Lingride] 加载翻译状态失败:", error);
  }
}

/**
 * 切换翻译状态
 *
 * 翻译与释义互斥：开启翻译时自动关闭释义
 */
async function toggleTranslation(): Promise<void> {
  const enabled = toggleSwitch.checked;

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.TOGGLE_TRANSLATION,
      payload: { enabled },
    });

    if (response.success) {
      isTranslationEnabled = enabled;

      // 互斥：开启翻译时关闭释义和混杂中英
      if (enabled && isParaphraseEnabled) {
        isParaphraseEnabled = false;
        paraphraseToggle.checked = false;
      }
      if (enabled && isMixedTranslateEnabled) {
        isMixedTranslateEnabled = false;
        mixedTranslateToggle.checked = false;
      }
    } else {
      // 恢复开关状态
      toggleSwitch.checked = isTranslationEnabled;
      showStatus(connectionStatus, response.error || "切换失败", "error");
    }
  } catch (error) {
    toggleSwitch.checked = isTranslationEnabled;
    showStatus(connectionStatus, "切换翻译状态失败", "error");
  }
}

// ====== 事件绑定 ======

function bindEvents(): void {
  // 翻译开关
  toggleSwitch.addEventListener("change", toggleTranslation);

  // 释义开关
  paraphraseToggle.addEventListener("change", toggleParaphrase);

  // 混杂中英开关
  mixedTranslateToggle.addEventListener("change", toggleMixedTranslate);

  // 英文水平选择（立即保存）
  englishLevelSelect.addEventListener("change", handleEnglishLevelChange);

  // 显示/隐藏 API Key
  showKeyBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    showKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // 模型选择
  modelSelect.addEventListener("change", () => {
    if (modelSelect.value === "custom") {
      customModelInput.style.display = "block";
      customModelInput.focus();
    } else {
      customModelInput.style.display = "none";
    }
  });

  // 测试连接
  testConnectionBtn.addEventListener("click", testConnection);

  // 高级设置折叠
  advancedToggle.addEventListener("click", () => {
    const isCollapsed = advancedContent.classList.toggle("collapsed");
    advancedToggle.classList.toggle("expanded", !isCollapsed);
  });

  // 重置默认值
  resetDefaultsBtn.addEventListener("click", resetDefaults);

  // 保存设置
  saveSettingsBtn.addEventListener("click", () => saveSettings());

  // 难度分析
  analyzeDifficultyBtn.addEventListener("click", handleAnalyzeDifficulty);
}

// ====== 功能实现 ======

/**
 * 测试 API 连接
 */
async function testConnection(): Promise<void> {
  testConnectionBtn.disabled = true;
  testConnectionBtn.textContent = "测试中...";
  showStatus(connectionStatus, "正在测试...", "loading");

  try {
    // 先保存当前表单配置
    await saveSettings(false);

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
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = "测试连接";
  }
}

/**
 * 重置为默认值
 */
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

  showStatus(connectionStatus, "所有 Prompt 已重置为默认值", "success");
}

/**
 * 保存设置
 */
async function saveSettings(showMessage = true): Promise<void> {
  // 收集表单数据
  const model =
    modelSelect.value === "custom" ? customModelInput.value : modelSelect.value;

  const config: LingridConfig = {
    api_base_url: apiBaseUrlInput.value.trim(),
    api_key: apiKeyInput.value.trim(),
    model: model.trim(),
    prompts: {
      system_prompt: systemPromptTextarea.value,
      user_prompt_template: userPromptTextarea.value,
    },
    difficulty_prompts: {
      system_prompt: difficultySystemPromptTextarea.value,
      user_prompt_template: difficultyUserPromptTextarea.value,
    },
    user_english_level: englishLevelSelect.value as CEFRLevel,
    paraphrase_prompts: {
      system_prompt: paraphraseSystemPromptTextarea.value,
      user_prompt_template: paraphraseUserPromptTextarea.value,
    },
    mixed_translate_prompts: {
      system_prompt: mixedTranslateSystemPromptTextarea.value,
      user_prompt_template: mixedTranslateUserPromptTextarea.value,
    },
  };

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: config,
    });

    if (response.success) {
      currentConfig = config;
      updateConfigWarning();
      if (showMessage) {
        showStatus(connectionStatus, "设置已保存", "success");
      }
    } else {
      if (showMessage) {
        showStatus(connectionStatus, response.error || "保存失败", "error");
      }
    }
  } catch (error) {
    if (showMessage) {
      showStatus(connectionStatus, "保存设置失败", "error");
    }
  }
}

// ====== 辅助函数 ======

/**
 * 显示状态消息
 */
function showStatus(
  element: HTMLElement,
  message: string,
  type: "success" | "error" | "loading"
): void {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = "block";

  // 成功消息 3 秒后自动隐藏
  if (type === "success") {
    setTimeout(() => {
      element.style.display = "none";
    }, 3000);
  }
}

// ====== 难度分析 ======

/**
 * 处理难度分析按钮点击
 */
async function handleAnalyzeDifficulty(): Promise<void> {
  // 禁用按钮，显示加载状态
  analyzeDifficultyBtn.disabled = true;
  analyzeDifficultyBtn.innerHTML = '<span class="btn-icon">⏳</span> 分析中...';
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
    analyzeDifficultyBtn.innerHTML =
      '<span class="btn-icon">📊</span> 分析当前页面';
  }
}

/**
 * 渲染难度分析结果
 */
function renderDifficultyResult(result: DifficultyResult): void {
  // 显示结果卡片
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
  if (result.isSelection) {
    selectionHint.style.display = "block";
  } else {
    selectionHint.style.display = "none";
  }
}

// ====== 释义功能 ======

/**
 * 加载释义状态
 */
async function loadParaphraseState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_PARAPHRASE_STATE,
    });

    if (response.success && response.data) {
      isParaphraseEnabled = response.data.enabled;
      paraphraseToggle.checked = isParaphraseEnabled;
    }
  } catch (error) {
    console.error("[Lingride] 加载释义状态失败:", error);
  }
}

/**
 * 切换释义状态
 *
 * 释义与翻译互斥：开启释义时自动关闭翻译
 */
async function toggleParaphrase(): Promise<void> {
  const enabled = paraphraseToggle.checked;

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.TOGGLE_PARAPHRASE,
      payload: { enabled },
    });

    if (response.success) {
      isParaphraseEnabled = enabled;

      // 互斥：开启释义时关闭翻译和混杂中英
      if (enabled && isTranslationEnabled) {
        isTranslationEnabled = false;
        toggleSwitch.checked = false;
      }
      if (enabled && isMixedTranslateEnabled) {
        isMixedTranslateEnabled = false;
        mixedTranslateToggle.checked = false;
      }
    } else {
      // 恢复开关状态
      paraphraseToggle.checked = isParaphraseEnabled;
      showStatus(paraphraseStatus, response.error || "切换失败", "error");
    }
  } catch (error) {
    paraphraseToggle.checked = isParaphraseEnabled;
    showStatus(paraphraseStatus, "切换释义状态失败", "error");
  }
}

/**
 * 处理英文水平变化
 *
 * 立即保存配置，更新提示，如果释义已开启则触发重新释义
 */
async function handleEnglishLevelChange(): Promise<void> {
  const newLevel = englishLevelSelect.value as CEFRLevel;

  // 更新提示
  updateLevelHint(newLevel);

  // 更新配置
  currentConfig.user_english_level = newLevel;

  // 立即保存
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_CONFIG,
      payload: currentConfig,
    });

    if (response.success) {
      // 如果释义已开启，需要重新开始释义（清除旧内容）
      if (isParaphraseEnabled) {
        // 先关闭再开启，触发清理和重新释义
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_PARAPHRASE,
          payload: { enabled: false },
        });
        await chrome.runtime.sendMessage({
          type: MessageType.TOGGLE_PARAPHRASE,
          payload: { enabled: true },
        });
      }

      // 如果混杂中英已开启，需要重新开始（清除旧内容）
      if (isMixedTranslateEnabled) {
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

/**
 * 更新水平提示
 *
 * 根据当前活跃模式显示不同的提示：
 * - 混杂中英开启时：显示英文保留百分比
 * - 释义开启时：显示目标等级
 * - 默认：显示目标等级
 */
function updateLevelHint(userLevel: CEFRLevel): void {
  if (isMixedTranslateEnabled) {
    const percent = getRetentionPercent(userLevel);
    levelHint.innerHTML = `💡 将保留约 <strong>${percent}%</strong> 英文内容，其余用中文表达`;
  } else {
    const targetLevel = calculateTargetLevel(userLevel);
    levelHint.innerHTML = `💡 内容将改写为 <strong>${targetLevel}</strong> 水平（略高于您的水平）`;
  }
}

// ====== 混杂中英翻译功能 ======

/**
 * 加载混杂中英翻译状态
 */
async function loadMixedTranslateState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_MIXED_TRANSLATE_STATE,
    });

    if (response.success && response.data) {
      isMixedTranslateEnabled = response.data.enabled;
      mixedTranslateToggle.checked = isMixedTranslateEnabled;
    }
  } catch (error) {
    console.error("[Lingride] 加载混杂中英翻译状态失败:", error);
  }
}

/**
 * 切换混杂中英翻译状态
 *
 * 三模式互斥：开启混杂中英时自动关闭翻译和释义
 */
async function toggleMixedTranslate(): Promise<void> {
  const enabled = mixedTranslateToggle.checked;

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.TOGGLE_MIXED_TRANSLATE,
      payload: { enabled },
    });

    if (response.success) {
      isMixedTranslateEnabled = enabled;

      // 互斥：开启混杂中英时关闭翻译和释义
      if (enabled && isTranslationEnabled) {
        isTranslationEnabled = false;
        toggleSwitch.checked = false;
      }
      if (enabled && isParaphraseEnabled) {
        isParaphraseEnabled = false;
        paraphraseToggle.checked = false;
      }

      // 更新水平提示以反映当前模式
      const userLevel =
        currentConfig.user_english_level || DEFAULT_USER_ENGLISH_LEVEL;
      updateLevelHint(userLevel as CEFRLevel);
    } else {
      // 恢复开关状态
      mixedTranslateToggle.checked = isMixedTranslateEnabled;
      showStatus(mixedTranslateStatus, response.error || "切换失败", "error");
    }
  } catch (error) {
    mixedTranslateToggle.checked = isMixedTranslateEnabled;
    showStatus(mixedTranslateStatus, "切换混杂中英翻译状态失败", "error");
  }
}
