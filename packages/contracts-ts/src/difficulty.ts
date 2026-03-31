export type DifficultyLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface VocabularyComplexity {
  rareWordCount: number;
  academicWordCount: number;
  avgWordLength: number;
}

export interface AnalysisVocabularyComplexity extends VocabularyComplexity {
  uniqueWordRatio: number;
  readabilityScore: number;
}

export interface SentenceComplexity {
  avgSentenceLength: number;
  complexSentenceRatio: number;
}

export interface AnalysisSentenceComplexity extends SentenceComplexity {
  avgClausesPerSentence: number;
  passiveVoiceRatio: number;
}

export interface DifficultyResult {
  difficultyLevel: DifficultyLevel;
  cefrLevel: CEFRLevel;
  score: number;
  vocabularyComplexity: VocabularyComplexity;
  sentenceComplexity: SentenceComplexity;
  estimatedReadingTime: number;
  suggestions: string[];
  sampleWordCount?: number;
  isSelection?: boolean;
}

export interface AnalysisResult
  extends Omit<DifficultyResult, "vocabularyComplexity" | "sentenceComplexity"> {
  vocabularyComplexity: AnalysisVocabularyComplexity;
  sentenceComplexity: AnalysisSentenceComplexity;
  analysisDate: Date;
  textLength: number;
  wordCount: number;
  providerId: string;
  model?: string;
}
