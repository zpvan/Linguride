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
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
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

// ====== 状态 ======

let currentConfig: LingridConfig = { ...DEFAULT_CONFIG };
let isTranslationEnabled = false;

// ====== 初始化 ======

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Lingride] Popup 已加载");

  // 加载配置
  await loadConfig();

  // 加载翻译状态
  await loadTranslationState();

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

  // Prompt 配置
  systemPromptTextarea.value =
    currentConfig.prompts?.system_prompt || DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value =
    currentConfig.prompts?.user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;
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
  systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
  userPromptTextarea.value = DEFAULT_USER_PROMPT_TEMPLATE;
  showStatus(connectionStatus, "Prompt 已重置为默认值", "success");
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
