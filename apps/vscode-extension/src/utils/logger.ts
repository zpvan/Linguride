import * as vscode from 'vscode';

/**
 * 日志级别
 */
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4
}

/**
 * 日志工具类
 */
export class Logger {
	private static instance: Logger;
	private outputChannel: vscode.OutputChannel;
	private logLevel: LogLevel = LogLevel.INFO;

	private constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Linguride English Analyzer');
	}

	/**
	 * 获取日志实例
	 */
	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	/**
	 * 设置日志级别
	 */
	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	/**
	 * 记录调试信息
	 */
	debug(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.DEBUG) {
			this.write('DEBUG', message, args);
		}
	}

	/**
	 * 记录一般信息
	 */
	info(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			this.write('INFO', message, args);
		}
	}

	/**
	 * 记录警告信息
	 */
	warn(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.WARN) {
			this.write('WARN', message, args);
		}
	}

	/**
	 * 记录错误信息
	 */
	error(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.ERROR) {
			this.write('ERROR', message, args);
		}
	}

	/**
	 * 记录错误对象
	 */
	errorObject(error: Error, context?: string): void {
		if (this.logLevel <= LogLevel.ERROR) {
			const message = context ? `${context}: ${error.message}` : error.message;
			this.write('ERROR', message, [{ stack: error.stack }]);
		}
	}

	/**
	 * 显示信息消息（同时显示给用户）
	 */
	showInfo(message: string): void {
		this.info(message);
		vscode.window.showInformationMessage(message);
	}

	/**
	 * 显示警告消息（同时显示给用户）
	 */
	showWarning(message: string): void {
		this.warn(message);
		vscode.window.showWarningMessage(message);
	}

	/**
	 * 显示错误消息（同时显示给用户）
	 */
	showError(message: string): void {
		this.error(message);
		vscode.window.showErrorMessage(message);
	}

	/**
	 * 显示进度消息
	 */
	async showProgress<T>(
		title: string,
		task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
	): Promise<T> {
		this.info(`开始任务: ${title}`);
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title,
				cancellable: true
			},
			async (progress, token) => {
				token.onCancellationRequested(() => {
					this.info(`任务取消: ${title}`);
				});

				try {
					const result = await task(progress);
					this.info(`任务完成: ${title}`);
					return result;
				} catch (error) {
					this.errorObject(error instanceof Error ? error : new Error(String(error)), `任务失败: ${title}`);
					throw error;
				}
			}
		);
	}

	/**
	 * 写入日志
	 */
	private write(level: string, message: string, args: any[]): void {
		const timestamp = new Date().toISOString();
		let logMessage = `[${timestamp}] [${level}] ${message}`;

		// 添加额外参数
		if (args.length > 0) {
			const argsString = args
				.map(arg => {
					if (arg instanceof Error) {
						return `${arg.message}\n${arg.stack}`;
					}
					return JSON.stringify(arg, null, 2);
				})
				.join(' ');
			logMessage += ` ${argsString}`;
		}

		// 写入输出通道
		this.outputChannel.appendLine(logMessage);

		// 同时在控制台输出（仅用于调试）
		if (this.logLevel === LogLevel.DEBUG) {
			console.log(`[Linguride] ${logMessage}`);
		}
	}

	/**
	 * 显示日志输出面板
	 */
	show(): void {
		this.outputChannel.show();
	}

	/**
	 * 隐藏日志输出面板
	 */
	hide(): void {
		this.outputChannel.hide();
	}

	/**
	 * 清除日志
	 */
	clear(): void {
		this.outputChannel.clear();
	}

	/**
	 * 销毁日志实例
	 */
	dispose(): void {
		this.outputChannel.dispose();
	}
}

/**
 * 便捷函数：获取日志实例
 */
export function getLogger(): Logger {
	return Logger.getInstance();
}

/**
 * 便捷函数：记录调试信息
 */
export function logDebug(message: string, ...args: any[]): void {
	Logger.getInstance().debug(message, ...args);
}

/**
 * 便捷函数：记录一般信息
 */
export function logInfo(message: string, ...args: any[]): void {
	Logger.getInstance().info(message, ...args);
}

/**
 * 便捷函数：记录警告信息
 */
export function logWarn(message: string, ...args: any[]): void {
	Logger.getInstance().warn(message, ...args);
}

/**
 * 便捷函数：记录错误信息
 */
export function logError(message: string, ...args: any[]): void {
	Logger.getInstance().error(message, ...args);
}

/**
 * 便捷函数：记录错误对象
 */
export function logErrorObject(error: Error, context?: string): void {
	Logger.getInstance().errorObject(error, context);
}