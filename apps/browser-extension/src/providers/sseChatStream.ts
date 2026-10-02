/**
 * @file sseChatStream.ts
 * @description SSE 流式聊天补全的共享解析器
 *
 * 供 OpenAI 兼容接口（DeepSeek/GLM/自定义端点）与
 * Anthropic Messages 兼容接口（MiniMax）的 Provider 复用：
 * - readSSEStream: 从 ReadableStream 逐行读取 `data:` 事件，
 *   处理跨 chunk 分片、脏行、`[DONE]` 终止
 * - streamSSEChatCompletion: 发起 POST 请求（强制 stream:true），
 *   组合超时/外部中止信号，并用指定 extractor 提取增量文本
 *
 * @author Lingride Team
 * @since 1.1.0
 */

/** SSE data 行 → 增量文本；返回 null 表示该行无文本增量 */
export type DeltaExtractor = (json: unknown) => string | null;

/** OpenAI 兼容格式 extractor（choices[0].delta.content） */
export const openAIDeltaExtractor: DeltaExtractor = (json) => {
  const delta = (json as {
    choices?: { delta?: { content?: unknown } }[];
  })?.choices?.[0]?.delta?.content;
  return typeof delta === "string" && delta.length > 0 ? delta : null;
};

/** Anthropic Messages 格式 extractor（content_block_delta → delta.text） */
export const anthropicDeltaExtractor: DeltaExtractor = (json) => {
  const event = json as {
    type?: string;
    delta?: { type?: string; text?: unknown };
  };
  if (
    event?.type === "content_block_delta" &&
    event.delta?.type === "text_delta" &&
    typeof event.delta.text === "string" &&
    event.delta.text.length > 0
  ) {
    return event.delta.text;
  }
  return null;
};

/**
 * 从 SSE 流读取增量文本
 *
 * @param body - fetch 响应的可读流
 * @param extractDelta - 每种 API 格式的增量提取器
 * @param onChunk - 每提取到一段非空增量回调一次
 * @returns 拼接后的完整文本
 */
export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  extractDelta: DeltaExtractor,
  onChunk: (delta: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice("data:".length).trim();
    if (!data || data === "[DONE]") return;
    try {
      const delta = extractDelta(JSON.parse(data));
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    } catch {
      // 忽略脏 JSON 行（代理/网关可能注入非事件数据）
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  // 冲刷末尾不完整行（无换行结尾的最后一条 data）
  if (buffer.trim()) handleLine(buffer);

  return full;
}

export interface SSEChatRequest {
  url: string;
  headers: Record<string, string>;
  /** 请求体（stream:true 由本函数强制写入） */
  body: Record<string, unknown>;
  /** 外部中止信号（CANCEL_STREAM） */
  signal?: AbortSignal;
  /** 超时毫秒数，默认 120 秒 */
  timeoutMs?: number;
}

/**
 * 发起 SSE 流式聊天补全请求
 *
 * @throws 带状态码与响应摘要的 Error（未带 provider 前缀，由调用方包装）
 */
export async function streamSSEChatCompletion(
  request: SSEChatRequest,
  extractDelta: DeltaExtractor,
  onChunk: (delta: string) => void
): Promise<string> {
  const timeoutMs = request.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // 外部信号（用户取消）转发到内部 controller
  if (request.signal) {
    if (request.signal.aborted) {
      controller.abort();
    } else {
      request.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...request.body, stream: true }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const summary = text.length > 300 ? `${text.slice(0, 300)}…` : text;
      throw new Error(`API 请求失败 (${response.status}): ${summary}`);
    }
    if (!response.body) {
      throw new Error("API 响应不支持流式读取");
    }

    return await readSSEStream(response.body, extractDelta, onChunk);
  } finally {
    clearTimeout(timeoutId);
  }
}
