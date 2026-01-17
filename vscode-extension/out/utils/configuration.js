"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const vscode = __importStar(require("vscode"));
const defaults_1 = require("../constants/defaults");
/**
 * 配置管理类
 * 处理VS Code设置API的读写操作
 */
class ConfigurationManager {
    /**
     * 获取完整的扩展配置
     * @returns 扩展配置对象
     */
    static getConfig() {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        // 获取prompt模板配置，使用空对象作为默认值
        const globalPromptTemplates = config.get('analysis.promptTemplates', {});
        // 确保promptTemplates对象完整，使用配置常量作为最终保障
        const validatedPromptTemplates = {
            system: globalPromptTemplates?.system || defaults_1.DEFAULT_PROMPT_TEMPLATES.system,
            user: globalPromptTemplates?.user || defaults_1.DEFAULT_PROMPT_TEMPLATES.user
        };
        // 构建配置对象，提供合理的默认值
        const extensionConfig = {
            defaultProvider: config.get('defaultProvider', 'deepseek'),
            providers: {
                openai: this.getProviderConfig('openai'),
                claude: this.getProviderConfig('claude'),
                deepseek: this.getProviderConfig('deepseek')
            },
            analysis: {
                defaultLanguage: config.get('analysis.defaultLanguage', 'en'),
                includeSuggestions: config.get('analysis.includeSuggestions', true),
                maxHistoryItems: config.get('analysis.maxHistoryItems', 50),
                promptTemplates: validatedPromptTemplates
            }
        };
        return extensionConfig;
    }
    /**
     * 获取特定提供商的配置
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @returns 提供商配置对象，如果未配置则返回undefined
     */
    static getProviderConfig(providerId) {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        const providerConfig = config.get(`providers.${providerId}`);
        if (!providerConfig || typeof providerConfig !== 'object') {
            return undefined;
        }
        // 确保返回的对象包含所有必需的字段
        const typedConfig = providerConfig;
        return {
            apiKey: typedConfig.apiKey || '',
            model: typedConfig.model || this.getDefaultModel(providerId),
            endpoint: typedConfig.endpoint || this.getDefaultEndpoint(providerId),
            maxTokens: typedConfig.maxTokens || 2000,
            temperature: typedConfig.temperature || 0.3,
            timeout: typedConfig.timeout || 30000,
            // 新增：prompt模板配置
            promptTemplates: typedConfig.promptTemplates || undefined
        };
    }
    /**
     * 更新扩展配置
     * @param updates 要更新的配置部分
     * @param target 配置目标（全局或工作区）
     * @returns 更新是否成功
     */
    static async updateConfig(updates, target = vscode.ConfigurationTarget.Global) {
        try {
            const config = vscode.workspace.getConfiguration(this.SECTION);
            // 递归更新配置对象
            for (const [key, value] of Object.entries(updates)) {
                await config.update(key, value, target);
            }
            return true;
        }
        catch (error) {
            console.error('更新配置失败:', error);
            return false;
        }
    }
    /**
     * 更新提供商配置
     * @param providerId 提供商ID
     * @param providerConfig 新的提供商配置
     * @param target 配置目标
     * @returns 更新是否成功
     */
    static async updateProviderConfig(providerId, providerConfig, target = vscode.ConfigurationTarget.Global) {
        try {
            const config = vscode.workspace.getConfiguration(this.SECTION);
            const key = `providers.${providerId}`;
            await config.update(key, providerConfig, target);
            return true;
        }
        catch (error) {
            console.error(`更新提供商 ${providerId} 配置失败:`, error);
            return false;
        }
    }
    /**
     * 验证提供商配置是否有效
     * @param providerId 提供商ID
     * @returns 配置是否有效
     */
    static validateProviderConfig(providerId) {
        const config = this.getProviderConfig(providerId);
        if (!config) {
            return false;
        }
        // 检查API密钥
        if (!config.apiKey || config.apiKey.trim().length === 0) {
            return false;
        }
        // 检查模型名称（如果提供）
        if (config.model && config.model.trim().length === 0) {
            return false;
        }
        // 检查端点URL（如果提供）
        if (config.endpoint && !this.isValidUrl(config.endpoint)) {
            return false;
        }
        return true;
    }
    /**
     * 获取默认的提供商模型
     * @param providerId 提供商ID
     * @returns 默认模型名称
     */
    static getDefaultModel(providerId) {
        switch (providerId) {
            case 'openai':
                return 'gpt-4-turbo-preview';
            case 'claude':
                return 'claude-3-sonnet-20240229';
            case 'deepseek':
                return 'deepseek-chat';
            default:
                return '';
        }
    }
    /**
     * 获取默认的API端点
     * @param providerId 提供商ID
     * @returns 默认端点URL
     */
    static getDefaultEndpoint(providerId) {
        switch (providerId) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'claude':
                return 'https://api.anthropic.com/v1/messages';
            case 'deepseek':
                return 'https://api.deepseek.com/chat/completions';
            default:
                return '';
        }
    }
    /**
     * 验证URL格式
     * @param url 待验证的URL
     * @returns URL是否有效
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 获取配置变更事件
     * @returns 配置变更事件
     */
    static onDidChangeConfiguration(listener) {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(this.SECTION)) {
                listener(e);
            }
        });
    }
    /**
     * 检查配置是否已初始化
     * @returns 是否至少有一个提供商已配置
     */
    static isConfigured() {
        const config = this.getConfig();
        return (!!config.providers.openai?.apiKey ||
            !!config.providers.claude?.apiKey ||
            !!config.providers.deepseek?.apiKey);
    }
    /**
     * 获取配置状态摘要
     * @returns 配置状态信息
     */
    static getConfigStatus() {
        const config = this.getConfig();
        const configuredProviders = [];
        if (config.providers.openai?.apiKey) {
            configuredProviders.push('OpenAI');
        }
        if (config.providers.claude?.apiKey) {
            configuredProviders.push('Claude');
        }
        if (config.providers.deepseek?.apiKey) {
            configuredProviders.push('DeepSeek');
        }
        return {
            isConfigured: configuredProviders.length > 0,
            configuredProviders,
            defaultProvider: config.defaultProvider
        };
    }
    /**
     * 验证prompt配置是否完整
     * @returns 验证结果和可选的错误信息
     */
    static validatePromptConfig() {
        const config = this.getConfig();
        if (!config.analysis.promptTemplates?.system || !config.analysis.promptTemplates?.user) {
            return {
                isValid: false,
                message: 'Prompt模板配置不完整，请检查linguride.analysis.promptTemplates设置'
            };
        }
        return { isValid: true };
    }
}
exports.ConfigurationManager = ConfigurationManager;
ConfigurationManager.SECTION = 'linguride';
//# sourceMappingURL=configuration.js.map