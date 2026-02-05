/**
 * @file ITranslateProvider.ts
 * @description 翻译服务提供者接口定义
 *
 * 定义翻译服务的抽象接口，遵循策略模式设计。
 * 所有具体的翻译服务提供者（如 DeepSeek、OpenAI）都需要实现此接口。
 *
 * 设计原则：
 * - 接口隔离：只定义翻译所需的最小方法集
 * - 依赖倒置：上层模块依赖接口而非具体实现
 * - 开闭原则：新增 Provider 无需修改现有代码
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { ProviderConfig } from "../types";

/**
 * 翻译服务提供者接口
 *
 * 定义所有翻译服务必须实现的方法。
 * 使用此接口可以轻松切换不同的翻译后端。
 *
 * @example
 * ```typescript
 * const provider: ITranslateProvider = new DeepSeekProvider(config);
 * const translations = await provider.translate(['Hello', 'World']);
 * ```
 */
export interface ITranslateProvider {
  /**
   * 翻译服务名称
   *
   * 用于日志记录和用户界面显示。
   */
  readonly name: string;

  /**
   * 批量翻译文本
   *
   * 将一组英文文本翻译为中文。
   *
   * @param texts - 待翻译的英文文本数组
   * @returns Promise 解析为翻译结果数组，与输入数组一一对应
   * @throws 如果翻译失败，抛出包含错误信息的 Error
   *
   * @example
   * ```typescript
   * const texts = ['Hello, world!', 'How are you?'];
   * const translations = await provider.translate(texts);
   * // translations: ['你好，世界！', '你好吗？']
   * ```
   */
  translate(texts: string[]): Promise<string[]>;

  /**
   * 测试 API 连接
   *
   * 发送简单请求验证 API 配置是否正确。
   * 用于 Popup 中的「测试连接」功能。
   *
   * @returns Promise 解析为测试结果对象
   * @property success - 连接是否成功
   * @property latency - 响应延迟（毫秒）
   * @property error - 错误信息（失败时）
   */
  testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }>;

  /**
   * 通用聊天方法
   *
   * 用于难度分析等非翻译场景，接受自定义 Prompt。
   *
   * @param systemPrompt - 系统提示词
   * @param userPrompt - 用户提示词
   * @returns Promise 解析为 AI 响应的原始字符串
   */
  chat(systemPrompt: string, userPrompt: string): Promise<string>;
}

/**
 * 翻译提供者基类
 *
 * 提供通用功能实现，减少具体 Provider 的重复代码。
 * 子类只需实现 `translate` 和 `testConnection` 方法。
 */
export abstract class BaseTranslateProvider implements ITranslateProvider {
  /** 提供者配置 */
  protected readonly config: ProviderConfig;

  /** 提供者名称（子类需覆写） */
  abstract readonly name: string;

  /**
   * 构造函数
   *
   * @param config - 提供者配置对象
   */
  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * 格式化待翻译文本为编号列表格式
   *
   * 将文本数组格式化为便于 LLM 理解和解析的编号格式。
   *
   * @param texts - 待翻译的文本数组
   * @returns 格式化后的字符串
   *
   * @example
   * ```typescript
   * formatTexts(['Hello', 'World'])
   * // 返回:
   * // 1---
   * // Hello
   * // 2---
   * // World
   * ```
   */
  protected formatTexts(texts: string[]): string {
    return texts.map((text, index) => `${index + 1}---\n${text}`).join("\n\n");
  }

  /**
   * 解析 LLM 返回的翻译结果
   *
   * 从 LLM 响应中提取编号对应的翻译文本。
   *
   * @param response - LLM 返回的原始响应文本
   * @param expectedCount - 期望的翻译数量
   * @returns 翻译结果数组
   * @throws 如果解析失败或数量不匹配，抛出错误
   */
  protected parseResponse(response: string, expectedCount: number): string[] {
    const results: string[] = [];

    // 尝试按编号分隔符解析
    // 格式: 1---\n翻译内容\n\n2---\n翻译内容
    const pattern = /(\d+)---\s*([\s\S]*?)(?=\n\d+---|$)/g;
    let match;

    while ((match = pattern.exec(response)) !== null) {
      const index = parseInt(match[1], 10) - 1;
      const translation = match[2].trim();

      if (index >= 0 && index < expectedCount) {
        results[index] = translation;
      }
    }

    // 如果正则解析失败，尝试简单的行分割
    if (results.filter(Boolean).length !== expectedCount) {
      // 回退策略：按空行分割
      const lines = response.split(/\n\s*\n/).filter((line) => line.trim());

      if (lines.length === expectedCount) {
        return lines.map((line) => line.replace(/^\d+[-—:：]\s*/, "").trim());
      }

      // 如果只有一个文本，直接返回整个响应
      if (expectedCount === 1) {
        return [response.trim()];
      }

      throw new Error(
        `翻译结果解析失败：期望 ${expectedCount} 条结果，` +
          `实际解析到 ${results.filter(Boolean).length} 条`
      );
    }

    return results;
  }

  /**
   * 构建完整的 User Prompt
   *
   * 将待翻译文本替换到 User Prompt 模板中。
   *
   * @param texts - 待翻译的文本数组
   * @returns 完整的 User Prompt
   */
  protected buildUserPrompt(texts: string[]): string {
    const formattedTexts = this.formatTexts(texts);
    return this.config.userPromptTemplate.replace("{{texts}}", formattedTexts);
  }

  // 抽象方法，子类必须实现
  abstract translate(texts: string[]): Promise<string[]>;
  abstract testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }>;
  abstract chat(systemPrompt: string, userPrompt: string): Promise<string>;
}
