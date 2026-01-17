"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProvider = void 0;
/**
 * LLM提供商基类
 * 提供一些通用功能
 */
class BaseProvider {
    constructor(config) {
        this.config = config;
    }
    validateConfig(config) {
        // 基础验证：检查API密钥是否存在
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
    getEstimatedCost(textLength) {
        // 基础估算：假设每1000字符0.01美元
        // 具体提供商可以覆盖此方法提供更准确的估算
        const tokens = Math.ceil(textLength / 4); // 粗略估算：1 token ≈ 4字符
        const costPerToken = 0.00001; // 每token 0.00001美元
        return tokens * costPerToken;
    }
    async testConnection() {
        try {
            // 发送一个简单的测试请求
            const testOptions = {
                text: 'This is a test sentence.',
                language: 'en',
                detailed: false
            };
            // 使用简化的分析，避免消耗大量token
            const result = await this.analyze(testOptions);
            return !!result && result.score >= 0;
        }
        catch (error) {
            console.error(`Provider ${this.name} connection test failed:`, error);
            return false;
        }
    }
    /**
     * 验证URL格式
     * @param url 待验证的URL
     * @returns URL是否有效
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 构建API请求头
     * @returns 请求头对象
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
        // 添加提供商特定的头信息
        if (this.id === 'anthropic') {
            headers['anthropic-version'] = '2023-06-01';
            headers['x-api-key'] = this.config.apiKey;
            delete headers['Authorization']; // Claude使用不同的认证头
        }
        return headers;
    }
    /**
     * 处理API错误
     * @param error 错误对象
     * @throws 格式化的错误信息
     */
    handleApiError(error) {
        if (error.response) {
            // API返回了错误响应
            const status = error.response.status;
            const data = error.response.data;
            let message = `API错误 (${status}): `;
            if (data?.error?.message) {
                message += data.error.message;
            }
            else if (data?.message) {
                message += data.message;
            }
            else {
                message += '未知错误';
            }
            throw new Error(message);
        }
        else if (error.request) {
            // 请求已发送但没有收到响应
            throw new Error('网络错误：无法连接到API服务');
        }
        else {
            // 请求配置错误
            throw new Error(`请求配置错误: ${error.message}`);
        }
    }
}
exports.BaseProvider = BaseProvider;
//# sourceMappingURL=ILLMProvider.js.map