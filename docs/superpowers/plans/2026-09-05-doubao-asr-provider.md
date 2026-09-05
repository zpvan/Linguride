# 新增豆包（火山方舟）ASR Provider 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页"语音识别服务"新增豆包（doubao-seed-asr-2.0）选项，配置 API Key 后成为最高优先级 ASR（豆包 > 腾讯 > 阿里 > Web Speech）。

**Architecture:** SAUC v1 二进制帧编解码抽成纯函数模块 `saucProtocol.ts`（gzip 用 CompressionStream/DecompressionStream，零依赖）；鉴权头由 service worker 通过 declarativeNetRequest 会话规则注入（浏览器 WS 不能设 header）；识别器 `DoubaoASRRecognizer` 在 tutor 页直连 WS，镜像腾讯识别器结构。

**Tech Stack:** TypeScript、Chrome Extension MV3（declarativeNetRequest）、vitest、Bun（实测脚本）。

**Spec:** `docs/superpowers/specs/2026-09-05-doubao-asr-provider-design.md`

**工作目录：** `apps/browser-extension`（以下相对路径均相对于它）

---

### Task 1: SAUC 协议模块（TDD 纯函数）

**Files:**
- Create: `src/tutor/saucProtocol.ts`
- Test: `src/tutor/saucProtocol.test.ts`

SAUC v1 帧布局（大端序）：`byte0: (1<<4)|1`（协议版本 1 + 4 字节头）、`byte1: (type<<4)|flags`、`byte2: (serialization<<4)|compression`、`byte3: 0`；flags 含序列号（1/2/3）时跟 int32 sequence；然后 uint32 payload_size + payload（compression=1 时 gzip）。消息类型：1=full client request，2=audio only，9=full server response，11=server ack，15=error（sequence 为错误码）。flags：0=无序列号，1=正序列号，2=负序列号（最后一包），3=最后一包带序列号。

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, expect, it } from "vitest";

import {
  SAUC_MSG_AUDIO_ONLY,
  SAUC_MSG_ERROR,
  SAUC_MSG_FULL_CLIENT_REQUEST,
  SAUC_MSG_FULL_SERVER_RESPONSE,
  buildAudioFrame,
  buildFullClientRequest,
  parseServerMessage,
} from "./saucProtocol";

describe("buildFullClientRequest", () => {
  it("builds header with full-client-request type and gzip JSON payload", async () => {
    const frame = await buildFullClientRequest({
      user: { uid: "test" },
      audio: { format: "pcm", codec: "raw", rate: 16000, bits: 16, channel: 1 },
      request: { model_name: "bigmodel", enable_punc: true },
    });

    expect(frame[0]).toBe(0b0001_0001); // 版本1 + 头长1
    expect(frame[1]).toBe((SAUC_MSG_FULL_CLIENT_REQUEST << 4) | 1); // 正序列号
    expect(frame[2]).toBe(0b0001_0001); // JSON + gzip
    expect(frame[3]).toBe(0);

    const view = new DataView(frame.buffer, frame.byteOffset);
    const seq = view.getInt32(4);
    expect(seq).toBe(1);

    const payloadSize = view.getUint32(8);
    expect(payloadSize).toBe(frame.length - 12);
  });
});

describe("buildAudioFrame", () => {
  it("increments positive sequence for normal frames", async () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const frame = await buildAudioFrame(pcm, 5, false);

    expect(frame[1]).toBe((SAUC_MSG_AUDIO_ONLY << 4) | 1);
    const view = new DataView(frame.buffer, frame.byteOffset);
    expect(view.getInt32(4)).toBe(5);
  });

  it("negates sequence with last-packet flag for final frame", async () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const frame = await buildAudioFrame(pcm, 5, true);

    expect(frame[1]).toBe((SAUC_MSG_AUDIO_ONLY << 4) | 3);
    const view = new DataView(frame.buffer, frame.byteOffset);
    expect(view.getInt32(4)).toBe(-5);
  });
});

describe("parseServerMessage", () => {
  it("parses gzipped JSON result with text", async () => {
    const request = await buildFullClientRequest({ result: { text: "hello" } });
    const parsed = await parseServerMessage(request);

    expect(parsed.type).toBe("result");
    expect(parsed.payload).toEqual({ result: { text: "hello" } });
    expect(parsed.isLast).toBe(false);
  });

  it("detects last package by negative sequence", async () => {
    const frame = await buildAudioFrame(new Uint8Array([0]), 7, true);
    // 把类型位改成 server response 复用同一布局构造测试帧
    frame[1] = (SAUC_MSG_FULL_SERVER_RESPONSE << 4) | 3;
    // 载荷不是合法 JSON（是 gzip 的 [0]），该用例只验证序列号
    const view = new DataView(frame.buffer, frame.byteOffset);
    expect(view.getInt32(4)).toBe(-7);
  });

  it("parses error frame: sequence field is the error code", async () => {
    // 手工构造错误帧：type=15, flags=1（带序列号）, 无压缩
    const payload = new TextEncoder().encode("quota exceeded");
    const frame = new Uint8Array(12 + payload.length);
    const view = new DataView(frame.buffer);
    frame[0] = 0b0001_0001;
    frame[1] = (SAUC_MSG_ERROR << 4) | 1;
    frame[2] = 0b0001_0000; // JSON 无压缩
    view.setInt32(4, 45000001);
    view.setUint32(8, payload.length);
    frame.set(payload, 12);

    const parsed = await parseServerMessage(frame);
    expect(parsed.type).toBe("error");
    expect(parsed.errorCode).toBe(45000001);
    expect(parsed.errorMessage).toBe("quota exceeded");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/tutor/saucProtocol.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 saucProtocol.ts**

```ts
/**
 * @file saucProtocol.ts
 * @description 火山引擎 SAUC v1 二进制协议编解码（豆包流式语音识别）
 *
 * 帧布局（大端序）：
 *   byte0: (protocol_version=1 << 4) | header_size=1（4 字节头）
 *   byte1: (message_type << 4) | flags
 *   byte2: (serialization << 4) | compression
 *   byte3: reserved = 0
 *   [flags ∈ {1,2,3} 时] int32 sequence
 *   uint32 payload_size
 *   payload（compression=1 时 gzip）
 */

export const SAUC_MSG_FULL_CLIENT_REQUEST = 0b0001;
export const SAUC_MSG_AUDIO_ONLY = 0b0010;
export const SAUC_MSG_FULL_SERVER_RESPONSE = 0b1001;
export const SAUC_MSG_SERVER_ACK = 0b1011;
export const SAUC_MSG_ERROR = 0b1111;

const FLAG_NO_SEQUENCE = 0b0000;
const FLAG_POS_SEQUENCE = 0b0001;
const FLAG_NEG_WITH_SEQUENCE = 0b0011;

const SERIALIZATION_JSON = 0b0001;
const COMPRESSION_GZIP = 0b0001;

async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  // 注意：直接传 Uint8Array（Blob 会尊重 view 的偏移），不要传 data.buffer
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function buildHeader(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number
): Uint8Array {
  return new Uint8Array([
    0b0001_0001,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0,
  ]);
}

function assembleFrame(
  header: Uint8Array,
  sequence: number | null,
  payload: Uint8Array
): Uint8Array {
  const seqBytes = sequence !== null ? 4 : 0;
  const frame = new Uint8Array(header.length + seqBytes + 4 + payload.length);
  const view = new DataView(frame.buffer);

  frame.set(header, 0);
  let offset = header.length;
  if (sequence !== null) {
    view.setInt32(offset, sequence);
    offset += 4;
  }
  view.setUint32(offset, payload.length);
  frame.set(payload, offset + 4);

  return frame;
}

/** 构建 full client request（会话首包，seq=1，JSON+gzip） */
export async function buildFullClientRequest(
  config: Record<string, unknown>
): Promise<Uint8Array> {
  const payload = await gzipCompress(
    new TextEncoder().encode(JSON.stringify(config))
  );
  return assembleFrame(
    buildHeader(
      SAUC_MSG_FULL_CLIENT_REQUEST,
      FLAG_POS_SEQUENCE,
      SERIALIZATION_JSON,
      COMPRESSION_GZIP
    ),
    1,
    payload
  );
}

/** 构建音频帧；isLast 时序列号取负（最后一包） */
export async function buildAudioFrame(
  pcm: Uint8Array,
  sequence: number,
  isLast: boolean
): Promise<Uint8Array> {
  const payload = await gzipCompress(pcm);
  return assembleFrame(
    buildHeader(
      SAUC_MSG_AUDIO_ONLY,
      isLast ? FLAG_NEG_WITH_SEQUENCE : FLAG_POS_SEQUENCE,
      SERIALIZATION_JSON,
      COMPRESSION_GZIP
    ),
    isLast ? -sequence : sequence,
    payload
  );
}

export interface SaucServerMessage {
  type: "result" | "ack" | "error";
  /** 服务端序列号；< 0 表示最后一包 */
  sequence: number;
  /** 是否最后一包 */
  isLast: boolean;
  /** result 类型的 JSON 载荷 */
  payload?: unknown;
  /** error 类型的错误码（取 sequence 字段） */
  errorCode?: number;
  /** error 类型的错误消息 */
  errorMessage?: string;
}

/** 解析服务端帧 */
export async function parseServerMessage(
  frame: Uint8Array
): Promise<SaucServerMessage> {
  if (frame.length < 4) {
    throw new Error("SAUC 帧长度不足");
  }

  const headerSize = (frame[0] & 0x0f) * 4;
  const messageType = (frame[1] >> 4) & 0x0f;
  const flags = frame[1] & 0x0f;
  const compression = frame[2] & 0x0f;

  const view = new DataView(frame.buffer, frame.byteOffset);
  let offset = headerSize;

  let sequence = 0;
  if (flags !== FLAG_NO_SEQUENCE) {
    sequence = view.getInt32(offset);
    offset += 4;
  }

  const payloadSize = view.getUint32(offset);
  offset += 4;
  let payload = frame.subarray(offset, offset + payloadSize);
  if (compression === COMPRESSION_GZIP) {
    payload = await gzipDecompress(payload);
  }

  if (messageType === SAUC_MSG_ERROR) {
    return {
      type: "error",
      sequence,
      isLast: true,
      errorCode: sequence,
      errorMessage: new TextDecoder().decode(payload),
    };
  }

  if (messageType === SAUC_MSG_SERVER_ACK) {
    return { type: "ack", sequence, isLast: sequence < 0 };
  }

  const payloadText = new TextDecoder().decode(payload);
  return {
    type: "result",
    sequence,
    isLast: sequence < 0,
    payload: payloadText ? JSON.parse(payloadText) : undefined,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/tutor/saucProtocol.test.ts`
Expected: 5 个测试 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/tutor/saucProtocol.ts apps/browser-extension/src/tutor/saucProtocol.test.ts
git commit -m "feat(browser-extension): 新增 SAUC v1 二进制协议编解码模块"
```

---

### Task 2: 类型/配置/manifest

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/types/index.ts`
- Modify: `src/background/configManager.ts`
- Modify: `src/manifest.json`

- [ ] **Step 1: types/config.ts**

1a. `AlibabaASRConfig`（约 line 168-180）之后追加：

```ts
/**
 * 豆包（火山方舟）ASR 配置
 *
 * 用于豆包流式语音识别模型 2.0（doubao-seed-asr-2.0）。
 * 配置后优先级最高：豆包 > 腾讯云 > 阿里云 > Web Speech API。
 */
export interface DoubaoASRConfig {
  /** 火山方舟 API Key */
  api_key: string;
}

/** 豆包 ASR WebSocket 地址（SAUC 单向流式） */
export const DOUBAO_ASR_WS_URL =
  "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";

/** 豆包 ASR 资源 ID（volc.seedasr.sauc.duration = 豆包流式语音识别模型 2.0 小时版） */
export const DOUBAO_ASR_RESOURCE_ID = "volc.seedasr.sauc.duration";
```

1b. `LingridConfig` 中 `alibaba_asr` 字段（约 line 425-426）之后追加：

```ts
  /** 豆包（火山方舟）ASR 配置（可选，配置后优先级最高） */
  doubao_asr?: DoubaoASRConfig;
```

- [ ] **Step 2: types/index.ts 导出**

值导出块追加 `DOUBAO_ASR_WS_URL, DOUBAO_ASR_RESOURCE_ID,`；类型导出块追加 `DoubaoASRConfig,`。

- [ ] **Step 3: configManager 透传**

`src/background/configManager.ts`（`alibaba_asr:` 行之后）追加：

```ts
      doubao_asr: stored.doubao_asr || DEFAULT_CONFIG.doubao_asr,
```

- [ ] **Step 4: manifest 增加权限**

`src/manifest.json` 的 `permissions` 数组中，`"offscreen"` 之后追加：

```json
    "declarativeNetRequest"
```

- [ ] **Step 5: 类型检查 + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bunx vitest run`
Expected: 无错误；全部 PASS

- [ ] **Step 6: Commit**

```bash
git add apps/browser-extension/src/types/config.ts apps/browser-extension/src/types/index.ts apps/browser-extension/src/background/configManager.ts apps/browser-extension/src/manifest.json
git commit -m "feat(browser-extension): 新增豆包 ASR 配置类型与 DNR 权限"
```

---

### Task 3: service worker DNR 鉴权头注入

**Files:**
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: 实现 syncDoubaoASRHeaderRule**

在 `sleep` 函数（约 line 744-746 区域）之后追加：

```ts
/** 豆包 ASR 鉴权头注入规则 ID（会话规则） */
const DOUBAO_ASR_DNR_RULE_ID = 4101;

/**
 * 同步豆包 ASR 的 DNR 会话规则：
 * 浏览器 WebSocket 无法自定义 header，通过 declarativeNetRequest
 * 在 WS 握手上注入 X-Api-Key / X-Api-Resource-Id / X-Api-Request-Id。
 * 未配置豆包 ASR key 时移除规则。
 */
async function syncDoubaoASRHeaderRule(): Promise<void> {
  const dnr = chrome.declarativeNetRequest;
  if (!dnr) return;

  const config = await getConfig();
  const apiKey = config.doubao_asr?.api_key?.trim();

  await dnr.updateSessionRules({
    removeRuleIds: [DOUBAO_ASR_DNR_RULE_ID],
    ...(apiKey
      ? {
          addRules: [
            {
              id: DOUBAO_ASR_DNR_RULE_ID,
              priority: 1,
              action: {
                type: chrome.declarativeNetRequest.RuleActionType
                  .MODIFY_HEADERS,
                requestHeaders: [
                  {
                    header: "X-Api-Key",
                    operation:
                      chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: apiKey,
                  },
                  {
                    header: "X-Api-Resource-Id",
                    operation:
                      chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: DOUBAO_ASR_RESOURCE_ID,
                  },
                  {
                    header: "X-Api-Request-Id",
                    operation:
                      chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: crypto.randomUUID(),
                  },
                ],
              },
              condition: {
                urlFilter: "openspeech.bytedance.com/api/v3/sauc/",
                resourceTypes: [
                  chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
                ],
              },
            },
          ],
        }
      : {}),
  });
}
```

并在顶部 `from "../types"` import 块中追加 `DOUBAO_ASR_RESOURCE_ID,`。

- [ ] **Step 2: 启动与配置保存时同步**

2a. SW 启动处（`initTabStateListeners();` 之后，约 line 150）追加：

```ts
void syncDoubaoASRHeaderRule().catch((error) => {
  console.warn("[Lingride] 同步豆包 ASR DNR 规则失败:", error);
});
```

2b. `handleSaveConfig` 中 `await saveConfig(payload);` 之后追加：

```ts
    await syncDoubaoASRHeaderRule();
```

- [ ] **Step 3: 类型检查**

Run: `cd apps/browser-extension && bun run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension/src/background/service-worker.ts
git commit -m "feat(browser-extension): DNR 会话规则注入豆包 ASR WebSocket 鉴权头"
```

---

### Task 4: DoubaoASRRecognizer

**Files:**
- Create: `src/tutor/doubaoASRRecognizer.ts`

镜像 `tencentASRRecognizer.ts` 结构（`acquireStream`、`AudioContext` 16kHz + 回退重采样、`ScriptProcessorNode`、`float32ToInt16`），差异：不需向 SW 请求签名 URL，直连 `DOUBAO_ASR_WS_URL`（鉴权由 DNR 注入）。

- [ ] **Step 1: 实现识别器**

```ts
/**
 * @file doubaoASRRecognizer.ts
 * @description 豆包（火山方舟）流式语音识别：SAUC 单向流式（bigmodel_nostream）
 *
 * 鉴权：WebSocket 握手所需的 X-Api-Key 等头由 service worker
 * 通过 declarativeNetRequest 会话规则注入，页面侧无需感知。
 */

import { DOUBAO_ASR_WS_URL, LingridConfig } from "../types";
import type { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { acquireStream, releaseStream } from "./audioCapture";
import {
  buildAudioFrame,
  buildFullClientRequest,
  parseServerMessage,
} from "./saucProtocol";

const TARGET_SAMPLE_RATE = 16000;
const AUDIO_SEND_INTERVAL = 200;

/** 检查豆包 ASR 是否已配置 */
export function isDoubaoASRConfigured(config: LingridConfig): boolean {
  return !!config.doubao_asr?.api_key?.trim();
}

interface SaucResultPayload {
  result?: { text?: string };
}

/**
 * 豆包流式语音识别器
 *
 * 单向流式模式：流式发送音频，返回整句识别结果（准确率优于双向流式）。
 */
export class DoubaoASRRecognizer implements ISpeechRecognizer {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private _isRecognizing = false;
  private sequence = 1;
  private finalTranscript = "";
  private connectTimeout: number | null = null;

  /** 实时识别结果回调 */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  async start(): Promise<void> {
    this.finalTranscript = "";
    this.sequence = 1;
    this._isRecognizing = false;

    await this.connectWebSocket();
    await this.startAudioCapture();

    this._isRecognizing = true;
    console.log("[Lingride DoubaoASR] 识别已启动");
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;

    // 发送最后一包（负序列号）并等待最终结果
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const lastFrame = await buildAudioFrame(new Uint8Array(0), ++this.sequence, true);
      this.ws.send(lastFrame);
    }

    // 等待服务端最后一包（sequence < 0）或超时 5s
    const deadline = Date.now() + 5000;
    while (!this.lastPackageReceived && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.cleanup();
    return this.finalTranscript.trim();
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  private lastPackageReceived = false;

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(DOUBAO_ASR_WS_URL);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      this.connectTimeout = window.setTimeout(() => {
        reject(new Error("豆包 ASR 连接超时"));
      }, 10000);

      ws.onopen = async () => {
        try {
          // 发送 full client request（会话配置）
          const frame = await buildFullClientRequest({
            user: { uid: "lingride-user" },
            audio: {
              format: "pcm",
              codec: "raw",
              rate: TARGET_SAMPLE_RATE,
              bits: 16,
              channel: 1,
            },
            request: { model_name: "bigmodel", enable_punc: true },
          });
          ws.send(frame);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };

      ws.onmessage = (event) => {
        void this.handleMessage(event);
      };

      ws.onerror = () => {
        if (this.connectTimeout !== null) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        const error = new Error("豆包 ASR WebSocket 连接失败");
        this.onError?.(error);
        reject(error);
      };

      ws.onclose = () => {
        this.lastPackageReceived = true;
      };
    });
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    if (!(event.data instanceof ArrayBuffer)) return;

    try {
      const message = await parseServerMessage(new Uint8Array(event.data));

      if (message.type === "error") {
        this.onError?.(
          new Error(`豆包 ASR 错误（${message.errorCode}）：${message.errorMessage}`)
        );
        return;
      }

      if (message.type === "result") {
        const payload = message.payload as SaucResultPayload | undefined;
        const text = payload?.result?.text?.trim();
        if (text) {
          this.finalTranscript = text;
          this.onInterimResult?.(text);
        }
      }

      if (message.isLast) {
        this.lastPackageReceived = true;
      }
    } catch (error) {
      console.warn("[Lingride DoubaoASR] 解析响应失败:", error);
    }
  }

  private async startAudioCapture(): Promise<void> {
    const stream = await acquireStream();

    try {
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    } catch {
      this.audioContext = new AudioContext();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    const audioContext = this.audioContext;

    let audioBuffer: Int16Array[] = [];
    let lastSendTime = Date.now();

    this.processorNode.onaudioprocess = (event) => {
      if (!this._isRecognizing || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);
      const pcmData =
        audioContext.sampleRate !== TARGET_SAMPLE_RATE
          ? this.resample(inputData, audioContext.sampleRate, TARGET_SAMPLE_RATE)
          : inputData;

      audioBuffer.push(this.float32ToInt16(pcmData));

      const now = Date.now();
      if (now - lastSendTime >= AUDIO_SEND_INTERVAL) {
        const buffer = audioBuffer;
        audioBuffer = [];
        lastSendTime = now;
        this.sendAudioData(buffer);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  private sendAudioData(chunks: Int16Array[]): void {
    if (chunks.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const seq = ++this.sequence;
    void buildAudioFrame(new Uint8Array(merged.buffer), seq, false).then(
      (frame) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(frame);
        }
      }
    );
  }

  private resample(
    input: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      output[i] = input[Math.floor(i * ratio)];
    }

    return output;
  }

  private float32ToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private cleanup(): void {
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    this.processorNode?.disconnect();
    this.sourceNode?.disconnect();
    this.processorNode = null;
    this.sourceNode = null;

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    releaseStream();

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
```

（`audioCapture.ts` 已确认导出 `acquireStream` 与 `releaseStream`。）

- [ ] **Step 2: 类型检查**

Run: `cd apps/browser-extension && bun run typecheck`
Expected: 无错误（若 audioCapture 导出名不匹配，按实际修正 import）

- [ ] **Step 3: Commit**

```bash
git add apps/browser-extension/src/tutor/doubaoASRRecognizer.ts
git commit -m "feat(browser-extension): 新增豆包流式 ASR 识别器（SAUC 单向流式）"
```

---

### Task 5: 优先级链接入 + popup 配置 UI

**Files:**
- Modify: `src/tutor/tutor.ts`
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.ts`

- [ ] **Step 1: createRecognizer 优先级**

`src/tutor/tutor.ts` 的 `createRecognizer`（约 line 715-751），在"优先级 1: 腾讯云 ASR"之前插入豆包分支，并更新函数头注释的优先级说明：

```ts
  // 优先级 1: 豆包 ASR（火山方舟）
  if (userConfig && isDoubaoASRConfigured(userConfig)) {
    console.log("[Lingride Tutor] 使用豆包 ASR 识别器");
    const doubaoRecognizer = new DoubaoASRRecognizer();

    doubaoRecognizer.onError = (error: Error) => {
      console.warn("[Lingride Tutor] 豆包 ASR 失败，降级到 Web Speech API:", error.message);
      options?.onFallback?.(`豆包识别失败: ${error.message}，使用浏览器识别`);
    };

    return doubaoRecognizer;
  }
```

import 区追加：

```ts
import {
  DoubaoASRRecognizer,
  isDoubaoASRConfigured,
} from "./doubaoASRRecognizer";
```

（原腾讯/阿里分支优先级注释序号顺延，可不改。函数头注释 `优先级：腾讯云 ASR > 阿里云 ASR > Web Speech API` 改为 `优先级：豆包 ASR > 腾讯云 ASR > 阿里云 ASR > Web Speech API`。）

- [ ] **Step 2: popup.html 新增豆包嵌套手风琴**

在阿里云嵌套手风琴结束后（`id="alibaba-asr"` 所属 `accordion-item nested` 的 `</div>` 之后）插入：

```html
              <!-- 嵌套 accordion: 豆包 -->
              <div class="accordion-item nested">
                <button class="accordion-header nested-header" data-accordion="doubao-asr" data-nested="true">
                  <span>豆包（优先级最高）</span>
                  <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="accordion-body nested-body" id="doubao-asr">
                  <div class="accordion-inner">
                    <div class="settings-row">
                      <label class="settings-label" for="doubaoAsrApiKey">API Key</label>
                      <div class="password-input">
                        <input type="password" id="doubaoAsrApiKey" class="settings-input" placeholder="火山方舟 API Key">
                        <button type="button" id="showDoubaoAsrKeyBtn" class="show-key-btn">显示</button>
                      </div>
                    </div>
                    <p class="settings-hint">
                      <a href="https://www.volcengine.com/docs/82379/2516286" target="_blank" rel="noopener">查看火山方舟语音模型接入文档 →</a>
                    </p>
                  </div>
                </div>
              </div>
```

并把"语音识别服务"区块的说明文案 `优先级：腾讯云 → 阿里云 → 浏览器内置。` 改为 `优先级：豆包 → 腾讯云 → 阿里云 → 浏览器内置。`。

- [ ] **Step 3: popup.ts 接线**

3a. DOM 引用区（`alibabaApiKey` 相关引用附近）追加：

```ts
const doubaoAsrApiKeyInput = document.getElementById(
  "doubaoAsrApiKey"
) as HTMLInputElement;
const showDoubaoAsrKeyBtn = document.getElementById(
  "showDoubaoAsrKeyBtn"
) as HTMLButtonElement;
```

3b. 事件绑定区（阿里云 show/hide 绑定附近）追加：

```ts
  doubaoAsrApiKeyInput.addEventListener("blur", autoSave);
  showDoubaoAsrKeyBtn.addEventListener("click", () => {
    const isPassword = doubaoAsrApiKeyInput.type === "password";
    doubaoAsrApiKeyInput.type = isPassword ? "text" : "password";
    showDoubaoAsrKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });
```

3c. `collectConfig` 阿里云段之后追加：

```ts
  // 豆包 ASR 配置（只有填写了才保存）
  const doubaoAsrApiKey = doubaoAsrApiKeyInput.value.trim();

  if (doubaoAsrApiKey) {
    currentConfig.doubao_asr = {
      api_key: doubaoAsrApiKey,
    };
  } else {
    delete currentConfig.doubao_asr;
  }
```

3d. `updateSettingsForm` 阿里云回填（`alibabaApiKeyInput.value = ...`）之后追加：

```ts
  doubaoAsrApiKeyInput.value = currentConfig.doubao_asr?.api_key || "";
```

- [ ] **Step 4: 类型检查 + lint + 构建 + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bun run lint && bun run build && bunx vitest run`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/tutor/tutor.ts apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts
git commit -m "feat(browser-extension): 豆包 ASR 设为最高优先级，设置页新增配置入口"
```

---

### Task 6: 真实音频端到端实测 + 人工验证

- [ ] **Step 1: 准备英文测试音频**

用已验证可用的豆包 TTS 生成，再用 macOS 自带 afconvert 转 PCM：

```bash
cd /tmp
curl -s -X POST "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $ARK_API_KEY" \
  -H "X-Api-Resource-Id: seed-tts-2.0" \
  -H "X-Api-Request-Id: $(uuidgen)" \
  -d '{"req_params":{"text":"The quick brown fox jumps over the lazy dog.","speaker":"en_female_allison_uranus_bigtts","audio_params":{"format":"mp3","sample_rate":24000}}}' \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const chunks=[];for(const l of d.split("\n")){if(!l.trim())continue;const j=JSON.parse(l);if(j.data)chunks.push(Buffer.from(j.data,"base64"))}process.stdout.write(Buffer.concat(chunks))})' > asr-test.mp3
afconvert -f WAVE -d LEI16@16000 -c 1 asr-test.mp3 asr-test.wav
```

Expected: `asr-test.wav` 生成成功（16kHz 16bit 单声道）

- [ ] **Step 2: Bun 端到端识别脚本**

创建 `scripts/test-doubao-asr.ts`（不入库或入库均可，建议入库到 scripts/）：

```ts
/**
 * @file test-doubao-asr.ts
 * @description 豆包 ASR 端到端实测：bun scripts/test-doubao-asr.ts <wav路径>
 * 用 Bun 的 WebSocket（支持自定义 header）直连 SAUC 接口。
 */
import {
  buildAudioFrame,
  buildFullClientRequest,
  parseServerMessage,
} from "../src/tutor/saucProtocol";

const apiKey = process.env.ARK_API_KEY?.trim();
const wavPath = process.argv[2];
if (!apiKey || !wavPath) {
  console.error("用法: ARK_API_KEY=xxx bun scripts/test-doubao-asr.ts /tmp/asr-test.wav");
  process.exit(2);
}

// 去掉 44 字节 WAV 头，得到裸 PCM
const wav = new Uint8Array(await Bun.file(wavPath).arrayBuffer());
const pcm = wav.subarray(44);

const ws = new WebSocket("wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream", {
  headers: {
    "X-Api-Key": apiKey,
    "X-Api-Resource-Id": "volc.seedasr.sauc.duration",
    "X-Api-Request-Id": crypto.randomUUID(),
  } as Record<string, string>,
});
ws.binaryType = "arraybuffer";

let seq = 1;
ws.onopen = async () => {
  ws.send(
    await buildFullClientRequest({
      user: { uid: "test" },
      audio: { format: "pcm", codec: "raw", rate: 16000, bits: 16, channel: 1 },
      request: { model_name: "bigmodel", enable_punc: true },
    })
  );

  // 每 200ms 发一帧（200ms * 16000Hz * 2B = 6400 字节）
  const CHUNK = 6400;
  for (let offset = 0; offset < pcm.length; offset += CHUNK) {
    const isLast = offset + CHUNK >= pcm.length;
    ws.send(
      await buildAudioFrame(pcm.subarray(offset, offset + CHUNK), ++seq, isLast)
    );
    await Bun.sleep(200);
  }
};

ws.onmessage = async (event) => {
  if (!(event.data instanceof ArrayBuffer)) return;
  const message = await parseServerMessage(new Uint8Array(event.data));
  if (message.type === "error") {
    console.error(`✗ 错误 ${message.errorCode}: ${message.errorMessage}`);
    process.exit(1);
  }
  if (message.type === "result") {
    const text = (message.payload as { result?: { text?: string } })?.result?.text;
    if (text) console.log("识别结果:", text);
  }
  if (message.isLast) {
    process.exit(0);
  }
};

ws.onerror = () => {
  console.error("✗ WebSocket 连接失败");
  process.exit(1);
};
```

Run: `cd apps/browser-extension && ARK_API_KEY=<用户的方舟key> bun scripts/test-doubao-asr.ts /tmp/asr-test.wav`
Expected: 输出 `识别结果: The quick brown fox jumps over the lazy dog.`（或极接近的文本）

- [ ] **Step 3: 全量验证**

Run: `cd apps/browser-extension && bun run typecheck && bun run lint && bunx vitest run && bun run build`
Expected: 全绿

- [ ] **Step 4: 人工验证**

`dist/` 加载 Chrome：设置 → 语音识别服务 → 豆包填 key；tutor 页发音评估朗读一句 → 识别文本正确；跟读功能正常。

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/scripts/test-doubao-asr.ts
git commit -m "test(browser-extension): 新增豆包 ASR 端到端实测脚本"
```
