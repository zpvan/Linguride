/**
 * @file translation.ts
 * @description 翻译相关类型定义
 *
 * 定义翻译过程中使用的各种类型，包括：
 * - 翻译元素：页面中可翻译的 DOM 元素
 * - 翻译结果：API 返回的翻译内容
 * - 批次管理：批量翻译的分批策略
 * - 缓存条目：页面级翻译缓存
 *
 * @author Lingride Team
 * @since 1.0.0
 */

/**
 * 翻译状态枚举
 *
 * 表示单个元素的翻译状态。
 */
export enum TranslationStatus {
  /** 等待翻译 */
  PENDING = "pending",
  /** 翻译中 */
  LOADING = "loading",
  /** 翻译成功 */
  SUCCESS = "success",
  /** 翻译失败 */
  ERROR = "error",
}

/**
 * 可翻译元素
 *
 * 封装页面中识别出的可翻译 DOM 元素。
 */
export interface TranslatableElement {
  /** 唯一标识符（基于 DOM 位置生成） */
  id: string;

  /** 原始 DOM 元素引用 */
  element: HTMLElement;

  /** 原始英文文本内容 */
  originalText: string;

  /** 当前翻译状态 */
  status: TranslationStatus;

  /** 中文翻译结果（成功后填充） */
  translation?: string;

  /** 错误信息（失败时填充） */
  error?: string;

  /** 原文中 <code> 标签内的词汇（用于译文格式保留） */
  codeWords?: string[];
}

/**
 * 翻译批次
 *
 * 用于动态分批翻译的批次信息。
 */
export interface TranslationBatch {
  /** 批次唯一 ID */
  batchId: string;

  /** 本批次包含的元素 ID 列表 */
  elementIds: string[];

  /** 本批次的文本内容列表 */
  texts: string[];

  /** 估算的 Token 数量 */
  estimatedTokens: number;

  /** 批次创建时间 */
  createdAt: number;
}

/**
 * 批次翻译结果
 *
 * 从 API 返回的批次翻译结果。
 */
export interface BatchTranslationResult {
  /** 批次 ID */
  batchId: string;

  /** 翻译结果数组，与请求的 texts 一一对应 */
  translations: string[];

  /** 是否成功 */
  success: boolean;

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 页面翻译缓存条目
 *
 * 存储在页面级内存缓存中的翻译条目。
 */
export interface CacheEntry {
  /** 原始文本（作为缓存键） */
  originalText: string;

  /** 翻译结果 */
  translation: string;

  /** 缓存时间戳 */
  timestamp: number;
}

/**
 * 翻译缓存
 *
 * 页面级的翻译缓存，使用 Map 存储。
 * 键为原始文本的哈希值，值为缓存条目。
 */
export type TranslationCache = Map<string, CacheEntry>;

/**
 * 批量管理器配置
 *
 * 控制动态分批策略的配置参数。
 */
export interface BatchManagerConfig {
  /** 每批次最大文本数量（默认 10） */
  maxTextsPerBatch: number;

  /** 每批次最大估算 Token 数（默认 2000） */
  maxTokensPerBatch: number;

  /** 批次发送间隔（毫秒，用于限速） */
  batchInterval: number;
}

/**
 * 默认批量管理器配置
 */
export const DEFAULT_BATCH_CONFIG: BatchManagerConfig = {
  maxTextsPerBatch: 10,
  maxTokensPerBatch: 2000,
  batchInterval: 100,
};

/**
 * 估算文本的 Token 数量
 *
 * 使用简单的启发式算法估算 Token 数量：
 * - 英文单词约 1.3 tokens
 * - 中文字符约 2 tokens
 *
 * @param text - 待估算的文本
 * @returns 估算的 Token 数量
 */
export function estimateTokens(text: string): number {
  // 统计英文单词（简单按空格分割）
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

  // 估算公式：英文单词 * 1.3 + 中文字符 * 2
  return Math.ceil(words.length * 1.3 + chineseChars * 2);
}

/**
 * 生成简单的哈希值
 *
 * 用于生成缓存键和元素 ID。
 *
 * @param str - 输入字符串
 * @returns 哈希值字符串
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash).toString(36);
}
