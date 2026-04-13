import { BaseTranslateProvider } from "./ITranslateProvider";

interface MessageContentBlock {
  type: string;
  text?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessagesRequest {
  model: string;
  system?: string;
  messages: Message[];
  max_tokens: number;
  temperature: number;
}

interface MessagesResponse {
  content?: MessageContentBlock[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export class MiniMaxProvider extends BaseTranslateProvider {
  readonly name = "MiniMax";

  private readonly timeout = 60000;

  private readonly maxRetries = 2;

  private getApiUrl(): string {
    const baseUrl = this.config.apiBaseUrl.replace(/\/$/, "");
    return `${baseUrl}/v1/messages`;
  }

  private formatProviderError(message: string): string {
    return message.startsWith(`[${this.name}]`)
      ? message
      : `[${this.name}] ${message}`;
  }

  private getApiErrorMessage(
    status: number,
    statusText: string,
    errorText: string
  ): string {
    let apiMessage: string | undefined;

    try {
      const errorData = JSON.parse(errorText) as ApiErrorResponse;
      apiMessage = errorData.error?.message;
    } catch {
      apiMessage = undefined;
    }

    return this.formatProviderError(
      `API 请求失败 (${status}): ${apiMessage || errorText || statusText}`
    );
  }

  private extractTextContent(response: MessagesResponse): string {
    const text = (response.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n");

    if (!text) {
      throw new Error(this.formatProviderError("API 返回空响应"));
    }

    return text;
  }

  private async sendRequest(
    messages: Message[],
    system?: string
  ): Promise<MessagesResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const requestBody: MessagesRequest = {
        model: this.config.model,
        messages,
        max_tokens: 8192,
        temperature: 0.3,
      };

      if (system) {
        requestBody.system = system;
      }

      const response = await fetch(this.getApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          this.getApiErrorMessage(
            response.status,
            response.statusText,
            errorText
          )
        );
      }

      return (await response.json()) as MessagesResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            this.formatProviderError(`请求超时（${this.timeout / 1000}秒）`)
          );
        }

        throw new Error(this.formatProviderError(error.message));
      }

      throw new Error(this.formatProviderError("未知请求错误"));
    }
  }

  private async sendRequestWithRetry(
    messages: Message[],
    system?: string
  ): Promise<MessagesResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.sendRequest(messages, system);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (
          lastError.message.includes("400") ||
          lastError.message.includes("401") ||
          lastError.message.includes("403")
        ) {
          throw lastError;
        }

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(this.formatProviderError("请求失败"));
  }

  async translate(texts: string[]): Promise<string[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const response = await this.sendRequestWithRetry(
      [
        {
          role: "user",
          content: this.buildUserPrompt(texts),
        },
      ],
      this.config.systemPrompt
    );

    return this.parseResponse(this.extractTextContent(response), texts.length);
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.sendRequestWithRetry(
      [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      systemPrompt
    );

    return this.extractTextContent(response);
  }

  async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.sendRequest(
        [
          {
            role: "user",
            content: 'Hi, this is a connection test. Please respond with "OK".',
          },
        ],
        undefined
      );

      this.extractTextContent(response);

      return {
        success: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error:
          error instanceof Error
            ? this.formatProviderError(error.message)
            : this.formatProviderError("未知错误"),
      };
    }
  }
}
