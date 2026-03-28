import { AnalysisOptions, AnalysisResult, ProviderConfig } from '../types';
/**
 * LLM提供商接口
 * 所有LLM提供商都必须实现此接口
 */
export interface ILLMProvider {
    /**
     * 提供商名称（显示用）
     */
    readonly name: string;
    /**
     * 提供商ID（配置用）
     */
    readonly id: string;
    /**
     * 提供商描述
     */
    readonly description: string;
    /**
     * 分析英文文本难度
     * @param options 分析选项
     * @returns 分析结果
     */
    analyze(options: AnalysisOptions): Promise<AnalysisResult>;
    /**
     * 验证提供商配置是否有效
     * @param config 提供商配置
     * @returns 配置是否有效
     */
    validateConfig(config: ProviderConfig): boolean;
    /**
     * 估算分析成本（基于文本长度）
     * @param textLength 文本长度（字符数）
     * @returns 估算成本（单位：美元）
     */
    getEstimatedCost(textLength: number): number;
    /**
     * 测试连接和认证
     * @returns 测试是否成功
     */
    testConnection(): Promise<boolean>;
}
/**
 * LLM提供商基类
 * 提供一些通用功能
 */
export declare abstract class BaseProvider implements ILLMProvider {
    abstract readonly name: string;
    abstract readonly id: string;
    abstract readonly description: string;
    protected config: ProviderConfig;
    constructor(config: ProviderConfig);
    abstract analyze(options: AnalysisOptions): Promise<AnalysisResult>;
    validateConfig(config: ProviderConfig): boolean;
    getEstimatedCost(textLength: number): number;
    testConnection(): Promise<boolean>;
    /**
     * 验证URL格式
     * @param url 待验证的URL
     * @returns URL是否有效
     */
    protected isValidUrl(url: string): boolean;
    /**
     * 构建API请求头
     * @returns 请求头对象
     */
    protected getHeaders(): Record<string, string>;
    /**
     * 处理API错误
     * @param error 错误对象
     * @throws 格式化的错误信息
     */
    protected handleApiError(error: any): never;
}
/**
 * 提供商工厂函数类型
 */
export type ProviderFactory = (config: ProviderConfig) => ILLMProvider;
//# sourceMappingURL=ILLMProvider.d.ts.map