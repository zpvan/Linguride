"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DifficultyAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
/**
 * 英文难度分析引擎
 * 负责协调文本处理、LLM调用和结果管理
 */
class DifficultyAnalyzer {
    constructor(provider) {
        this.history = [];
        this.maxHistorySize = 50;
        this.provider = provider;
    }
    /**
     * 分析英文文本难度
     * @param text 要分析的文本
     * @param options 分析选项
     * @returns 分析结果
     */
    async analyzeText(text, options = {}) {
        // 验证输入文本
        if (!text || text.trim().length === 0) {
            throw new Error('分析文本不能为空');
        }
        // 准备分析选项
        const analysisOptions = {
            text: text.trim(),
            language: options.language || 'en',
            detailed: options.detailed !== undefined ? options.detailed : true,
            maxTokens: options.maxTokens
        };
        // 检查文本长度（避免过长文本）
        if (analysisOptions.text.length > 10000) {
            vscode.window.showWarningMessage('文本较长，分析可能需要较长时间，建议分段分析。');
        }
        try {
            // 调用LLM提供商进行分析
            const result = await this.provider.analyze(analysisOptions);
            // 添加提供商信息
            result.providerId = this.provider.id;
            // 添加到历史记录
            this.addToHistory(result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            throw new Error(`难度分析失败: ${errorMessage}`);
        }
    }
    /**
     * 分析当前编辑器中选中的文本
     * @returns 分析结果，如果没有选中文本则返回null
     */
    async analyzeSelection() {
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
    async analyzeDocument() {
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
    async analyzeBatch(texts) {
        if (!texts || texts.length === 0) {
            return [];
        }
        const results = [];
        const total = texts.length;
        // 显示进度
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '批量分析英文难度',
            cancellable: true
        }, async (progress, token) => {
            for (let i = 0; i < total; i++) {
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    progress.report({
                        message: `正在分析第 ${i + 1}/${total} 个文本`,
                        increment: (100 / total)
                    });
                    const result = await this.analyzeText(texts[i]);
                    results.push(result);
                }
                catch (error) {
                    console.error(`分析第 ${i + 1} 个文本失败:`, error);
                    // 继续分析下一个文本
                }
            }
        });
        return results;
    }
    /**
     * 添加到历史记录
     */
    addToHistory(result) {
        this.history.unshift(result); // 添加到开头
        // 限制历史记录大小
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }
    /**
     * 获取分析历史
     * @param limit 返回的最大记录数
     * @returns 历史记录数组
     */
    getHistory(limit) {
        if (limit && limit > 0) {
            return this.history.slice(0, limit);
        }
        return [...this.history];
    }
    /**
     * 清除历史记录
     */
    clearHistory() {
        this.history = [];
    }
    /**
     * 获取历史统计信息
     */
    getHistoryStats() {
        const stats = {
            total: this.history.length,
            byDifficulty: {
                Beginner: 0,
                Intermediate: 0,
                Advanced: 0,
                Expert: 0
            },
            avgScore: 0,
            byProvider: {}
        };
        if (this.history.length === 0) {
            return stats;
        }
        let totalScore = 0;
        for (const result of this.history) {
            // 统计难度等级
            stats.byDifficulty[result.difficultyLevel] =
                (stats.byDifficulty[result.difficultyLevel] || 0) + 1;
            // 累计分数
            totalScore += result.score;
            // 统计提供商
            const provider = result.providerId || 'unknown';
            stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
        }
        // 计算平均分数
        stats.avgScore = totalScore / this.history.length;
        return stats;
    }
    /**
     * 导出历史记录
     * @param format 导出格式 ('json' 或 'csv')
     * @returns 导出的数据
     */
    exportHistory(format = 'json') {
        if (format === 'csv') {
            return this.exportHistoryAsCSV();
        }
        return JSON.stringify(this.history, null, 2);
    }
    /**
     * 导出为CSV格式
     */
    exportHistoryAsCSV() {
        if (this.history.length === 0) {
            return '';
        }
        const headers = [
            'Date',
            'Difficulty Level',
            'CEFR Level',
            'Score',
            'Text Length',
            'Word Count',
            'Reading Time (min)',
            'Provider'
        ];
        const rows = this.history.map(result => [
            result.analysisDate.toISOString(),
            result.difficultyLevel,
            result.cefrLevel,
            result.score.toString(),
            result.textLength.toString(),
            result.wordCount.toString(),
            result.estimatedReadingTime.toString(),
            result.providerId
        ]);
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        return csvContent;
    }
    /**
     * 比较两个分析结果
     */
    compareResults(result1, result2) {
        return {
            scoreDifference: result2.score - result1.score,
            difficultyChange: `${result1.difficultyLevel} → ${result2.difficultyLevel}`,
            readingTimeRatio: result2.estimatedReadingTime / result1.estimatedReadingTime,
            vocabularyComparison: {
                rareWords: result2.vocabularyComplexity.rareWordCount - result1.vocabularyComplexity.rareWordCount,
                academicWords: result2.vocabularyComplexity.academicWordCount - result1.vocabularyComplexity.academicWordCount
            }
        };
    }
}
exports.DifficultyAnalyzer = DifficultyAnalyzer;
//# sourceMappingURL=DifficultyAnalyzer.js.map