import type { AnalysisOptions, AnalysisResult } from "@linguride/contracts-ts";

export interface TextAnalysisProvider {
  readonly id: string;
  analyze(options: AnalysisOptions): Promise<AnalysisResult>;
}

export interface BatchAnalysisProgress {
  current: number;
  total: number;
  text: string;
}

export interface BatchAnalysisErrorContext {
  index: number;
  text: string;
}

export interface BatchAnalysisHooks {
  onProgress?: (progress: BatchAnalysisProgress) => void;
  isCancelled?: () => boolean;
  onError?: (error: unknown, context: BatchAnalysisErrorContext) => void;
}

export class TextAnalysisService {
  private history: AnalysisResult[] = [];

  constructor(
    private readonly provider: TextAnalysisProvider,
    private readonly maxHistorySize = 50
  ) {}

  async analyzeText(
    text: string,
    options: Partial<AnalysisOptions> = {}
  ): Promise<AnalysisResult> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new Error("分析文本不能为空");
    }

    const analysisOptions: AnalysisOptions = {
      text: normalizedText,
      language: options.language || "en",
      detailed: options.detailed !== undefined ? options.detailed : true,
      maxTokens: options.maxTokens,
    };

    const result = await this.provider.analyze(analysisOptions);
    if (!result.providerId) {
      result.providerId = this.provider.id;
    }

    this.addToHistory(result);
    return result;
  }

  async analyzeBatch(
    texts: string[],
    hooks: BatchAnalysisHooks = {}
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const total = texts.length;

    for (let index = 0; index < total; index += 1) {
      if (hooks.isCancelled?.()) {
        break;
      }

      const text = texts[index];
      hooks.onProgress?.({
        current: index + 1,
        total,
        text,
      });

      try {
        const result = await this.analyzeText(text);
        results.push(result);
      } catch (error) {
        hooks.onError?.(error, { index, text });
      }
    }

    return results;
  }

  getHistory(limit?: number): AnalysisResult[] {
    if (limit && limit > 0) {
      return this.history.slice(0, limit);
    }

    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistoryStats(): {
    total: number;
    byDifficulty: Record<string, number>;
    avgScore: number;
    byProvider: Record<string, number>;
  } {
    const stats = {
      total: this.history.length,
      byDifficulty: {
        Beginner: 0,
        Intermediate: 0,
        Advanced: 0,
        Expert: 0,
      },
      avgScore: 0,
      byProvider: {} as Record<string, number>,
    };

    if (this.history.length === 0) {
      return stats;
    }

    let totalScore = 0;

    for (const result of this.history) {
      stats.byDifficulty[result.difficultyLevel] =
        (stats.byDifficulty[result.difficultyLevel] || 0) + 1;

      totalScore += result.score;

      const provider = result.providerId || "unknown";
      stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
    }

    stats.avgScore = totalScore / this.history.length;
    return stats;
  }

  exportHistory(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      return this.exportHistoryAsCsv();
    }

    return JSON.stringify(this.history, null, 2);
  }

  compareResults(result1: AnalysisResult, result2: AnalysisResult): {
    scoreDifference: number;
    difficultyChange: string;
    readingTimeRatio: number;
    vocabularyComparison: {
      rareWords: number;
      academicWords: number;
    };
  } {
    return {
      scoreDifference: result2.score - result1.score,
      difficultyChange: `${result1.difficultyLevel} → ${result2.difficultyLevel}`,
      readingTimeRatio: result2.estimatedReadingTime / result1.estimatedReadingTime,
      vocabularyComparison: {
        rareWords:
          result2.vocabularyComplexity.rareWordCount -
          result1.vocabularyComplexity.rareWordCount,
        academicWords:
          result2.vocabularyComplexity.academicWordCount -
          result1.vocabularyComplexity.academicWordCount,
      },
    };
  }

  private addToHistory(result: AnalysisResult): void {
    this.history.unshift(result);

    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
  }

  private exportHistoryAsCsv(): string {
    if (this.history.length === 0) {
      return "";
    }

    const headers = [
      "Date",
      "Difficulty Level",
      "CEFR Level",
      "Score",
      "Text Length",
      "Word Count",
      "Reading Time (min)",
      "Provider",
    ];

    const rows = this.history.map((result) => [
      result.analysisDate.toISOString(),
      result.difficultyLevel,
      result.cefrLevel,
      result.score.toString(),
      result.textLength.toString(),
      result.wordCount.toString(),
      result.estimatedReadingTime.toString(),
      result.providerId,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }
}
