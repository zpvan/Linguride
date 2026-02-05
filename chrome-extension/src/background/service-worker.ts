/**
 * @file service-worker.ts
 * @description Background Service Worker 入口
 *
 * Chrome 扩展的后台服务，负责：
 * - 消息路由：处理 Popup 和 Content Script 的消息
 * - API 调用：通过 Provider 调用翻译 API
 * - 配置管理：读写配置到 Chrome Storage
 * - Tab 状态管理：维护每个 Tab 的翻译状态
 *
 * 消息类型：
 * - GET_CONFIG: 获取配置
 * - SAVE_CONFIG: 保存配置
 * - TOGGLE_TRANSLATION: 开关翻译
 * - GET_TRANSLATION_STATE: 获取翻译状态
 * - TRANSLATE: 翻译请求
 * - TEST_CONNECTION: 测试连接
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { DeepSeekProvider } from "../providers";
import {
  GetConfigResponse,
  GetTranslationStateResponse,
  LingridConfig,
  Message,
  MessageType,
  SaveConfigResponse,
  TestConnectionResponse,
  TranslateResponse,
} from "../types";
import {
  getConfig,
  getProviderConfig,
  isConfigValid,
  saveConfig,
} from "./configManager";
import { getTabState, initTabStateListeners, setTabState } from "./tabState";

// ====== 初始化 ======

console.log("[Lingride] Background Service Worker 已启动");

// 初始化 Tab 状态监听器
initTabStateListeners();

// ====== 消息处理 ======

/**
 * 处理 GET_CONFIG 消息
 *
 * 返回当前存储的配置。
 */
async function handleGetConfig(): Promise<GetConfigResponse> {
  try {
    const config = await getConfig();
    return {
      success: true,
      data: {
        api_base_url: config.api_base_url,
        api_key: config.api_key,
        model: config.model,
        prompts: config.prompts,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取配置失败",
    };
  }
}

/**
 * 处理 SAVE_CONFIG 消息
 *
 * 保存配置到 Chrome Storage。
 */
async function handleSaveConfig(
  payload: LingridConfig
): Promise<SaveConfigResponse> {
  try {
    await saveConfig(payload);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存配置失败",
    };
  }
}

/**
 * 处理 TOGGLE_TRANSLATION 消息
 *
 * 切换指定 Tab 的翻译状态，并通知 Content Script。
 */
async function handleToggleTranslation(
  tabId: number,
  enabled: boolean
): Promise<GetTranslationStateResponse> {
  try {
    // 检查配置是否有效
    const config = await getConfig();
    if (enabled && !isConfigValid(config)) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 更新状态
    setTabState(tabId, enabled);

    // 通知 Content Script
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "TRANSLATION_STATE_CHANGED",
        payload: { enabled },
      });
      console.log("[Lingride] 已通知 Content Script, enabled:", enabled);
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(tabId, {
          type: "TRANSLATION_STATE_CHANGED",
          payload: { enabled },
        });
        console.log("[Lingride] 注入并通知 Content Script 成功");
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面启用翻译，请刷新页面后重试",
        };
      }
    }

    return {
      success: true,
      data: { enabled },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "切换翻译状态失败",
    };
  }
}

/**
 * 处理 GET_TRANSLATION_STATE 消息
 *
 * 返回指定 Tab 的翻译状态。
 */
function handleGetTranslationState(tabId: number): GetTranslationStateResponse {
  const enabled = getTabState(tabId);
  return {
    success: true,
    data: { enabled },
  };
}

/**
 * 处理 TRANSLATE 消息
 *
 * 调用翻译 Provider 进行文本翻译。
 */
async function handleTranslate(
  texts: string[],
  batchId: string
): Promise<TranslateResponse> {
  console.log(
    `[Lingride] 收到翻译请求: batchId=${batchId}, texts=${texts.length}条`
  );

  try {
    // 获取 Provider 配置
    const providerConfig = await getProviderConfig();
    console.log(
      `[Lingride] Provider 配置: baseUrl=${providerConfig.apiBaseUrl}, model=${providerConfig.model}`
    );

    // 验证配置
    if (!providerConfig.apiKey) {
      console.error("[Lingride] API Key 未配置");
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 创建 Provider 并翻译
    console.log("[Lingride] 开始调用 API...");
    const provider = new DeepSeekProvider(providerConfig);
    const translations = await provider.translate(texts);
    console.log(`[Lingride] API 返回成功: ${translations.length}条翻译`);

    return {
      success: true,
      data: {
        batchId,
        translations,
      },
    };
  } catch (error) {
    console.error("[Lingride] 翻译失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "翻译失败",
    };
  }
}

/**
 * 处理 TEST_CONNECTION 消息
 *
 * 测试 API 连接是否正常。
 */
async function handleTestConnection(): Promise<TestConnectionResponse> {
  try {
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    const provider = new DeepSeekProvider(providerConfig);
    const result = await provider.testConnection();

    if (result.success) {
      return {
        success: true,
        data: {
          latency: result.latency,
          model: providerConfig.model,
        },
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "测试连接失败",
    };
  }
}

// ====== 消息路由 ======

/**
 * 消息监听器
 *
 * 接收来自 Popup 和 Content Script 的消息，
 * 分发到对应的处理函数。
 */
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    // 获取发送消息的 Tab ID
    const tabId = sender.tab?.id;

    console.log("[Lingride] 收到消息:", message.type);

    // 异步处理消息
    (async () => {
      let response;

      switch (message.type) {
        case MessageType.GET_CONFIG:
          response = await handleGetConfig();
          break;

        case MessageType.SAVE_CONFIG:
          response = await handleSaveConfig(message.payload as LingridConfig);
          break;

        case MessageType.TOGGLE_TRANSLATION:
          if (tabId === undefined) {
            // 如果是从 Popup 发来的，获取当前活动 Tab
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = await handleToggleTranslation(
                activeTab.id,
                message.payload.enabled
              );
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = await handleToggleTranslation(
              tabId,
              message.payload.enabled
            );
          }
          break;

        case MessageType.GET_TRANSLATION_STATE:
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = handleGetTranslationState(activeTab.id);
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = handleGetTranslationState(tabId);
          }
          break;

        case MessageType.TRANSLATE:
          response = await handleTranslate(
            message.payload.texts,
            message.payload.batchId
          );
          break;

        case MessageType.TEST_CONNECTION:
          response = await handleTestConnection();
          break;

        default:
          response = { success: false, error: "未知消息类型" };
      }

      sendResponse(response);
    })();

    // 返回 true 表示异步发送响应
    return true;
  }
);

// ====== 扩展图标点击 ======

// 点击扩展图标打开 Popup（由 manifest.json 配置处理）
// 此处可添加额外的图标点击逻辑

console.log("[Lingride] 消息路由已就绪");
