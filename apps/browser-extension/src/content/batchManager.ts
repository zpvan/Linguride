/**
 * @file batchManager.ts
 * @description 动态批量管理器
 *
 * 负责将待翻译文本动态分批，避免单次请求过大导致：
 * - API Token 超限
 * - 请求超时
 * - 解析困难
 *
 * 分批策略：
 * - 基于文本数量限制（默认最多 10 条）
 * - 基于估算 Token 数量限制（默认最多 2000 tokens）
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import {
  BatchManagerConfig,
  DEFAULT_BATCH_CONFIG,
  estimateTokens,
  TranslatableElement,
  TranslationBatch,
} from "../types";

/**
 * 批量管理器类
 *
 * 将待翻译元素分成多个批次，并管理批次的发送和结果处理。
 */
export class BatchManager {
  /** 配置参数 */
  private readonly config: BatchManagerConfig;

  /** 批次计数器，用于生成唯一 ID */
  private batchCounter = 0;

  /**
   * 构造函数
   *
   * @param config - 可选的配置参数，未指定时使用默认值
   */
  constructor(config?: Partial<BatchManagerConfig>) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * 生成唯一的批次 ID
   *
   * @returns 批次 ID 字符串
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${++this.batchCounter}`;
  }

  /**
   * 将元素分成批次
   *
   * 根据配置的限制条件，将待翻译元素分成多个批次。
   *
   * @param elements - 待翻译的元素数组
   * @returns 批次数组
   *
   * @example
   * ```typescript
   * const manager = new BatchManager();
   * const batches = manager.createBatches(elements);
   * for (const batch of batches) {
   *   const result = await translateBatch(batch);
   * }
   * ```
   */
  createBatches(elements: TranslatableElement[]): TranslationBatch[] {
    const batches: TranslationBatch[] = [];
    let currentBatch: TranslatableElement[] = [];
    let currentTokens = 0;

    for (const element of elements) {
      const elementTokens = estimateTokens(element.originalText);

      // 检查是否需要开始新批次
      const wouldExceedTexts =
        currentBatch.length >= this.config.maxTextsPerBatch;
      const wouldExceedTokens =
        currentTokens + elementTokens > this.config.maxTokensPerBatch;

      if (currentBatch.length > 0 && (wouldExceedTexts || wouldExceedTokens)) {
        // 保存当前批次
        batches.push(this.createBatchFromElements(currentBatch, currentTokens));
        // 重置
        currentBatch = [];
        currentTokens = 0;
      }

      // 添加到当前批次
      currentBatch.push(element);
      currentTokens += elementTokens;
    }

    // 保存最后一个批次
    if (currentBatch.length > 0) {
      batches.push(this.createBatchFromElements(currentBatch, currentTokens));
    }

    console.log(
      `[Lingride] 创建了 ${batches.length} 个批次，` +
        `共 ${elements.length} 个元素`
    );

    return batches;
  }

  /**
   * 从元素数组创建批次对象
   *
   * @param elements - 元素数组
   * @param estimatedTokens - 估算的总 Token 数
   * @returns 批次对象
   */
  private createBatchFromElements(
    elements: TranslatableElement[],
    estimatedTokens: number
  ): TranslationBatch {
    return {
      batchId: this.generateBatchId(),
      elementIds: elements.map((e) => e.id),
      texts: elements.map((e) => e.originalText),
      estimatedTokens,
      createdAt: Date.now(),
    };
  }

  /**
   * 获取配置信息
   *
   * @returns 当前配置的副本
   */
  getConfig(): BatchManagerConfig {
    return { ...this.config };
  }
}

/**
 * 创建默认的批量管理器实例
 */
export function createBatchManager(
  config?: Partial<BatchManagerConfig>
): BatchManager {
  return new BatchManager(config);
}
