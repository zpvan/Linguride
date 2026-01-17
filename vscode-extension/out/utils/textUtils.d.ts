/**
 * 文本处理工具函数
 */
/**
 * 清理和标准化文本
 */
export declare function cleanText(text: string): string;
/**
 * 统计文本基本信息
 */
export declare function analyzeTextStats(text: string): {
    charCount: number;
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordLength: number;
    avgSentenceLength: number;
};
/**
 * 估算阅读时间（基于平均阅读速度）
 */
export declare function estimateReadingTime(text: string, wordsPerMinute?: number): number;
/**
 * 提取文本片段（用于预览）
 */
export declare function extractSnippet(text: string, maxLength?: number): string;
/**
 * 检测文本语言（简单实现，主要检测英文）
 */
export declare function detectLanguage(text: string): string;
/**
 * 检查文本是否主要为英文
 */
export declare function isPrimarilyEnglish(text: string): boolean;
/**
 * 分割长文本（避免超过token限制）
 */
export declare function splitLongText(text: string, maxLength?: number): string[];
/**
 * 计算文本复杂度分数（简单启发式算法）
 */
export declare function calculateTextComplexity(text: string): number;
/**
 * 生成文本摘要
 */
export declare function generateSummary(text: string, maxSentences?: number): string;
//# sourceMappingURL=textUtils.d.ts.map