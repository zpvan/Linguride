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
exports.AnalysisPanel = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
/**
 * 分析结果面板
 * 显示在VS Code侧边栏的Webview面板
 */
class AnalysisPanel {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this.viewType = 'lingurideAnalysisView';
    }
    /**
     * 显示分析结果
     */
    show(result) {
        this.currentResult = result;
        // 如果面板不存在，创建它
        if (!this.panel) {
            this.createPanel();
        }
        // 更新面板内容
        this.updateWebview();
        // 显示面板
        if (this.panel && !this.panel.visible) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        }
    }
    /**
     * 解析Webview视图（用于侧边栏）
     */
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };
        webviewView.webview.html = this.getWebviewContent(webviewView.webview);
        // 处理Webview消息
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this.handleWebviewMessage(message, webviewView);
        });
        // 更新Webview内容（如果有当前结果）
        if (this.currentResult) {
            this.updateWebviewView(webviewView);
        }
    }
    /**
     * 创建Webview面板
     */
    createPanel() {
        this.panel = vscode.window.createWebviewPanel(this.viewType, 'English Difficulty Analysis', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.extensionUri]
        });
        // 处理面板关闭
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
        // 设置初始内容
        this.panel.webview.html = this.getWebviewContent(this.panel.webview);
        // 处理Webview消息
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleWebviewMessage(message);
        });
    }
    /**
     * 更新Webview内容
     */
    updateWebview() {
        if (!this.panel || !this.currentResult) {
            return;
        }
        this.panel.webview.html = this.getWebviewContent(this.panel.webview);
    }
    /**
     * 更新侧边栏Webview视图
     */
    updateWebviewView(webviewView) {
        if (!this.currentResult) {
            return;
        }
        webviewView.webview.html = this.getWebviewContent(webviewView.webview);
    }
    /**
     * 获取Webview HTML内容
     */
    getWebviewContent(webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
        // 如果有分析结果，将其嵌入到HTML中
        const resultData = this.currentResult
            ? JSON.stringify(this.currentResult)
            : 'null';
        return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>English Difficulty Analysis</title>
	<link href="${styleUri}" rel="stylesheet">
</head>
<body>
	<div class="container">
		<header class="header">
			<h1>English Difficulty Analysis</h1>
			<p class="subtitle">AI-powered text difficulty assessment</p>
		</header>

		<main id="content">
			${this.currentResult ? this.getResultHtml() : this.getWelcomeHtml()}
		</main>

		<footer class="footer">
			<p>Powered by Linguride • ${new Date().toLocaleDateString()}</p>
		</footer>
	</div>

	<script>
		// 将分析结果数据传递给JavaScript
		window.analysisResult = ${resultData};
	</script>
	<script src="${scriptUri}"></script>
</body>
</html>`;
    }
    /**
     * 获取欢迎页面HTML
     */
    getWelcomeHtml() {
        return `
			<div class="welcome">
				<div class="welcome-icon">📚</div>
				<h2>Welcome to Linguride English Analyzer</h2>
				<p>Select English text in your editor and use the context menu or command palette to analyze its difficulty.</p>

				<div class="instructions">
					<h3>How to use:</h3>
					<ol>
						<li>Select English text in any editor</li>
						<li>Right-click and choose "Analyze English Difficulty"</li>
						<li>View detailed analysis results here</li>
					</ol>
				</div>

				<div class="configuration">
					<h3>Configuration needed:</h3>
					<p>Please configure at least one LLM provider in VS Code settings.</p>
					<button id="configure-button" class="button primary">Configure Now</button>
				</div>
			</div>
		`;
    }
    /**
     * 获取分析结果HTML
     */
    getResultHtml() {
        if (!this.currentResult) {
            return this.getWelcomeHtml();
        }
        const result = this.currentResult;
        const difficultyColors = {
            Beginner: '#4CAF50',
            Intermediate: '#2196F3',
            Advanced: '#FF9800',
            Expert: '#F44336'
        };
        const difficultyColor = difficultyColors[result.difficultyLevel] || '#666';
        return `
			<div class="result">
				<div class="result-header">
					<div class="difficulty-badge" style="background-color: ${difficultyColor}">
						${result.difficultyLevel} (${result.cefrLevel})
					</div>
					<div class="score">
						<div class="score-label">Score</div>
						<div class="score-value">${Math.round(result.score)}/100</div>
					</div>
				</div>

				<div class="score-bar">
					<div class="score-fill" style="width: ${result.score}%"></div>
				</div>

				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-label">Text Length</div>
						<div class="stat-value">${result.textLength} chars</div>
					</div>
					<div class="stat-card">
						<div class="stat-label">Word Count</div>
						<div class="stat-value">${result.wordCount} words</div>
					</div>
					<div class="stat-card">
						<div class="stat-label">Reading Time</div>
						<div class="stat-value">${result.estimatedReadingTime.toFixed(1)} min</div>
					</div>
					<div class="stat-card">
						<div class="stat-label">Provider</div>
						<div class="stat-value">${result.providerId}</div>
					</div>
				</div>

				<div class="analysis-sections">
					<section class="analysis-section">
						<h3>Vocabulary Complexity</h3>
						<div class="metrics">
							<div class="metric">
								<span class="metric-label">Rare Words:</span>
								<span class="metric-value">${result.vocabularyComplexity.rareWordCount}</span>
							</div>
							<div class="metric">
								<span class="metric-label">Academic Words:</span>
								<span class="metric-value">${result.vocabularyComplexity.academicWordCount}</span>
							</div>
							<div class="metric">
								<span class="metric-label">Avg Word Length:</span>
								<span class="metric-value">${result.vocabularyComplexity.avgWordLength.toFixed(1)}</span>
							</div>
							<div class="metric">
								<span class="metric-label">Readability:</span>
								<span class="metric-value">${Math.round(result.vocabularyComplexity.readabilityScore)}/100</span>
							</div>
						</div>
					</section>

					<section class="analysis-section">
						<h3>Sentence Complexity</h3>
						<div class="metrics">
							<div class="metric">
								<span class="metric-label">Avg Sentence Length:</span>
								<span class="metric-value">${result.sentenceComplexity.avgSentenceLength.toFixed(1)} words</span>
							</div>
							<div class="metric">
								<span class="metric-label">Complex Sentences:</span>
								<span class="metric-value">${(result.sentenceComplexity.complexSentenceRatio * 100).toFixed(1)}%</span>
							</div>
							<div class="metric">
								<span class="metric-label">Clauses per Sentence:</span>
								<span class="metric-value">${result.sentenceComplexity.avgClausesPerSentence.toFixed(1)}</span>
							</div>
							<div class="metric">
								<span class="metric-label">Passive Voice:</span>
								<span class="metric-value">${(result.sentenceComplexity.passiveVoiceRatio * 100).toFixed(1)}%</span>
							</div>
						</div>
					</section>
				</div>

				${result.suggestions.length > 0 ? `
					<section class="suggestions">
						<h3>Improvement Suggestions</h3>
						<ul class="suggestion-list">
							${result.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
						</ul>
					</section>
				` : ''}

				<div class="actions">
					<button id="export-button" class="button secondary">Export Result</button>
					<button id="analyze-again-button" class="button primary">Analyze Another Text</button>
				</div>
			</div>
		`;
    }
    /**
     * 处理Webview消息
     */
    async handleWebviewMessage(message, webviewView) {
        const logger = (0, logger_1.getLogger)();
        switch (message.command) {
            case 'configure':
                await vscode.commands.executeCommand('workbench.action.openSettings', 'linguride');
                logger.info('用户点击了配置按钮');
                break;
            case 'export':
                await this.exportResult();
                break;
            case 'analyzeAgain':
                await vscode.commands.executeCommand('linguride.analyzeDifficulty');
                break;
            case 'showDetails':
                if (this.currentResult) {
                    await this.showDetailedView();
                }
                break;
            default:
                logger.warn(`未知的Webview消息命令: ${message.command}`);
        }
    }
    /**
     * 导出分析结果
     */
    async exportResult() {
        if (!this.currentResult) {
            return;
        }
        const logger = (0, logger_1.getLogger)();
        try {
            // 选择导出格式
            const format = await vscode.window.showQuickPick(['JSON', 'CSV'], {
                placeHolder: 'Select export format'
            });
            if (!format) {
                return;
            }
            // 选择保存位置
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    [format]: [format.toLowerCase()]
                },
                defaultUri: vscode.Uri.file(`analysis_result_${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`)
            });
            if (!uri) {
                return;
            }
            // 准备数据
            let data;
            if (format === 'JSON') {
                data = JSON.stringify(this.currentResult, null, 2);
            }
            else {
                // CSV格式
                const result = this.currentResult;
                const headers = ['Metric', 'Value'];
                const rows = [
                    ['Difficulty Level', result.difficultyLevel],
                    ['CEFR Level', result.cefrLevel],
                    ['Score', result.score.toString()],
                    ['Text Length', result.textLength.toString()],
                    ['Word Count', result.wordCount.toString()],
                    ['Reading Time (min)', result.estimatedReadingTime.toString()],
                    ['Rare Words', result.vocabularyComplexity.rareWordCount.toString()],
                    ['Academic Words', result.vocabularyComplexity.academicWordCount.toString()],
                    ['Avg Word Length', result.vocabularyComplexity.avgWordLength.toString()],
                    ['Readability Score', result.vocabularyComplexity.readabilityScore.toString()],
                    ['Avg Sentence Length', result.sentenceComplexity.avgSentenceLength.toString()],
                    ['Complex Sentence Ratio', result.sentenceComplexity.complexSentenceRatio.toString()],
                    ['Analysis Date', result.analysisDate.toISOString()],
                    ['Provider', result.providerId]
                ];
                data = [
                    headers.join(','),
                    ...rows.map(row => row.join(','))
                ].join('\n');
            }
            // 写入文件
            await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf8'));
            logger.showInfo(`分析结果已导出到: ${uri.fsPath}`);
        }
        catch (error) {
            logger.errorObject(error instanceof Error ? error : new Error(String(error)), '导出分析结果失败');
            vscode.window.showErrorMessage('导出失败，请查看日志获取详细信息');
        }
    }
    /**
     * 显示详细视图
     */
    async showDetailedView() {
        if (!this.currentResult) {
            return;
        }
        // 创建新的Webview面板显示详细信息
        const panel = vscode.window.createWebviewPanel('lingurideDetailedView', 'Detailed Analysis', vscode.ViewColumn.Active, {
            enableScripts: true
        });
        panel.webview.html = this.getDetailedHtml();
    }
    /**
     * 获取详细HTML内容
     */
    getDetailedHtml() {
        // 简化实现，实际项目中可以扩展
        return `<!DOCTYPE html>
<html>
<head>
	<style>
		body { padding: 20px; font-family: sans-serif; }
		pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
	</style>
</head>
<body>
	<h1>Detailed Analysis</h1>
	<pre>${JSON.stringify(this.currentResult, null, 2)}</pre>
</body>
</html>`;
    }
    /**
     * 释放资源
     */
    dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
}
exports.AnalysisPanel = AnalysisPanel;
//# sourceMappingURL=AnalysisPanel.js.map