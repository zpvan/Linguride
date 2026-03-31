export interface TextAnalysisHighlight {
  title: string;
  detail: string;
}

export interface TextAnalysisMetrics {
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordLength: number;
  averageSentenceLength: number;
  estimatedReadingMinutes: number;
}

export interface TextAnalysisSummary {
  normalizedText: string;
  excerpt: string;
  metrics: TextAnalysisMetrics;
  highlights: TextAnalysisHighlight[];
}
