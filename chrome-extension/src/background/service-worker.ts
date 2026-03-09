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
 * - GET_CONFIG / SAVE_CONFIG: 配置读写
 * - TOGGLE_TRANSLATION / GET_TRANSLATION_STATE / TRANSLATE: 双语翻译
 * - TOGGLE_PARAPHRASE / GET_PARAPHRASE_STATE / PARAPHRASE: 英文释义
 * - TOGGLE_MIXED_TRANSLATE / GET_MIXED_TRANSLATE_STATE / MIXED_TRANSLATE: 混杂中英翻译
 * - TEST_CONNECTION: 测试连接
 * - ANALYZE_DIFFICULTY / EXTRACT_PAGE_TEXT: 难度分析
 * - ANALYZE_SENTENCE: 长难句分析
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { DEFAULT_DIFFICULTY_PROMPTS } from "../constants/difficultyPrompts";
import { DEFAULT_MIXED_TRANSLATE_PROMPTS } from "../constants/mixedTranslatePrompts";
import { DEFAULT_PARAPHRASE_PROMPTS } from "../constants/paraphrasePrompts";
import { DEFAULT_PRONUNCIATION_PROMPTS } from "../constants/pronunciationPrompts";
import { DEFAULT_SENTENCE_ANALYSIS_PROMPTS } from "../constants/sentenceAnalysisPrompts";
import {
  SHADOW_ASSESS_PROMPTS,
  SPLIT_SENTENCES_PROMPTS,
} from "../constants/shadowPrompts";
import {
  CHINESE_TO_ENGLISH_PROMPTS,
  ENGLISH_DEFINITION_PROMPTS,
  ENGLISH_TO_CHINESE_PROMPTS,
} from "../constants/tutorPrompts";
import {
  ANALYZE_LISTENING_PROMPTS,
  SEGMENT_CORPUS_PROMPTS,
} from "../constants/corpusPrompts";
import { DeepSeekProvider } from "../providers";
import {
  AlibabaASRStartResponse,
  AlibabaASRStopResponse,
  AnalyzeDifficultyResponse,
  AnalyzeListeningResponse,
  AnalyzeSentenceResponse,
  AssessPronunciationResponse,
  calculateTargetLevel,
  CEFRLevel,
  ChineseToEnglishResponse,
  DifficultyResult,
  EnglishDefinitionResponse,
  EnglishDefinitionResult,
  EnglishToChineseResponse,
  ExtractPageTextResponse,
  GetConfigResponse,
  GetMixedTranslateStateResponse,
  GetParaphraseStateResponse,
  getRetentionPercent,
  GetTranslationStateResponse,
  LingridConfig,
  ListeningAnalysisResult,
  Message,
  MessageType,
  MixedTranslateResponse,
  ParaphraseResponse,
  PronunciationAssessmentResult,
  SaveConfigResponse,
  SegmentCorpusResponse,
  SegmentCorpusResult,
  SentenceAnalysisResult,
  ShadowAssessmentResult,
  ShadowAssessResponse,
  SplitSentencesResponse,
  SplitSentencesResult,
  TencentASRSignResponse,
  TestConnectionResponse,
  TranslateResponse,
} from "../types";
import {
  getConfig,
  getProviderConfig,
  isConfigValid,
  saveConfig,
} from "./configManager";
import {
  getMixedTranslateState,
  getParaphraseState,
  getTabState,
  initTabStateListeners,
  setMixedTranslateState,
  setParaphraseState,
  setTabState,
} from "./tabState";

// ====== 初始化 ======

console.log("[Lingride] Background Service Worker 已启动");

// 初始化 Tab 状态监听器
initTabStateListeners();

// ====== 消息处理 ======

/**
 * 处理 GET_CONFIG 消息
 *
 * 返回当前存储的完整配置。
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
        user_english_level: config.user_english_level,
        difficulty_prompts: config.difficulty_prompts,
        paraphrase_prompts: config.paraphrase_prompts,
        mixed_translate_prompts: config.mixed_translate_prompts,
        sentence_analysis_prompts: config.sentence_analysis_prompts,
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
      await chrome.tabs.sendMessage(
        tabId,
        {
          type: "TRANSLATION_STATE_CHANGED",
          payload: { enabled },
        },
        { frameId: 0 }
      );
      console.log("[Lingride] 已通知 Content Script, enabled:", enabled);
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(
          tabId,
          {
            type: "TRANSLATION_STATE_CHANGED",
            payload: { enabled },
          },
          { frameId: 0 }
        );
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

/**
 * 处理 ANALYZE_DIFFICULTY 消息
 *
 * 分析当前页面的英文难度级别。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取当前 Tab
 * 3. 向 Content Script 发送提取文本请求
 * 4. 调用 AI 进行难度分析
 * 5. 解析并返回结果
 */
async function handleAnalyzeDifficulty(): Promise<AnalyzeDifficultyResponse> {
  try {
    // 1. 获取配置并验证
    const config = await getConfig();
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 获取当前活动 Tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab?.id) {
      return {
        success: false,
        error: "无法获取当前 Tab",
      };
    }

    const tabId = activeTab.id;

    // 3. 向 Content Script 发送提取文本请求
    let extractResponse: ExtractPageTextResponse;

    try {
      extractResponse = await chrome.tabs.sendMessage(
        tabId,
        {
          type: MessageType.EXTRACT_PAGE_TEXT,
        },
        { frameId: 0 }
      );
    } catch (e) {
      // Content Script 未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        extractResponse = await chrome.tabs.sendMessage(
          tabId,
          {
            type: MessageType.EXTRACT_PAGE_TEXT,
          },
          { frameId: 0 }
        );
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面分析难度（可能是浏览器内置页面）",
        };
      }
    }

    if (!extractResponse.success || !extractResponse.data) {
      return {
        success: false,
        error: extractResponse.error || "无法提取页面文本",
      };
    }

    const { text, wordCount, isSelection } = extractResponse.data;
    console.log(
      `[Lingride] 提取文本成功: ${wordCount} 词, 选中文本: ${isSelection}`
    );

    // 4. 获取 Prompt 配置（用户自定义或默认）
    const prompts = config.difficulty_prompts || DEFAULT_DIFFICULTY_PROMPTS;
    const userPrompt = prompts.user_prompt_template.replace("{text}", text);

    // 5. 调用 AI 进行分析
    console.log("[Lingride] 开始难度分析...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 6. 解析 JSON 响应
    let result: DifficultyResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 添加额外信息
    result.sampleWordCount = wordCount;
    result.isSelection = isSelection;

    console.log("[Lingride] 难度分析完成:", result.difficultyLevel);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 难度分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "难度分析失败",
    };
  }
}

// ====== 释义功能 ======

/**
 * 处理 TOGGLE_PARAPHRASE 消息
 *
 * 切换指定 Tab 的释义状态，并通知 Content Script。
 * 释义与翻译互斥。
 */
async function handleToggleParaphrase(
  tabId: number,
  enabled: boolean
): Promise<GetParaphraseStateResponse> {
  try {
    // 检查配置是否有效
    const config = await getConfig();
    if (enabled && !isConfigValid(config)) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 更新状态（TabState 内部处理互斥逻辑）
    setParaphraseState(tabId, enabled);

    // 获取用户等级（用于缓存键）
    const userLevel = config.user_english_level || "A2";

    // 通知 Content Script（附带用户等级）
    try {
      await chrome.tabs.sendMessage(
        tabId,
        {
          type: "PARAPHRASE_STATE_CHANGED",
          payload: { enabled, userLevel },
        },
        { frameId: 0 }
      );
      console.log(
        "[Lingride] 已通知 Content Script 释义状态, enabled:",
        enabled,
        ", userLevel:",
        userLevel
      );
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(
          tabId,
          {
            type: "PARAPHRASE_STATE_CHANGED",
            payload: { enabled, userLevel },
          },
          { frameId: 0 }
        );
        console.log("[Lingride] 注入并通知 Content Script 成功");
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面启用释义，请刷新页面后重试",
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
      error: error instanceof Error ? error.message : "切换释义状态失败",
    };
  }
}

/**
 * 处理 GET_PARAPHRASE_STATE 消息
 *
 * 返回指定 Tab 的释义状态。
 */
function handleGetParaphraseState(tabId: number): GetParaphraseStateResponse {
  const enabled = getParaphraseState(tabId);
  return {
    success: true,
    data: { enabled },
  };
}

/**
 * 处理 PARAPHRASE 消息
 *
 * 调用 AI 将英文文本改写为适合用户水平的版本。
 * 使用批量处理模式，与翻译功能类似。
 */
async function handleParaphrase(
  texts: string[],
  batchId: string
): Promise<ParaphraseResponse> {
  console.log(
    `[Lingride] 收到释义请求: batchId=${batchId}, texts=${texts.length}条`
  );

  try {
    // 获取配置
    const config = await getConfig();
    const providerConfig = await getProviderConfig();

    // 验证配置
    if (!providerConfig.apiKey) {
      console.error("[Lingride] API Key 未配置");
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 获取用户水平和目标水平
    const userLevel = config.user_english_level || "A2";
    const targetLevel = calculateTargetLevel(userLevel);
    console.log(`[Lingride] 用户水平: ${userLevel}, 目标水平: ${targetLevel}`);

    // 获取 Prompt 配置
    const prompts = config.paraphrase_prompts || DEFAULT_PARAPHRASE_PROMPTS;

    // 构建批量文本（编号格式）
    const numberedTexts = texts
      .map((text, index) => `${index + 1}---\n${text}\n---`)
      .join("\n\n");

    // 构建 User Prompt
    const userPrompt = prompts.user_prompt_template
      .replace("{{texts}}", numberedTexts)
      .replace(/\{\{user_level\}\}/g, userLevel)
      .replace(/\{\{target_level\}\}/g, targetLevel);

    // 调用 AI
    console.log("[Lingride] 开始调用释义 API...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 解析响应（编号格式）
    const paraphrases = parseNumberedResponse(aiResponse, texts.length);
    console.log(`[Lingride] 释义完成: ${paraphrases.length}条`);

    return {
      success: true,
      data: {
        batchId,
        paraphrases,
      },
    };
  } catch (error) {
    console.error("[Lingride] 释义失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "释义失败",
    };
  }
}

/**
 * 解析编号格式的响应
 *
 * 响应格式：NUMBER---content---
 */
function parseNumberedResponse(
  response: string,
  expectedCount: number
): string[] {
  const results: string[] = [];

  // 尝试匹配编号格式
  const pattern = /(\d+)---\s*([\s\S]*?)\s*---/g;
  let match;

  while ((match = pattern.exec(response)) !== null) {
    const index = parseInt(match[1], 10) - 1;
    const content = match[2].trim();
    if (index >= 0 && index < expectedCount) {
      results[index] = content;
    }
  }

  // 检查是否所有条目都已解析
  if (results.filter(Boolean).length === expectedCount) {
    return results;
  }

  // 备用方案：按段落分割
  console.warn("[Lingride] 编号格式解析失败，尝试按段落分割");
  const paragraphs = response
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // 清理可能的序号前缀
  return paragraphs.slice(0, expectedCount).map((p) => {
    // 移除可能的序号前缀，如 "1. " 或 "1) " 或 "1---"
    return p.replace(/^\d+[\.\)\-]+\s*/, "").trim();
  });
}

// ====== 混杂中英翻译功能 ======

/**
 * 处理 TOGGLE_MIXED_TRANSLATE 消息
 *
 * 切换指定 Tab 的混杂中英翻译状态，并通知 Content Script。
 * 混杂中英与翻译、释义三者互斥。
 */
async function handleToggleMixedTranslate(
  tabId: number,
  enabled: boolean
): Promise<GetMixedTranslateStateResponse> {
  try {
    // 检查配置是否有效
    const config = await getConfig();
    if (enabled && !isConfigValid(config)) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 更新状态（TabState 内部处理互斥逻辑）
    setMixedTranslateState(tabId, enabled);

    // 获取用户等级（用于缓存键）
    const userLevel = config.user_english_level || "A2";

    // 通知 Content Script（附带用户等级）
    try {
      await chrome.tabs.sendMessage(
        tabId,
        {
          type: "MIXED_TRANSLATE_STATE_CHANGED",
          payload: { enabled, userLevel },
        },
        { frameId: 0 }
      );
      console.log(
        "[Lingride] 已通知 Content Script 混杂中英状态, enabled:",
        enabled,
        ", userLevel:",
        userLevel
      );
    } catch (e) {
      // Content Script 可能未加载，尝试注入
      console.warn("[Lingride] Content Script 未加载，尝试注入...");

      try {
        // 尝试注入 Content Script
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["src/content/index.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: true },
          files: ["src/content/styles.css"],
        });

        // 等待脚本加载后重新发送消息
        await new Promise((resolve) => setTimeout(resolve, 100));
        await chrome.tabs.sendMessage(
          tabId,
          {
            type: "MIXED_TRANSLATE_STATE_CHANGED",
            payload: { enabled, userLevel },
          },
          { frameId: 0 }
        );
        console.log("[Lingride] 注入并通知 Content Script 成功");
      } catch (injectError) {
        console.error("[Lingride] 注入 Content Script 失败:", injectError);
        return {
          success: false,
          error: "无法在此页面启用混杂中英翻译，请刷新页面后重试",
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
      error:
        error instanceof Error ? error.message : "切换混杂中英翻译状态失败",
    };
  }
}

/**
 * 处理 GET_MIXED_TRANSLATE_STATE 消息
 *
 * 返回指定 Tab 的混杂中英翻译状态。
 */
function handleGetMixedTranslateState(
  tabId: number
): GetMixedTranslateStateResponse {
  const enabled = getMixedTranslateState(tabId);
  return {
    success: true,
    data: { enabled },
  };
}

/**
 * 处理 MIXED_TRANSLATE 消息
 *
 * 调用 AI 将英文文本转换为中英混杂文本。
 * 根据用户 CEFR 等级动态调整英文保留比例。
 * 使用批量处理模式，与翻译/释义功能类似。
 */
async function handleMixedTranslate(
  texts: string[],
  batchId: string
): Promise<MixedTranslateResponse> {
  console.log(
    `[Lingride] 收到混杂中英翻译请求: batchId=${batchId}, texts=${texts.length}条`
  );

  try {
    // 获取配置
    const config = await getConfig();
    const providerConfig = await getProviderConfig();

    // 验证配置
    if (!providerConfig.apiKey) {
      console.error("[Lingride] API Key 未配置");
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 获取用户水平和保留比例
    const userLevel = config.user_english_level || "A2";
    const retentionPercent = getRetentionPercent(userLevel);
    console.log(
      `[Lingride] 用户水平: ${userLevel}, 英文保留比例: ${retentionPercent}%`
    );

    // 获取 Prompt 配置
    const prompts =
      config.mixed_translate_prompts || DEFAULT_MIXED_TRANSLATE_PROMPTS;

    // 构建批量文本（编号格式）
    const numberedTexts = texts
      .map((text, index) => `${index + 1}---\n${text}\n---`)
      .join("\n\n");

    // 构建 User Prompt
    const userPrompt = prompts.user_prompt_template
      .replace("{{texts}}", numberedTexts)
      .replace(/\{\{user_level\}\}/g, userLevel)
      .replace(/\{\{retention_percent\}\}/g, retentionPercent.toString());

    // 调用 AI
    console.log("[Lingride] 开始调用混杂中英翻译 API...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 解析响应（编号格式）
    const mixedTexts = parseNumberedResponse(aiResponse, texts.length);
    console.log(`[Lingride] 混杂中英翻译完成: ${mixedTexts.length}条`);

    return {
      success: true,
      data: {
        batchId,
        mixedTexts,
      },
    };
  } catch (error) {
    console.error("[Lingride] 混杂中英翻译失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "混杂中英翻译失败",
    };
  }
}

// ====== 长难句分析功能 ======

/**
 * 处理 ANALYZE_SENTENCE 消息
 *
 * 对用户输入的英文长难句进行结构化分析。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置（用户自定义或默认）
 * 3. 替换 {{sentence}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleAnalyzeSentence(
  sentence: string
): Promise<AnalyzeSentenceResponse> {
  try {
    // 1. 获取配置并验证
    const config = await getConfig();
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 获取 Prompt 配置（用户自定义或默认）
    const prompts =
      config.sentence_analysis_prompts || DEFAULT_SENTENCE_ANALYSIS_PROMPTS;
    const userPrompt = prompts.user_prompt_template.replace(
      "{{sentence}}",
      sentence
    );

    // 3. 调用 AI 进行分析
    console.log("[Lingride] 开始长难句分析...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 4. 解析 JSON 响应（三级 fallback 策略）
    let result: SentenceAnalysisResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    console.log("[Lingride] 长难句分析完成");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 长难句分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "长难句分析失败",
    };
  }
}

// ====== 发音评估功能 ======

/**
 * 处理 ASSESS_PRONUNCIATION 消息
 *
 * 对比用户的口语发音（语音识别文本）与原文，给出评估和改进建议。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置
 * 3. 替换 {{original}} 和 {{recognized}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleAssessPronunciation(
  original: string,
  recognized: string
): Promise<AssessPronunciationResponse> {
  try {
    // 1. 获取配置并验证
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 获取 Prompt 配置
    const prompts = DEFAULT_PRONUNCIATION_PROMPTS;
    const userPrompt = prompts.user_prompt_template
      .replace("{{original}}", original)
      .replace("{{recognized}}", recognized);

    // 3. 调用 AI 进行分析
    console.log("[Lingride] 开始发音评估...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(prompts.system_prompt, userPrompt);

    // 4. 解析 JSON 响应（三级 fallback 策略）
    let result: PronunciationAssessmentResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    console.log("[Lingride] 发音评估完成, score:", result.score);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 发音评估失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "发音评估失败",
    };
  }
}

// ====== 外教助手功能 ======

/**
 * 处理中译英请求
 *
 * 调用 AI 将中文文本翻译成英文。
 */
async function handleChineseToEnglish(
  text: string
): Promise<ChineseToEnglishResponse> {
  try {
    // 1. 获取 Provider 配置
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 构建 Prompt
    const userPrompt = CHINESE_TO_ENGLISH_PROMPTS.user_prompt_template.replace(
      "{{text}}",
      text
    );

    // 3. 调用 AI
    console.log("[Lingride] 开始中译英...");
    const provider = new DeepSeekProvider(providerConfig);
    const translation = await provider.chat(
      CHINESE_TO_ENGLISH_PROMPTS.system_prompt,
      userPrompt
    );

    console.log("[Lingride] 中译英完成");

    return {
      success: true,
      data: { translation: translation.trim() },
    };
  } catch (error) {
    console.error("[Lingride] 中译英失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "中译英失败",
    };
  }
}

/**
 * 处理英译中请求
 *
 * 调用 AI 将英文文本翻译成中文。
 */
async function handleEnglishToChinese(
  text: string
): Promise<EnglishToChineseResponse> {
  try {
    // 1. 获取 Provider 配置
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 构建 Prompt
    const userPrompt = ENGLISH_TO_CHINESE_PROMPTS.user_prompt_template.replace(
      "{{text}}",
      text
    );

    // 3. 调用 AI
    console.log("[Lingride] 开始英译中...");
    const provider = new DeepSeekProvider(providerConfig);
    const translation = await provider.chat(
      ENGLISH_TO_CHINESE_PROMPTS.system_prompt,
      userPrompt
    );

    console.log("[Lingride] 英译中完成");

    return {
      success: true,
      data: { translation: translation.trim() },
    };
  } catch (error) {
    console.error("[Lingride] 英译中失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "英译中失败",
    };
  }
}

/**
 * 处理英英释义请求
 *
 * 调用 AI 用英语解释英文词汇/句子，根据用户 CEFR 水平调整复杂度。
 */
async function handleEnglishDefinition(
  text: string,
  userLevel: CEFRLevel
): Promise<EnglishDefinitionResponse> {
  try {
    // 1. 获取 Provider 配置
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 构建 Prompt
    const userPrompt = ENGLISH_DEFINITION_PROMPTS.user_prompt_template
      .replace(/\{\{text\}\}/g, text)
      .replace(/\{\{user_level\}\}/g, userLevel);

    // 3. 调用 AI
    console.log(`[Lingride] 开始英英释义 (${userLevel})...`);
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(
      ENGLISH_DEFINITION_PROMPTS.system_prompt,
      userPrompt
    );

    // 4. 解析 JSON 响应（三级 fallback 策略）
    let result: EnglishDefinitionResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 5. 确保字段完整性
    result = {
      definition: result.definition || "",
      examples: result.examples || [],
      synonyms: result.synonyms || [],
      usageNotes: result.usageNotes || "",
    };

    console.log("[Lingride] 英英释义完成");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 英英释义失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "英英释义失败",
    };
  }
}

// ====== 影子跟读功能 ======

/**
 * 处理 SPLIT_SENTENCES 消息
 *
 * 调用 AI 将用户输入的英文文本智能分句。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置
 * 3. 替换 {{text}} 占位符
 * 4. 调用 AI 进行分句
 * 5. 解析 JSON 结果并返回
 */
async function handleSplitSentences(
  text: string
): Promise<SplitSentencesResponse> {
  try {
    // 1. 获取配置并验证
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 验证输入
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        success: false,
        error: "输入文本不能为空",
      };
    }

    // 3. 构建 Prompt
    const userPrompt = SPLIT_SENTENCES_PROMPTS.user_prompt_template.replace(
      "{{text}}",
      trimmedText
    );

    // 4. 调用 AI 进行分句
    console.log("[Lingride] 开始智能分句...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(
      SPLIT_SENTENCES_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: SplitSentencesResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    const sentences = result.sentences || [];
    result = {
      sentences,
      totalCount: sentences.length,
    };

    console.log(`[Lingride] 分句完成: ${result.totalCount} 句`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 智能分句失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "分句失败，请重试",
    };
  }
}

/**
 * 处理 SHADOW_ASSESS 消息
 *
 * 对比用户的跟读发音（语音识别文本）与原文，从准确度、流利度、语调、节奏四个维度给出评估。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 获取 Prompt 配置
 * 3. 替换 {{original}} 和 {{recognized}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleShadowAssess(
  original: string,
  recognized: string
): Promise<ShadowAssessResponse> {
  try {
    // 1. 获取配置并验证
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 验证输入
    if (!original.trim() || !recognized.trim()) {
      return {
        success: false,
        error: "原文和识别文本不能为空",
      };
    }

    // 3. 构建 Prompt
    const userPrompt = SHADOW_ASSESS_PROMPTS.user_prompt_template
      .replace("{{original}}", original)
      .replace("{{recognized}}", recognized);

    // 4. 调用 AI 进行分析
    console.log("[Lingride] 开始影子跟读评估...");
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(
      SHADOW_ASSESS_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: ShadowAssessmentResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    result = {
      score: result.score || 0,
      accuracy: result.accuracy || 0,
      fluency: result.fluency || 0,
      intonation: result.intonation || 0,
      rhythm: result.rhythm || 0,
      issues: result.issues || [],
      suggestions: result.suggestions || [],
      encouragement: result.encouragement || "继续努力！",
      comparison: result.comparison || {
        original,
        recognized,
        matchRate: 0,
        mismatches: [],
      },
    };

    console.log("[Lingride] 影子跟读评估完成, score:", result.score);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 影子跟读评估失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "评估失败，请重试",
    };
  }
}

// ====== 语料库听力训练功能 ======

/**
 * 处理 SEGMENT_CORPUS 消息
 *
 * 调用 AI 根据用户 CEFR 水平对语料文本进行 i+1 难度断句。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 验证输入文本
 * 3. 替换 {{userLevel}} 和 {{text}} 占位符
 * 4. 调用 AI 进行断句
 * 5. 解析 JSON 结果并返回
 */
async function handleSegmentCorpus(
  text: string,
  userLevel: CEFRLevel
): Promise<SegmentCorpusResponse> {
  try {
    // 1. 获取配置并验证
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 验证输入
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        success: false,
        error: "输入文本不能为空",
      };
    }

    // 3. 构建 Prompt
    const userPrompt = SEGMENT_CORPUS_PROMPTS.user_prompt_template
      .replace("{{userLevel}}", userLevel)
      .replace("{{text}}", trimmedText);

    // 4. 调用 AI 进行断句
    console.log(`[Lingride] 开始语料断句 (${userLevel})...`);
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(
      SEGMENT_CORPUS_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: SegmentCorpusResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    result = {
      sentences: result.sentences || [],
      overallLevel: result.overallLevel || userLevel,
    };

    console.log(`[Lingride] 语料断句完成: ${result.sentences.length} 句`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 语料断句失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "断句失败，请重试",
    };
  }
}

/**
 * 处理 ANALYZE_LISTENING 消息
 *
 * 调用 AI 对比用户听写结果与原文，分析听力盲区。
 *
 * 流程：
 * 1. 验证 API Key 配置
 * 2. 验证输入
 * 3. 替换 {{original}}、{{userInput}} 和 {{userLevel}} 占位符
 * 4. 调用 AI 进行分析
 * 5. 解析 JSON 结果并返回
 */
async function handleAnalyzeListening(
  original: string,
  userInput: string,
  userLevel: CEFRLevel
): Promise<AnalyzeListeningResponse> {
  try {
    // 1. 获取配置并验证
    const providerConfig = await getProviderConfig();

    if (!providerConfig.apiKey) {
      return {
        success: false,
        error: "请先配置 API Key",
      };
    }

    // 2. 验证输入
    if (!original.trim()) {
      return {
        success: false,
        error: "原文不能为空",
      };
    }

    // 3. 构建 Prompt
    const userPrompt = ANALYZE_LISTENING_PROMPTS.user_prompt_template
      .replace("{{original}}", original)
      .replace("{{userInput}}", userInput || "(用户未输入)")
      .replace("{{userLevel}}", userLevel);

    // 4. 调用 AI 进行分析
    console.log(`[Lingride] 开始听力分析 (${userLevel})...`);
    const provider = new DeepSeekProvider(providerConfig);
    const aiResponse = await provider.chat(
      ANALYZE_LISTENING_PROMPTS.system_prompt,
      userPrompt
    );

    // 5. 解析 JSON 响应
    let result: ListeningAnalysisResult;
    try {
      // 尝试直接解析
      result = JSON.parse(aiResponse);
    } catch {
      // 尝试提取 JSON 代码块
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("AI 返回的格式无效，无法解析为 JSON");
      }
    }

    // 确保字段完整性
    result = {
      accuracy: result.accuracy || 0,
      errors: result.errors || [],
      blindSpots: result.blindSpots || [],
      suggestions: result.suggestions || [],
      encouragement: result.encouragement || "继续努力！",
    };

    console.log(`[Lingride] 听力分析完成, 准确率: ${result.accuracy}%`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Lingride] 听力分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "分析失败，请重试",
    };
  }
}

// ====== 腾讯云 ASR 签名 ======

/**
 * 处理 TENCENT_ASR_SIGN 消息
 *
 * 生成腾讯云实时语音识别的签名 URL。
 * 签名在 background 中生成以保护密钥安全。
 *
 * 腾讯云 ASR WebSocket URL 格式：
 * wss://asr.cloud.tencent.com/asr/v2/{appid}?{params}&signature={signature}
 */
async function handleTencentASRSign(): Promise<TencentASRSignResponse> {
  try {
    // 1. 获取配置
    const config = await getConfig();

    if (
      !config.tencent_asr?.app_id ||
      !config.tencent_asr?.secret_id ||
      !config.tencent_asr?.secret_key
    ) {
      return {
        success: false,
        error: "腾讯云 ASR 未配置，请在设置中填写 AppID、SecretID 和 SecretKey",
      };
    }

    const { app_id, secret_id, secret_key } = config.tencent_asr;

    // 2. 生成签名参数
    const timestamp = Math.floor(Date.now() / 1000);
    const expired = timestamp + 86400; // 24小时有效期
    const nonce = Math.floor(Math.random() * 100000);

    // 请求参数
    const params: Record<string, string | number> = {
      secretid: secret_id,
      timestamp,
      expired,
      nonce,
      engine_model_type: "16k_en", // 英语 16kHz
      voice_format: 1, // PCM
      needvad: 1, // 开启 VAD
      filter_dirty: 0, // 不过滤脏话
      filter_modal: 0, // 不过滤语气词
      filter_punc: 0, // 不过滤标点
      convert_num_mode: 1, // 数字智能转换
      word_info: 0, // 不返回词级别时间戳
    };

    // 3. 生成签名字符串
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");

    // 4. 计算 HMAC-SHA1 签名
    const signature = await hmacSha1Base64(secret_key, signStr);

    // 5. 构建完整 URL
    const queryString =
      sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") +
      `&signature=${encodeURIComponent(signature)}`;

    const signedUrl = `wss://asr.cloud.tencent.com/asr/v2/${app_id}?${queryString}`;

    console.log("[Lingride] 腾讯云 ASR 签名生成成功");

    return {
      success: true,
      data: { signedUrl },
    };
  } catch (error) {
    console.error("[Lingride] 腾讯云 ASR 签名生成失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "签名生成失败",
    };
  }
}

/**
 * HMAC-SHA1 签名并返回 Base64 编码
 *
 * 使用 Web Crypto API 实现。
 */
async function hmacSha1Base64(key: string, data: string): Promise<string> {
  // 将字符串转换为 ArrayBuffer
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  // 计算 HMAC
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);

  // 转换为 Base64
  const signatureArray = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  return btoa(binary);
}

// ====== 阿里云 ASR WebSocket 管理 ======

/**
 * 阿里云 ASR 会话状态
 *
 * 每个 Tab 最多一个活跃会话。
 */
interface AlibabaASRSession {
  /** WebSocket 连接 */
  ws: WebSocket;
  /** 任务 ID（UUID） */
  taskId: string;
  /** 与 Tutor 页面的 Port 连接（用于推送实时结果） */
  port: chrome.runtime.Port;
  /** 最终识别结果（sentence_end=true 时累积） */
  finalText: string;
  /** 中间识别结果（sentence_end=false 时更新） */
  interimText: string;
  /** 是否已收到 task-started 事件 */
  taskStarted: boolean;
  /** 启动时的 resolve 回调 */
  startResolve?: (value: AlibabaASRStartResponse) => void;
  /** 启动时的 reject 回调 */
  startReject?: (error: Error) => void;
}

/** 按 Tab ID 管理阿里云 ASR 会话 */
const alibabaASRSessions = new Map<number, AlibabaASRSession>();

/**
 * 阿里云 ASR WebSocket URL
 */
const ALIBABA_ASR_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference";

/**
 * 处理 ALIBABA_ASR_START 消息
 *
 * 在 Background Service Worker 中建立 WebSocket 连接，保护 API Key 安全。
 *
 * 流程：
 * 1. 验证配置
 * 2. 建立 WebSocket 连接（Bearer Token 鉴权）
 * 3. 发送 run-task 指令
 * 4. 等待 task-started 事件
 * 5. 返回成功响应
 */
async function handleAlibabaASRStart(
  tabId: number,
  port: chrome.runtime.Port
): Promise<AlibabaASRStartResponse> {
  try {
    // 1. 检查是否已有活跃会话
    if (alibabaASRSessions.has(tabId)) {
      console.warn("[Lingride] 阿里云 ASR 会话已存在，先关闭旧会话");
      await cleanupAlibabaASRSession(tabId);
    }

    // 2. 获取配置
    const config = await getConfig();
    if (!config.alibaba_asr?.api_key) {
      return {
        success: false,
        error: "阿里云 ASR 未配置，请在设置中填写 API Key",
      };
    }

    const apiKey = config.alibaba_asr.api_key;

    // 3. 生成任务 ID
    const taskId = crypto.randomUUID().replace(/-/g, "");

    // 4. 返回 Promise，等待 task-started 事件
    return new Promise((resolve, reject) => {
      // 5. 建立 WebSocket 连接
      // 注意：Service Worker 中的 WebSocket 不支持自定义 headers
      // 阿里云 API 支持通过 URL 参数传递 token
      const wsUrl = `${ALIBABA_ASR_WS_URL}?token=${encodeURIComponent(apiKey)}`;
      const ws = new WebSocket(wsUrl);

      // 创建会话对象
      const session: AlibabaASRSession = {
        ws,
        taskId,
        port,
        finalText: "",
        interimText: "",
        taskStarted: false,
        startResolve: resolve,
        startReject: reject,
      };

      // 保存会话
      alibabaASRSessions.set(tabId, session);

      // 设置连接超时
      const connectTimeout = setTimeout(() => {
        if (!session.taskStarted) {
          console.error("[Lingride] 阿里云 ASR 连接超时");
          cleanupAlibabaASRSession(tabId);
          resolve({ success: false, error: "连接超时，请重试" });
        }
      }, 10000);

      // 6. 监听 WebSocket 事件
      ws.onopen = () => {
        console.log("[Lingride] 阿里云 ASR WebSocket 连接成功");

        // 发送 run-task 指令
        const runTaskCmd = {
          header: {
            action: "run-task",
            task_id: taskId,
            streaming: "duplex",
          },
          payload: {
            task_group: "audio",
            task: "asr",
            function: "recognition",
            model: "paraformer-realtime-v2",
            parameters: {
              format: "pcm",
              sample_rate: 16000,
              language_hints: ["en"], // 英语识别
            },
            input: {},
          },
        };

        ws.send(JSON.stringify(runTaskCmd));
        console.log("[Lingride] 已发送 run-task 指令");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          handleAlibabaASREvent(tabId, data, connectTimeout);
        } catch (e) {
          console.error("[Lingride] 解析阿里云 ASR 响应失败:", e);
        }
      };

      ws.onerror = (event) => {
        console.error("[Lingride] 阿里云 ASR WebSocket 错误:", event);
        clearTimeout(connectTimeout);
        if (!session.taskStarted) {
          cleanupAlibabaASRSession(tabId);
          resolve({ success: false, error: "WebSocket 连接失败" });
        }
      };

      ws.onclose = (event) => {
        console.log(
          `[Lingride] 阿里云 ASR WebSocket 关闭: code=${event.code}, reason=${event.reason}`
        );
        clearTimeout(connectTimeout);
        // 非正常关闭时清理会话
        if (event.code !== 1000) {
          cleanupAlibabaASRSession(tabId);
        }
      };
    });
  } catch (error) {
    console.error("[Lingride] 启动阿里云 ASR 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动失败",
    };
  }
}

/**
 * 处理阿里云 ASR 事件
 *
 * 解析服务端返回的事件，更新会话状态并推送结果到 Tutor。
 */
function handleAlibabaASREvent(
  tabId: number,
  event: {
    header?: {
      event?: string;
      task_id?: string;
      error_code?: string;
      error_message?: string;
    };
    payload?: {
      output?: {
        sentence?: {
          text?: string;
          sentence_end?: boolean;
        };
      };
    };
  },
  connectTimeout?: ReturnType<typeof setTimeout>
): void {
  const session = alibabaASRSessions.get(tabId);
  if (!session) return;

  const eventType = event.header?.event;

  switch (eventType) {
    case "task-started":
      console.log("[Lingride] 阿里云 ASR 任务已启动");
      session.taskStarted = true;
      if (connectTimeout) clearTimeout(connectTimeout);
      // 调用启动成功回调
      session.startResolve?.({ success: true });
      session.startResolve = undefined;
      session.startReject = undefined;
      break;

    case "result-generated":
      const text = event.payload?.output?.sentence?.text || "";
      const isFinal = event.payload?.output?.sentence?.sentence_end === true;

      if (isFinal) {
        // 最终结果：累积到 finalText
        session.finalText += text + " ";
        session.interimText = "";
      } else {
        // 中间结果：更新 interimText
        session.interimText = text;
      }

      // 推送实时结果到 Tutor
      try {
        session.port.postMessage({
          type: MessageType.ALIBABA_ASR_RESULT,
          payload: {
            text: (session.finalText + session.interimText).trim(),
            isFinal,
          },
        });
      } catch (e) {
        console.warn("[Lingride] 推送阿里云 ASR 结果失败:", e);
      }
      break;

    case "task-finished":
      console.log("[Lingride] 阿里云 ASR 任务已完成");
      break;

    case "task-failed":
      console.error(
        "[Lingride] 阿里云 ASR 任务失败:",
        event.header?.error_code,
        event.header?.error_message
      );
      // 如果还在启动阶段，调用失败回调
      if (!session.taskStarted) {
        if (connectTimeout) clearTimeout(connectTimeout);
        session.startResolve?.({
          success: false,
          error: event.header?.error_message || "任务启动失败",
        });
        session.startResolve = undefined;
        session.startReject = undefined;
      }
      // 通知 Tutor 错误
      try {
        session.port.postMessage({
          type: MessageType.ALIBABA_ASR_RESULT,
          payload: {
            text: "",
            isFinal: true,
            error: event.header?.error_message,
          },
        });
      } catch (e) {
        console.warn("[Lingride] 推送阿里云 ASR 错误失败:", e);
      }
      cleanupAlibabaASRSession(tabId);
      break;

    default:
      // 忽略其他事件
      break;
  }
}

/**
 * 处理 ALIBABA_ASR_AUDIO 消息
 *
 * 将 Base64 编码的音频数据解码后发送到阿里云 ASR。
 */
function handleAlibabaASRAudio(tabId: number, audioData: string): void {
  const session = alibabaASRSessions.get(tabId);
  if (!session) {
    console.warn("[Lingride] 阿里云 ASR 会话不存在，忽略音频数据");
    return;
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    console.warn("[Lingride] 阿里云 ASR WebSocket 未就绪，忽略音频数据");
    return;
  }

  if (!session.taskStarted) {
    console.warn("[Lingride] 阿里云 ASR 任务未启动，忽略音频数据");
    return;
  }

  try {
    // Base64 解码
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 发送二进制音频数据
    session.ws.send(bytes.buffer);
  } catch (e) {
    console.error("[Lingride] 发送阿里云 ASR 音频数据失败:", e);
  }
}

/**
 * 处理 ALIBABA_ASR_STOP 消息
 *
 * 发送 finish-task 指令并等待最终结果。
 */
async function handleAlibabaASRStop(
  tabId: number
): Promise<AlibabaASRStopResponse> {
  const session = alibabaASRSessions.get(tabId);
  if (!session) {
    return {
      success: false,
      error: "没有活跃的阿里云 ASR 会话",
    };
  }

  try {
    // 发送 finish-task 指令
    if (session.ws.readyState === WebSocket.OPEN && session.taskStarted) {
      const finishTaskCmd = {
        header: {
          action: "finish-task",
          task_id: session.taskId,
          streaming: "duplex",
        },
        payload: {
          input: {},
        },
      };

      session.ws.send(JSON.stringify(finishTaskCmd));
      console.log("[Lingride] 已发送 finish-task 指令");

      // 等待一小段时间让服务器处理最后的数据
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 获取最终结果
    const finalText = (session.finalText + session.interimText).trim();

    // 清理会话
    await cleanupAlibabaASRSession(tabId);

    console.log(`[Lingride] 阿里云 ASR 停止，最终结果: "${finalText}"`);

    return {
      success: true,
      data: { finalText },
    };
  } catch (error) {
    console.error("[Lingride] 停止阿里云 ASR 失败:", error);
    await cleanupAlibabaASRSession(tabId);
    return {
      success: false,
      error: error instanceof Error ? error.message : "停止失败",
    };
  }
}

/**
 * 清理阿里云 ASR 会话
 */
async function cleanupAlibabaASRSession(tabId: number): Promise<void> {
  const session = alibabaASRSessions.get(tabId);
  if (!session) return;

  try {
    // 关闭 WebSocket
    if (
      session.ws.readyState === WebSocket.OPEN ||
      session.ws.readyState === WebSocket.CONNECTING
    ) {
      session.ws.close(1000, "Session ended");
    }
  } catch (e) {
    console.warn("[Lingride] 关闭阿里云 ASR WebSocket 失败:", e);
  }

  // 从 Map 中移除
  alibabaASRSessions.delete(tabId);
  console.log(`[Lingride] 阿里云 ASR 会话已清理: tabId=${tabId}`);
}

/**
 * 监听 Port 连接（用于阿里云 ASR 实时结果推送）
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "alibaba-asr") {
    console.log("[Lingride] 收到阿里云 ASR Port 连接");

    // 获取 Tab ID
    const tabId = port.sender?.tab?.id;
    if (!tabId) {
      console.error("[Lingride] 无法获取阿里云 ASR Port 的 Tab ID");
      port.disconnect();
      return;
    }

    // 监听 Port 断开
    port.onDisconnect.addListener(() => {
      console.log(`[Lingride] 阿里云 ASR Port 断开: tabId=${tabId}`);
      // Port 断开时清理会话
      cleanupAlibabaASRSession(tabId);
    });

    // 监听来自 Tutor 的消息
    port.onMessage.addListener(async (message: Message) => {
      switch (message.type) {
        case MessageType.ALIBABA_ASR_START:
          const startResponse = await handleAlibabaASRStart(tabId, port);
          port.postMessage({ type: "ALIBABA_ASR_START_RESPONSE", ...startResponse });
          break;

        case MessageType.ALIBABA_ASR_AUDIO:
          handleAlibabaASRAudio(tabId, (message as { payload: { audioData: string } }).payload.audioData);
          break;

        case MessageType.ALIBABA_ASR_STOP:
          const stopResponse = await handleAlibabaASRStop(tabId);
          port.postMessage({ type: "ALIBABA_ASR_STOP_RESPONSE", ...stopResponse });
          break;
      }
    });
  }
});

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

        case MessageType.ANALYZE_DIFFICULTY:
          response = await handleAnalyzeDifficulty();
          break;

        case MessageType.TOGGLE_PARAPHRASE:
          if (tabId === undefined) {
            // 如果是从 Popup 发来的，获取当前活动 Tab
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = await handleToggleParaphrase(
                activeTab.id,
                message.payload.enabled
              );
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = await handleToggleParaphrase(
              tabId,
              message.payload.enabled
            );
          }
          break;

        case MessageType.GET_PARAPHRASE_STATE:
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = handleGetParaphraseState(activeTab.id);
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = handleGetParaphraseState(tabId);
          }
          break;

        case MessageType.PARAPHRASE:
          response = await handleParaphrase(
            message.payload.texts,
            message.payload.batchId
          );
          break;

        case MessageType.TOGGLE_MIXED_TRANSLATE:
          if (tabId === undefined) {
            // 如果是从 Popup 发来的，获取当前活动 Tab
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = await handleToggleMixedTranslate(
                activeTab.id,
                message.payload.enabled
              );
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = await handleToggleMixedTranslate(
              tabId,
              message.payload.enabled
            );
          }
          break;

        case MessageType.GET_MIXED_TRANSLATE_STATE:
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTab?.id) {
              response = handleGetMixedTranslateState(activeTab.id);
            } else {
              response = { success: false, error: "无法获取当前 Tab" };
            }
          } else {
            response = handleGetMixedTranslateState(tabId);
          }
          break;

        case MessageType.MIXED_TRANSLATE:
          response = await handleMixedTranslate(
            message.payload.texts,
            message.payload.batchId
          );
          break;

        case MessageType.ANALYZE_SENTENCE:
          response = await handleAnalyzeSentence(message.payload.sentence);
          break;

        case MessageType.ASSESS_PRONUNCIATION:
          response = await handleAssessPronunciation(
            message.payload.original,
            message.payload.recognized
          );
          break;

        case MessageType.CHINESE_TO_ENGLISH:
          response = await handleChineseToEnglish(message.payload.text);
          break;

        case MessageType.ENGLISH_TO_CHINESE:
          response = await handleEnglishToChinese(message.payload.text);
          break;

        case MessageType.ENGLISH_DEFINITION:
          response = await handleEnglishDefinition(
            message.payload.text,
            message.payload.userLevel
          );
          break;

        case MessageType.SPLIT_SENTENCES:
          response = await handleSplitSentences(message.payload.text);
          break;

        case MessageType.SHADOW_ASSESS:
          response = await handleShadowAssess(
            message.payload.original,
            message.payload.recognized
          );
          break;

        case MessageType.TENCENT_ASR_SIGN:
          response = await handleTencentASRSign();
          break;

        case MessageType.SEGMENT_CORPUS:
          response = await handleSegmentCorpus(
            message.payload.text,
            message.payload.userLevel
          );
          break;

        case MessageType.ANALYZE_LISTENING:
          response = await handleAnalyzeListening(
            message.payload.original,
            message.payload.userInput,
            message.payload.userLevel
          );
          break;

        // 阿里云 ASR 消息通过 Port 处理，这里提供 fallback
        case MessageType.ALIBABA_ASR_START:
        case MessageType.ALIBABA_ASR_AUDIO:
        case MessageType.ALIBABA_ASR_STOP:
          response = {
            success: false,
            error: "阿里云 ASR 消息应通过 Port 连接发送",
          };
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
