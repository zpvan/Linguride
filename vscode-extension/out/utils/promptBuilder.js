"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
/**
 * Prompt构建工具类
 * 处理prompt模板的获取、优先级解析和变量替换
 */
class PromptBuilder {
    /**
     * 获取最终的系统提示
     * 优先级：provider特定配置 > 全局配置 > 默认值
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @param config 扩展配置
     * @returns 系统提示字符串
     */
    static getSystemPrompt(providerId, config) {
        // 1. 尝试获取provider特定配置
        const providerConfig = config.providers[providerId];
        if (providerConfig?.promptTemplates?.system) {
            return providerConfig.promptTemplates.system;
        }
        // 2. 使用全局配置（由ConfigurationManager确保不为空）
        return config.analysis.promptTemplates.system;
    }
    /**
     * 获取最终的用户提示（进行变量替换）
     * 优先级：provider特定配置 > 全局配置 > 默认值
     * @param text 用户输入的文本
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @param config 扩展配置
     * @param language 语言代码，默认 'en'
     * @returns 用户提示字符串（已进行变量替换）
     */
    static getUserPrompt(text, providerId, config, language = 'en') {
        let template;
        // 1. 尝试获取provider特定配置
        const providerConfig = config.providers[providerId];
        if (providerConfig?.promptTemplates?.user) {
            template = providerConfig.promptTemplates.user;
        }
        // 2. 使用全局配置（由ConfigurationManager确保不为空）
        else {
            template = config.analysis.promptTemplates.user;
        }
        // 执行变量替换
        return this.replaceVariables(template, {
            text,
            language,
            date: new Date().toISOString().split('T')[0] // YYYY-MM-DD格式
        });
    }
    /**
     * 变量替换
     * 将模板中的占位符（如{text}）替换为实际值
     * @param template 原始模板字符串
     * @param variables 变量映射对象
     * @returns 替换后的字符串
     */
    static replaceVariables(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{${key}}`;
            // 使用全局替换，处理可能出现的多个相同占位符
            result = result.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), value);
        }
        return result;
    }
    /**
     * 转义正则表达式特殊字符
     * 用于安全地创建正则表达式
     */
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * 验证prompt模板是否包含必要的占位符
     * @param template 待验证的模板
     * @param requiredPlaceholders 必需的占位符数组
     * @returns 验证结果和缺失的占位符
     */
    static validateTemplate(template, requiredPlaceholders = ['text']) {
        const missing = [];
        for (const placeholder of requiredPlaceholders) {
            const regex = new RegExp(`\\{${this.escapeRegExp(placeholder)}\\}`);
            if (!regex.test(template)) {
                missing.push(placeholder);
            }
        }
        return {
            isValid: missing.length === 0,
            missingPlaceholders: missing
        };
    }
    /**
     * 获取支持的变量列表（用于文档和UI显示）
     * @returns 支持的变量描述对象
     */
    static getSupportedVariables() {
        return [
            {
                name: 'text',
                description: '用户输入的英文文本',
                example: '{text}'
            },
            {
                name: 'language',
                description: '分析语言代码',
                example: '{language}'
            },
            {
                name: 'date',
                description: '当前日期（YYYY-MM-DD格式）',
                example: '{date}'
            }
        ];
    }
    /**
     * 验证prompt配置是否完整
     * @param config 扩展配置
     * @param providerId 提供商ID
     * @returns 验证结果和缺失的配置项
     */
    static validatePromptConfig(config, providerId) {
        const missingConfigs = [];
        // 由于ConfigurationManager已确保全局配置完整，只需检查provider特定配置
        const providerConfig = config.providers[providerId];
        if (!providerConfig?.promptTemplates?.system && !config.analysis.promptTemplates?.system) {
            missingConfigs.push(`系统提示模板`);
        }
        if (!providerConfig?.promptTemplates?.user && !config.analysis.promptTemplates?.user) {
            missingConfigs.push(`用户提示模板`);
        }
        return {
            isValid: missingConfigs.length === 0,
            missingConfigs
        };
    }
}
exports.PromptBuilder = PromptBuilder;
//# sourceMappingURL=promptBuilder.js.map