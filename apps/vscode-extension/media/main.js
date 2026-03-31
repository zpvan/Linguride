/**
 * Linguride English Difficulty Analyzer - Webview JavaScript
 */

// 当DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
	initializeWebview();
});

/**
 * 初始化Webview
 */
function initializeWebview() {
	// 绑定按钮事件
	bindButtonEvents();

	// 如果有分析结果，进行额外处理
	if (window.analysisResult && window.analysisResult !== null) {
		processAnalysisResult(window.analysisResult);
	}

	// 添加键盘快捷键支持
	addKeyboardShortcuts();
}

/**
 * 绑定按钮事件
 */
function bindButtonEvents() {
	// 配置按钮
	const configureButton = document.getElementById('configure-button');
	if (configureButton) {
		configureButton.addEventListener('click', () => {
			postMessageToExtension({ command: 'configure' });
		});
	}

	// 导出按钮
	const exportButton = document.getElementById('export-button');
	if (exportButton) {
		exportButton.addEventListener('click', () => {
			postMessageToExtension({ command: 'export' });
		});
	}

	// 再次分析按钮
	const analyzeAgainButton = document.getElementById('analyze-again-button');
	if (analyzeAgainButton) {
		analyzeAgainButton.addEventListener('click', () => {
			postMessageToExtension({ command: 'analyzeAgain' });
		});
	}

	// 分数条动画
	const scoreFill = document.querySelector('.score-fill');
	if (scoreFill && window.analysisResult) {
		animateScoreBar(scoreFill, window.analysisResult.score);
	}
}

/**
 * 处理分析结果
 */
function processAnalysisResult(result) {
	// 更新页面标题
	document.title = `English Analysis - ${result.difficultyLevel} (${result.cefrLevel})`;

	// 添加难度等级特定样式
	addDifficultyClass(result.difficultyLevel);

	// 格式化日期
	formatDates(result.analysisDate);

	// 添加复制功能
	addCopyFunctionality(result);

	// 添加图表可视化（如果可用）
	initializeCharts(result);
}

/**
 * 添加难度等级特定样式
 */
function addDifficultyClass(difficultyLevel) {
	const body = document.body;
	const difficultyClass = `difficulty-${difficultyLevel.toLowerCase()}`;
	body.classList.add(difficultyClass);
}

/**
 * 格式化日期显示
 */
function formatDates(analysisDate) {
	const dateElements = document.querySelectorAll('.analysis-date');
	const date = new Date(analysisDate);

	dateElements.forEach(element => {
		element.textContent = date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	});
}

/**
 * 添加复制功能
 */
function addCopyFunctionality(result) {
	// 为统计值添加复制功能
	const statValues = document.querySelectorAll('.stat-value, .metric-value');
	statValues.forEach(element => {
		element.style.cursor = 'pointer';
		element.title = 'Click to copy';

		element.addEventListener('click', () => {
			const textToCopy = element.textContent;
			copyToClipboard(textToCopy, element);
		});
	});
}

/**
 * 初始化图表可视化
 */
function initializeCharts(result) {
	// 简单进度条已经通过CSS实现
	// 可以在这里添加更复杂的图表，如柱状图、饼图等
	// 目前使用简单的CSS可视化

	// 词汇复杂度可视化
	createVocabularyChart(result.vocabularyComplexity);

	// 句子复杂度可视化
	createSentenceChart(result.sentenceComplexity);
}

/**
 * 创建词汇复杂度图表
 */
function createVocabularyChart(vocabularyComplexity) {
	// 简单实现：创建进度条显示各项指标
	const vocabularySection = document.querySelector('.vocabulary-complexity');
	if (!vocabularySection) {
		return;
	}

	const metrics = [
		{ label: 'Rare Words', value: Math.min(vocabularyComplexity.rareWordCount / 10, 1) },
		{ label: 'Academic Words', value: Math.min(vocabularyComplexity.academicWordCount / 5, 1) },
		{ label: 'Readability', value: vocabularyComplexity.readabilityScore / 100 }
	];

	metrics.forEach(metric => {
		const progressBar = document.createElement('div');
		progressBar.className = 'metric-progress';
		progressBar.innerHTML = `
			<div class="progress-label">${metric.label}</div>
			<div class="progress-bar">
				<div class="progress-fill" style="width: ${metric.value * 100}%"></div>
			</div>
			<div class="progress-value">${Math.round(metric.value * 100)}%</div>
		`;

		vocabularySection.appendChild(progressBar);
	});
}

/**
 * 创建句子复杂度图表
 */
function createSentenceChart(sentenceComplexity) {
	// 类似词汇复杂度的实现
}

/**
 * 动画显示分数条
 */
function animateScoreBar(scoreFillElement, finalScore) {
	// 重置宽度为0
	scoreFillElement.style.width = '0%';

	// 使用requestAnimationFrame实现平滑动画
	let currentWidth = 0;
	const targetWidth = finalScore;
	const duration = 1000; // 1秒
	const startTime = performance.now();

	function animate(currentTime) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);

		// 使用缓动函数使动画更自然
		const easedProgress = easeOutCubic(progress);
		currentWidth = easedProgress * targetWidth;

		scoreFillElement.style.width = `${currentWidth}%`;

		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}

	requestAnimationFrame(animate);
}

/**
 * 缓动函数：三次方缓出
 */
function easeOutCubic(t) {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text, element) {
	try {
		await navigator.clipboard.writeText(text);

		// 显示成功反馈
		const originalText = element.textContent;
		element.textContent = 'Copied!';
		element.style.color = '#4CAF50';

		setTimeout(() => {
			element.textContent = originalText;
			element.style.color = '';
		}, 1500);
	} catch (error) {
		console.error('Failed to copy:', error);
		// 降级方案：使用document.execCommand
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
	}
}

/**
 * 发送消息到扩展
 */
function postMessageToExtension(message) {
	// 尝试使用acquireVsCodeApi
	if (typeof acquireVsCodeApi !== 'undefined') {
		const vscode = acquireVsCodeApi();
		vscode.postMessage(message);
	} else {
		// 降级方案：尝试使用window.parent
		window.parent.postMessage(message, '*');
	}
}

/**
 * 添加键盘快捷键
 */
function addKeyboardShortcuts() {
	document.addEventListener('keydown', (event) => {
		// Ctrl/Cmd + E 导出
		if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
			event.preventDefault();
			postMessageToExtension({ command: 'export' });
		}

		// Ctrl/Cmd + A 再次分析
		if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
			event.preventDefault();
			postMessageToExtension({ command: 'analyzeAgain' });
		}

		// Ctrl/Cmd + , 打开配置
		if ((event.ctrlKey || event.metaKey) && event.key === ',') {
			event.preventDefault();
			postMessageToExtension({ command: 'configure' });
		}
	});
}

/**
 * 处理来自扩展的消息
 */
window.addEventListener('message', (event) => {
	const message = event.data;

	switch (message.command) {
		case 'updateResult':
			window.analysisResult = message.result;
			processAnalysisResult(message.result);
			break;

		case 'showNotification':
			showNotification(message.text, message.type);
			break;

		case 'updateProgress':
			updateProgress(message.progress);
			break;
	}
});

/**
 * 显示通知
 */
function showNotification(text, type = 'info') {
	const notification = document.createElement('div');
	notification.className = `notification notification-${type}`;
	notification.textContent = text;

	document.body.appendChild(notification);

	// 自动消失
	setTimeout(() => {
		notification.classList.add('notification-hide');
		setTimeout(() => {
			document.body.removeChild(notification);
		}, 300);
	}, 3000);
}

/**
 * 更新进度
 */
function updateProgress(progress) {
	const progressElement = document.getElementById('progress-bar');
	if (progressElement) {
		progressElement.style.width = `${progress}%`;
	}
}

// 添加通知样式
const style = document.createElement('style');
style.textContent = `
	.notification {
		position: fixed;
		top: 20px;
		right: 20px;
		padding: 12px 16px;
		border-radius: 6px;
		color: white;
		font-size: 14px;
		z-index: 1000;
		animation: slideIn 0.3s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.notification-info {
		background-color: #2196F3;
	}

	.notification-success {
		background-color: #4CAF50;
	}

	.notification-warning {
		background-color: #FF9800;
	}

	.notification-error {
		background-color: #F44336;
	}

	.notification-hide {
		animation: slideOut 0.3s ease forwards;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slideOut {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(100%);
			opacity: 0;
		}
	}

	.metric-progress {
		display: flex;
		align-items: center;
		margin-bottom: 8px;
	}

	.progress-label {
		width: 120px;
		font-size: 13px;
		color: #666;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		background-color: #e9ecef;
		border-radius: 3px;
		overflow: hidden;
		margin: 0 12px;
	}

	.progress-fill {
		height: 100%;
		background-color: #4361ee;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.progress-value {
		width: 40px;
		text-align: right;
		font-size: 12px;
		color: #666;
	}
`;

document.head.appendChild(style);