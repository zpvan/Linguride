import * as vscode from 'vscode';
import { TextAnalysisService } from '@linguride/text-assistant-core';
import { ILLMProvider } from '../providers/ILLMProvider';
import { AnalysisOptions, AnalysisResult } from '../types';

/**
 * 英文难度分析引擎
 * 负责协调文本处理、LLM调用和结果管理
 */
export class DifficultyAnalyzer {
	private readonly service: TextAnalysisService;

	constructor(provider: ILLMProvider) {
		this.service = new TextAnalysisService(provider, 50);
	}

	/**
	 * 分析英文文本难度
	 * @param text 要分析的文本
	 * @param options 分析选项
	 * @returns 分析结果
	 */
	async analyzeText(text: string, options: Partial<AnalysisOptions> = {}): Promise<AnalysisResult> {
		// 验证输入文本
		if (!text || text.trim().length === 0) {
			throw new Error('分析文本不能为空');
		}

		// 准备分析选项
		const analysisOptions: AnalysisOptions = {
			text: text.trim(),
			language: options.language || 'en',
			detailed: options.detailed !== undefined ? options.detailed : true,
			maxTokens: options.maxTokens
		};

		// 检查文本长度（避免过长文本）
		if (analysisOptions.text.length > 10000) {
			vscode.window.showWarningMessage(
				'文本较长，分析可能需要较长时间，建议分段分析。'
			);
		}

		try {
			return await this.service.analyzeText(analysisOptions.text, analysisOptions);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : '未知错误';
			throw new Error(`难度分析失败: ${errorMessage}`);
		}
	}

	/**
	 * 分析当前编辑器中选中的文本
	 * @returns 分析结果，如果没有选中文本则返回null
	 */
	async analyzeSelection(): Promise<AnalysisResult | null> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('没有活动的编辑器');
			return null;
		}

		const selection = editor.selection;
		const text = editor.document.getText(selection);

		if (!text.trim()) {
			vscode.window.showWarningMessage('请先选择一些英文文本');
			return null;
		}

		return this.analyzeText(text);
	}

	/**
	 * 分析整个文档
	 * @returns 分析结果
	 */
	async analyzeDocument(): Promise<AnalysisResult | null> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('没有活动的编辑器');
			return null;
		}

		const document = editor.document;
		const text = document.getText();

		if (!text.trim()) {
			vscode.window.showWarningMessage('文档为空');
			return null;
		}

		return this.analyzeText(text);
	}

	/**
	 * 批量分析多个文本
	 * @param texts 文本数组
	 * @returns 分析结果数组
	 */
	async analyzeBatch(texts: string[]): Promise<AnalysisResult[]> {
		if (!texts || texts.length === 0) {
			return [];
		}

		const results: AnalysisResult[] = [];

		// 显示进度
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: '批量分析英文难度',
				cancellable: true
			},
			async (progress, token) => {
				const batchResults = await this.service.analyzeBatch(texts, {
					isCancelled: () => token.isCancellationRequested,
					onProgress: ({ current, total }) => {
						progress.report({
							message: `正在分析第 ${current}/${total} 个文本`,
							increment: 100 / total
						});
					},
					onError: (error, context) => {
						console.error(`分析第 ${context.index + 1} 个文本失败:`, error);
					}
				});

				results.push(...batchResults);
			}
		);

		return results;
	}

	/**
	 * 获取分析历史
	 * @param limit 返回的最大记录数
	 * @returns 历史记录数组
	 */
	getHistory(limit?: number): AnalysisResult[] {
		return this.service.getHistory(limit);
	}

	/**
	 * 清除历史记录
	 */
	clearHistory(): void {
		this.service.clearHistory();
	}

	/**
	 * 获取历史统计信息
	 */
	getHistoryStats(): {
		total: number;
		byDifficulty: Record<string, number>;
		avgScore: number;
		byProvider: Record<string, number>;
	} {
		return this.service.getHistoryStats();
	}

	/**
	 * 导出历史记录
	 * @param format 导出格式 ('json' 或 'csv')
	 * @returns 导出的数据
	 */
	exportHistory(format: 'json' | 'csv' = 'json'): string {
		return this.service.exportHistory(format);
	}

	/**
	 * 比较两个分析结果
	 */
	compareResults(result1: AnalysisResult, result2: AnalysisResult): {
		scoreDifference: number;
		difficultyChange: string;
		readingTimeRatio: number;
		vocabularyComparison: {
			rareWords: number;
			academicWords: number;
		};
	} {
		return this.service.compareResults(result1, result2);
	}
}
