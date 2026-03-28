import { ILLMProvider } from '../providers/ILLMProvider';
import { AnalysisOptions, AnalysisResult } from '../types';
/**
 * 英文难度分析引擎
 * 负责协调文本处理、LLM调用和结果管理
 */
export declare class DifficultyAnalyzer {
    private provider;
    private history;
    private readonly maxHistorySize;
    constructor(provider: ILLMProvider);
    /**
     * 分析英文文本难度
     * @param text 要分析的文本
     * @param options 分析选项
     * @returns 分析结果
     */
    analyzeText(text: string, options?: Partial<AnalysisOptions>): Promise<AnalysisResult>;
    /**
     * 分析当前编辑器中选中的文本
     * @returns 分析结果，如果没有选中文本则返回null
     */
    analyzeSelection(): Promise<AnalysisResult | null>;
    /**
     * 分析整个文档
     * @returns 分析结果
     */
    analyzeDocument(): Promise<AnalysisResult | null>;
    /**
     * 批量分析多个文本
     * @param texts 文本数组
     * @returns 分析结果数组
     */
    analyzeBatch(texts: string[]): Promise<AnalysisResult[]>;
    /**
     * 添加到历史记录
     */
    private addToHistory;
    /**
     * 获取分析历史
     * @param limit 返回的最大记录数
     * @returns 历史记录数组
     */
    getHistory(limit?: number): AnalysisResult[];
    /**
     * 清除历史记录
     */
    clearHistory(): void;
    /**
     * 获取历史统计信息
     */
    getHistoryStats(): {
        total: number;
        byDifficulty: Record<string, number>;
        avgScore: number;
        byProvider: Record<string, number>;
    };
    /**
     * 导出历史记录
     * @param format 导出格式 ('json' 或 'csv')
     * @returns 导出的数据
     */
    exportHistory(format?: 'json' | 'csv'): string;
    /**
     * 导出为CSV格式
     */
    private exportHistoryAsCSV;
    /**
     * 比较两个分析结果
     */
    compareResults(result1: AnalysisResult, result2: AnalysisResult): {
        scoreDifference: number;
        difficultyChange: string;
        readingTimeRatio: number;
        vocabularyComparison: {
            rareWords: number;
            academicWords: number;
        };
    };
}
//# sourceMappingURL=DifficultyAnalyzer.d.ts.map