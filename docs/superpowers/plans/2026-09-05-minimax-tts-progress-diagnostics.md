# MiniMax TTS 合成进度可见性 + 可用性诊断 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让语料库听力训练页能看到 MiniMax 语音合成的阶段进度并可取消，失败时显示具体原因；同时提供一次性诊断脚本和插件内置深度诊断来定位"大多数句子合成失败"的根因。

**Architecture:** 方案 A（页面轮询合成状态）：service worker 维护合成任务表（Map<requestId, TaskState>），页面每 700ms 查询状态；取消复用现有 `ttsPlaybackEpoch` 机制；诊断逻辑抽成纯函数模块便于测试。

**Tech Stack:** TypeScript、Chrome Extension MV3、vitest、Node 18+ fetch（诊断脚本零依赖）。

**Spec:** `docs/superpowers/specs/2026-09-05-minimax-tts-progress-diagnostics-design.md`

**工作目录：** `apps/browser-extension`（以下所有相对路径均相对于它）

**测试命令约定：** 单测用 `bunx vitest run <file>`（package.json 的 `test` 脚本是 watch 模式，不要用）；类型检查 `bun run typecheck`。

---

### Task 1: 一次性诊断脚本 diagnose-minimax-tts.mjs

独立于插件，写完即可用真实 API key 运行，定位"经常无法合成"的根因。

**Files:**
- Create: `scripts/diagnose-minimax-tts.mjs`

- [ ] **Step 1: 编写诊断脚本**

```js
#!/usr/bin/env node
/**
 * @file diagnose-minimax-tts.mjs
 * @description MiniMax 异步语音合成（t2a_async_v2）可用性诊断脚本
 *
 * 用法：
 *   MINIMAX_API_KEY=xxx node scripts/diagnose-minimax-tts.mjs
 *   MINIMAX_API_KEY=xxx DIAGNOSE_SAMPLES=8 MINIMAX_TTS_MODEL=speech-2.8-hd node scripts/diagnose-minimax-tts.mjs
 *
 * 输出每次采样的各阶段耗时与最终汇总（成功率 / avg / p50 / max / 错误分布）。
 */

const API_BASE = (
  process.env.MINIMAX_TTS_BASE_URL || "https://api.minimaxi.com/v1"
).replace(/\/$/, "");
const API_KEY = process.env.MINIMAX_API_KEY?.trim();
const MODEL = process.env.MINIMAX_TTS_MODEL || "speech-2.8-turbo";
const SAMPLES = Number.parseInt(process.env.DIAGNOSE_SAMPLES || "5", 10);
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;
const SAMPLE_TEXT =
  "The quick brown fox jumps over the lazy dog near the riverbank.";

if (!API_KEY) {
  console.error("错误：请通过环境变量提供 MINIMAX_API_KEY");
  console.error(
    "用法：MINIMAX_API_KEY=xxx node scripts/diagnose-minimax-tts.mjs"
  );
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timedFetch(url, init) {
  const startedAt = Date.now();
  const response = await fetch(url, init);
  const text = await response.text();
  return { status: response.status, ok: response.ok, text, ms: Date.now() - startedAt };
}

function parseBaseResp(text) {
  try {
    const data = JSON.parse(text);
    return { data, statusCode: data?.base_resp?.status_code, statusMsg: data?.base_resp?.status_msg };
  } catch {
    return { data: null, statusCode: undefined, statusMsg: text.slice(0, 120) };
  }
}

async function createTask() {
  const { status, ok, text, ms } = await timedFetch(`${API_BASE}/t2a_async_v2`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      text: SAMPLE_TEXT,
      language_boost: "auto",
      voice_setting: { voice_id: "English_expressive_narrator", speed: 1, vol: 1, pitch: 1 },
      audio_setting: { format: "mp3" },
    }),
  });
  const { data, statusCode, statusMsg } = parseBaseResp(text);
  if (!ok || statusCode !== 0 || !data?.task_id) {
    throw Object.assign(new Error(`创建任务失败 http=${status} code=${statusCode} msg=${statusMsg}`), { phase: "create" });
  }
  return { taskId: data.task_id, fileId: data.file_id, ms };
}

async function pollTask(taskId) {
  const startedAt = Date.now();
  const transitions = [];
  let polls = 0;
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const { status, ok, text } = await timedFetch(
      `${API_BASE}/query/t2a_async_query_v2?task_id=${taskId}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );
    polls += 1;
    const { data, statusCode, statusMsg } = parseBaseResp(text);
    if (!ok || statusCode !== 0) {
      throw Object.assign(new Error(`查询失败 http=${status} code=${statusCode} msg=${statusMsg}`), { phase: "poll" });
    }
    const taskStatus = String(data?.status || "").toLowerCase();
    if (transitions[transitions.length - 1] !== taskStatus) transitions.push(taskStatus);
    if (taskStatus === "success") {
      const fileId = data?.file_id;
      if (!fileId) throw Object.assign(new Error("任务成功但无 file_id"), { phase: "poll" });
      return { fileId, ms: Date.now() - startedAt, polls, transitions };
    }
    if (taskStatus === "failed" || taskStatus === "expired") {
      throw Object.assign(new Error(`任务状态=${taskStatus}`), { phase: "poll" });
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw Object.assign(new Error(`轮询超时（${POLL_TIMEOUT_MS / 1000}s, ${polls} 次查询）`), { phase: "poll" });
}

async function downloadAudio(fileId) {
  const startedAt = Date.now();
  const response = await fetch(`${API_BASE}/files/retrieve_content?file_id=${fileId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`下载失败 http=${response.status} body=${text.slice(0, 120)}`), { phase: "download" });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw Object.assign(new Error("下载的音频为空"), { phase: "download" });
  }
  return { ms: Date.now() - startedAt, bytes: buffer.byteLength };
}

async function runSample(index) {
  const totalStart = Date.now();
  try {
    const created = await createTask();
    const polled = await pollTask(created.taskId);
    const downloaded = await downloadAudio(polled.fileId);
    return {
      index,
      success: true,
      createMs: created.ms,
      synthMs: polled.ms,
      downloadMs: downloaded.ms,
      totalMs: Date.now() - totalStart,
      polls: polled.polls,
      bytes: downloaded.bytes,
      transitions: polled.transitions.join("→"),
    };
  } catch (error) {
    return {
      index,
      success: false,
      totalMs: Date.now() - totalStart,
      phase: error.phase || "unknown",
      error: error.message,
    };
  }
}

const results = [];
console.log(`MiniMax TTS 诊断开始：模型=${MODEL} 采样=${SAMPLES} 次 端点=${API_BASE}\n`);
for (let i = 1; i <= SAMPLES; i++) {
  const result = await runSample(i);
  results.push(result);
  if (result.success) {
    console.log(
      `#${i} ✓ 总耗时 ${(result.totalMs / 1000).toFixed(1)}s（创建 ${result.createMs}ms / 合成 ${(result.synthMs / 1000).toFixed(1)}s (${result.polls}次轮询, ${result.transitions}) / 下载 ${result.downloadMs}ms, ${result.bytes}B）`
    );
  } else {
    console.log(`#${i} ✗ 阶段=${result.phase} 耗时 ${(result.totalMs / 1000).toFixed(1)}s 错误：${result.error}`);
  }
}

const successes = results.filter((r) => r.success);
const synthTimes = successes.map((r) => r.synthMs).sort((a, b) => a - b);
const totalTimes = successes.map((r) => r.totalMs).sort((a, b) => a - b);
const failureGroups = new Map();
for (const r of results.filter((r) => !r.success)) {
  const key = `${r.phase}: ${r.error}`;
  failureGroups.set(key, (failureGroups.get(key) || 0) + 1);
}

console.log("\n===== 汇总 =====");
console.log(`成功率：${successes.length}/${SAMPLES}`);
if (successes.length > 0) {
  const avg = (arr) => (arr.reduce((s, v) => s + v, 0) / arr.length / 1000).toFixed(1);
  console.log(`合成耗时 avg=${avg(synthTimes)}s p50=${(percentile(synthTimes, 50) / 1000).toFixed(1)}s max=${(percentile(synthTimes, 100) / 1000).toFixed(1)}s`);
  console.log(`总耗时   avg=${avg(totalTimes)}s p50=${(percentile(totalTimes, 50) / 1000).toFixed(1)}s max=${(percentile(totalTimes, 100) / 1000).toFixed(1)}s`);
}
if (failureGroups.size > 0) {
  console.log("失败分布：");
  for (const [reason, count] of failureGroups) console.log(`  ×${count} ${reason}`);
}

process.exit(successes.length === SAMPLES ? 0 : 1);
```

- [ ] **Step 2: 验证脚本的参数校验**

Run: `cd apps/browser-extension && node scripts/diagnose-minimax-tts.mjs`
Expected: 退出码 2，输出"错误：请通过环境变量提供 MINIMAX_API_KEY"

- [ ] **Step 3: 用无效 key 验证错误路径**

Run: `cd apps/browser-extension && MINIMAX_API_KEY=invalid-key DIAGNOSE_SAMPLES=1 node scripts/diagnose-minimax-tts.mjs`
Expected: 输出 `#1 ✗ 阶段=create ...`（鉴权失败），汇总显示 `成功率：0/1`，退出码 1

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension/scripts/diagnose-minimax-tts.mjs
git commit -m "feat(browser-extension): 添加 MiniMax TTS 可用性诊断脚本"
```

---

### Task 2: 消息协议类型扩展

**Files:**
- Modify: `src/types/messages.ts`

- [ ] **Step 1: 扩展 MessageType 枚举**

在 `src/types/messages.ts:107`（`STOP_TTS_PLAYBACK = "STOP_TTS_PLAYBACK",`）之后追加：

```ts
  /** 查询语音合成进度 */
  GET_TTS_SYNTHESIS_STATUS = "GET_TTS_SYNTHESIS_STATUS",
  /** 取消语音合成 */
  CANCEL_TTS_SYNTHESIS = "CANCEL_TTS_SYNTHESIS",
  /** TTS 服务深度诊断 */
  DIAGNOSE_TTS = "DIAGNOSE_TTS",
```

- [ ] **Step 2: 错误码增加 TTS_CANCELLED**

在 `src/types/messages.ts:757`（`| "TTS_AUDIO_INVALID"`）之后、`| "TTS_UNKNOWN_ERROR"` 之前插入：

```ts
  | "TTS_CANCELLED"
```

- [ ] **Step 3: SynthesizeSpeechMessage 增加 requestId**

将 `src/types/messages.ts:414-422` 的 `SynthesizeSpeechMessage` 改为：

```ts
export interface SynthesizeSpeechMessage {
  type: MessageType.SYNTHESIZE_SPEECH;
  payload: {
    /** 要朗读的文本 */
    text: string;
    /** 播放语速 */
    rate: TTSSpeed;
    /** 合成进度跟踪 ID（传入后可通过 GET_TTS_SYNTHESIS_STATUS 查询进度） */
    requestId?: string;
  };
}
```

- [ ] **Step 4: 新增进度/取消/诊断消息与响应类型**

在 `StopTTSPlaybackMessage`（`src/types/messages.ts:427-429`）之后追加：

```ts
/**
 * 语音合成阶段
 */
export type TTSSynthesisStage =
  | "submitting"
  | "synthesizing"
  | "downloading"
  | "ready"
  | "failed"
  | "cancelled"
  | "unknown";

/**
 * 查询语音合成进度消息
 */
export interface GetTTSSynthesisStatusMessage {
  type: MessageType.GET_TTS_SYNTHESIS_STATUS;
  payload: {
    /** 合成进度跟踪 ID */
    requestId: string;
  };
}

/**
 * 取消语音合成消息
 */
export interface CancelTTSSynthesisMessage {
  type: MessageType.CANCEL_TTS_SYNTHESIS;
  payload: {
    /** 合成进度跟踪 ID */
    requestId: string;
  };
}

/**
 * TTS 服务深度诊断消息
 */
export interface DiagnoseTTSMessage {
  type: MessageType.DIAGNOSE_TTS;
  payload: {
    /** 要诊断的 TTS 服务 */
    provider: TTSProviderId;
  };
}
```

在 `StopTTSPlaybackResponse`（`src/types/messages.ts:877`）之后追加：

```ts
/**
 * 查询语音合成进度响应
 */
export interface GetTTSSynthesisStatusResponse extends BaseResponse {
  data?: {
    /** 当前合成阶段 */
    stage: TTSSynthesisStage;
    /** 自合成开始以来的毫秒数 */
    elapsedMs: number;
    /** 失败阶段的错误码 */
    errorCode?: TTSServiceErrorCode;
  };
}

/**
 * 取消语音合成响应
 */
export type CancelTTSSynthesisResponse = BaseResponse;

/**
 * TTS 深度诊断汇总
 */
export interface TTSDiagnoseSummary {
  /** 成功采样数 */
  successCount: number;
  /** 总采样数 */
  totalCount: number;
  /** 成功采样的平均耗时（毫秒，无成功时为 0） */
  avgMs: number;
  /** 成功采样的最小耗时（毫秒，无成功时为 0） */
  minMs: number;
  /** 成功采样的最大耗时（毫秒，无成功时为 0） */
  maxMs: number;
  /** 失败原因分布 */
  failures: Array<{ errorCode: TTSServiceErrorCode; count: number }>;
}

/**
 * TTS 服务深度诊断响应
 */
export interface DiagnoseTTSResponse extends BaseResponse {
  data?: TTSDiagnoseSummary;
}
```

- [ ] **Step 5: 加入 Message / Response 联合类型**

在 `Message` 联合类型（`src/types/messages.ts:583`，末尾 `| AnalyzeListeningMessage;`）中，将结尾改为：

```ts
  | SegmentCorpusMessage
  | AnalyzeListeningMessage
  | GetTTSSynthesisStatusMessage
  | CancelTTSSynthesisMessage
  | DiagnoseTTSMessage;
```

在 `Response` 联合类型（`src/types/messages.ts:987`）中，在 `| StopTTSPlaybackResponse` 之后插入：

```ts
  | GetTTSSynthesisStatusResponse
  | CancelTTSSynthesisResponse
  | DiagnoseTTSResponse
```

- [ ] **Step 6: 类型检查**

Run: `cd apps/browser-extension && bun run typecheck`
Expected: 无错误（service-worker 尚未实现 handler，联合类型新增成员不影响编译）

- [ ] **Step 7: Commit**

```bash
git add apps/browser-extension/src/types/messages.ts
git commit -m "feat(browser-extension): 新增 TTS 合成进度查询/取消/诊断消息协议"
```

---

### Task 3: 合成任务表模块 ttsSynthesisTasks.ts

纯 TypeScript 模块，无 chrome API 依赖，便于单测。

**Files:**
- Create: `src/background/ttsSynthesisTasks.ts`
- Test: `src/background/ttsSynthesisTasks.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, expect, it } from "vitest";

import { TTSSynthesisTaskRegistry } from "./ttsSynthesisTasks";

describe("TTSSynthesisTaskRegistry", () => {
  it("begins a task in submitting stage", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("submitting");
    expect(record?.startedAt).toBe(1000);
  });

  it("advances stages and records taskId", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.advance("req-1", "synthesizing", { taskId: 12345 });
    registry.advance("req-1", "downloading");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("downloading");
    expect(record?.taskId).toBe(12345);
  });

  it("marks terminal stage timestamps on finish", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");
    now = 5000;
    registry.advance("req-1", "ready");

    expect(registry.get("req-1")?.finishedAt).toBe(5000);
  });

  it("fail records errorCode and does not overwrite cancelled tasks", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.cancel("req-1");
    registry.fail("req-1", "TTS_RATE_LIMIT");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("cancelled");
    expect(record?.errorCode).toBeUndefined();
  });

  it("fail marks stage failed with errorCode", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.fail("req-1", "TTS_RATE_LIMIT");

    const record = registry.get("req-1");
    expect(record?.stage).toBe("failed");
    expect(record?.errorCode).toBe("TTS_RATE_LIMIT");
  });

  it("returns undefined for unknown requestId", () => {
    const registry = new TTSSynthesisTaskRegistry();
    expect(registry.get("missing")).toBeUndefined();
  });

  it("isolates concurrent requestIds", () => {
    const registry = new TTSSynthesisTaskRegistry(() => 1000);
    registry.begin("req-1");
    registry.begin("req-2");
    registry.advance("req-1", "synthesizing");

    expect(registry.get("req-1")?.stage).toBe("synthesizing");
    expect(registry.get("req-2")?.stage).toBe("submitting");
  });

  it("prunes terminal tasks after retention window", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");
    registry.advance("req-1", "ready");

    now += 5 * 60 * 1000 + 1;
    expect(registry.get("req-1")).toBeUndefined();
  });

  it("keeps terminal tasks within retention window", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");
    registry.advance("req-1", "ready");

    now += 5 * 60 * 1000 - 1;
    expect(registry.get("req-1")?.stage).toBe("ready");
  });

  it("does not prune active tasks", () => {
    let now = 1000;
    const registry = new TTSSynthesisTaskRegistry(() => now);
    registry.begin("req-1");

    now += 60 * 60 * 1000;
    expect(registry.get("req-1")?.stage).toBe("submitting");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/background/ttsSynthesisTasks.test.ts`
Expected: FAIL，模块不存在（`Cannot find module './ttsSynthesisTasks'`）

- [ ] **Step 3: 实现任务表模块**

```ts
/**
 * @file ttsSynthesisTasks.ts
 * @description AI 语音合成任务表：跟踪每次合成请求的阶段进度，支持取消与惰性清理
 */

import type { TTSServiceErrorCode, TTSSynthesisStage } from "../types/messages";

export interface TTSSynthesisTaskRecord {
  /** 合成进度跟踪 ID */
  requestId: string;
  /** 当前合成阶段 */
  stage: TTSSynthesisStage;
  /** MiniMax 异步任务 ID（创建任务成功后记录） */
  taskId?: number;
  /** 合成开始时间戳 */
  startedAt: number;
  /** 进入终态（ready/failed/cancelled）的时间戳 */
  finishedAt?: number;
  /** 失败错误码 */
  errorCode?: TTSServiceErrorCode;
}

/** 终态任务保留时长，供页面查询最终状态 */
const TERMINAL_RETENTION_MS = 5 * 60 * 1000;

const TERMINAL_STAGES: ReadonlySet<TTSSynthesisStage> = new Set([
  "ready",
  "failed",
  "cancelled",
]);

export class TTSSynthesisTaskRegistry {
  private readonly tasks = new Map<string, TTSSynthesisTaskRecord>();

  constructor(private readonly now: () => number = Date.now) {}

  /** 登记一次新的合成请求（submitting 阶段） */
  begin(requestId: string): void {
    this.tasks.set(requestId, {
      requestId,
      stage: "submitting",
      startedAt: this.now(),
    });
  }

  /** 推进阶段；终态任务不再变更 */
  advance(
    requestId: string,
    stage: TTSSynthesisStage,
    patch?: { taskId?: number }
  ): void {
    const record = this.tasks.get(requestId);
    if (!record || TERMINAL_STAGES.has(record.stage)) return;

    record.stage = stage;
    if (patch?.taskId !== undefined) {
      record.taskId = patch.taskId;
    }
    if (TERMINAL_STAGES.has(stage)) {
      record.finishedAt = this.now();
    }
  }

  /** 标记失败；不覆盖已进入终态（如已取消）的任务 */
  fail(requestId: string, errorCode: TTSServiceErrorCode): void {
    const record = this.tasks.get(requestId);
    if (!record || TERMINAL_STAGES.has(record.stage)) return;

    record.stage = "failed";
    record.errorCode = errorCode;
    record.finishedAt = this.now();
  }

  /** 取消合成；不覆盖已进入终态的任务 */
  cancel(requestId: string): void {
    const record = this.tasks.get(requestId);
    if (!record || TERMINAL_STAGES.has(record.stage)) return;

    record.stage = "cancelled";
    record.finishedAt = this.now();
  }

  /** 查询任务；惰性清理过期终态任务 */
  get(requestId: string): TTSSynthesisTaskRecord | undefined {
    this.pruneExpired();
    return this.tasks.get(requestId);
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [requestId, record] of this.tasks) {
      if (
        record.finishedAt !== undefined &&
        now - record.finishedAt > TERMINAL_RETENTION_MS
      ) {
        this.tasks.delete(requestId);
      }
    }
  }
}

/** 全局共享的合成任务表 */
export const ttsSynthesisTaskRegistry = new TTSSynthesisTaskRegistry();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/background/ttsSynthesisTasks.test.ts`
Expected: 10 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/background/ttsSynthesisTasks.ts apps/browser-extension/src/background/ttsSynthesisTasks.test.ts
git commit -m "feat(browser-extension): 新增 TTS 合成任务表模块（阶段跟踪/取消/TTL 清理）"
```

---

### Task 4: 诊断聚合模块 ttsDiagnostics.ts

纯函数模块：多次采样的聚合统计 + 超时包装，供 service worker 的诊断 handler 使用。

**Files:**
- Create: `src/background/ttsDiagnostics.ts`
- Test: `src/background/ttsDiagnostics.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, expect, it, vi } from "vitest";

import { summarizeDiagnoseSamples, withTimeout } from "./ttsDiagnostics";

describe("summarizeDiagnoseSamples", () => {
  it("aggregates successful samples", () => {
    const summary = summarizeDiagnoseSamples([
      { success: true, durationMs: 2000 },
      { success: true, durationMs: 4000 },
      { success: true, durationMs: 9000 },
    ]);

    expect(summary).toEqual({
      successCount: 3,
      totalCount: 3,
      avgMs: 5000,
      minMs: 2000,
      maxMs: 9000,
      failures: [],
    });
  });

  it("groups failures by errorCode", () => {
    const summary = summarizeDiagnoseSamples([
      { success: true, durationMs: 3000 },
      { success: false, durationMs: 1000, errorCode: "TTS_RATE_LIMIT" },
      { success: false, durationMs: 1200, errorCode: "TTS_RATE_LIMIT" },
      { success: false, durationMs: 800, errorCode: "TTS_AUTH_ERROR" },
    ]);

    expect(summary.successCount).toBe(1);
    expect(summary.totalCount).toBe(4);
    expect(summary.avgMs).toBe(3000);
    expect(summary.failures).toEqual([
      { errorCode: "TTS_RATE_LIMIT", count: 2 },
      { errorCode: "TTS_AUTH_ERROR", count: 1 },
    ]);
  });

  it("returns zero latency stats when all samples failed", () => {
    const summary = summarizeDiagnoseSamples([
      { success: false, durationMs: 500, errorCode: "TTS_NETWORK_ERROR" },
    ]);

    expect(summary.avgMs).toBe(0);
    expect(summary.minMs).toBe(0);
    expect(summary.maxMs).toBe(0);
  });
});

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      1000,
      () => new Error("timeout")
    );
    expect(result).toBe("ok");
  });

  it("rejects with the timeout error when the promise is too slow", async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("late"), 5000)
    );
    const assertion = expect(
      withTimeout(slow, 1000, () => new Error("诊断采样超时"))
    ).rejects.toThrow("诊断采样超时");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/background/ttsDiagnostics.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现诊断聚合模块**

```ts
/**
 * @file ttsDiagnostics.ts
 * @description TTS 深度诊断：采样结果聚合与超时包装（纯函数，便于测试）
 */

import type { TTSDiagnoseSummary, TTSServiceErrorCode } from "../types/messages";

export interface DiagnoseSampleResult {
  /** 本次采样是否成功 */
  success: boolean;
  /** 采样耗时（毫秒） */
  durationMs: number;
  /** 失败时的错误码 */
  errorCode?: TTSServiceErrorCode;
}

/**
 * 聚合多次采样结果：成功率、耗时统计（仅统计成功样本）、失败原因分布。
 */
export function summarizeDiagnoseSamples(
  samples: DiagnoseSampleResult[]
): TTSDiagnoseSummary {
  const successes = samples.filter((sample) => sample.success);
  const durations = successes.map((sample) => sample.durationMs);

  const failureMap = new Map<TTSServiceErrorCode, number>();
  for (const sample of samples) {
    if (sample.success) continue;
    const code = sample.errorCode ?? "TTS_UNKNOWN_ERROR";
    failureMap.set(code, (failureMap.get(code) ?? 0) + 1);
  }

  return {
    successCount: successes.length,
    totalCount: samples.length,
    avgMs:
      durations.length > 0
        ? Math.round(durations.reduce((sum, v) => sum + v, 0) / durations.length)
        : 0,
    minMs: durations.length > 0 ? Math.min(...durations) : 0,
    maxMs: durations.length > 0 ? Math.max(...durations) : 0,
    failures: [...failureMap.entries()].map(([errorCode, count]) => ({
      errorCode,
      count,
    })),
  };
}

/**
 * 为 Promise 添加超时；超时后以 onTimeout 产生的错误拒绝。
 * 内部 Promise 被拒绝后仍可能 settle，附加 catch 避免未处理拒绝告警。
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    promise.catch(() => {
      // 超时后内部 Promise 的后续拒绝不再有人消费，静默吞掉
    });
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/background/ttsDiagnostics.test.ts`
Expected: 5 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/background/ttsDiagnostics.ts apps/browser-extension/src/background/ttsDiagnostics.test.ts
git commit -m "feat(browser-extension): 新增 TTS 诊断聚合模块（采样统计/超时包装）"
```

---

### Task 5: service worker 集成（进度上报 / 取消 / 状态查询 / 诊断）

**Files:**
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: 引入新模块与类型**

在 `src/background/service-worker.ts` 顶部 import 区（`from "../constants/corpusPrompts"` 之后）追加：

```ts
import { ttsSynthesisTaskRegistry } from "./ttsSynthesisTasks";
import {
  DiagnoseSampleResult,
  summarizeDiagnoseSamples,
  withTimeout,
} from "./ttsDiagnostics";
```

并在现有类型 import（`import type { ... } from "../types"`，约 line 60-110 的块）中追加：

```ts
  GetTTSSynthesisStatusResponse,
  CancelTTSSynthesisResponse,
  DiagnoseTTSResponse,
```

- [ ] **Step 2: getTTSErrorMessage 增加 TTS_CANCELLED 分支**

在 `getTTSErrorMessage`（`src/background/service-worker.ts:338`）的 switch 中，`case "TTS_PLAYBACK_ERROR":` 分支前插入：

```ts
    case "TTS_CANCELLED":
      return "朗读已取消";
```

- [ ] **Step 3: waitForMiniMaxTaskFileId 支持取消**

将 `waitForMiniMaxTaskFileId`（`src/background/service-worker.ts:1209`）签名与循环改为：

```ts
async function waitForMiniMaxTaskFileId(
  apiKey: string,
  taskId: MiniMaxTaskId,
  initialFileId?: MiniMaxFileId,
  shouldAbort?: () => boolean
): Promise<MiniMaxFileId> {
  const startedAt = Date.now();
  let fileId = initialFileId;

  while (Date.now() - startedAt < MINIMAX_TTS_POLL_TIMEOUT_MS) {
    if (shouldAbort?.()) {
      throw createTTSError({
        provider: "minimax",
        code: "TTS_CANCELLED",
      });
    }

    const data = await queryMiniMaxTTSTask(apiKey, taskId);
    // ……循环体其余部分保持不变……
```

（循环体内 `if (data.file_id)` 起的现有逻辑不动，仅新增 shouldAbort 检查。）

- [ ] **Step 4: MiniMax 管线接入任务表**

定义进度上下文类型并改造三个函数（`src/background/service-worker.ts:1319-1367`）：

```ts
interface TTSSynthesisProgressContext {
  requestId: string;
}

async function requestMiniMaxTTSAudio(
  context: TTSProviderRequestContext,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  const apiKey = context.config.minimax_tts?.api_key?.trim();
  if (!apiKey) {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const { taskId, fileId } = await createMiniMaxTTSTask(context);
  if (progress) {
    ttsSynthesisTaskRegistry.advance(progress.requestId, "synthesizing", {
      taskId,
    });
  }

  const outputFileId = await waitForMiniMaxTaskFileId(
    apiKey,
    taskId,
    fileId,
    progress
      ? () =>
          ttsSynthesisTaskRegistry.get(progress.requestId)?.stage ===
          "cancelled"
      : undefined
  );

  if (progress) {
    ttsSynthesisTaskRegistry.advance(progress.requestId, "downloading");
  }

  const audio = await downloadMiniMaxTTSAudio(apiKey, outputFileId);
  if (progress) {
    ttsSynthesisTaskRegistry.advance(progress.requestId, "ready");
  }
  return audio;
}

async function requestTTSAudioByProvider(
  provider: TTSProviderId,
  context: TTSProviderRequestContext,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  return provider === "minimax"
    ? requestMiniMaxTTSAudio(context, progress)
    : requestXiaomiTTSAudio(context);
}

async function requestTTSAudioWithPriority(
  text: string,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  const config = await getConfig();
  const selection = config.tts_selection || "browser";
  const context: TTSProviderRequestContext = {
    config,
    text,
  };

  // 用户选择浏览器朗读，直接返回未配置错误触发浏览器回退
  if (selection === "browser") {
    throw createTTSError({
      provider: "minimax",
      code: "TTS_NOT_CONFIGURED",
      message: "使用浏览器朗读",
    });
  }

  // 只尝试用户选择的 AI 提供者，失败时抛出错误触发浏览器回退
  try {
    return await requestTTSAudioByProvider(selection, context, progress);
  } catch (error) {
    throw normalizeUnknownTTSError(selection, error);
  }
}
```

注意：`normalizeUnknownTTSError` 会把非 TTSError 包装成 `TTS_UNKNOWN_ERROR`，`TTS_CANCELLED` 是 TTSError 实例，会原样透传。

- [ ] **Step 5: handleSynthesizeSpeech 接入任务表**

将 `handleSynthesizeSpeech`（`src/background/service-worker.ts:1759`）整体替换为：

```ts
/**
 * 处理 SYNTHESIZE_SPEECH 消息
 *
 * 按优先级调用 AI TTS 生成音频；传入 requestId 时登记合成任务表以上报进度。
 */
async function handleSynthesizeSpeech(
  text: string,
  rate: TTSSpeed,
  requestId?: string
): Promise<SynthesizeSpeechResponse> {
  const playbackEpoch = nextTTSPlaybackEpoch();
  if (requestId) {
    ttsSynthesisTaskRegistry.begin(requestId);
  }

  try {
    if (!text.trim()) {
      return {
        success: false,
        errorCode: "TTS_BAD_REQUEST",
        error: "朗读文本不能为空",
      };
    }

    const data = await requestTTSAudioWithPriority(
      text.trim(),
      requestId ? { requestId } : undefined
    );
    if (!isCurrentTTSPlaybackEpoch(playbackEpoch)) {
      if (requestId) {
        ttsSynthesisTaskRegistry.cancel(requestId);
      }
      return {
        success: false,
        errorCode: "TTS_CANCELLED",
        error: "朗读已取消",
      };
    }

    if (requestId) {
      ttsSynthesisTaskRegistry.advance(requestId, "ready");
    }

    await playTTSAudioInOffscreen(data, rate);
    if (!isCurrentTTSPlaybackEpoch(playbackEpoch)) {
      return {
        success: false,
        errorCode: "TTS_CANCELLED",
        error: "朗读已取消",
      };
    }

    return {
      success: true,
      data: {
        provider: data.provider,
        fallbackWarningMessage: data.fallbackWarningMessage,
      },
    };
  } catch (error) {
    if (requestId) {
      ttsSynthesisTaskRegistry.fail(
        requestId,
        error instanceof TTSError ? error.code : "TTS_UNKNOWN_ERROR"
      );
    }

    if (error instanceof TTSError) {
      return {
        success: false,
        errorCode: error.code,
        error: error.message,
        errorHint: error.hint,
        httpStatus: error.httpStatus,
        errorDetail: error.detail,
      };
    }

    return {
      success: false,
      errorCode: "TTS_UNKNOWN_ERROR",
      error: error instanceof Error ? error.message : "语音合成失败",
      errorDetail: error instanceof Error ? error.message : undefined,
    };
  }
}
```

- [ ] **Step 6: 新增状态查询 / 取消 / 诊断 handler**

在 `handleStopTTSPlayback`（`src/background/service-worker.ts:1820`）之后追加：

```ts
/**
 * 处理 GET_TTS_SYNTHESIS_STATUS 消息
 *
 * 查询指定合成请求的进度；未知 requestId 返回 stage=unknown。
 */
async function handleGetTTSSynthesisStatus(
  requestId: string
): Promise<GetTTSSynthesisStatusResponse> {
  const record = ttsSynthesisTaskRegistry.get(requestId);
  if (!record) {
    return {
      success: true,
      data: { stage: "unknown", elapsedMs: 0 },
    };
  }

  const endedAt = record.finishedAt ?? Date.now();
  return {
    success: true,
    data: {
      stage: record.stage,
      elapsedMs: endedAt - record.startedAt,
      errorCode: record.errorCode,
    },
  };
}

/**
 * 处理 CANCEL_TTS_SYNTHESIS 消息
 *
 * 取消指定合成请求：任务置为 cancelled（轮询循环下一轮即中止），
 * 并递增播放 epoch 防止迟到的音频开始播放。
 */
async function handleCancelTTSSynthesis(
  requestId: string
): Promise<CancelTTSSynthesisResponse> {
  try {
    ttsSynthesisTaskRegistry.cancel(requestId);
    nextTTSPlaybackEpoch();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消语音合成失败",
    };
  }
}

const DIAGNOSE_TTS_SAMPLE_COUNT = 3;
const DIAGNOSE_TTS_SAMPLE_TIMEOUT_MS = 60_000;
const DIAGNOSE_TTS_TEXT =
  "Hello from Lingride. This is a speech synthesis diagnostic sample.";

/**
 * 处理 DIAGNOSE_TTS 消息
 *
 * 顺序跑多次采样合成，汇总成功率、耗时与失败原因分布。
 */
async function handleDiagnoseTTS(
  provider: TTSProviderId
): Promise<DiagnoseTTSResponse> {
  try {
    const config = await getConfig();
    const samples: DiagnoseSampleResult[] = [];

    for (let i = 0; i < DIAGNOSE_TTS_SAMPLE_COUNT; i++) {
      const startedAt = Date.now();
      try {
        await withTimeout(
          requestTTSAudioByProvider(provider, {
            config,
            text: DIAGNOSE_TTS_TEXT,
          }),
          DIAGNOSE_TTS_SAMPLE_TIMEOUT_MS,
          () =>
            createTTSError({
              provider,
              code: "TTS_SERVER_BUSY",
              detail: "诊断采样超时（60s）",
            })
        );
        samples.push({ success: true, durationMs: Date.now() - startedAt });
      } catch (error) {
        samples.push({
          success: false,
          durationMs: Date.now() - startedAt,
          errorCode:
            error instanceof TTSError ? error.code : "TTS_UNKNOWN_ERROR",
        });
      }
    }

    return { success: true, data: summarizeDiagnoseSamples(samples) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "语音合成诊断失败",
    };
  }
}
```

- [ ] **Step 7: 接入消息分发**

在消息分发 switch 中（`src/background/service-worker.ts`），修改 `SYNTHESIZE_SPEECH` case 并新增三个 case。找到现有：

```ts
        case MessageType.SYNTHESIZE_SPEECH:
          response = await handleSynthesizeSpeech(
            message.payload.text,
            message.payload.rate
          );
          break;
```

替换为：

```ts
        case MessageType.SYNTHESIZE_SPEECH:
          response = await handleSynthesizeSpeech(
            message.payload.text,
            message.payload.rate,
            message.payload.requestId
          );
          break;

        case MessageType.GET_TTS_SYNTHESIS_STATUS:
          response = await handleGetTTSSynthesisStatus(
            message.payload.requestId
          );
          break;

        case MessageType.CANCEL_TTS_SYNTHESIS:
          response = await handleCancelTTSSynthesis(message.payload.requestId);
          break;

        case MessageType.DIAGNOSE_TTS:
          response = await handleDiagnoseTTS(message.payload.provider);
          break;
```

- [ ] **Step 8: 类型检查 + 全量单测**

Run: `cd apps/browser-extension && bun run typecheck && bunx vitest run`
Expected: 类型检查无错误；所有测试 PASS

- [ ] **Step 9: Commit**

```bash
git add apps/browser-extension/src/background/service-worker.ts
git commit -m "feat(browser-extension): TTS 合成接入任务表，支持进度查询/取消/深度诊断"
```

---

### Task 6: hybridTTSPlayer 进度回调与取消

**Files:**
- Modify: `src/shared/hybridTTSPlayer.ts`
- Test: `src/shared/hybridTTSPlayer.test.ts`

- [ ] **Step 1: 编写失败测试（追加到现有测试文件）**

在 `src/shared/hybridTTSPlayer.test.ts` 顶部 import 改为：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createHybridTTSPlayer,
  selectNaturalBrowserVoice,
} from "./hybridTTSPlayer";
```

文件末尾追加：

```ts
// ====== AI 进度跟踪与取消 ======

type MockMessage = { type: string; payload?: Record<string, unknown> };

let sentMessages: MockMessage[] = [];
let messageHandler: (message: MockMessage) => unknown;

function installChromeMock(
  handler: (message: MockMessage) => unknown
): void {
  sentMessages = [];
  messageHandler = handler;
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      sendMessage: vi.fn((message: MockMessage) =>
        Promise.resolve(messageHandler(message))
      ),
    },
  };
}

function installBrowserTTSMock(): { speakCalls: number } {
  const state = { speakCalls: 0 };
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = class {
    text: string;
    lang = "";
    rate = 1;
    voice: unknown = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  (globalThis as Record<string, unknown>).window = {
    speechSynthesis: {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: (utterance: {
        onstart: (() => void) | null;
        onend: (() => void) | null;
      }) => {
        state.speakCalls += 1;
        setTimeout(() => {
          utterance.onstart?.();
          utterance.onend?.();
        }, 0);
      },
    },
  };
  return state;
}

describe("createHybridTTSPlayer AI progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).chrome;
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
  });

  it("reports synthesis progress and defers onStart until ready", async () => {
    let statusCalls = 0;
    installChromeMock((message) => {
      if (message.type === "GET_TTS_SYNTHESIS_STATUS") {
        statusCalls += 1;
        return {
          success: true,
          data: {
            stage: statusCalls < 2 ? "synthesizing" : "ready",
            elapsedMs: statusCalls * 700,
          },
        };
      }
      if (message.type === "SYNTHESIZE_SPEECH") {
        return new Promise((resolve) =>
          setTimeout(
            () => resolve({ success: true, data: { provider: "minimax" } }),
            1500
          )
        );
      }
      return { success: false };
    });

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const stages: string[] = [];
    const events: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onStart: () => events.push("start"),
      onEnd: () => events.push("end"),
      onProgress: (progress) => stages.push(progress.stage),
    });

    await vi.advanceTimersByTimeAsync(3000);
    await playPromise;

    expect(stages).toContain("synthesizing");
    expect(stages).toContain("ready");
    expect(events).toEqual(["start", "end"]);

    const synthMessage = sentMessages.find(
      (m) => m.type === "SYNTHESIZE_SPEECH"
    );
    expect(synthMessage?.payload?.requestId).toMatch(/^tts-/);
  });

  it("cancelAIPlayback sends cancellation for the active request", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: false,
                errorCode: "TTS_CANCELLED",
                error: "朗读已取消",
              }),
            60_000
          )
        );
      }
      return { success: true, data: { stage: "synthesizing", elapsedMs: 100 } };
    });
    const browserTTS = installBrowserTTSMock();

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onProgress: () => {},
    });

    await vi.advanceTimersByTimeAsync(100);
    player.cancelAIPlayback();
    await vi.advanceTimersByTimeAsync(61_000);
    await playPromise;

    const cancelMessage = sentMessages.find(
      (m) => m.type === "CANCEL_TTS_SYNTHESIS"
    );
    expect(cancelMessage).toBeDefined();
    expect(cancelMessage?.payload?.requestId).toMatch(/^tts-/);
    // 取消后静默回退浏览器朗读
    expect(browserTTS.speakCalls).toBe(1);
  });

  it("falls back to browser speech silently on TTS_CANCELLED", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return {
          success: false,
          errorCode: "TTS_CANCELLED",
          error: "朗读已取消",
        };
      }
      return { success: true, data: { stage: "unknown", elapsedMs: 0 } };
    });
    const browserTTS = installBrowserTTSMock();

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const warnings: string[] = [];
    const aiErrors: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onFallbackWarning: (message) => warnings.push(message),
      onAIError: (message) => aiErrors.push(message),
    });
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(warnings).toHaveLength(0);
    expect(aiErrors).toHaveLength(0);
    expect(browserTTS.speakCalls).toBe(1);
  });

  it("reports specific AI error via onAIError", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return {
          success: false,
          errorCode: "TTS_RATE_LIMIT",
          error: "请求过于频繁或额度受限",
        };
      }
      return { success: true, data: { stage: "unknown", elapsedMs: 0 } };
    });
    installBrowserTTSMock();

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const warnings: string[] = [];
    const aiErrors: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onFallbackWarning: (message) => warnings.push(message),
      onAIError: (message) => aiErrors.push(message),
    });
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(aiErrors).toEqual(["请求过于频繁或额度受限"]);
    expect(warnings).toHaveLength(0);
  });

  it("keeps legacy behavior when onProgress is not provided", async () => {
    installChromeMock((message) => {
      if (message.type === "SYNTHESIZE_SPEECH") {
        return { success: true, data: { provider: "minimax" } };
      }
      return { success: true, data: { stage: "unknown", elapsedMs: 0 } };
    });

    const player = createHybridTTSPlayer({ isAIEnabled: () => true });
    const events: string[] = [];

    const playPromise = player.playText({
      text: "hello world",
      rate: 1,
      onStart: () => events.push("start"),
      onEnd: () => events.push("end"),
    });
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(events).toEqual(["start", "end"]);
    const synthMessage = sentMessages.find(
      (m) => m.type === "SYNTHESIZE_SPEECH"
    );
    expect(synthMessage?.payload?.requestId).toBeUndefined();
    expect(
      sentMessages.some((m) => m.type === "GET_TTS_SYNTHESIS_STATUS")
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/shared/hybridTTSPlayer.test.ts`
Expected: FAIL（`onProgress`/`onAIError`/`cancelAIPlayback` 不存在，类型错误或断言失败）

- [ ] **Step 3: 改造 hybridTTSPlayer.ts**

3a. import 区（`src/shared/hybridTTSPlayer.ts:6-10`）改为：

```ts
import {
  GetTTSSynthesisStatusResponse,
  MessageType,
  SynthesizeSpeechResponse,
  TTSSpeed,
  TTSSynthesisStage,
} from "../types";
```

3b. `PlayTextOptions`（line 22-30）改为：

```ts
/** AI 合成进度 */
export interface TTSSynthesisProgress {
  stage: TTSSynthesisStage;
  elapsedMs: number;
}

export interface PlayTextOptions {
  text: string;
  rate: TTSSpeed;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onFallbackWarning?: (message: string) => void;
  fallbackWarningMessage?: string;
  /** AI 合成进度回调（传入后启用进度跟踪，onStart 延迟到 ready 阶段触发） */
  onProgress?: (progress: TTSSynthesisProgress) => void;
  /** AI 合成失败回调，携带具体失败原因 */
  onAIError?: (message: string) => void;
}
```

3c. `HybridTTSPlayer` 接口（line 32-37）增加：

```ts
export interface HybridTTSPlayer {
  playText(options: PlayTextOptions): Promise<void>;
  playTextTwice(options: PlayTextOptions & { gapMs?: number }): Promise<void>;
  /** 取消正在进行中的 AI 合成（不影响后续的浏览器回退朗读） */
  cancelAIPlayback(): void;
  stop(): void;
  isPlaying(): boolean;
}
```

3d. 在 `createHybridTTSPlayer` 闭包变量区（line 120-126 附近，`let ownsAIPlayback = false;` 之后）追加：

```ts
  // AI 合成进度轮询间隔
  const AI_STATUS_POLL_INTERVAL_MS = 700;
  // 当前进行中的 AI 合成请求 ID（未启用进度跟踪时为 null）
  let activeAIRequestId: string | null = null;
  let aiRequestCounter = 0;
```

3e. 将 `playAISpeech`（line 250-283）整体替换为：

```ts
  interface PlayAICallbacks {
    onStart?: () => void;
    onEnd?: () => void;
    onProgress?: (progress: TTSSynthesisProgress) => void;
  }

  async function pollAISynthesisStatus(
    requestId: string,
    token: number,
    onProgress: (progress: TTSSynthesisProgress) => void,
    onReady: () => void
  ): Promise<void> {
    try {
      const response: GetTTSSynthesisStatusResponse =
        await chrome.runtime.sendMessage({
          type: MessageType.GET_TTS_SYNTHESIS_STATUS,
          payload: { requestId },
        });

      if (!response?.success || !response.data || !isCurrentRun(token)) return;
      if (response.data.stage === "unknown") return;

      onProgress({
        stage: response.data.stage,
        elapsedMs: response.data.elapsedMs,
      });

      if (response.data.stage === "ready") {
        onReady();
      }
    } catch {
      // Service worker 休眠等场景，忽略本次轮询
    }
  }

  async function playAISpeech(
    text: string,
    rate: TTSSpeed,
    token: number,
    callbacks: PlayAICallbacks
  ): Promise<SynthesizeSpeechResponse> {
    const { onStart, onEnd, onProgress } = callbacks;

    if (!isCurrentRun(token)) {
      return {
        success: false,
        errorCode: "TTS_CANCELLED",
        error: "朗读已取消",
      };
    }

    const trackProgress = typeof onProgress === "function";
    const requestId = trackProgress
      ? `tts-${Date.now()}-${++aiRequestCounter}`
      : undefined;
    activeAIRequestId = requestId ?? null;

    let readyNotified = false;
    const notifyReady = () => {
      if (readyNotified || !isCurrentRun(token)) return;
      readyNotified = true;
      onStart?.();
    };

    // 未启用进度跟踪时保持原行为：请求发出即标记播放中
    if (!trackProgress) {
      onStart?.();
    }

    let pollTimer: ReturnType<typeof setInterval> | undefined;
    if (requestId && onProgress) {
      void pollAISynthesisStatus(requestId, token, onProgress, notifyReady);
      pollTimer = setInterval(() => {
        void pollAISynthesisStatus(requestId, token, onProgress, notifyReady);
      }, AI_STATUS_POLL_INTERVAL_MS);
    }

    ownsAIPlayback = true;
    try {
      const response: SynthesizeSpeechResponse =
        await chrome.runtime.sendMessage({
          type: MessageType.SYNTHESIZE_SPEECH,
          payload: { text, rate, requestId },
        });

      if (response.success && isCurrentRun(token)) {
        notifyReady();
        onEnd?.();
      }

      return response;
    } finally {
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
      }
      activeAIRequestId = null;
      ownsAIPlayback = false;
    }
  }

  function cancelAIPlayback(): void {
    const requestId = activeAIRequestId;
    if (!requestId) return;

    void chrome.runtime
      .sendMessage({
        type: MessageType.CANCEL_TTS_SYNTHESIS,
        payload: { requestId },
      })
      .catch(() => {
        // Service worker 可能已休眠，忽略取消失败
      });
  }
```

3f. `playTextInternal`（line 285-335）替换为：

```ts
  async function playTextInternal(
    token: number,
    playOptions: PlayTextOptions
  ): Promise<void> {
    const text = playOptions.text.trim();
    if (!text) return;

    const {
      rate,
      lang = "en-US",
      onStart,
      onEnd,
      onProgress,
      onAIError,
      onFallbackWarning,
      fallbackWarningMessage = DEFAULT_FALLBACK_WARNING,
    } = playOptions;

    const shouldTryAI = options.isAIEnabled();

    if (shouldTryAI) {
      try {
        const response = await playAISpeech(text, rate, token, {
          onStart,
          onEnd,
          onProgress,
        });

        if (!isCurrentRun(token)) return;

        if (response.success && response.data) {
          if (response.data.fallbackWarningMessage && !fallbackWarningShown) {
            fallbackWarningShown = true;
            onFallbackWarning?.(response.data.fallbackWarningMessage);
          }
          return;
        }

        // 用户主动取消：静默回退浏览器朗读，不显示警告
        if (response.errorCode === "TTS_CANCELLED") {
          // fall through
        } else if (response.error && onAIError) {
          fallbackWarningShown = true;
          onAIError(response.error);
        } else if (
          response.errorCode !== "TTS_NOT_CONFIGURED" &&
          !fallbackWarningShown
        ) {
          fallbackWarningShown = true;
          onFallbackWarning?.(fallbackWarningMessage);
        }
      } catch {
        if (!isCurrentRun(token)) return;

        if (!fallbackWarningShown) {
          fallbackWarningShown = true;
          onFallbackWarning?.(fallbackWarningMessage);
        }
      }
    }

    await playBrowserText(text, rate, token, lang, onStart, onEnd);
  }
```

3g. 返回对象（line 369-374）增加 `cancelAIPlayback`：

```ts
  return {
    playText,
    playTextTwice,
    cancelAIPlayback,
    stop,
    isPlaying,
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/shared/hybridTTSPlayer.test.ts`
Expected: 全部 PASS（原有 6 个 + 新增 5 个）

- [ ] **Step 5: 类型检查**

Run: `cd apps/browser-extension && bun run typecheck`
Expected: 无错误。注意 `TTSSynthesisStage` 需能从 `../types` 导出——若 `src/types/index.ts` 是 re-export 桶文件，确认它 `export * from "./messages"`（现有 `SynthesizeSpeechResponse` 已可从此导入，说明桶文件已覆盖 messages.ts，新类型自动可用）。

- [ ] **Step 6: Commit**

```bash
git add apps/browser-extension/src/shared/hybridTTSPlayer.ts apps/browser-extension/src/shared/hybridTTSPlayer.test.ts
git commit -m "feat(browser-extension): hybridTTSPlayer 支持合成进度回调与取消"
```

---

### Task 7: 语料库页进度 UI

**Files:**
- Modify: `src/corpus/corpus.html`
- Modify: `src/corpus/corpus.css`
- Modify: `src/corpus/corpus.ts`

- [ ] **Step 1: corpus.html 添加进度区**

在 `src/corpus/corpus.html:128`（`<span id="playCount" class="play-count">已播放 0 次</span>`）之后、`</div>`（`.tts-controls` 结束）之前插入：

```html
          <div id="ttsProgress" class="tts-progress" hidden>
            <div class="tts-progress-track"><div class="tts-progress-bar"></div></div>
            <span id="ttsProgressText" class="tts-progress-text"></span>
            <button id="ttsCancelBtn" class="tts-cancel-btn" type="button">取消</button>
          </div>
```

- [ ] **Step 2: corpus.css 添加进度区样式**

在 `src/corpus/corpus.css` 的 `.btn-tts.playing .icon-pause` 规则（约 line 528）之后追加：

```css
/* TTS 合成进度 */
.tts-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex: 1;
  min-width: 0;
}

.tts-progress[hidden] {
  display: none;
}

.tts-progress-track {
  flex: 1;
  height: 4px;
  background: var(--bg-quaternary);
  border-radius: 2px;
  overflow: hidden;
}

.tts-progress-bar {
  width: 40%;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  animation: tts-progress-indeterminate 1.2s var(--ease-out) infinite;
}

@keyframes tts-progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

.tts-progress-text {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.tts-cancel-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--separator);
  border-radius: var(--radius-sm, 6px);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s var(--ease-out);
}

.tts-cancel-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}
```

若 `--space-sm` / `--separator` / `--ease-out` 变量名不存在，打开 corpus.css 的 `:root` 块确认实际变量名并替换（现有样式已使用 `--space-md`、`--separator`、`--ease-out`，保持一致即可）。

- [ ] **Step 3: corpus.ts 接入进度展示与取消**

3a. DOM 引用区（`src/corpus/corpus.ts:98` `const playCount = ...` 之后）追加：

```ts
const ttsProgress = document.getElementById("ttsProgress") as HTMLElement;
const ttsProgressText = document.getElementById("ttsProgressText") as HTMLElement;
const ttsCancelBtn = document.getElementById("ttsCancelBtn") as HTMLButtonElement;
```

3b. 常量区（`TTS_PLAYBACK_ERROR_MESSAGE` 之后）追加：

```ts
/** AI 合成阶段文案 */
const TTS_STAGE_LABELS: Record<string, string> = {
  submitting: "提交中",
  synthesizing: "合成中",
  downloading: "下载音频",
};
```

3c. 在 `handlePlaySentence` 之前新增两个辅助函数：

```ts
function showTTSProgress(stage: string, elapsedMs: number): void {
  const label = TTS_STAGE_LABELS[stage] ?? "合成中";
  ttsProgressText.textContent = `${label}… ${Math.round(elapsedMs / 1000)}s`;
  ttsProgress.hidden = false;
}

function hideTTSProgress(): void {
  ttsProgress.hidden = true;
}
```

3d. `handlePlaySentence`（`src/corpus/corpus.ts:564-600`）整体替换为：

```ts
function handlePlaySentence(): void {
  if (!state || !isTTSAvailable) return;

  const sentence = state.sentences[state.currentIndex];
  const rate = currentTTSSpeed;

  // 停止当前播放
  corpusTTSPlayer.stop();
  hideTTSProgress();

  void corpusTTSPlayer
    .playText({
      text: sentence.text,
      rate,
      onStart: () => {
        hideTTSProgress();
        playBtn.classList.add("playing");
      },
      onEnd: () => {
        hideTTSProgress();
        playBtn.classList.remove("playing");
        if (state) {
          state.playCounts[state.currentIndex]++;
          playCount.textContent = `已播放 ${state.playCounts[state.currentIndex]} 次`;
        }
      },
      onProgress: ({ stage, elapsedMs }) => {
        if (stage === "ready" || stage === "failed" || stage === "cancelled" || stage === "unknown") {
          hideTTSProgress();
          return;
        }
        showTTSProgress(stage, elapsedMs);
      },
      onAIError: (message) => {
        showStatus(
          practiceStatus,
          `AI 合成失败：${message}，已切换浏览器朗读`,
          "warning"
        );
      },
      onFallbackWarning: (message) => {
        showStatus(practiceStatus, message, "warning");
      },
      fallbackWarningMessage: TTS_FALLBACK_WARNING_MESSAGE,
    })
    .catch((error) => {
      hideTTSProgress();
      playBtn.classList.remove("playing");
      showStatus(
        practiceStatus,
        error instanceof Error ? error.message : TTS_PLAYBACK_ERROR_MESSAGE,
        "error"
      );
    });
}
```

3e. `renderCurrentSentence`（`src/corpus/corpus.ts:493`）开头（`if (!state) return;` 之后）追加一行，切换句子时收起进度区：

```ts
  hideTTSProgress();
```

3f. `bindEvents`（`src/corpus/corpus.ts:272`）内追加取消按钮绑定（放在 `replayBtn` 绑定附近）：

```ts
  ttsCancelBtn.addEventListener("click", () => {
    hideTTSProgress();
    corpusTTSPlayer.cancelAIPlayback();
  });
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd apps/browser-extension && bun run typecheck && bun run build`
Expected: 无错误，构建成功

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/corpus/corpus.html apps/browser-extension/src/corpus/corpus.css apps/browser-extension/src/corpus/corpus.ts
git commit -m "feat(browser-extension): 语料库听力训练页展示 AI 合成进度并支持取消"
```

---

### Task 8: popup 设置页深度诊断

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.ts`

- [ ] **Step 1: popup.html 添加深度诊断按钮**

在 `src/popup/popup.html` MiniMax  accordion body 内，找到这两行（约 line 458-463）：

```html
                    <p class="settings-hint">
                      <a href="https://platform.minimaxi.com/docs/guides/speech-t2a-async" target="_blank" rel="noopener">查看 MiniMax TTS 文档 →</a>
                    </p>
```

在它们**之前**插入：

```html
                    <div class="settings-divider"></div>
                    <div class="settings-row">
                      <label class="settings-label label-muted">可用性</label>
                      <button
                        type="button"
                        id="diagnoseMiniMaxTTSBtn"
                        class="service-test-btn diagnose-miniMax-tts-btn"
                        disabled
                        title="填写 API Key 后可诊断"
                      >深度诊断</button>
                    </div>
```

- [ ] **Step 2: popup.ts 添加 DOM 引用与事件绑定**

在 `src/popup/popup.ts:377-379`（`testMiniMaxTTSBtn` 引用）之后追加：

```ts
const diagnoseMiniMaxTTSBtn = document.getElementById(
  "diagnoseMiniMaxTTSBtn"
) as HTMLButtonElement;
```

在 `src/popup/popup.ts:1327`（`testMiniMaxTTSBtn.addEventListener("click", handleTestMiniMaxTTS);`）之后追加：

```ts
  diagnoseMiniMaxTTSBtn.addEventListener("click", handleDiagnoseMiniMaxTTS);
```

找到 `updateMiniMaxTTSButtonAvailability` 函数（控制 `testMiniMaxTTSBtn.disabled` 的函数，搜索函数名定位），在其中对 `testMiniMaxTTSBtn.disabled = ...` 赋值之后同步一行：

```ts
  diagnoseMiniMaxTTSBtn.disabled = testMiniMaxTTSBtn.disabled;
```

- [ ] **Step 3: popup.ts 实现诊断 handler**

在 `handleTestMiniMaxTTS`（`src/popup/popup.ts:2249`）之后追加：

```ts
function formatDiagnoseLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function handleDiagnoseMiniMaxTTS(event: Event): Promise<void> {
  event.stopPropagation();

  if (diagnoseMiniMaxTTSBtn.disabled || !minimaxTTSApiKeyInput.value.trim()) {
    return;
  }

  diagnoseMiniMaxTTSBtn.disabled = true;
  showMiniMaxTTSStatus("正在深度诊断（连续合成 3 次，约需 1 分钟）...", "loading");

  try {
    await autoSave();

    const response: DiagnoseTTSResponse = await chrome.runtime.sendMessage({
      type: MessageType.DIAGNOSE_TTS,
      payload: { provider: "minimax" },
    });

    if (response.success && response.data) {
      const data = response.data;
      const parts: string[] = [
        `${data.successCount}/${data.totalCount} 成功`,
      ];

      if (data.successCount > 0) {
        parts.push(
          `平均 ${formatDiagnoseLatency(data.avgMs)}（${formatDiagnoseLatency(data.minMs)} ~ ${formatDiagnoseLatency(data.maxMs)}）`
        );
      }

      if (data.failures.length > 0) {
        const reasons = data.failures
          .map((failure) => {
            const reason = getMiniMaxTTSFailureReason({
              success: false,
              errorCode: failure.errorCode,
              error: "",
            });
            return `${reason} ×${failure.count}`;
          })
          .join("、");
        parts.push(`失败原因：${reasons}`);
      }

      showMiniMaxTTSStatus(
        parts.join(" · "),
        data.failures.length === 0 ? "success" : "error"
      );
    } else {
      showMiniMaxTTSStatus(
        `诊断失败：${response.error || "未知错误"}`,
        "error"
      );
    }
  } catch {
    showMiniMaxTTSStatus("诊断失败：请求发送失败", "error");
  } finally {
    diagnoseMiniMaxTTSBtn.disabled = false;
  }
}
```

注意：`getMiniMaxTTSFailureReason` 的入参类型是 `TestTTSConnectionResponse`，上述调用构造了一个兼容字面量；若类型不兼容，将该函数签名放宽为 `{ errorCode?: TTSServiceErrorCode; errorDetail?: string; httpStatus?: number }`。

同时确认 popup.ts 顶部 import 包含 `DiagnoseTTSResponse`（追加到现有 `from "../types"` 的 import 列表）。

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd apps/browser-extension && bun run typecheck && bun run build`
Expected: 无错误，构建成功

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts
git commit -m "feat(browser-extension): 设置页新增 MiniMax TTS 深度诊断"
```

---

### Task 9: 全量验证 + 运行诊断脚本定位根因

- [ ] **Step 1: 全量测试与构建**

Run: `cd apps/browser-extension && bun run typecheck && bunx vitest run && bun run build`
Expected: 类型检查无错误；所有测试 PASS；构建成功

- [ ] **Step 2: 用真实 API key 运行诊断脚本**

向用户索取 MiniMax API key（插件设置页可复制），然后：

Run: `cd apps/browser-extension && MINIMAX_API_KEY=<用户提供的key> node scripts/diagnose-minimax-tts.mjs`

记录输出：成功率、合成耗时分布、失败原因分布，据此判断根因（限流 / 排队慢 / 鉴权），并向用户汇报。

- [ ] **Step 3: 人工验证（加载插件实测）**

`dist/` 构建产物加载到 Chrome，打开语料库听力训练页：
1. 粘贴语料开始练习 → 播放按钮旁出现"合成中… Ns"进度与取消按钮；
2. 点击取消 → 立即切换浏览器朗读当前句；
3. 断网或填错误 key → 状态栏显示具体失败原因并回退浏览器朗读；
4. 设置页点"深度诊断" → 显示成功率与耗时汇总。

- [ ] **Step 4: 最终 Commit（如有修复）**

```bash
git add -A apps/browser-extension
git commit -m "fix(browser-extension): 人工验证发现的问题修复"
```
