import { BaseProvider } from './ILLMProvider';
import { AnalysisOptions, AnalysisResult, ProviderConfig } from '../types';
/**
 * OpenAI LLM提供商实现
 * 使用OpenAI GPT模型进行英文难度分析
 */
export declare class OpenAIProvider extends BaseProvider {
    readonly name = "OpenAI";
    readonly id = "openai";
    readonly description = "\u4F7F\u7528OpenAI GPT\u6A21\u578B\u8FDB\u884C\u82F1\u6587\u96BE\u5EA6\u5206\u6790";
    private axiosInstance;
    constructor(config: ProviderConfig);
    /**
     * 分析英文文本难度
     */
    analyze(options: AnalysisOptions): Promise<AnalysisResult>;
    /**
     * 解析API响应
     */
    private parseResponse;
    /**
     * 标准化难度等级
     */
    private normalizeDifficultyLevel;
    /**
     * 标准化CEFR等级
     */
    private normalizeCEFRLevel;
    /**
     * 限制分数在0-100范围内
     */
    private clampScore;
    /**
     * 限制比例在0-1范围内
     */
    private clampRatio;
    /**
     * 计算词数
     */
    private countWords;
    /**
     * 重写验证配置方法，添加OpenAI特定验证
     */
    validateConfig(config: ProviderConfig): boolean;
    /**
     * 重写估算成本方法，提供更准确的OpenAI成本估算
     */
    getEstimatedCost(textLength: number): number;
}
//# sourceMappingURL=OpenAIProvider.d.ts.map