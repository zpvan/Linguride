import axios, { AxiosInstance } from 'axios';
import { BaseProvider } from './ILLMProvider';
import { AnalysisOptions, AnalysisResult, ProviderConfig } from '../types';
import { ConfigurationManager } from '../utils/configuration';
import { PromptBuilder } from '../utils/promptBuilder';

/**
 * DeepSeek LLM提供商实现
 * 使用DeepSeek API进行英文难度分析
 */
export class DeepSeekProvider extends BaseProvider {
	readonly name = 'DeepSeek';
	readonly id = 'deepseek';
	readonly description = '使用DeepSeek模型进行英文难度分析';

	private axiosInstance: AxiosInstance;

	constructor(config: ProviderConfig) {
		super(config);

		// 创建Axios实例
		this.axiosInstance = axios.create({
			baseURL: config.endpoint || 'https://api.deepseek.com',
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

			// 使用PromptBuilder构建提示词（与其他provider保持一致）
			const systemPrompt = PromptBuilder.getSystemPrompt(this.id, config);
			const userPrompt = PromptBuilder.getUserPrompt(options.text, this.id, config, options.language);

			// 准备请求数据
			const requestData = {
				model: this.config.model || 'deepseek-chat',
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
			const response = await this.axiosInstance.post('/chat/completions', requestData);

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

			// 解析JSON响应
			let parsedData;
			try {
				parsedData = JSON.parse(content);
			} catch (parseError) {
				// 尝试提取JSON部分（如果响应包含其他文本）
				const jsonMatch = content.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					parsedData = JSON.parse(jsonMatch[0]);
				} else {
					throw new Error('无法解析JSON响应');
				}
			}

			// 验证必需字段
			const requiredFields = ['difficultyLevel', 'cefrLevel', 'score'];
			for (const field of requiredFields) {
				if (parsedData[field] === undefined) {
					throw new Error(`响应中缺少必需字段: ${field}`);
				}
			}

			// 构建分析结果
			const result: AnalysisResult = {
				difficultyLevel: this.normalizeDifficultyLevel(parsedData.difficultyLevel),
				cefrLevel: this.normalizeCEFRLevel(parsedData.cefrLevel),
				score: this.clampScore(parsedData.score),

				vocabularyComplexity: {
					rareWordCount: parsedData.vocabularyComplexity?.rareWordCount || 0,
					academicWordCount: parsedData.vocabularyComplexity?.academicWordCount || 0,
					avgWordLength: parsedData.vocabularyComplexity?.avgWordLength || 0,
					uniqueWordRatio: this.clampRatio(parsedData.vocabularyComplexity?.uniqueWordRatio),
					readabilityScore: this.clampScore(parsedData.vocabularyComplexity?.readabilityScore)
				},

				sentenceComplexity: {
					avgSentenceLength: parsedData.sentenceComplexity?.avgSentenceLength || 0,
					complexSentenceRatio: this.clampRatio(parsedData.sentenceComplexity?.complexSentenceRatio),
					avgClausesPerSentence: parsedData.sentenceComplexity?.avgClausesPerSentence || 0,
					passiveVoiceRatio: this.clampRatio(parsedData.sentenceComplexity?.passiveVoiceRatio)
				},

				estimatedReadingTime: Math.max(0.1, parsedData.estimatedReadingTime || 1),
				suggestions: Array.isArray(parsedData.suggestions) ? parsedData.suggestions.slice(0, 5) : [],

				analysisDate: new Date(),
				textLength: originalText.length,
				wordCount: this.countWords(originalText),

				providerId: this.id,
				model: this.config.model
			};

			return result;

		} catch (error) {
			console.error('解析DeepSeek响应失败:', error);
			throw new Error(`解析响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	/**
	 * 标准化难度等级
	 */
	private normalizeDifficultyLevel(level: string): AnalysisResult['difficultyLevel'] {
		const normalized = level.toLowerCase();
		if (normalized.includes('beginner')) return 'Beginner';
		if (normalized.includes('intermediate')) return 'Intermediate';
		if (normalized.includes('advanced')) return 'Advanced';
		if (normalized.includes('expert')) return 'Expert';

		// 默认值
		return 'Intermediate';
	}

	/**
	 * 标准化CEFR等级
	 */
	private normalizeCEFRLevel(level: string): AnalysisResult['cefrLevel'] {
		const normalized = level.toUpperCase();
		if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(normalized)) {
			return normalized as AnalysisResult['cefrLevel'];
		}

		// 根据难度等级推断CEFR等级
		const difficultyLevel = this.normalizeDifficultyLevel(level);
		switch (difficultyLevel) {
			case 'Beginner': return 'A1';
			case 'Intermediate': return 'B1';
			case 'Advanced': return 'C1';
			case 'Expert': return 'C2';
			default: return 'B1';
		}
	}

	/**
	 * 限制分数在0-100范围内
	 */
	private clampScore(score: number): number {
		if (typeof score !== 'number' || isNaN(score)) {
			return 50; // 默认值
		}
		return Math.max(0, Math.min(100, score));
	}

	/**
	 * 限制比例在0-1范围内
	 */
	private clampRatio(ratio: number): number {
		if (typeof ratio !== 'number' || isNaN(ratio)) {
			return 0.5; // 默认值
		}
		return Math.max(0, Math.min(1, ratio));
	}

	/**
	 * 计算词数
	 */
	private countWords(text: string): number {
		return text.trim().split(/\s+/).length;
	}

	/**
	 * 重写验证配置方法，添加DeepSeek特定验证
	 */
	validateConfig(config: ProviderConfig): boolean {
		// 调用基类验证
		if (!super.validateConfig(config)) {
			return false;
		}

		// DeepSeek特定验证
		// 检查API密钥格式（DeepSeek API密钥通常以特定前缀开头）
		if (config.apiKey && !config.apiKey.startsWith('sk-')) {
			console.warn('DeepSeek API密钥可能格式不正确，通常以"sk-"开头');
			// 不返回false，因为API密钥格式可能变化
		}

		return true;
	}

	/**
	 * 重写估算成本方法，提供更准确的DeepSeek成本估算
	 */
	getEstimatedCost(textLength: number): number {
		// DeepSeek定价（示例，实际价格可能不同）
		const tokens = Math.ceil(textLength / 4); // 粗略估算：1 token ≈ 4字符
		const costPerToken = 0.0000008; // DeepSeek每token大约0.0000008美元
		return tokens * costPerToken;
	}
}