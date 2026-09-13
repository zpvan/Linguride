# MiniMax ASR 选项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页「语音识别服务」新增 MiniMax 选项，复用 `minimax_tts.api_key`，经 `POST {base}/v1/speech_to_text`（multipart 上传 WAV + SSE 流式文本）实现跟读识别。

**Architecture:** 镜像 `XiaomiASRRecognizer` 模式：pcmCapture 攒 16kHz PCM → stop 时 `encodeWavFromPCM` 打包 WAV → FormData 上传 → SSE 增量拼文本。配置层零新增存储字段（复用 `minimax_tts`）；`encodeWavFromPCM` 提取为共享模块 `wavEncoder.ts`。

**Tech Stack:** TypeScript / Chrome Extension MV3 / Vitest / Bun

**Spec:** `docs/superpowers/specs/2026-09-13-minimax-asr-provider-design.md`

**通用命令（所有任务在 `apps/browser-extension` 目录下执行）：**
- 测试：`bunx vitest run <file>`
- 类型检查：`bun run typecheck`
- 构建：`bun run build`

---

### Task 1: 提取共享 WAV 编码器 wavEncoder.ts

**Files:**
- Create: `apps/browser-extension/src/tutor/wavEncoder.ts`
- Create: `apps/browser-extension/src/tutor/wavEncoder.test.ts`
- Modify: `apps/browser-extension/src/tutor/xiaomiASRRecognizer.ts`（删本地 `encodeWavFromPCM`，改 import）
- Modify: `apps/browser-extension/src/tutor/xiaomiASRRecognizer.test.ts`（删 WAV 测试，改 import 来源）

- [ ] **Step 1: 创建 wavEncoder.ts（从 xiaomiASRRecognizer.ts 原样搬出）**

```ts
/**
 * @file wavEncoder.ts
 * @description 16kHz/mono/int16 PCM → 44 字节 RIFF WAV 头编码。
 *
 * 供批量上传式 ASR 识别器（小米 / MiniMax）共用。
 */

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
```

- [ ] **Step 2: 创建 wavEncoder.test.ts（从 xiaomiASRRecognizer.test.ts 搬出 WAV 用例，改 import 来源）**

```ts
import { describe, expect, it } from "vitest";

import { encodeWavFromPCM } from "./wavEncoder";

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
```

- [ ] **Step 3: xiaomiASRRecognizer.ts 删除本地 `encodeWavFromPCM`（原 59–86 行整个函数），顶部 import 区加：**

```ts
import { encodeWavFromPCM } from "./wavEncoder";
```

注意：不要再用 `export function encodeWavFromPCM`（删除整个函数体），`uint8ToBase64` 保留在原文件不动。

- [ ] **Step 4: xiaomiASRRecognizer.test.ts 删除 `describe("encodeWavFromPCM", ...)` 整个块（原 8–35 行），import 改为只保留：**

```ts
import { parseXiaomiASRSSELine } from "./xiaomiASRRecognizer";
```

- [ ] **Step 5: 跑测试确认全部通过（提取不改行为）**

Run: `bunx vitest run src/tutor/wavEncoder.test.ts src/tutor/xiaomiASRRecognizer.test.ts`
Expected: PASS（wavEncoder 2 个 + xiaomi 5 个）

- [ ] **Step 6: typecheck**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add apps/browser-extension/src/tutor/wavEncoder.ts apps/browser-extension/src/tutor/wavEncoder.test.ts apps/browser-extension/src/tutor/xiaomiASRRecognizer.ts apps/browser-extension/src/tutor/xiaomiASRRecognizer.test.ts
git commit -m "refactor(browser-extension): 提取共享 WAV 编码器 wavEncoder"
```

---

### Task 2: 配置层 — MiniMax ASR 判定与迁移链

**Files:**
- Modify: `apps/browser-extension/src/types/config.ts`（ASRProviderId、isMiniMaxASRConfigured、resolveASRSelection、MINIMAX_ASR_MODEL）
- Modify: `apps/browser-extension/src/types/index.ts`（导出）
- Test: `apps/browser-extension/src/types/config.test.ts`

- [ ] **Step 1: 写失败测试 — 追加到 `resolveASRSelection` describe 块末尾**

```ts
  it("falls to minimax when only minimax tts key configured", () => {
    expect(
      resolveASRSelection({ minimax_tts: { api_key: "k" } } as never)
    ).toBe("minimax");
  });

  it("prefers minimax over xiaomi in migration order", () => {
    expect(
      resolveASRSelection({
        minimax_tts: { api_key: "k" },
        xiaomi_asr: { api_key: "k" },
      } as never)
    ).toBe("minimax");
  });

  it("prefers alibaba over minimax in migration order", () => {
    expect(
      resolveASRSelection({
        alibaba_asr: { api_key: "k" },
        minimax_tts: { api_key: "k" },
      } as never)
    ).toBe("alibaba");
  });

  it("explicit xiaomi selection wins over configured minimax", () => {
    expect(
      resolveASRSelection({
        asr_selection: "xiaomi",
        minimax_tts: { api_key: "k" },
      } as never)
    ).toBe("xiaomi");
  });
```

并在文件末尾新增 describe：

```ts
describe("isMiniMaxASRConfigured", () => {
  it("returns true when minimax tts api key is present", () => {
    expect(
      isMiniMaxASRConfigured({ minimax_tts: { api_key: "sk-x" } } as never)
    ).toBe(true);
  });

  it("returns false for blank or missing key", () => {
    expect(
      isMiniMaxASRConfigured({ minimax_tts: { api_key: "  " } } as never)
    ).toBe(false);
    expect(isMiniMaxASRConfigured({} as never)).toBe(false);
  });
});
```

（记得在测试文件顶部 import 加 `isMiniMaxASRConfigured`。）

- [ ] **Step 2: 跑测试确认失败**

Run: `bunx vitest run src/types/config.test.ts`
Expected: FAIL — `isMiniMaxASRConfigured is not exported` / minimax 用例断言失败

- [ ] **Step 3: 实现 config.ts 修改**

① `ASRProviderId`（约 211 行）改为：

```ts
export type ASRProviderId = "doubao" | "tencent" | "alibaba" | "minimax" | "xiaomi";
```

② `isXiaomiASRConfigured` 之后插入：

```ts
/** MiniMax ASR 是否已配置（复用 MiniMax TTS 的 API Key） */
export function isMiniMaxASRConfigured(config: LingridConfig): boolean {
  return !!config.minimax_tts?.api_key?.trim();
}
```

③ `resolveASRSelection`（约 252 行）改为：

```ts
/**
 * 解析当前生效的语音识别服务选择。
 *
 * 1. 用户显式选择优先；
 * 2. 老配置无 asr_selection 字段时，按 豆包 > 腾讯 > 阿里 > MiniMax > 小米 取第一个已配置的；
 * 3. 全未配置回退浏览器识别。
 */
export function resolveASRSelection(config: LingridConfig): ASRSelectionMode {
  if (config.asr_selection) return config.asr_selection;
  if (isDoubaoASRConfigured(config)) return "doubao";
  if (isTencentASRConfigured(config)) return "tencent";
  if (isAlibabaASRConfigured(config)) return "alibaba";
  if (isMiniMaxASRConfigured(config)) return "minimax";
  if (isXiaomiASRConfigured(config)) return "xiaomi";
  return "browser";
}
```

④ `XIAOMI_ASR_MODEL` 常量附近加：

```ts
/** MiniMax ASR 固定模型名 */
export const MINIMAX_ASR_MODEL = "asr-1.0";
```

- [ ] **Step 4: types/index.ts 导出加 `isMiniMaxASRConfigured` 和 `MINIMAX_ASR_MODEL`**（与 `isXiaomiASRConfigured`、`XIAOMI_ASR_MODEL` 同组）

- [ ] **Step 5: 跑测试确认通过**

Run: `bunx vitest run src/types/config.test.ts`
Expected: PASS 全部

- [ ] **Step 6: typecheck**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add apps/browser-extension/src/types/config.ts apps/browser-extension/src/types/index.ts apps/browser-extension/src/types/config.test.ts
git commit -m "feat(browser-extension): 配置层支持 MiniMax ASR 选项与迁移链"
```

---

### Task 3: MiniMaxASRRecognizer 识别器

**Files:**
- Create: `apps/browser-extension/src/tutor/minimaxASRRecognizer.ts`
- Test: `apps/browser-extension/src/tutor/minimaxASRRecognizer.test.ts`

SSE 事件解析约定（宽容模式，字段名以联调实测为准）：
- `data: [DONE]` 或事件 JSON `finish: true` → done
- 事件 JSON 有 `delta` 字符串 → delta（累加）
- 无 `delta` 但有 `text` 字符串 → snapshot（整体替换，防御「每事件携带累计全文」的服务端行为）
- 其余（非 data 行、畸形 JSON、空 delta）→ null

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";

import { parseMiniMaxASRSSELine } from "./minimaxASRRecognizer";

describe("parseMiniMaxASRSSELine", () => {
  it("extracts delta text from a data line", () => {
    const line = 'data: {"delta":"Good ","finish":false}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({ type: "delta", text: "Good " });
  });

  it("returns snapshot when event carries text without delta", () => {
    const line = 'data: {"text":"Good morning","finish":false}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({
      type: "snapshot",
      text: "Good morning",
    });
  });

  it("returns done when finish is true", () => {
    const line = 'data: {"delta":"","finish":true,"duration":2.5}';
    expect(parseMiniMaxASRSSELine(line)).toEqual({ type: "done" });
  });

  it("returns done for the [DONE] sentinel", () => {
    expect(parseMiniMaxASRSSELine("data: [DONE]")).toEqual({ type: "done" });
  });

  it("ignores non-data lines and empty lines", () => {
    expect(parseMiniMaxASRSSELine("")).toBeNull();
    expect(parseMiniMaxASRSSELine(": comment")).toBeNull();
    expect(parseMiniMaxASRSSELine("event: message")).toBeNull();
  });

  it("ignores malformed JSON without throwing", () => {
    expect(parseMiniMaxASRSSELine("data: {not json")).toBeNull();
  });

  it("returns null for events without delta or text", () => {
    expect(parseMiniMaxASRSSELine('data: {"finish":false}')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bunx vitest run src/tutor/minimaxASRRecognizer.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 minimaxASRRecognizer.ts**

```ts
/**
 * @file minimaxASRRecognizer.ts
 * @description MiniMax 语音识别（asr-1.0）
 *
 * 批量模式：录音期间攒 PCM，stop 时打包 WAV 经 multipart/form-data 上传，
 * stream:true 下经 SSE 增量出识别文本（非边录边传）。
 * 复用 MiniMax TTS 的 API Key 与线路设置（国际/国内）。
 * host_permissions 已覆盖 api.minimaxi.com / api.minimax.cn。
 */

import {
  LingridConfig,
  MINIMAX_ASR_MODEL,
  normalizeMiniMaxTTSBaseUrl,
} from "../types";
import type { ISpeechRecognizer } from "../types/pronunciationAssessment";
import { acquireStream, releaseStream } from "./audioCapture";
import { createPCMCapture } from "./pcmCapture";
import type { PCMCapture } from "./pcmCapture";
import { encodeWavFromPCM } from "./wavEncoder";

export { isMiniMaxASRConfigured } from "../types";

/** SSE 解析结果：增量文本 / 全文快照 / 结束 / 忽略 */
export type MiniMaxSSEEvent =
  | { type: "delta"; text: string }
  | { type: "snapshot"; text: string }
  | { type: "done" }
  | null;

/**
 * 解析一行 SSE 文本。
 * 宽容模式：delta 优先（增量），text 兜底（快照替换）；
 * finish:true 或 [DONE] 结束；畸形行返回 null，不抛错。
 */
export function parseMiniMaxASRSSELine(line: string): MiniMaxSSEEvent {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return { type: "done" };

  try {
    const chunk = JSON.parse(payload) as {
      delta?: string;
      text?: string;
      finish?: boolean;
    };
    if (chunk.finish === true) return { type: "done" };
    if (typeof chunk.delta === "string" && chunk.delta) {
      return { type: "delta", text: chunk.delta };
    }
    if (typeof chunk.text === "string" && chunk.text) {
      return { type: "snapshot", text: chunk.text };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * MiniMax 流式语音识别器（批量上传 + SSE 出文本）。
 */
export class MiniMaxASRRecognizer implements ISpeechRecognizer {
  /** 上传 + SSE 读取超时（30s 内未响应则中止） */
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

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
    const key = this.config.minimax_tts?.api_key?.trim();
    if (!key) {
      throw new Error(
        "MiniMax 识别未配置 API Key（复用语音合成服务的 MiniMax Key），请到设置页配置或切换识别服务"
      );
    }
    this.apiKey = key;
    this.pendingChunks = [];

    const stream = await acquireStream();
    this.pcmCapture = createPCMCapture((chunk) => {
      if (!this._isRecognizing) return;
      this.pendingChunks.push(chunk);
    });
    this.pcmCapture.start(stream);

    this._isRecognizing = true;
    console.log("[Lingride MiniMaxASR] 识别已启动");
  }

  /**
   * 停止录音并返回最终识别文本。
   * 契约与既有识别器一致：不抛异常——出错走 onError 并返回空串，
   * 由调用方统一处理空结果，避免中断 stopRecordingUI 流程。
   */
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
      this.onError?.(new Error("未识别到语音内容，请重试"));
      return "";
    }

    // 打包 WAV，multipart/form-data 上传
    const wav = encodeWavFromPCM(merged);
    const form = new FormData();
    form.append("model", MINIMAX_ASR_MODEL);
    form.append(
      "file",
      new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }),
      "audio.wav"
    );
    form.append("response_format", "json");
    form.append("stream", "true");

    const baseUrl = normalizeMiniMaxTTSBaseUrl(
      this.config.minimax_tts?.api_base_url
    );

    // 上传 + SSE 读取整体超时（30s 内未响应则中止）
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, MiniMaxASRRecognizer.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/speech_to_text`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          // 注意：multipart 的 Content-Type 由浏览器自动生成（含 boundary），不要手动设置
          language: "en",
        },
        body: form,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const message = await this.extractErrorMessage(response);
        this.onError?.(new Error(message));
        return "";
      }
      if (!response.body) {
        this.onError?.(new Error("MiniMax ASR 响应为空"));
        return "";
      }

      // SSE 逐行读取
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let transcript = "";

      const applyEvent = (event: MiniMaxSSEEvent): boolean => {
        if (event?.type === "done") return true;
        if (event?.type === "delta") {
          transcript += event.text;
          this.onInterimResult?.(transcript.trim());
        }
        if (event?.type === "snapshot") {
          transcript = event.text;
          this.onInterimResult?.(transcript.trim());
        }
        return false;
      };

      try {
        outer: for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (applyEvent(parseMiniMaxASRSSELine(line))) {
              // 服务端发结束后不一定会立刻关连接，提前退出
              break outer;
            }
          }
        }

        // 补解析残余 buffer（最后一行可能无换行结尾）
        applyEvent(parseMiniMaxASRSSELine(buffer));
      } finally {
        reader.releaseLock();
      }

      const result = transcript.trim();
      if (!result) {
        this.onError?.(new Error("未识别到语音内容，请重试"));
        return "";
      }
      return result;
    } catch (error) {
      if (abortController.signal.aborted) {
        this.onError?.(new Error("MiniMax ASR 请求超时，请重试"));
      } else {
        this.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
      }
      return "";
    } finally {
      clearTimeout(timeout);
    }
  }

  isRecognizing(): boolean {
    return this._isRecognizing;
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    if (response.status === 401) {
      return "MiniMax ASR API Key 无效，请检查设置页配置";
    }
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
        base_resp?: { status_msg?: string };
      };
      const detail = body.error?.message || body.base_resp?.status_msg;
      if (detail) {
        return `MiniMax ASR 请求失败：${detail}`;
      }
    } catch {
      // 响应体非 JSON，落到通用错误
    }
    return `MiniMax ASR 请求失败（HTTP ${response.status}）`;
  }
}
```

（`normalizeMiniMaxTTSBaseUrl` 已在 `src/types/index.ts` 导出，无需改动。）

- [ ] **Step 4: 跑测试确认通过**

Run: `bunx vitest run src/tutor/minimaxASRRecognizer.test.ts`
Expected: PASS 7 个用例

- [ ] **Step 5: typecheck + 全量测试**

Run: `bun run typecheck && bunx vitest run`
Expected: 无类型错误；全部测试通过

- [ ] **Step 6: Commit**

```bash
git add apps/browser-extension/src/tutor/minimaxASRRecognizer.ts apps/browser-extension/src/tutor/minimaxASRRecognizer.test.ts apps/browser-extension/src/types/index.ts
git commit -m "feat(browser-extension): MiniMax ASR 识别器（WAV 上传 + SSE 流式文本）"
```

---

### Task 4: tutor.ts 接入 createRecognizer

**Files:**
- Modify: `apps/browser-extension/src/tutor/tutor.ts`（createRecognizer switch，约 743–752 行）

- [ ] **Step 1: 修改 import 区与 switch**

顶部 import 加（与 XiaomiASRRecognizer 同组）：

```ts
import { MiniMaxASRRecognizer } from "./minimaxASRRecognizer";
```

types import 加 `isMiniMaxASRConfigured`。

switch 中 `case "xiaomi":` 之前插入：

```ts
    case "minimax":
      if (!isMiniMaxASRConfigured(config)) {
        throw new Error(
          "MiniMax 识别未配置 API Key（复用语音合成服务的 MiniMax Key），请到设置页配置或切换识别服务"
        );
      }
      console.log("[Lingride Tutor] 使用 MiniMax ASR 识别器");
      return new MiniMaxASRRecognizer(config);
```

- [ ] **Step 2: typecheck + 全量测试 + 构建**

Run: `bun run typecheck && bunx vitest run && bun run build`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add apps/browser-extension/src/tutor/tutor.ts
git commit -m "feat(browser-extension): createRecognizer 接入 MiniMax ASR 选项"
```

---

### Task 5: 设置页（popup.html + popup.ts）

**Files:**
- Modify: `apps/browser-extension/src/popup/popup.html`（asrProviderSelect 选项 + MiniMax 说明文字）
- Modify: `apps/browser-extension/src/popup/popup.ts`（updateASRProviderHint labels/checkers；MiniMax 说明显隐）

- [ ] **Step 1: popup.html — 下拉加选项与说明文字**

`asrProviderSelect` 中 `<option value="xiaomi">小米</option>` 之前插入：

```html
                  <option value="minimax">MiniMax</option>
```

`asrProviderHint` 那一行之后插入说明段落：

```html
              <p id="minimaxAsrReuseHint" class="settings-hint" style="display:none;">
                复用语音合成服务的 MiniMax API Key 与线路设置。
              </p>
```

- [ ] **Step 2: popup.ts — 元素引用与显隐逻辑**

`asrProviderHint` 元素引用（约 430 行）之后加：

```ts
const minimaxAsrReuseHint = document.getElementById(
  "minimaxAsrReuseHint"
) as HTMLParagraphElement;
```

`updateASRProviderHint`（约 2003 行）改为：

```ts
function updateASRProviderHint(): void {
  const selection = asrProviderSelect.value as ASRSelectionMode;
  const labels: Record<string, string> = {
    doubao: "豆包",
    tencent: "腾讯云",
    alibaba: "阿里云",
    minimax: "MiniMax",
    xiaomi: "小米",
  };
  const configuredCheckers: Record<string, (c: LingridConfig) => boolean> = {
    doubao: isDoubaoASRConfigured,
    tencent: isTencentASRConfigured,
    alibaba: isAlibabaASRConfigured,
    minimax: isMiniMaxASRConfigured,
    xiaomi: isXiaomiASRConfigured,
  };

  // MiniMax 复用说明只在选中 MiniMax 时显示
  minimaxAsrReuseHint.style.display =
    selection === "minimax" ? "block" : "none";

  const label = labels[selection];
  const checker = configuredCheckers[selection];
  if (label && checker && !checker(currentConfig)) {
    asrProviderHint.textContent =
      selection === "minimax"
        ? "尚未配置 MiniMax 的 API 密钥（请先在语音合成服务中配置），当前选择不会生效"
        : `尚未配置${label}的 API 密钥，当前选择不会生效`;
    asrProviderHint.style.display = "block";
  } else {
    asrProviderHint.style.display = "none";
  }
}
```

popup.ts 顶部 types import 加 `isMiniMaxASRConfigured`。

注意：`updateASRProviderHint` 已在 `asrProviderSelect` change 事件与 `updateSettingsForm` 回填后调用（约 1264、1993 行），说明文字显隐自动跟随，无需额外绑定。

- [ ] **Step 3: typecheck + 构建**

Run: `bun run typecheck && bun run build`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts
git commit -m "feat(browser-extension): 设置页语音识别服务新增 MiniMax 选项"
```

---

### Task 6: 全量验证 + Playwright E2E

**Files:** 无新增（验证任务）

- [ ] **Step 1: 全量验证**

Run: `bun run typecheck && bunx vitest run && bun run build`
Expected: 无类型错误；全部测试通过；构建成功

- [ ] **Step 2: Playwright E2E（复用小米 ASR 的脚本模式）**

用 `launchPersistentContext` + `--load-extension` 加载 `apps/browser-extension/dist`（playwright-core，executablePath 指向已安装 chromium-1243；popup 操作用 evaluate 驱动，避免点击遮挡；使用全新临时 profile）：

1. 打开 popup，evaluate 驱动：MiniMax TTS key 输入框填测试值并触发 blur 自动保存 → ASR 下拉选 `minimax` → 触发 change
2. 读 `chrome.storage.local` 断言 `asr_selection === "minimax"`、`minimax_tts.api_key` 有值
3. 重开 popup，断言 `asrProviderSelect.value === "minimax"` 且黄色未配置提示不显示
4. 打开 tutor 页，触发识别器创建，断言 console 出现「使用 MiniMax ASR 识别器」
5. 断言 minimaxAsrReuseHint 说明文字可见

- [ ] **Step 3: 汇报用户手动验证清单**

向用户汇报 E2E 结果，请其在真实 Chrome 中验证：
1. 重新加载扩展
2. 设置页 → 语音合成服务 → MiniMax 填真实 key（若无）
3. 语音识别服务 → 选 MiniMax → 显示「复用语音合成服务的 MiniMax API Key」且无黄色警告
4. tutor 页录音 → console 显示「使用 MiniMax ASR 识别器」，能识别出英文文本
5. 用户确认 OK 后 `git pull --rebase && git push origin main`

---

## Self-Review 记录

- **Spec 覆盖**：§3 配置层 → Task 2；§4 识别器 → Task 3；§5 共享代码 → Task 1；§6 tutor 接入 → Task 4；§7 设置页 → Task 5；§8 测试 → 各任务 TDD 步骤 + Task 6；§9 SSE 宽容解析 → Task 3 解析器约定
- **无 placeholder**：所有代码步骤含完整代码
- **类型一致**：`MiniMaxSSEEvent` / `parseMiniMaxASRSSELine` / `MiniMaxASRRecognizer` / `isMiniMaxASRConfigured` / `MINIMAX_ASR_MODEL` / `encodeWavFromPCM`（wavEncoder）/ `normalizeMiniMaxTTSBaseUrl` 全文一致
- **configManager 无需改动**：已确认 `minimax_tts`、`asr_selection` 在白名单中
- **manifest 无需改动**：`host_permissions` 已含 `api.minimaxi.com` / `api.minimax.cn`
