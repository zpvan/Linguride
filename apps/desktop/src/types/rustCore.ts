export type ProviderKind = "deepSeek" | "openAi" | "custom";
export type OpenAiAuthMode = "apiKey" | "oAuth";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ReaderMode = "translate" | "paraphrase" | "mixed";
export type DifficultyTier = "foundation" | "guided" | "stretch" | "intensive";
export type CaptureSourceApp = "browserExtension" | "desktopApp" | "manualInput";
export type CaptureType = "page" | "selection" | "clipboard" | "manual" | "fileImport";
export type PreferredSurface = "inbox" | "reader" | "tutor" | "corpus";
export type SessionKind = "reader" | "tutor" | "corpus";
export type SessionStatus = "draft" | "completed";

export interface LingurideConfig {
  provider: ProviderKind;
  openAiAuthMode: OpenAiAuthMode;
  apiBaseUrl: string;
  model: string;
  userLevel: CefrLevel;
  readerMode: ReaderMode;
  desktopHandoffEnabled: boolean;
}

export interface CaptureRecord {
  id: string;
  sourceApp: CaptureSourceApp;
  captureType: CaptureType;
  preferredSurface: PreferredSurface;
  originUrl?: string | null;
  title: string;
  text: string;
  preview: string;
  contentHash: string;
  createdAt: number;
  truncated: boolean;
}

export interface SessionRecord {
  id: string;
  kind: SessionKind;
  status: SessionStatus;
  captureId?: string | null;
  title: string;
  createdAt: number;
}

export interface WorkspaceSnapshot {
  config: LingurideConfig;
  captures: CaptureRecord[];
  sessions: SessionRecord[];
}

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

export interface DifficultyReport {
  tier: DifficultyTier;
  cefrLevel: CefrLevel;
  score: number;
  readingTimeMinutes: number;
  suggestions: string[];
}

export interface ReaderBlock {
  id: string;
  originalText: string;
  renderedText: string;
}

export interface ReaderDocument {
  captureId: string;
  title: string;
  originUrl?: string | null;
  mode: ReaderMode;
  blocks: ReaderBlock[];
}

export interface ReaderResult {
  document: ReaderDocument;
  difficulty: DifficultyReport;
  summary: TextAnalysisSummary;
}

export interface ManualCaptureInput {
  text: string;
  title?: string;
  originUrl?: string;
}
