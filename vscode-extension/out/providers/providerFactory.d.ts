import { ILLMProvider } from './ILLMProvider';
/**
 * 提供商工厂类
 * 负责创建和管理LLM提供商实例
 */
export declare class ProviderFactory {
    private static instances;
    private static configChangeDisposable;
    /**
     * 根据提供商ID创建或获取提供商实例
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @returns 提供商实例，如果配置无效则返回null
     */
    static createProvider(providerId?: string): Promise<ILLMProvider | null>;
    /**
     * 获取所有可用的提供商信息
     * @returns 提供商信息列表
     */
    static getAvailableProviders(): Array<{
        id: string;
        name: string;
        description: string;
        configured: boolean;
    }>;
    /**
     * 清除缓存的提供商实例
     * @param providerId 可选的提供商ID，如果未提供则清除所有
     */
    static clearCache(providerId?: string): void;
    /**
     * 初始化配置变更监听器
     * 当VS Code配置变更时自动清除缓存
     */
    private static initializeConfigListener;
    /**
     * 获取当前活跃的提供商ID
     * @returns 当前活跃的提供商ID
     */
    static getActiveProviderId(): string;
    /**
     * 清理工厂资源
     * 扩展停用时调用此方法释放所有资源
     */
    static dispose(): void;
}
/**
 * 便捷函数：创建默认提供商
 * @returns 默认提供商实例
 */
export declare function createProvider(): Promise<ILLMProvider | null>;
/**
 * 便捷函数：创建指定提供商
 * @param providerId 提供商ID
 * @returns 指定提供商实例
 */
export declare function createProviderById(providerId: string): Promise<ILLMProvider | null>;
//# sourceMappingURL=providerFactory.d.ts.map