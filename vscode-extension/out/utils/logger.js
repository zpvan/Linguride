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
exports.Logger = exports.LogLevel = void 0;
exports.getLogger = getLogger;
exports.logDebug = logDebug;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
exports.logErrorObject = logErrorObject;
const vscode = __importStar(require("vscode"));
/**
 * 日志级别
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["NONE"] = 4] = "NONE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * 日志工具类
 */
class Logger {
    constructor() {
        this.logLevel = LogLevel.INFO;
        this.outputChannel = vscode.window.createOutputChannel('Linguride English Analyzer');
    }
    /**
     * 获取日志实例
     */
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * 设置日志级别
     */
    setLogLevel(level) {
        this.logLevel = level;
    }
    /**
     * 记录调试信息
     */
    debug(message, ...args) {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.write('DEBUG', message, args);
        }
    }
    /**
     * 记录一般信息
     */
    info(message, ...args) {
        if (this.logLevel <= LogLevel.INFO) {
            this.write('INFO', message, args);
        }
    }
    /**
     * 记录警告信息
     */
    warn(message, ...args) {
        if (this.logLevel <= LogLevel.WARN) {
            this.write('WARN', message, args);
        }
    }
    /**
     * 记录错误信息
     */
    error(message, ...args) {
        if (this.logLevel <= LogLevel.ERROR) {
            this.write('ERROR', message, args);
        }
    }
    /**
     * 记录错误对象
     */
    errorObject(error, context) {
        if (this.logLevel <= LogLevel.ERROR) {
            const message = context ? `${context}: ${error.message}` : error.message;
            this.write('ERROR', message, [{ stack: error.stack }]);
        }
    }
    /**
     * 显示信息消息（同时显示给用户）
     */
    showInfo(message) {
        this.info(message);
        vscode.window.showInformationMessage(message);
    }
    /**
     * 显示警告消息（同时显示给用户）
     */
    showWarning(message) {
        this.warn(message);
        vscode.window.showWarningMessage(message);
    }
    /**
     * 显示错误消息（同时显示给用户）
     */
    showError(message) {
        this.error(message);
        vscode.window.showErrorMessage(message);
    }
    /**
     * 显示进度消息
     */
    async showProgress(title, task) {
        this.info(`开始任务: ${title}`);
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                this.info(`任务取消: ${title}`);
            });
            try {
                const result = await task(progress);
                this.info(`任务完成: ${title}`);
                return result;
            }
            catch (error) {
                this.errorObject(error instanceof Error ? error : new Error(String(error)), `任务失败: ${title}`);
                throw error;
            }
        });
    }
    /**
     * 写入日志
     */
    write(level, message, args) {
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
    show() {
        this.outputChannel.show();
    }
    /**
     * 隐藏日志输出面板
     */
    hide() {
        this.outputChannel.hide();
    }
    /**
     * 清除日志
     */
    clear() {
        this.outputChannel.clear();
    }
    /**
     * 销毁日志实例
     */
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.Logger = Logger;
/**
 * 便捷函数：获取日志实例
 */
function getLogger() {
    return Logger.getInstance();
}
/**
 * 便捷函数：记录调试信息
 */
function logDebug(message, ...args) {
    Logger.getInstance().debug(message, ...args);
}
/**
 * 便捷函数：记录一般信息
 */
function logInfo(message, ...args) {
    Logger.getInstance().info(message, ...args);
}
/**
 * 便捷函数：记录警告信息
 */
function logWarn(message, ...args) {
    Logger.getInstance().warn(message, ...args);
}
/**
 * 便捷函数：记录错误信息
 */
function logError(message, ...args) {
    Logger.getInstance().error(message, ...args);
}
/**
 * 便捷函数：记录错误对象
 */
function logErrorObject(error, context) {
    Logger.getInstance().errorObject(error, context);
}
//# sourceMappingURL=logger.js.map