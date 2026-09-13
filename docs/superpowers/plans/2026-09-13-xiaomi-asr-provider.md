# 小米 MiMo 语音识别 Provider 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 语音识别服务新增小米 MiMo（`mimo-v2.5-asr`）选项：录完一句话后上传 WAV，经 SSE 流式逐 token 出识别文本。

**Architecture:** `LingridConfig` 新增 `xiaomi_asr` 独立 key 字段；PCM 采集从豆包识别器抽为公共模块 `pcmCapture.ts`；新建 `XiaomiASRRecognizer`（采集攒 PCM → stop 时 WAV+base64 → fetch 直连 chat/completions + stream:true → SSE 增量解析）；设置页加小米选项与配置面板。

**Tech Stack:** TypeScript、Chrome Extension MV3、vitest（`bunx vitest run`）

**Spec:** `docs/superpowers/specs/2026-09-13-xiaomi-asr-provider-design.md`

**工作目录：** 相对路径基于 `apps/browser-extension/`；git 命令在仓库根 `/Users/knox/Documents/GitWorkSpace/Linguride` 执行。

---

### Task 1: 类型与配置（config.ts）

**Files:**
- Modify: `src/types/config.ts`（XiaomiTTSConfig 区约 247 行之后；ASR 判定函数区约 215-260 行）
- Modify: `src/types/index.ts`
- Test: `src/types/config.test.ts`

- [ ] **Step 1: 写失败测试**

`src/types/config.test.ts` 顶部 import 块加入 `isXiaomiASRConfigured`（与既有 `isAlibabaASRConfigured` 等并列）。

文件末尾 `describe("isXxxASRConfigured")` 块内追加：

```ts
  it("xiaomi requires non-empty trimmed api_key", () => {
    expect(isXiaomiASRConfigured({} as never)).toBe(false);
    expect(isXiaomiASRConfigured({ xiaomi_asr: { api_key: "  " } } as never)).toBe(false);
    expect(isXiaomiASRConfigured({ xiaomi_asr: { api_key: "k" } } as never)).toBe(true);
  });
```

`describe("resolveASRSelection")` 块内追加：

```ts
  it("falls to xiaomi when only xiaomi configured", () => {
    expect(resolveASRSelection({ xiaomi_asr: { api_key: "k" } } as never)).toBe(
      "xiaomi"
    );
  });

  it("prefers alibaba over xiaomi in migration order", () => {
    expect(
      resolveASRSelection({
        alibaba_asr: { api_key: "k" },
        xiaomi_asr: { api_key: "k" },
      } as never)
    ).toBe("alibaba");
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: FAIL（`isXiaomiASRConfigured is not a function`）

- [ ] **Step 3: 实现**

`src/types/config.ts`：

a) 在 `DoubaoASRConfig` 接口之后（约 197 行区域，紧接 ASR 相关类型）插入：

```ts
/**
 * 小米 MiMo ASR 配置
 *
 * 用于小米 mimo-v2.5-asr 语音识别模型（OpenAI 兼容 chat/completions）。
 * 可在设置页「语音识别服务」中手动选择启用。
 */
export interface XiaomiASRConfig {
  /** 小米 MiMo API Key */
  api_key: string;
}

/** 小米 ASR 接口地址（OpenAI 兼容） */
export const XIAOMI_ASR_API_URL =
  "https://api.xiaomimimo.com/v1/chat/completions";

/** 小米 ASR 固定模型名 */
export const XIAOMI_ASR_MODEL = "mimo-v2.5-asr";
```

b) 修改 `ASRProviderId`：

```ts
export type ASRProviderId = "doubao" | "tencent" | "alibaba" | "xiaomi";
```

c) 在 `isAlibabaASRConfigured` 之后插入：

```ts
/** 小米 ASR 是否已配置（API Key 非空） */
export function isXiaomiASRConfigured(config: LingridConfig): boolean {
  return !!config.xiaomi_asr?.api_key?.trim();
}
```

d) 修改 `resolveASRSelection`，在 `isAlibabaASRConfigured` 判断之后、`return "browser"` 之前插入一行：

```ts
  if (isXiaomiASRConfigured(config)) return "xiaomi";
```

e) `LingridConfig` 接口在 `asr_selection?: ASRSelectionMode;` 之后插入：

```ts
  /** 小米 MiMo ASR 配置（可选，不配置则不可手动选择） */
  xiaomi_asr?: XiaomiASRConfig;
```

`src/types/index.ts`：`export { ... } from "./config"` 块加入 `isXiaomiASRConfigured, XIAOMI_ASR_API_URL, XIAOMI_ASR_MODEL`；`export type { ... }` 块加入 `XiaomiASRConfig`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: 24 passed

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/types/config.ts apps/browser-extension/src/types/config.test.ts apps/browser-extension/src/types/index.ts
git commit -m "feat(browser-extension): 小米 ASR 配置类型与迁移链末尾接入

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: PCM 采集抽取（pcmCapture.ts）

**Files:**
- Create: `src/tutor/pcmCapture.ts`
- Modify: `src/tutor/doubaoASRRecognizer.ts`（197-297 行采集段）

- [ ] **Step 1: 新建 pcmCapture.ts**

创建 `src/tutor/pcmCapture.ts`：

```ts
/**
 * @file pcmCapture.ts
 * @description PCM 音频采集公共模块
 *
 * 从 doubaoASRRecognizer 抽取，供豆包（实时流式发送）与小米（批量上传）
 * 等识别器共用：AudioContext 16kHz 采集 + 重采样 + float32→int16。
 */

export const PCM_TARGET_SAMPLE_RATE = 16000;

export interface PCMCapture {
  /** 启动采集；每个 PCM 帧经回调吐出（已重采样至 16kHz int16） */
  start(stream: MediaStream): void;
  /** 停止采集并释放节点（不关闭传入的 stream，由调用方管理） */
  stop(): void;
}

/**
 * 创建 PCM 采集器。
 *
 * @param onChunk 每个 PCM 帧（Int16Array，16kHz mono）的回调
 */
export function createPCMCapture(
  onChunk: (chunk: Int16Array) => void
): PCMCapture {
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;

  function resample(
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

  function float32ToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  return {
    start(stream: MediaStream): void {
      // 尝试 16kHz 采样率；不支持则用默认采样率并重采样
      try {
        audioContext = new AudioContext({
          sampleRate: PCM_TARGET_SAMPLE_RATE,
        });
      } catch {
        audioContext = new AudioContext();
        console.log(
          `[Lingride PCMCapture] 使用默认采样率: ${audioContext.sampleRate}Hz`
        );
      }

      const ctx = audioContext;
      sourceNode = ctx.createMediaStreamSource(stream);
      processorNode = ctx.createScriptProcessor(4096, 1, 1);

      processorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData =
          ctx.sampleRate !== PCM_TARGET_SAMPLE_RATE
            ? resample(inputData, ctx.sampleRate, PCM_TARGET_SAMPLE_RATE)
            : inputData;
        onChunk(float32ToInt16(pcmData));
      };

      sourceNode.connect(processorNode);
      processorNode.connect(ctx.destination);
    },

    stop(): void {
      processorNode?.disconnect();
      sourceNode?.disconnect();
      processorNode = null;
      sourceNode = null;
      if (audioContext) {
        void audioContext.close();
        audioContext = null;
      }
    },
  };
}
```

- [ ] **Step 2: 豆包识别器改用公共模块**

`src/tutor/doubaoASRRecognizer.ts`：

a) import 区加入：

```ts
import { createPCMCapture, PCMCapture } from "./pcmCapture";
```

b) 删除三个类字段 `audioContext`/`sourceNode`/`processorNode`，替换为：

```ts
  private pcmCapture: PCMCapture | null = null;
```

c) 整个 `startAudioCapture` 方法替换为：

```ts
  private async startAudioCapture(): Promise<void> {
    const stream = await acquireStream();

    this.pendingChunks = [];
    let lastSendTime = Date.now();

    this.pcmCapture = createPCMCapture((chunk) => {
      if (
        !this._isRecognizing ||
        !this.ws ||
        this.ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }
      this.pendingChunks.push(chunk);

      const now = Date.now();
      if (now - lastSendTime >= AUDIO_SEND_INTERVAL) {
        lastSendTime = now;
        this.flushPendingChunks();
      }
    });
    this.pcmCapture.start(stream);
  }
```

d) 删除 `resample` 和 `float32ToInt16` 两个私有方法（约 274-297 行）。

e) `cleanup()` 中删除 `processorNode`/`sourceNode`/`audioContext` 三段清理，替换为：

```ts
    this.pcmCapture?.stop();
    this.pcmCapture = null;
```

f) 常量 `TARGET_SAMPLE_RATE` 仍被 `buildFullClientRequest` 的 `rate` 使用——将其改为从 pcmCapture 导入的 `PCM_TARGET_SAMPLE_RATE`（import 处一并加入），删除本地 `const TARGET_SAMPLE_RATE = 16000;`。

- [ ] **Step 3: typecheck + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bunx vitest run`
Expected: 0 错误；全部 PASS（豆包行为不变）

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension/src/tutor/pcmCapture.ts apps/browser-extension/src/tutor/doubaoASRRecognizer.ts
git commit -m "refactor(browser-extension): 抽取 PCM 采集公共模块 pcmCapture

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 小米识别器（xiaomiASRRecognizer.ts）

**Files:**
- Create: `src/tutor/xiaomiASRRecognizer.ts`
- Test: `src/tutor/xiaomiASRRecognizer.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/tutor/xiaomiASRRecognizer.test.ts`：

```ts
import { describe, expect, it } from "vitest";

import {
  encodeWavFromPCM,
  parseXiaomiASRSSELine,
} from "./xiaomiASRRecognizer";

describe("encodeWavFromPCM", () => {
  it("writes a valid 44-byte WAV header for 16kHz mono int16", () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const wav = encodeWavFromPCM(pcm);

    // RIFF 魔数
    expect(String.fromCharCode(wav[0], wav[1], wav[2], wav[3])).toBe("RIFF");
    expect(String.fromCharCode(wav[8], wav[9], wav[10], wav[11])).toBe("WAVE");
    // 文件总长 = 36 + 数据字节数
    const view = new DataView(wav.buffer);
    expect(view.getUint32(4, true)).toBe(36 + pcm.length * 2);
    // fmt: PCM=1, mono=1, 16kHz, 16bit
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    // data 块长度
    expect(view.getUint32(40, true)).toBe(pcm.length * 2);
    // 总长度
    expect(wav.length).toBe(44 + pcm.length * 2);
  });

  it("encodes PCM samples little-endian after the header", () => {
    const pcm = new Int16Array([0x0102]);
    const wav = encodeWavFromPCM(pcm);
    expect(wav[44]).toBe(0x02);
    expect(wav[45]).toBe(0x01);
  });
});

describe("parseXiaomiASRSSELine", () => {
  it("extracts delta content from a data line", () => {
    const line =
      'data: {"id":"x","choices":[{"delta":{"content":"Good "},"index":0,"finish_reason":null}]}';
    expect(parseXiaomiASRSSELine(line)).toEqual({ type: "delta", text: "Good " });
  });

  it("returns done for the [DONE] sentinel", () => {
    expect(parseXiaomiASRSSELine("data: [DONE]")).toEqual({ type: "done" });
  });

  it("returns done when finish_reason is stop", () => {
    const line =
      'data: {"id":"x","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}';
    expect(parseXiaomiASRSSELine(line)).toEqual({ type: "done" });
  });

  it("ignores non-data lines and empty lines", () => {
    expect(parseXiaomiASRSSELine("")).toBeNull();
    expect(parseXiaomiASRSSELine(": comment")).toBeNull();
    expect(parseXiaomiASRSSELine("event: message")).toBeNull();
  });

  it("ignores malformed JSON without throwing", () => {
    expect(parseXiaomiASRSSELine("data: {not json")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/tutor/xiaomiASRRecognizer.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现识别器**

创建 `src/tutor/xiaomiASRRecognizer.ts`：

```ts
/**
 * @file xiaomiASRRecognizer.ts
 * @description 小米 MiMo 语音识别（mimo-v2.5-asr）
 *
 * 批量模式：录音期间攒 PCM，stop 时打包 WAV 上传，
 * stream:true 下经 SSE 逐 token 出识别文本（非边录边传）。
 * HTTPS 直连，页面侧 fetch（host_permissions 已覆盖 api.xiaomimimo.com）。
 */

import {
  LingridConfig,
  XIAOMI_ASR_API_URL,
  XIAOMI_ASR_MODEL,
} from "../types";
import type { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { acquireStream, releaseStream } from "./audioCapture";
import { createPCMCapture, PCMCapture } from "./pcmCapture";

export { isXiaomiASRConfigured } from "../types";

/** SSE 解析结果：增量文本 / 结束 / 忽略 */
export type XiaomiSSEEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | null;

/**
 * 解析一行 SSE 文本，提取增量内容或结束信号。
 * 非 data 行、[DONE] 之外的畸形 JSON 均返回 null，不抛错。
 */
export function parseXiaomiASRSSELine(line: string): XiaomiSSEEvent {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return { type: "done" };

  try {
    const chunk = JSON.parse(payload) as {
      choices?: Array<{
        delta?: { content?: string };
        finish_reason?: string | null;
      }>;
    };
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason === "stop") return { type: "done" };
    const text = choice?.delta?.content;
    if (text) return { type: "delta", text };
    return null;
  } catch {
    return null;
  }
}

/**
 * 把 16kHz/mono/int16 PCM 包上 44 字节 RIFF WAV 头。
 */
export function encodeWavFromPCM(pcm: Int16Array): Uint8Array {
  const dataLength = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt 块长度
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 16000, true); // 采样率
  view.setUint32(28, 16000 * 2, true); // 字节率 = rate * channels * bits/8
  view.setUint16(32, 2, true); // 块对齐 = channels * bits/8
  view.setUint16(34, 16, true); // 位深
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  new Int16Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

/** Uint8Array → base64（分块避免栈溢出） */
function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * 小米流式语音识别器（批量上传 + SSE 出文本）。
 */
export class XiaomiASRRecognizer implements ISpeechRecognizer {
  private pcmCapture: PCMCapture | null = null;
  private pendingChunks: Int16Array[] = [];
  private _isRecognizing = false;
  private apiKey = "";

  /**
   * @param config 完整用户配置（由 tutor.ts createRecognizer 注入，
   *               与其他识别器从同一上下文取配置，避免识别器内重复读 storage）
   */
  constructor(private readonly config: LingridConfig) {}

  /** 实时识别结果回调（SSE 增量拼接后的累计文本） */
  onInterimResult?: (text: string) => void;

  /** 错误回调 */
  onError?: (error: Error) => void;

  async start(): Promise<void> {
    if (!this.config.xiaomi_asr?.api_key?.trim()) {
      throw new Error("小米识别未配置 API Key，请到设置页配置或切换识别服务");
    }
    this.apiKey = this.config.xiaomi_asr.api_key.trim();
    this.pendingChunks = [];

    const stream = await acquireStream();
    this.pcmCapture = createPCMCapture((chunk) => {
      if (!this._isRecognizing) return;
      this.pendingChunks.push(chunk);
    });
    this.pcmCapture.start(stream);

    this._isRecognizing = true;
    console.log("[Lingride XiaomiASR] 识别已启动");
  }

  async stop(): Promise<string> {
    this._isRecognizing = false;

    // 停采集并合并 PCM
    this.pcmCapture?.stop();
    this.pcmCapture = null;
    releaseStream();

    const totalLength = this.pendingChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of this.pendingChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pendingChunks = [];

    if (merged.length === 0) {
      throw new Error("未识别到语音内容，请重试");
    }

    // 打包 WAV 并上传
    const wav = encodeWavFromPCM(merged);
    const audioBase64 = uint8ToBase64(wav);

    const response = await fetch(XIAOMI_ASR_API_URL, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XIAOMI_ASR_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: `data:audio/wav;base64,${audioBase64}`,
                },
              },
            ],
          },
        ],
        asr_options: { language: "en" },
        stream: true,
      }),
    });

    if (!response.ok) {
      const message = await this.extractErrorMessage(response);
      throw new Error(message);
    }
    if (!response.body) {
      throw new Error("小米 ASR 响应为空");
    }

    // SSE 逐行读取
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let transcript = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseXiaomiASRSSELine(line);
        if (event?.type === "delta") {
          transcript += event.text;
          this.onInterimResult?.(transcript.trim());
        }
      }
    }

    const result = transcript.trim();
    if (!result) {
      throw new Error("未识别到语音内容，请重试");
    }
    return result;
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    if (response.status === 401) {
      return "小米 ASR API Key 无效，请检查设置页配置";
    }
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      if (body.error?.message) {
        return `小米 ASR 请求失败：${body.error.message}`;
      }
    } catch {
      // 响应体非 JSON，落到通用错误
    }
    return `小米 ASR 请求失败（HTTP ${response.status}）`;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/tutor/xiaomiASRRecognizer.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/tutor/xiaomiASRRecognizer.ts apps/browser-extension/src/tutor/xiaomiASRRecognizer.test.ts
git commit -m "feat(browser-extension): 小米 MiMo ASR 识别器（WAV 批量上传 + SSE 流式出文本）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 接入 createRecognizer 与设置页

**Files:**
- Modify: `src/tutor/tutor.ts`（import 约 45-48 行；switch 约 721-743 行）
- Modify: `src/popup/popup.html`（asrProviderSelect 约 385-392 行；ASR 嵌套手风琴区）
- Modify: `src/popup/popup.ts`（元素声明、blur 绑定、保存约 1831 行、加载约 1953 行、updateASRProviderHint）

- [ ] **Step 1: tutor.ts 加 xiaomi 分支**

a) import 区（豆包 import 之后）加入：

```ts
import {
  XiaomiASRRecognizer,
  isXiaomiASRConfigured,
} from "./xiaomiASRRecognizer";
```

b) `createRecognizer` switch 中 `case "alibaba"` 之后、`case "browser"` 之前插入：

```ts
    case "xiaomi":
      if (!isXiaomiASRConfigured(config)) {
        throw new Error("小米识别未配置 API Key，请到设置页配置或切换识别服务");
      }
      console.log("[Lingride Tutor] 使用小米 ASR 识别器");
      return new XiaomiASRRecognizer(config);
```


- [ ] **Step 2: popup.html 加选项与面板**

a) `asrProviderSelect` 中 `<option value="alibaba">阿里云</option>` 之后插入：

```html
                  <option value="xiaomi">小米</option>
```

b) 豆包 ASR 嵌套手风琴（`id="doubao-asr"` 所在 `accordion-item nested` 整块）之后插入小米面板：

```html
              <!-- 嵌套 accordion: 小米 -->
              <div class="accordion-item nested">
                <button class="accordion-header nested-header" data-accordion="xiaomi-asr" data-nested="true">
                  <span>小米</span>
                  <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="accordion-body nested-body" id="xiaomi-asr">
                  <div class="accordion-inner">
                    <div class="settings-row">
                      <label class="settings-label" for="xiaomiAsrApiKey">API Key</label>
                      <div class="password-input">
                        <input type="password" id="xiaomiAsrApiKey" class="settings-input" placeholder="小米 MiMo API Key">
                        <button type="button" id="showXiaomiAsrKeyBtn" class="show-key-btn">显示</button>
                      </div>
                    </div>
                    <p class="settings-hint">
                      <a href="https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/Speech-Recognition" target="_blank" rel="noopener">查看小米 MiMo 语音识别文档 →</a>
                    </p>
                  </div>
                </div>
              </div>
```

- [ ] **Step 3: popup.ts 元素、事件、保存、加载、提示**

a) 元素声明（`doubaoAsrApiKeyInput` 声明之后）：

```ts
const xiaomiAsrApiKeyInput = document.getElementById(
  "xiaomiAsrApiKey"
) as HTMLInputElement;
const showXiaomiAsrKeyBtn = document.getElementById(
  "showXiaomiAsrKeyBtn"
) as HTMLButtonElement;
```

b) 事件绑定（`doubaoAsrApiKeyInput` blur 绑定之后）：

```ts
  // Settings - 小米 ASR 配置自动保存
  xiaomiAsrApiKeyInput.addEventListener("blur", () => {
    void autoSave().then(updateASRProviderHint);
  });
  showXiaomiAsrKeyBtn.addEventListener("click", () => {
    const isPassword = xiaomiAsrApiKeyInput.type === "password";
    xiaomiAsrApiKeyInput.type = isPassword ? "text" : "password";
    showXiaomiAsrKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });
```

c) 保存逻辑：找到豆包 ASR 保存段（`currentConfig.doubao_asr = {...}` 附近），其后插入：

```ts
  // 小米 ASR 配置（API Key 为空视为未配置）
  const xiaomiAsrApiKey = xiaomiAsrApiKeyInput.value.trim();
  if (xiaomiAsrApiKey) {
    currentConfig.xiaomi_asr = { api_key: xiaomiAsrApiKey };
  } else {
    delete currentConfig.xiaomi_asr;
  }
```

d) 加载逻辑：`doubaoAsrApiKeyInput.value = currentConfig.doubao_asr?.api_key || "";` 之后插入：

```ts
  xiaomiAsrApiKeyInput.value = currentConfig.xiaomi_asr?.api_key || "";
```

e) `updateASRProviderHint` 的 labels 加 `xiaomi: "小米"`，configuredCheckers 加 `xiaomi: isXiaomiASRConfigured`。

f) `../types` import 块加入 `isXiaomiASRConfigured`。

- [ ] **Step 4: typecheck + lint + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bunx eslint src && bunx vitest run`
Expected: 0 错误（既有 2 个 aiServiceOptions warning 可保留）；全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/tutor/tutor.ts apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts
git commit -m "feat(browser-extension): 设置页与识别器工厂接入小米 ASR 选项

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 全量验证与手动测试

**Files:** 无

- [ ] **Step 1: CI gate**

Run: `cd apps/browser-extension && bun run typecheck && bunx eslint src && bunx vitest run && bun run build`
Expected: 全绿 + 构建成功

- [ ] **Step 2: 真实 key 冒烟（可选但推荐）**

用项目已有的小米 key 跑一次 curl 直连验证接口可用（脚本或手工均可）：

```bash
# 生成 1s 静音 WAV 后 base64，验证 401/200 行为
curl -sS -X POST 'https://api.xiaomimimo.com/v1/chat/completions' \
  -H "api-key: $XIAOMI_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"mimo-v2.5-asr","messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":"data:audio/wav;base64,<BASE64_WAV>"}}]}],"asr_options":{"language":"en"}}'
```

Expected: 200 + choices[0].message.content 含识别文本（静音可能为空文本，但 HTTP 200 即链路通）

- [ ] **Step 3: 手动验证清单（用户在 Chrome 中执行）**

1. 设置页 → 语音识别服务：下拉出现「小米」；选中且未填 key → 黄色提示
2. 填入小米 key → 提示消失
3. tutor 页选小米 → 录一句英文 → SSE 逐字出文本 → 出全文
4. 影子跟读模式同样可用
5. 选小米但清空 key → 录音前报错「小米识别未配置 API Key…」

- [ ] **Step 4: 用户确认后 push**

```bash
git pull --rebase && git push origin main
```
