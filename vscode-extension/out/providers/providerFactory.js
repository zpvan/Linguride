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
exports.ProviderFactory = void 0;
exports.createProvider = createProvider;
exports.createProviderById = createProviderById;
const vscode = __importStar(require("vscode"));
const configuration_1 = require("../utils/configuration");
/**
 * 提供商工厂类
 * 负责创建和管理LLM提供商实例
 */
class ProviderFactory {
    /**
     * 根据提供商ID创建或获取提供商实例
     * @param providerId 提供商ID ('openai', 'claude', 'deepseek')
     * @returns 提供商实例，如果配置无效则返回null
     */
    static async createProvider(providerId) {
        try {
            // 如果没有指定提供商，使用默认配置
            const config = configuration_1.ConfigurationManager.getConfig();
            const targetProviderId = providerId || config.defaultProvider;
            // 检查是否已有实例
            if (this.instances.has(targetProviderId)) {
                return this.instances.get(targetProviderId);
            }
            // 获取提供商配置
            const providerConfig = configuration_1.ConfigurationManager.getProviderConfig(targetProviderId);
            if (!providerConfig) {
                vscode.window.showWarningMessage(`未找到 ${targetProviderId} 的配置，请先配置API密钥`);
                return null;
            }
            // 验证配置
            if (!providerConfig.apiKey || providerConfig.apiKey.trim().length === 0) {
                vscode.window.showWarningMessage(`${targetProviderId} API密钥未配置，请先设置`);
                return null;
            }
            // 创建提供商实例
            let provider;
            switch (targetProviderId) {
                case 'openai':
                    const { OpenAIProvider } = await Promise.resolve().then(() => __importStar(require('./OpenAIProvider')));
                    provider = new OpenAIProvider(providerConfig);
                    break;
                case 'claude':
                    const { ClaudeProvider } = await Promise.resolve().then(() => __importStar(require('./ClaudeProvider')));
                    provider = new ClaudeProvider(providerConfig);
                    break;
                case 'deepseek':
                    const { DeepSeekProvider } = await Promise.resolve().then(() => __importStar(require('./DeepSeekProvider')));
                    provider = new DeepSeekProvider(providerConfig);
                    break;
                default:
                    throw new Error(`不支持的LLM提供商: ${targetProviderId}`);
            }
            // 验证提供商配置
            if (!provider.validateConfig(providerConfig)) {
                vscode.window.showErrorMessage(`${targetProviderId} 配置无效，请检查配置`);
                return null;
            }
            // 测试连接（可选，可以注释掉以加快启动速度）
            // const connected = await provider.testConnection();
            // if (!connected) {
            // 	vscode.window.showWarningMessage(
            // 		`无法连接到 ${targetProviderId} 服务，请检查网络和API密钥`
            // 	);
            // 	return null;
            // }
            // 缓存实例
            this.instances.set(targetProviderId, provider);
            return provider;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`创建LLM提供商失败: ${errorMessage}`);
            console.error('提供商创建错误:', error);
            return null;
        }
    }
    /**
     * 获取所有可用的提供商信息
     * @returns 提供商信息列表
     */
    static getAvailableProviders() {
        const config = configuration_1.ConfigurationManager.getConfig();
        const providers = [
            {
                id: 'openai',
                name: 'OpenAI',
                description: '使用GPT模型进行英文难度分析',
                configured: !!config.providers.openai?.apiKey
            },
            {
                id: 'claude',
                name: 'Claude',
                description: '使用Claude模型进行英文难度分析',
                configured: !!config.providers.claude?.apiKey
            },
            {
                id: 'deepseek',
                name: 'DeepSeek',
                description: '使用DeepSeek模型进行英文难度分析',
                configured: !!config.providers.deepseek?.apiKey
            }
        ];
        return providers;
    }
    /**
     * 清除缓存的提供商实例
     * @param providerId 可选的提供商ID，如果未提供则清除所有
     */
    static clearCache(providerId) {
        if (providerId) {
            this.instances.delete(providerId);
        }
        else {
            this.instances.clear();
        }
    }
    /**
     * 获取当前活跃的提供商ID
     * @returns 当前活跃的提供商ID
     */
    static getActiveProviderId() {
        const config = configuration_1.ConfigurationManager.getConfig();
        return config.defaultProvider;
    }
}
exports.ProviderFactory = ProviderFactory;
ProviderFactory.instances = new Map();
/**
 * 便捷函数：创建默认提供商
 * @returns 默认提供商实例
 */
async function createProvider() {
    return ProviderFactory.createProvider();
}
/**
 * 便捷函数：创建指定提供商
 * @param providerId 提供商ID
 * @returns 指定提供商实例
 */
async function createProviderById(providerId) {
    return ProviderFactory.createProvider(providerId);
}
//# sourceMappingURL=providerFactory.js.map