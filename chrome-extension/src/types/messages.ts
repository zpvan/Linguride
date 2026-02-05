/**
 * @file messages.ts
 * @description Chrome 扩展消息类型定义
 *
 * 定义 Popup、Background 和 Content Script 之间
 * 通信使用的消息类型和响应类型。
 *
 * 消息流向：
 * - Popup → Background: 配置更新、翻译开关控制、连接测试
 * - Content → Background: 翻译请求
 * - Background → Content: 翻译结果、状态变更
 *
 * @author Lingride Team
 * @since 1.0.0
 */

/**
 * 消息类型枚举
 *
 * 定义所有可能的消息操作类型。
 */
export enum MessageType {
  // ====== 配置相关 ======
  /** 获取配置 */
  GET_CONFIG = "GET_CONFIG",
  /** 保存配置 */
  SAVE_CONFIG = "SAVE_CONFIG",

  // ====== 翻译控制 ======
  /** 开启/关闭翻译 */
  TOGGLE_TRANSLATION = "TOGGLE_TRANSLATION",
  /** 获取当前 Tab 的翻译状态 */
  GET_TRANSLATION_STATE = "GET_TRANSLATION_STATE",

  // ====== 翻译请求 ======
  /** 请求翻译文本 */
  TRANSLATE = "TRANSLATE",

  // ====== 连接测试 ======
  /** 测试 API 连接 */
  TEST_CONNECTION = "TEST_CONNECTION",
}

/**
 * 获取配置消息
 */
export interface GetConfigMessage {
  type: MessageType.GET_CONFIG;
}

/**
 * 保存配置消息
 */
export interface SaveConfigMessage {
  type: MessageType.SAVE_CONFIG;
  payload: {
    api_base_url: string;
    api_key: string;
    model: string;
    prompts: {
      system_prompt: string;
      user_prompt_template: string;
    };
  };
}

/**
 * 切换翻译状态消息
 */
export interface ToggleTranslationMessage {
  type: MessageType.TOGGLE_TRANSLATION;
  payload: {
    /** 是否启用翻译 */
    enabled: boolean;
  };
}

/**
 * 获取翻译状态消息
 */
export interface GetTranslationStateMessage {
  type: MessageType.GET_TRANSLATION_STATE;
}

/**
 * 翻译请求消息
 */
export interface TranslateMessage {
  type: MessageType.TRANSLATE;
  payload: {
    /** 待翻译的文本数组 */
    texts: string[];
    /** 批次 ID，用于匹配响应 */
    batchId: string;
  };
}

/**
 * 测试连接消息
 */
export interface TestConnectionMessage {
  type: MessageType.TEST_CONNECTION;
}

/**
 * 所有消息类型的联合类型
 */
export type Message =
  | GetConfigMessage
  | SaveConfigMessage
  | ToggleTranslationMessage
  | GetTranslationStateMessage
  | TranslateMessage
  | TestConnectionMessage;

// ====== 响应类型定义 ======

/**
 * 基础响应结构
 */
export interface BaseResponse {
  /** 操作是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 获取配置响应
 */
export interface GetConfigResponse extends BaseResponse {
  data?: {
    api_base_url: string;
    api_key: string;
    model: string;
    prompts: {
      system_prompt: string;
      user_prompt_template: string;
    };
  };
}

/**
 * 保存配置响应
 */
export interface SaveConfigResponse extends BaseResponse {}

/**
 * 翻译状态响应
 */
export interface GetTranslationStateResponse extends BaseResponse {
  data?: {
    /** 当前 Tab 翻译是否启用 */
    enabled: boolean;
  };
}

/**
 * 翻译结果响应
 */
export interface TranslateResponse extends BaseResponse {
  data?: {
    /** 批次 ID */
    batchId: string;
    /** 翻译结果数组，与请求的 texts 数组一一对应 */
    translations: string[];
  };
}

/**
 * 测试连接响应
 */
export interface TestConnectionResponse extends BaseResponse {
  data?: {
    /** 响应延迟（毫秒） */
    latency: number;
    /** 模型名称 */
    model: string;
  };
}

/**
 * 所有响应类型的联合类型
 */
export type Response =
  | GetConfigResponse
  | SaveConfigResponse
  | GetTranslationStateResponse
  | TranslateResponse
  | TestConnectionResponse;
