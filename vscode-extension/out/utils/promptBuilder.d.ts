import { ExtensionConfig } from '../types';
/**
 * Prompt构建工具类
 * 处理prompt模板的获取、优先级解析和变量替换
 */
export declare class PromptBuilder {
    /**
     * 获取最终的系统提示
     * 优先级：provider特定配置 > 全局配置 > 默认值
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @param config 扩展配置
     * @returns 系统提示字符串
     */
    static getSystemPrompt(providerId: string, config: ExtensionConfig): string;
    /**
     * 获取最终的用户提示（进行变量替换）
     * 优先级：provider特定配置 > 全局配置 > 默认值
     * @param text 用户输入的文本
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @param config 扩展配置
     * @param language 语言代码，默认 'en'
     * @returns 用户提示字符串（已进行变量替换）
     */
    static getUserPrompt(text: string, providerId: string, config: ExtensionConfig, language?: string): string;
    /**
     * 变量替换
     * 将模板中的占位符（如{text}）替换为实际值
     * @param template 原始模板字符串
     * @param variables 变量映射对象
     * @returns 替换后的字符串
     */
    private static replaceVariables;
    /**
     * 转义正则表达式特殊字符
     * 用于安全地创建正则表达式
     */
    private static escapeRegExp;
    /**
     * 验证prompt模板是否包含必要的占位符
     * @param template 待验证的模板
     * @param requiredPlaceholders 必需的占位符数组
     * @returns 验证结果和缺失的占位符
     */
    static validateTemplate(template: string, requiredPlaceholders?: string[]): {
        isValid: boolean;
        missingPlaceholders: string[];
    };
    /**
     * 获取支持的变量列表（用于文档和UI显示）
     * @returns 支持的变量描述对象
     */
    static getSupportedVariables(): Array<{
        name: string;
        description: string;
        example: string;
    }>;
    /**
     * 验证prompt配置是否完整
     * @param config 扩展配置
     * @param providerId 提供商ID
     * @returns 验证结果和缺失的配置项
     */
    static validatePromptConfig(config: ExtensionConfig, providerId: string): {
        isValid: boolean;
        missingConfigs: string[];
    };
}
//# sourceMappingURL=promptBuilder.d.ts.map