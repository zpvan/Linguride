import * as vscode from 'vscode';
import { ExtensionConfig, ProviderConfig } from '../types';
/**
 * 配置管理类
 * 处理VS Code设置API的读写操作
 */
export declare class ConfigurationManager {
    private static readonly SECTION;
    /**
     * 获取完整的扩展配置
     * @returns 扩展配置对象
     */
    static getConfig(): ExtensionConfig;
    /**
     * 获取特定提供商的配置
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @returns 提供商配置对象，如果未配置则返回undefined
     */
    static getProviderConfig(providerId: string): ProviderConfig | undefined;
    /**
     * 更新扩展配置
     * @param updates 要更新的配置部分
     * @param target 配置目标（全局或工作区）
     * @returns 更新是否成功
     */
    static updateConfig(updates: Partial<ExtensionConfig>, target?: vscode.ConfigurationTarget): Promise<boolean>;
    /**
     * 更新提供商配置
     * @param providerId 提供商ID
     * @param providerConfig 新的提供商配置
     * @param target 配置目标
     * @returns 更新是否成功
     */
    static updateProviderConfig(providerId: string, providerConfig: ProviderConfig, target?: vscode.ConfigurationTarget): Promise<boolean>;
    /**
     * 验证提供商配置是否有效
     * @param providerId 提供商ID
     * @returns 配置是否有效
     */
    static validateProviderConfig(providerId: string): boolean;
    /**
     * 获取默认的提供商模型
     * @param providerId 提供商ID
     * @returns 默认模型名称
     */
    private static getDefaultModel;
    /**
     * 获取默认的API端点
     * @param providerId 提供商ID
     * @returns 默认端点URL
     */
    private static getDefaultEndpoint;
    /**
     * 验证URL格式
     * @param url 待验证的URL
     * @returns URL是否有效
     */
    private static isValidUrl;
    /**
     * 获取配置变更事件
     * @returns 配置变更事件
     */
    static onDidChangeConfiguration(listener: (e: vscode.ConfigurationChangeEvent) => any): vscode.Disposable;
    /**
     * 检查配置是否已初始化
     * @returns 是否至少有一个提供商已配置
     */
    static isConfigured(): boolean;
    /**
     * 获取配置状态摘要
     * @returns 配置状态信息
     */
    static getConfigStatus(): {
        isConfigured: boolean;
        configuredProviders: string[];
        defaultProvider: string;
    };
    /**
     * 验证prompt配置是否完整
     * @returns 验证结果和可选的错误信息
     */
    static validatePromptConfig(): {
        isValid: boolean;
        message?: string;
    };
}
//# sourceMappingURL=configuration.d.ts.map