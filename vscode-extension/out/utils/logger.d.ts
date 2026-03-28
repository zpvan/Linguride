import * as vscode from 'vscode';
/**
 * 日志级别
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}
/**
 * 日志工具类
 */
export declare class Logger {
    private static instance;
    private outputChannel;
    private logLevel;
    private constructor();
    /**
     * 获取日志实例
     */
    static getInstance(): Logger;
    /**
     * 设置日志级别
     */
    setLogLevel(level: LogLevel): void;
    /**
     * 记录调试信息
     */
    debug(message: string, ...args: any[]): void;
    /**
     * 记录一般信息
     */
    info(message: string, ...args: any[]): void;
    /**
     * 记录警告信息
     */
    warn(message: string, ...args: any[]): void;
    /**
     * 记录错误信息
     */
    error(message: string, ...args: any[]): void;
    /**
     * 记录错误对象
     */
    errorObject(error: Error, context?: string): void;
    /**
     * 显示信息消息（同时显示给用户）
     */
    showInfo(message: string): void;
    /**
     * 显示警告消息（同时显示给用户）
     */
    showWarning(message: string): void;
    /**
     * 显示错误消息（同时显示给用户）
     */
    showError(message: string): void;
    /**
     * 显示进度消息
     */
    showProgress<T>(title: string, task: (progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>) => Promise<T>): Promise<T>;
    /**
     * 写入日志
     */
    private write;
    /**
     * 显示日志输出面板
     */
    show(): void;
    /**
     * 隐藏日志输出面板
     */
    hide(): void;
    /**
     * 清除日志
     */
    clear(): void;
    /**
     * 销毁日志实例
     */
    dispose(): void;
}
/**
 * 便捷函数：获取日志实例
 */
export declare function getLogger(): Logger;
/**
 * 便捷函数：记录调试信息
 */
export declare function logDebug(message: string, ...args: any[]): void;
/**
 * 便捷函数：记录一般信息
 */
export declare function logInfo(message: string, ...args: any[]): void;
/**
 * 便捷函数：记录警告信息
 */
export declare function logWarn(message: string, ...args: any[]): void;
/**
 * 便捷函数：记录错误信息
 */
export declare function logError(message: string, ...args: any[]): void;
/**
 * 便捷函数：记录错误对象
 */
export declare function logErrorObject(error: Error, context?: string): void;
//# sourceMappingURL=logger.d.ts.map