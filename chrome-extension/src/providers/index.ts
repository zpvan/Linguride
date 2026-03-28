/**
 * @file index.ts
 * @description Provider 模块导出入口
 *
 * 统一导出所有翻译服务提供者及相关类型。
 *
 * @author Lingride Team
 * @since 1.0.0
 */

export { DeepSeekProvider } from "./DeepSeekProvider";
export { OpenAICodexProvider } from "./OpenAICodexProvider";
export { BaseTranslateProvider } from "./ITranslateProvider";
export type { ITranslateProvider } from "./ITranslateProvider";
