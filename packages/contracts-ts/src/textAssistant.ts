export type AnalysisProviderId = "openai" | "claude" | "deepseek";

export interface PromptTemplates {
  system?: string;
  user?: string;
}

export interface AnalysisOptions {
  text: string;
  language?: string;
  detailed?: boolean;
  maxTokens?: number;
}

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  promptTemplates?: PromptTemplates;
}

export interface ExtensionConfig {
  defaultProvider: AnalysisProviderId;
  providers: Partial<Record<AnalysisProviderId, ProviderConfig>>;
  analysis: {
    defaultLanguage: string;
    includeSuggestions: boolean;
    maxHistoryItems: number;
    promptTemplates?: PromptTemplates;
  };
}

export interface APIError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
}
