import { ProviderConfig } from "../types";
import { BaseTranslateProvider } from "./ITranslateProvider";

export interface OpenAICodexRequestCredentials {
  accessToken: string;
  accountId: string;
}

export interface OpenAICodexAuthAdapter {
  getCredentials(options?: {
    forceRefresh?: boolean;
  }): Promise<OpenAICodexRequestCredentials>;
  handleUnauthorized(): Promise<void>;
}

interface OpenAICodexEventPayload {
  delta?: string;
  error?: {
    message?: string;
  };
  message?: string;
}

interface OpenAICodexRequestBody {
  model: string;
  store: false;
  stream: true;
  instructions: string;
  input: Array<{
    role: "user";
    content: Array<{
      type: "input_text";
      text: string;
    }>;
  }>;
  text: {
    verbosity: "medium";
  };
  include: ["reasoning.encrypted_content"];
}

export class OpenAICodexProvider extends BaseTranslateProvider {
  readonly name = "OpenAI Codex";

  private readonly endpointUrl = "https://chatgpt.com/backend-api/codex/responses";
  private readonly timeout = 60000;

  constructor(
    config: ProviderConfig,
    private readonly authAdapter: OpenAICodexAuthAdapter
  ) {
    super(config);
  }

  private buildRequestBody(
    systemPrompt: string,
    userPrompt: string
  ): OpenAICodexRequestBody {
    return {
      model: this.config.model,
      store: false,
      stream: true,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt,
            },
          ],
        },
      ],
      text: {
        verbosity: "medium",
      },
      include: ["reasoning.encrypted_content"],
    };
  }

  private async parseStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("OpenAI Codex 未返回可读取的数据流");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let outputText = "";
    let refusalText = "";

    const processFrame = (frame: string): void => {
      const lines = frame
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      let eventName = "";
      const dataParts: string[] = [];

      lines.forEach((line) => {
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim();
          return;
        }

        if (line.startsWith("data:")) {
          dataParts.push(line.slice("data:".length).trim());
        }
      });

      if (!eventName || dataParts.length === 0) {
        return;
      }

      const rawData = dataParts.join("\n");
      if (rawData === "[DONE]") {
        return;
      }

      let payload: OpenAICodexEventPayload;
      try {
        payload = JSON.parse(rawData) as OpenAICodexEventPayload;
      } catch {
        return;
      }

      switch (eventName) {
        case "response.output_text.delta":
          outputText += payload.delta || "";
          break;
        case "response.refusal.delta":
          refusalText += payload.delta || "";
          break;
        case "response.failed":
          throw new Error(
            payload.error?.message ||
              payload.message ||
              "OpenAI Codex 请求失败"
          );
        case "response.completed":
          break;
        default:
          break;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";

      frames.forEach((frame) => {
        processFrame(frame);
      });
    }

    if (buffer.trim()) {
      processFrame(buffer);
    }

    const finalText = outputText.trim() || refusalText.trim();
    if (!finalText) {
      throw new Error("OpenAI Codex 返回空响应");
    }

    return finalText;
  }

  private async doRequest(
    body: OpenAICodexRequestBody,
    forceRefresh: boolean,
    hasRetriedUnauthorized: boolean
  ): Promise<string> {
    const credentials = await this.authAdapter.getCredentials({
      forceRefresh,
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "chatgpt-account-id": credentials.accountId,
          "OpenAI-Beta": "responses=experimental",
          originator: "pi",
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        if (hasRetriedUnauthorized) {
          await this.authAdapter.handleUnauthorized();
          throw new Error("请重新登录 OpenAI OAuth");
        }

        return this.doRequest(body, true, true);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI Codex 请求失败 (${response.status}): ${
            errorText || response.statusText
          }`
        );
      }

      return this.parseStream(response);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`请求超时（${this.timeout / 1000}秒）`);
      }

      throw error;
    }
  }

  private async request(systemPrompt: string, userPrompt: string): Promise<string> {
    const body = this.buildRequestBody(systemPrompt, userPrompt);
    return this.doRequest(body, false, false);
  }

  async translate(texts: string[]): Promise<string[]> {
    if (!texts.length) {
      return [];
    }

    const content = await this.request(
      this.config.systemPrompt,
      this.buildUserPrompt(texts)
    );

    return this.parseResponse(content, texts.length);
  }

  async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      const content = await this.request(
        "You are a connectivity check assistant. Reply with OK.",
        'Hi, this is a connection test. Please respond with "OK".'
      );

      return {
        success: Boolean(content.trim()),
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    return this.request(systemPrompt, userPrompt);
  }
}
