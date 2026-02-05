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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const DifficultyAnalyzer_1 = require("./analysis/DifficultyAnalyzer");
const providerFactory_1 = require("./providers/providerFactory");
const AnalysisPanel_1 = require("./ui/AnalysisPanel");
let analysisPanel;
/**
 * 激活扩展时调用
 * @param context 扩展上下文
 */
function activate(context) {
    console.log('Linguride English Difficulty Analyzer 扩展已激活');
    // 注册命令：分析选中文本的难度
    const analyzeCommand = vscode.commands.registerCommand('linguride.analyzeDifficulty', async () => {
        try {
            // 获取当前编辑器
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('没有活动的编辑器');
                return;
            }
            // 获取选中的文本
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            if (!text.trim()) {
                vscode.window.showWarningMessage('请先选择一些英文文本');
                return;
            }
            // 显示进度指示
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '分析英文难度',
                cancellable: true
            }, async (progress, token) => {
                progress.report({ message: '正在初始化分析器...' });
                // 创建LLM提供商
                const provider = await (0, providerFactory_1.createProvider)();
                if (!provider) {
                    vscode.window.showErrorMessage('无法创建LLM提供商，请检查配置');
                    return;
                }
                // 创建分析器并分析文本
                const analyzer = new DifficultyAnalyzer_1.DifficultyAnalyzer(provider);
                progress.report({ message: '正在分析文本...', increment: 30 });
                const result = await analyzer.analyzeText(text);
                progress.report({ message: '正在生成结果...', increment: 40 });
                // 显示结果
                if (!analysisPanel) {
                    analysisPanel = new AnalysisPanel_1.AnalysisPanel(context.extensionUri);
                }
                analysisPanel.show(result);
                vscode.window.showInformationMessage('英文难度分析完成！');
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`分析失败: ${errorMessage}`);
            console.error('分析错误:', error);
        }
    });
    // 注册命令：打开配置页面
    const configureCommand = vscode.commands.registerCommand('linguride.configure', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'linguride');
    });
    // 注册侧边栏面板
    const panelProvider = vscode.window.registerWebviewViewProvider('lingurideAnalysisView', {
        resolveWebviewView: (webviewView) => {
            if (!analysisPanel) {
                analysisPanel = new AnalysisPanel_1.AnalysisPanel(context.extensionUri);
            }
            analysisPanel.resolveWebviewView(webviewView);
        }
    });
    // 将命令和提供者添加到订阅列表，以便在停用时清理
    context.subscriptions.push(analyzeCommand, configureCommand, panelProvider, {
        dispose: () => providerFactory_1.ProviderFactory.dispose()
    });
}
/**
 * 停用扩展时调用
 */
function deactivate() {
    if (analysisPanel) {
        analysisPanel.dispose();
    }
}
//# sourceMappingURL=extension.js.map