import type {
  AnalysisResult,
  CEFRLevel,
  DifficultyLevel,
} from "@linguride/contracts-ts";

interface RawVocabularyComplexity {
  rareWordCount?: unknown;
  academicWordCount?: unknown;
  avgWordLength?: unknown;
  uniqueWordRatio?: unknown;
  readabilityScore?: unknown;
}

interface RawSentenceComplexity {
  avgSentenceLength?: unknown;
  complexSentenceRatio?: unknown;
  avgClausesPerSentence?: unknown;
  passiveVoiceRatio?: unknown;
}

interface RawAnalysisPayload {
  difficultyLevel?: unknown;
  cefrLevel?: unknown;
  score?: unknown;
  vocabularyComplexity?: RawVocabularyComplexity;
  sentenceComplexity?: RawSentenceComplexity;
  estimatedReadingTime?: unknown;
  suggestions?: unknown;
}

export interface AnalysisResultMetadata {
  providerId: string;
  model?: string;
  analysisDate?: Date;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function clampScore(value: unknown, fallback = 50): number {
  return Math.max(0, Math.min(100, asNumber(value, fallback)));
}

export function clampRatio(value: unknown, fallback = 0.5): number {
  return Math.max(0, Math.min(1, asNumber(value, fallback)));
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function normalizeDifficultyLevel(level: string): DifficultyLevel {
  const normalized = level.toLowerCase();

  if (normalized.includes("beginner")) {
    return "Beginner";
  }

  if (normalized.includes("intermediate")) {
    return "Intermediate";
  }

  if (normalized.includes("advanced")) {
    return "Advanced";
  }

  if (normalized.includes("expert")) {
    return "Expert";
  }

  return "Intermediate";
}

export function normalizeCEFRLevel(
  level: string,
  fallbackDifficultyLevel?: DifficultyLevel
): CEFRLevel {
  const normalized = level.toUpperCase();

  if (["A1", "A2", "B1", "B2", "C1", "C2"].includes(normalized)) {
    return normalized as CEFRLevel;
  }

  switch (fallbackDifficultyLevel) {
    case "Beginner":
      return "A1";
    case "Intermediate":
      return "B1";
    case "Advanced":
      return "C1";
    case "Expert":
      return "C2";
    default:
      return "B1";
  }
}

export function parseStructuredJsonContent<T = unknown>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const fencedJsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fencedJsonMatch) {
      return JSON.parse(fencedJsonMatch[1].trim()) as T;
    }

    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as T;
    }

    throw new Error("无法解析JSON响应");
  }
}

export function createAnalysisResult(
  payload: RawAnalysisPayload,
  originalText: string,
  metadata: AnalysisResultMetadata
): AnalysisResult {
  const difficultyLevel = normalizeDifficultyLevel(String(payload.difficultyLevel || ""));

  return {
    difficultyLevel,
    cefrLevel: normalizeCEFRLevel(String(payload.cefrLevel || ""), difficultyLevel),
    score: clampScore(payload.score),
    vocabularyComplexity: {
      rareWordCount: asNumber(payload.vocabularyComplexity?.rareWordCount),
      academicWordCount: asNumber(payload.vocabularyComplexity?.academicWordCount),
      avgWordLength: asNumber(payload.vocabularyComplexity?.avgWordLength),
      uniqueWordRatio: clampRatio(payload.vocabularyComplexity?.uniqueWordRatio),
      readabilityScore: clampScore(payload.vocabularyComplexity?.readabilityScore),
    },
    sentenceComplexity: {
      avgSentenceLength: asNumber(payload.sentenceComplexity?.avgSentenceLength),
      complexSentenceRatio: clampRatio(payload.sentenceComplexity?.complexSentenceRatio),
      avgClausesPerSentence: asNumber(payload.sentenceComplexity?.avgClausesPerSentence),
      passiveVoiceRatio: clampRatio(payload.sentenceComplexity?.passiveVoiceRatio),
    },
    estimatedReadingTime: Math.max(0.1, asNumber(payload.estimatedReadingTime, 1)),
    suggestions: Array.isArray(payload.suggestions)
      ? payload.suggestions
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 5)
      : [],
    analysisDate: metadata.analysisDate || new Date(),
    textLength: originalText.length,
    wordCount: countWords(originalText),
    providerId: metadata.providerId,
    model: metadata.model,
  };
}

export function parseDifficultyAnalysisContent(
  content: string,
  originalText: string,
  metadata: AnalysisResultMetadata
): AnalysisResult {
  const parsed = parseStructuredJsonContent<RawAnalysisPayload>(content);

  for (const requiredField of ["difficultyLevel", "cefrLevel", "score"] as const) {
    if (parsed[requiredField] === undefined) {
      throw new Error(`响应中缺少必需字段: ${requiredField}`);
    }
  }

  return createAnalysisResult(parsed, originalText, metadata);
}
