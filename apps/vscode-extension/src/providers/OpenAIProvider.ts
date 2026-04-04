import axios, { AxiosInstance } from 'axios';
import { parseDifficultyAnalysisContent } from '@linguride/text-assistant-core';
import { BaseProvider } from './ILLMProvider';
import { AnalysisOptions, AnalysisResult, ProviderConfig } from '../types';
import { ConfigurationManager } from '../utils/configuration';
import { PromptBuilder } from '../utils/promptBuilder';

/**
 * OpenAI LLM提供商实现
 * 使用OpenAI GPT模型进行英文难度分析
 */
export class OpenAIProvider extends BaseProvider {
	readonly name = 'OpenAI';
	readonly id = 'openai';
	readonly description = '使用OpenAI GPT模型进行英文难度分析';

	private axiosInstance: AxiosInstance;

	constructor(config: ProviderConfig) {
		super(config);

		// 创建Axios实例
		this.axiosInstance = axios.create({
			baseURL: config.endpoint || 'https://api.openai.com',
			timeout: config.timeout || 30000,
			headers: this.getHeaders()
		});
	}

	/**
	 * 分析英文文本难度
	 */
	async analyze(options: AnalysisOptions): Promise<AnalysisResult> {
		try {
			// 获取配置
			const config = ConfigurationManager.getConfig();

			// 使用PromptBuilder构建提示词
			const systemPrompt = PromptBuilder.getSystemPrompt(this.id, config);
			const userPrompt = PromptBuilder.getUserPrompt(options.text, this.id, config, options.language);

			// 准备请求数据
			const requestData = {
				model: this.config.model || 'gpt-4-turbo-preview',
				messages: [
					{
						role: 'system',
						content: systemPrompt
					},
					{
						role: 'user',
						content: userPrompt
					}
				],
				max_tokens: this.config.maxTokens || 2000,
				temperature: this.config.temperature || 0.3,
				response_format: { type: 'json_object' }
			};

			// 发送API请求
			const response = await this.axiosInstance.post('/v1/chat/completions', requestData);

			// 解析响应
			const result = this.parseResponse(response.data, options.text);
			return result;

		} catch (error) {
			// 处理API错误
			this.handleApiError(error);
		}
	}


	/**
	 * 解析API响应
	 */
	private parseResponse(response: any, originalText: string): AnalysisResult {
		try {
			// 提取响应内容
			const content = response.choices?.[0]?.message?.content;
			if (!content) {
				throw new Error('API响应中缺少内容');
			}

			return parseDifficultyAnalysisContent(content, originalText, {
				providerId: this.id,
				model: this.config.model
			});

		} catch (error) {
			console.error('解析OpenAI响应失败:', error);
			throw new Error(`解析响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	/**
	 * 重写验证配置方法，添加OpenAI特定验证
	 */
	validateConfig(config: ProviderConfig): boolean {
		// 调用基类验证
		if (!super.validateConfig(config)) {
			return false;
		}

		// OpenAI特定验证
		// 检查API密钥格式（OpenAI API密钥通常以'sk-'开头）
		if (config.apiKey && !config.apiKey.startsWith('sk-')) {
			console.warn('OpenAI API密钥可能格式不正确，通常以"sk-"开头');
			// 不返回false，因为API密钥格式可能变化
		}

		return true;
	}

	/**
	 * 重写估算成本方法，提供更准确的OpenAI成本估算
	 */
	getEstimatedCost(textLength: number): number {
		// OpenAI定价（示例，实际价格可能不同）
		const tokens = Math.ceil(textLength / 4); // 粗略估算：1 token ≈ 4字符
		const costPerToken = 0.00003; // GPT-4 Turbo每token大约0.00003美元
		return tokens * costPerToken;
	}
}
