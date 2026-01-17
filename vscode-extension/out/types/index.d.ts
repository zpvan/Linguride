/**
 * 英文难度分析扩展的核心类型定义
 */
/**
 * 难度等级枚举
 */
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
/**
 * CEFR等级（欧洲共同语言参考标准）
 */
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
/**
 * 词汇复杂度分析
 */
export interface VocabularyComplexity {
    rareWordCount: number;
    academicWordCount: number;
    avgWordLength: number;
    uniqueWordRatio: number;
    readabilityScore: number;
}
/**
 * 句子复杂度分析
 */
export interface SentenceComplexity {
    avgSentenceLength: number;
    complexSentenceRatio: number;
    avgClausesPerSentence: number;
    passiveVoiceRatio: number;
}
/**
 * 分析选项
 */
export interface AnalysisOptions {
    text: string;
    language?: string;
    detailed?: boolean;
    maxTokens?: number;
}
/**
 * 分析结果
 */
export interface AnalysisResult {
    difficultyLevel: DifficultyLevel;
    cefrLevel: CEFRLevel;
    score: number;
    vocabularyComplexity: VocabularyComplexity;
    sentenceComplexity: SentenceComplexity;
    estimatedReadingTime: number;
    suggestions: string[];
    analysisDate: Date;
    textLength: number;
    wordCount: number;
    providerId: string;
    model?: string;
}
/**
 * Prompt模板配置
 */
export interface PromptTemplates {
    system?: string;
    user?: string;
}
/**
 * LLM提供商配置
 */
export interface ProviderConfig {
    apiKey: string;
    model?: string;
    endpoint?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    promptTemplates?: PromptTemplates;
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
        promptTemplates?: PromptTemplates;
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
//# sourceMappingURL=index.d.ts.map