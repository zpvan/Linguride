/**
 * 英文难度分析扩展的核心类型定义
 */

/**
 * 难度等级枚举
 */
export type DifficultyLevel =
	| 'Beginner'    // A1-A2
	| 'Intermediate' // B1-B2
	| 'Advanced'     // C1
	| 'Expert';      // C2

/**
 * CEFR等级（欧洲共同语言参考标准）
 */
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * 词汇复杂度分析
 */
export interface VocabularyComplexity {
	rareWordCount: number;           // 罕见词数量
	academicWordCount: number;       // 学术词汇数量
	avgWordLength: number;           // 平均词长
	uniqueWordRatio: number;         // 唯一词比例
	readabilityScore: number;        // 可读性分数
}

/**
 * 句子复杂度分析
 */
export interface SentenceComplexity {
	avgSentenceLength: number;       // 平均句长（词数）
	complexSentenceRatio: number;    // 复杂句式比例
	avgClausesPerSentence: number;   // 每句平均子句数
	passiveVoiceRatio: number;       // 被动语态比例
}

/**
 * 分析选项
 */
export interface AnalysisOptions {
	text: string;                    // 待分析的文本
	language?: string;               // 语言代码，默认 'en'
	detailed?: boolean;              // 是否包含详细分析
	maxTokens?: number;              // 最大token数（用于API调用）
}

/**
 * 分析结果
 */
export interface AnalysisResult {
	difficultyLevel: DifficultyLevel; // 难度等级
	cefrLevel: CEFRLevel;            // CEFR等级
	score: number;                   // 综合分数 (0-100)

	vocabularyComplexity: VocabularyComplexity; // 词汇复杂度
	sentenceComplexity: SentenceComplexity;     // 句子复杂度

	estimatedReadingTime: number;    // 预计阅读时间（分钟）
	suggestions: string[];           // 改进建议

	analysisDate: Date;              // 分析时间
	textLength: number;              // 文本长度（字符数）
	wordCount: number;               // 词数

	providerId: string;              // 使用的LLM提供商ID
	model?: string;                  // 使用的模型
}

/**
 * Prompt模板配置
 */
export interface PromptTemplates {
	system?: string;                 // 系统提示模板
	user?: string;                   // 用户提示模板
}

/**
 * LLM提供商配置
 */
export interface ProviderConfig {
	apiKey: string;                  // API密钥
	model?: string;                  // 模型名称
	endpoint?: string;               // API端点
	maxTokens?: number;              // 最大token数
	temperature?: number;            // 温度参数
	timeout?: number;                // 超时时间（毫秒）
	promptTemplates?: PromptTemplates; // Prompt模板配置（可选）
}

/**
 * 扩展配置
 */
export interface ExtensionConfig {
	defaultProvider: 'openai' | 'claude' | 'deepseek';
	providers: {
		openai?: ProviderConfig;
		claude?: ProviderConfig;
		deepseek?: ProviderConfig;
	};
	analysis: {
		defaultLanguage: string;
		includeSuggestions: boolean;
		maxHistoryItems: number;
		promptTemplates?: PromptTemplates; // 全局prompt模板配置（可选）
	};
}

/**
 * API错误类型
 */
export interface APIError {
	code: string;
	message: string;
	statusCode?: number;
	retryable: boolean;
}