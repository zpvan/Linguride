import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  anthropicDeltaExtractor,
  openAIDeltaExtractor,
  readSSEStream,
  streamSSEChatCompletion,
} from "./sseChatStream";

/** 把若干字符串块编码成一个 ReadableStream（每块一次 enqueue） */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readSSEStream", () => {
  it("解析 OpenAI 格式 delta 并拼接完整文本", async () => {
    const body = streamOf([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    const deltas: string[] = [];
    const full = await readSSEStream(body, openAIDeltaExtractor, (d) =>
      deltas.push(d)
    );
    expect(full).toBe("Hello world");
    expect(deltas).toEqual(["Hello", " world"]);
  });

  it("一条 data 行被拆到两个 chunk 也能正确解析", async () => {
    const body = streamOf([
      'data: {"choices":[{"delta":{"con',
      'tent":"split"}}]}\n\n',
    ]);
    const full = await readSSEStream(body, openAIDeltaExtractor, () => undefined);
    expect(full).toBe("split");
  });

  it("忽略非 data 行、空行与脏 JSON 行", async () => {
    const body = streamOf([
      "event: message_start\n",
      "\n",
      "data: {broken json\n\n",
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ]);
    const full = await readSSEStream(body, openAIDeltaExtractor, () => undefined);
    expect(full).toBe("ok");
  });

  it("Anthropic 格式：提取 content_block_delta 的 text", async () => {
    const body = streamOf([
      "event: content_block_delta\n",
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      "event: content_block_delta\n",
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n\n',
      "event: message_stop\n",
      'data: {"type":"message_stop"}\n\n',
    ]);
    const full = await readSSEStream(body, anthropicDeltaExtractor, () => undefined);
    expect(full).toBe("Hi there");
  });

  it("delta 缺失或为空字符串时不回调", async () => {
    const body = streamOf([
      'data: {"choices":[{"delta":{}}]}\n\n',
      'data: {"choices":[{"delta":{"content":""}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
    ]);
    const deltas: string[] = [];
    await readSSEStream(body, openAIDeltaExtractor, (d) => deltas.push(d));
    expect(deltas).toEqual(["x"]);
  });
});

describe("streamSSEChatCompletion", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST 请求体强制 stream:true，并透传自定义 header 与 body 字段", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        streamOf(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n']),
        { status: 200 }
      )
    );

    const full = await streamSSEChatCompletion(
      {
        url: "https://api.example.com/v1/chat/completions",
        headers: { "Content-Type": "application/json" },
        body: { model: "m", messages: [{ role: "user", content: "hi" }] },
      },
      openAIDeltaExtractor,
      () => undefined
    );

    expect(full).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "m",
      stream: true,
    });
  });

  it("HTTP 错误时抛出带状态码与响应摘要的错误", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"message":"bad key"}}', { status: 401 })
    );
    await expect(
      streamSSEChatCompletion(
        { url: "https://x", headers: {}, body: {} },
        openAIDeltaExtractor,
        () => undefined
      )
    ).rejects.toThrow("API 请求失败 (401)");
  });

  it("外部 signal abort 时请求被中止", async () => {
    fetchMock.mockImplementation((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError"))
        );
      });
    });
    const controller = new AbortController();
    const promise = streamSSEChatCompletion(
      { url: "https://x", headers: {}, body: {}, signal: controller.signal },
      openAIDeltaExtractor,
      () => undefined
    );
    controller.abort();
    await expect(promise).rejects.toThrow();
  });
});
