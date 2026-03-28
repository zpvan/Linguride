/**
 * @file DeepSeekProvider.ts
 * @description DeepSeek 翻译服务提供者实现
 *
 * 实现 ITranslateProvider 接口，通过 DeepSeek API 进行翻译。
 * DeepSeek API 兼容 OpenAI 格式，使用标准的 Chat Completions 接口。
 *
 * API 文档：https://platform.deepseek.com/api-docs
 *
 * 特性：
 * - 支持批量翻译（通过编号格式）
 * - 自动重试机制（网络错误时）
 * - 详细的错误信息报告
 * - 连接测试功能
 *
 * @author Lingride Team
 * @since 1.0.0
 */

import { BaseTranslateProvider } from "./ITranslateProvider";

/**
 * OpenAI 兼容格式的消息类型
 */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * OpenAI 兼容格式的请求体
 */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * OpenAI 兼容格式的响应体
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * API 错误响应格式
 */
interface ApiErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * DeepSeek 翻译服务提供者
 *
 * 通过 DeepSeek API（OpenAI 兼容格式）实现英中翻译功能。
 *
 * @example
 * ```typescript
 * const config: ProviderConfig = {
 *   apiBaseUrl: 'https://api.deepseek.com',
 *   apiKey: 'sk-xxx',
 *   model: 'deepseek-chat',
 *   systemPrompt: '...',
 *   userPromptTemplate: '...',
 * };
 *
 * const provider = new DeepSeekProvider(config);
 * const translations = await provider.translate(['Hello, world!']);
 * ```
 */
export class DeepSeekProvider extends BaseTranslateProvider {
  /** 服务名称标识 */
  readonly name = "DeepSeek";

  /** 默认超时时间（毫秒） */
  private readonly timeout = 60000;

  /** 最大重试次数 */
  private readonly maxRetries = 2;

  /**
   * 构造 API 请求 URL
   *
   * @returns 完整的 API 端点 URL
   */
  private getApiUrl(): string {
    const baseUrl = this.config.apiBaseUrl.replace(/\/$/, "");
    return `${baseUrl}/v1/chat/completions`;
  }

  /**
   * 发送 API 请求
   *
   * 封装 fetch 调用，处理超时和错误。
   *
   * @param messages - 聊天消息数组
   * @returns Promise 解析为 API 响应
   * @throws 请求失败时抛出详细错误
   */
  private async sendRequest(
    messages: ChatMessage[]
  ): Promise<ChatCompletionResponse> {
    const url = this.getApiUrl();
    console.log(`[Lingride] 发送请求到: ${url}`);

    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: 0.3, // 翻译任务使用较低温度以保证一致性
    };

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log("[Lingride] 正在等待 API 响应...");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      // 清除超时定时器
      clearTimeout(timeoutId);
      console.log(`[Lingride] 收到响应: status=${response.status}`);

      // 检查 HTTP 状态码
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Lingride] API 错误: ${errorText}`);
        try {
          const errorData = JSON.parse(errorText) as ApiErrorResponse;
          throw new Error(
            `API 请求失败 (${response.status}): ${
              errorData.error?.message || response.statusText
            }`
          );
        } catch {
          throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
        }
      }

      const data = (await response.json()) as ChatCompletionResponse;
      console.log(`[Lingride] API 成功, choices=${data.choices?.length}`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[Lingride] 请求异常:", error);

      // 处理特定错误类型
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`请求超时（${this.timeout / 1000}秒）`);
        }
        throw error;
      }

      throw new Error("未知请求错误");
    }
  }

  /**
   * 带重试的请求发送
   *
   * 在网络错误时自动重试，指数退避策略。
   *
   * @param messages - 聊天消息数组
   * @returns Promise 解析为 API 响应
   */
  private async sendRequestWithRetry(
    messages: ChatMessage[]
  ): Promise<ChatCompletionResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.sendRequest(messages);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果是认证错误或参数错误，不重试
        if (
          lastError.message.includes("401") ||
          lastError.message.includes("403") ||
          lastError.message.includes("400")
        ) {
          throw lastError;
        }

        // 指数退避等待
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          console.log(
            `[Lingride] 重试请求 (${attempt + 1}/${this.maxRetries})...`
          );
        }
      }
    }

    throw lastError || new Error("请求失败");
  }

  /**
   * 批量翻译文本
   *
   * 将英文文本数组翻译为中文。使用编号格式进行批量翻译，
   * 然后解析响应提取各段翻译结果。
   *
   * @param texts - 待翻译的英文文本数组
   * @returns Promise 解析为翻译结果数组
   * @throws 翻译或解析失败时抛出错误
   *
   * @example
   * ```typescript
   * const translations = await provider.translate([
   *   'Hello, world!',
   *   'How are you today?'
   * ]);
   * // 返回: ['你好，世界！', '你今天好吗？']
   * ```
   */
  async translate(texts: string[]): Promise<string[]> {
    // 参数验证
    if (!texts || texts.length === 0) {
      return [];
    }

    // 构建消息
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: this.config.systemPrompt,
      },
      {
        role: "user",
        content: this.buildUserPrompt(texts),
      },
    ];

    // 发送请求
    console.log(`[Lingride] 发送翻译请求，共 ${texts.length} 段文本`);
    const response = await this.sendRequestWithRetry(messages);

    // 提取响应内容
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("API 返回空响应");
    }

    // 解析翻译结果
    const translations = this.parseResponse(content, texts.length);
    console.log(`[Lingride] 翻译完成，成功解析 ${translations.length} 段结果`);

    return translations;
  }

  /**
   * 测试 API 连接
   *
   * 发送简单的测试请求验证 API 配置是否正确。
   *
   * @returns Promise 解析为测试结果
   *
   * @example
   * ```typescript
   * const result = await provider.testConnection();
   * if (result.success) {
   *   console.log(`连接成功，延迟 ${result.latency}ms`);
   * } else {
   *   console.error(`连接失败：${result.error}`);
   * }
   * ```
   */
  async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: 'Hi, this is a connection test. Please respond with "OK".',
        },
      ];

      const response = await this.sendRequest(messages);
      const latency = Date.now() - startTime;

      // 验证响应有效性
      if (!response.choices || response.choices.length === 0) {
        return {
          success: false,
          latency,
          error: "API 返回无效响应",
        };
      }

      return {
        success: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "未知错误";

      return {
        success: false,
        latency,
        error: errorMessage,
      };
    }
  }

  /**
   * 通用聊天方法
   *
   * 用于难度分析等非翻译场景，接受自定义 Prompt。
   * 不使用配置中的 Prompt，直接使用传入的参数。
   *
   * @param systemPrompt - 系统提示词
   * @param userPrompt - 用户提示词
   * @returns Promise 解析为 AI 响应的原始字符串
   *
   * @example
   * ```typescript
   * const response = await provider.chat(
   *   '你是一个英语难度分析专家...',
   *   '请分析以下文本的难度...'
   * );
   * ```
   */
  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    console.log("[Lingride] 发送 chat 请求");
    const response = await this.sendRequestWithRetry(messages);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("API 返回空响应");
    }

    console.log("[Lingride] chat 请求成功");
    return content;
  }
}
