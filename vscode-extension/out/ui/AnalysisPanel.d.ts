import * as vscode from 'vscode';
import { AnalysisResult } from '../types';
/**
 * 分析结果面板
 * 显示在VS Code侧边栏的Webview面板
 */
export declare class AnalysisPanel {
    private readonly extensionUri;
    private readonly viewType;
    private panel;
    private currentResult;
    constructor(extensionUri: vscode.Uri);
    /**
     * 显示分析结果
     */
    show(result: AnalysisResult): void;
    /**
     * 解析Webview视图（用于侧边栏）
     */
    resolveWebviewView(webviewView: vscode.WebviewView): void;
    /**
     * 创建Webview面板
     */
    private createPanel;
    /**
     * 更新Webview内容
     */
    private updateWebview;
    /**
     * 更新侧边栏Webview视图
     */
    private updateWebviewView;
    /**
     * 获取Webview HTML内容
     */
    private getWebviewContent;
    /**
     * 获取欢迎页面HTML
     */
    private getWelcomeHtml;
    /**
     * 获取分析结果HTML
     */
    private getResultHtml;
    /**
     * 处理Webview消息
     */
    private handleWebviewMessage;
    /**
     * 导出分析结果
     */
    private exportResult;
    /**
     * 显示详细视图
     */
    private showDetailedView;
    /**
     * 获取详细HTML内容
     */
    private getDetailedHtml;
    /**
     * 释放资源
     */
    dispose(): void;
}
//# sourceMappingURL=AnalysisPanel.d.ts.map