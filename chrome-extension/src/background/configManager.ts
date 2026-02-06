/**
 * @file configManager.ts
 * @description 配置管理器
 *
 * 封装 Chrome Storage API，提供配置的读取、保存和验证功能。
 * 所有配置存储在 chrome.storage.local 中，确保数据持久化。
 *
 * 功能：
 * - 读取配置（带默认值回退）
 * - 保存配置（带验证）
 * - 配置迁移（未来版本升级）
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import {
  DEFAULT_CONFIG,
  LingridConfig,
  ProviderConfig,
  STORAGE_KEY,
  toProviderConfig,
} from "../types";

/**
 * 获取配置
 *
 * 从 Chrome Storage 读取配置，如果不存在则返回默认配置。
 *
 * @returns Promise 解析为 LingridConfig 对象
 */
export async function getConfig(): Promise<LingridConfig> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<LingridConfig> | undefined;

    if (!stored) {
      console.log("[Lingride] 未找到配置，使用默认值");
      return { ...DEFAULT_CONFIG };
    }

    // 合并存储配置与默认配置，确保新增字段有默认值
    const config: LingridConfig = {
      api_base_url: stored.api_base_url || DEFAULT_CONFIG.api_base_url,
      api_key: stored.api_key || DEFAULT_CONFIG.api_key,
      model: stored.model || DEFAULT_CONFIG.model,
      prompts: {
        system_prompt:
          stored.prompts?.system_prompt || DEFAULT_CONFIG.prompts.system_prompt,
        user_prompt_template:
          stored.prompts?.user_prompt_template ||
          DEFAULT_CONFIG.prompts.user_prompt_template,
      },
      // 可选字段：用户水平 & 各模式 Prompt 配置
      user_english_level:
        stored.user_english_level || DEFAULT_CONFIG.user_english_level,
      difficulty_prompts:
        stored.difficulty_prompts || DEFAULT_CONFIG.difficulty_prompts,
      paraphrase_prompts:
        stored.paraphrase_prompts || DEFAULT_CONFIG.paraphrase_prompts,
      mixed_translate_prompts:
        stored.mixed_translate_prompts ||
        DEFAULT_CONFIG.mixed_translate_prompts,
    };

    return config;
  } catch (error) {
    console.error("[Lingride] 读取配置失败:", error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存配置
 *
 * 将配置保存到 Chrome Storage。
 *
 * @param config - 要保存的配置对象
 * @throws 保存失败时抛出错误
 */
export async function saveConfig(config: LingridConfig): Promise<void> {
  try {
    // 验证必要字段
    if (!config.api_base_url) {
      throw new Error("API Base URL 不能为空");
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    console.log("[Lingride] 配置已保存");
  } catch (error) {
    console.error("[Lingride] 保存配置失败:", error);
    throw error;
  }
}

/**
 * 获取 Provider 格式的配置
 *
 * 从存储读取配置并转换为 ProviderConfig 格式，
 * 供 DeepSeekProvider 等翻译服务使用。
 *
 * @returns Promise 解析为 ProviderConfig 对象
 */
export async function getProviderConfig(): Promise<ProviderConfig> {
  const config = await getConfig();
  return toProviderConfig(config);
}

/**
 * 验证配置是否完整
 *
 * 检查必要的 API 配置是否已设置。
 *
 * @param config - 要验证的配置对象
 * @returns 配置是否有效
 */
export function isConfigValid(config: LingridConfig): boolean {
  return !!config.api_base_url && !!config.api_key && !!config.model;
}

/**
 * 重置配置为默认值
 *
 * @returns Promise 解析为默认配置对象
 */
export async function resetConfig(): Promise<LingridConfig> {
  const defaultConfig = { ...DEFAULT_CONFIG };
  await saveConfig(defaultConfig);
  console.log("[Lingride] 配置已重置为默认值");
  return defaultConfig;
}
