# 新增豆包（火山方舟）TTS Provider 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页"语音合成服务"新增豆包（火山方舟 seed-tts-2.0）提供者，HTTP 单向流式接口，4 个美式音色下拉可选。

**Architecture:** 完整镜像现有小米 provider 模式：config 类型 → service worker 合成函数（JSONL 分块解析 + base64 拼接）→ popup 手风琴。弹窗通用 helper（`setServiceTestButtonState`/`showServiceTestStatus`/`clearServiceTestResetTimer`）直接复用；"测试连接"与"深度诊断"经 `requestTTSAudioByProvider` 分支自动支持。

**Tech Stack:** TypeScript、Chrome Extension MV3、vitest。

**Spec:** `docs/superpowers/specs/2026-09-05-doubao-tts-provider-design.md`

**接口实测结论**（2026-09-05，用户方舟 key）：`POST https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional` 返回 JSONL 分块 `{"code":0,"message":"","data":"<base64>"}`，**code 0 = 成功**，data 为 mp3 片段。

**工作目录：** `apps/browser-extension`（以下相对路径均相对于它）

---

### Task 1: 类型与配置层

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/types/index.ts`
- Modify: `src/background/configManager.ts`
- Modify: `src/manifest.json`
- Test: `src/types/config.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `src/types/config.test.ts` 顶部 import 块追加 `DOUBAO_TTS_VOICE_OPTIONS, normalizeDoubaoTTSVoice`，文件末尾追加：

```ts
describe("normalizeDoubaoTTSVoice", () => {
  it("returns default voice for empty input", () => {
    expect(normalizeDoubaoTTSVoice(undefined)).toBe(
      "en_female_allison_uranus_bigtts"
    );
    expect(normalizeDoubaoTTSVoice("")).toBe("en_female_allison_uranus_bigtts");
  });

  it("accepts known v2.0 voices", () => {
    expect(normalizeDoubaoTTSVoice("en_male_alex_uranus_bigtts")).toBe(
      "en_male_alex_uranus_bigtts"
    );
  });

  it("falls back to default for unknown voices", () => {
    expect(normalizeDoubaoTTSVoice("unknown_voice")).toBe(
      "en_female_allison_uranus_bigtts"
    );
  });

  it("voice options contain the 4 curated voices", () => {
    expect(DOUBAO_TTS_VOICE_OPTIONS).toEqual([
      "en_female_allison_uranus_bigtts",
      "en_female_brittney_pimintel_uranus_bigtts",
      "en_male_alex_uranus_bigtts",
      "en_male_alberto_uranus_bigtts",
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: FAIL（导出不存在）

- [ ] **Step 3: 修改 types/config.ts**

3a. `TTSSelectionMode`（约 line 189）与 `TTSProviderId`（约 line 194）：

```ts
export type TTSSelectionMode = "minimax" | "xiaomi" | "doubao" | "browser";

/**
 * 语音合成服务标识
 */
export type TTSProviderId = "minimax" | "xiaomi" | "doubao";
```

（同时把 TTSSelectionMode 上方的注释中追加一行 ` * - doubao: 豆包（火山方舟）语音合成`）

3b. `XiaomiTTSConfig` 之后追加：

```ts
/**
 * 豆包（火山方舟）语音合成音色（seed-tts-2.0，美式英语）
 */
export type DoubaoTTSVoice =
  | "en_female_allison_uranus_bigtts"
  | "en_female_brittney_pimintel_uranus_bigtts"
  | "en_male_alex_uranus_bigtts"
  | "en_male_alberto_uranus_bigtts";

/** 豆包 TTS 可选音色 */
export const DOUBAO_TTS_VOICE_OPTIONS: DoubaoTTSVoice[] = [
  "en_female_allison_uranus_bigtts",
  "en_female_brittney_pimintel_uranus_bigtts",
  "en_male_alex_uranus_bigtts",
  "en_male_alberto_uranus_bigtts",
];

/** 豆包 TTS 默认音色（Allison，美式女声） */
export const DOUBAO_TTS_DEFAULT_VOICE: DoubaoTTSVoice =
  "en_female_allison_uranus_bigtts";

/** 规范化豆包 TTS 音色；未知值回退默认音色 */
export function normalizeDoubaoTTSVoice(value?: string | null): DoubaoTTSVoice {
  if (value && DOUBAO_TTS_VOICE_OPTIONS.includes(value as DoubaoTTSVoice)) {
    return value as DoubaoTTSVoice;
  }

  return DOUBAO_TTS_DEFAULT_VOICE;
}

/**
 * 豆包（火山方舟）语音合成配置
 */
export interface DoubaoTTSConfig {
  /** 火山方舟 API Key */
  api_key: string;

  /** 可选音色，留空时使用默认音色 */
  voice?: DoubaoTTSVoice;
}
```

3c. 在小米 TTS 常量区（`XIAOMI_TTS_MODEL` 附近）追加：

```ts
/**
 * 豆包（火山方舟）TTS 接口地址（HTTP 单向流式，一次性返回完整音频）
 */
export const DOUBAO_TTS_API_URL =
  "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional";

/** 豆包 TTS 资源 ID（seed-tts-2.0 = 豆包语音合成模型 2.0） */
export const DOUBAO_TTS_RESOURCE_ID = "seed-tts-2.0";
```

3d. `LingridConfig` 中 `xiaomi_tts` 字段附近追加：

```ts
  /** 豆包（火山方舟）TTS 配置（可选，不配置则回退浏览器 TTS） */
  doubao_tts?: DoubaoTTSConfig;
```

- [ ] **Step 4: types/index.ts 导出**

`from "./config"` 的**值导出块**（含 `XIAOMI_TTS_MODEL` 的那个 `export { ... }`）追加：

```ts
  DOUBAO_TTS_API_URL,
  DOUBAO_TTS_RESOURCE_ID,
  DOUBAO_TTS_VOICE_OPTIONS,
  DOUBAO_TTS_DEFAULT_VOICE,
  normalizeDoubaoTTSVoice,
```

**类型导出块**（`export type { ... }`）追加：

```ts
  DoubaoTTSConfig,
  DoubaoTTSVoice,
```

- [ ] **Step 5: configManager 透传 doubao_tts**

`src/background/configManager.ts` 的 `getConfig` 组装处（约 line 90 `xiaomi_tts: stored.xiaomi_tts || DEFAULT_CONFIG.xiaomi_tts,`）之后追加：

```ts
      doubao_tts: stored.doubao_tts || DEFAULT_CONFIG.doubao_tts,
```

- [ ] **Step 6: manifest 增加 host 权限**

`src/manifest.json` 的 `host_permissions` 数组中追加：

```json
    "https://openspeech.bytedance.com/*"
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts && bun run typecheck`
Expected: 新增 4 个测试 PASS；typecheck 无错误

- [ ] **Step 8: Commit**

```bash
git add apps/browser-extension/src/types/config.ts apps/browser-extension/src/types/config.test.ts apps/browser-extension/src/types/index.ts apps/browser-extension/src/background/configManager.ts apps/browser-extension/src/manifest.json
git commit -m "feat(browser-extension): 新增豆包 TTS 配置类型与 manifest 权限"
```

---

### Task 2: service worker 豆包合成

**Files:**
- Modify: `src/background/service-worker.ts`
- Modify: `src/corpus/corpus.ts`

- [ ] **Step 1: 常量与 provider 标签**

1a. `XIAOMI_TTS_TEST_TEXT`（约 line 152）之后追加：

```ts
const DOUBAO_TTS_TEST_TEXT = "Hello from Lingride.";
const DOUBAO_TTS_AUDIO_FORMAT = "mp3";
const DOUBAO_TTS_SAMPLE_RATE = 24000;
```

1b. `getTTSProviderLabel`（当前为 `return provider === "minimax" ? "MiniMax" : "小米";`）改为：

```ts
const TTS_PROVIDER_LABELS: Record<TTSProviderId, string> = {
  minimax: "MiniMax",
  xiaomi: "小米",
  doubao: "豆包",
};

function getTTSProviderLabel(provider: TTSProviderId): string {
  return TTS_PROVIDER_LABELS[provider];
}
```

1c. `isXiaomiTTSConfigured` 之后追加：

```ts
function isDoubaoTTSConfigured(config: LingridConfig): boolean {
  return !!config.doubao_tts?.api_key?.trim();
}
```

- [ ] **Step 2: 实现 requestDoubaoTTSAudio**

在 `requestXiaomiTTSAudio` 函数之后追加：

```ts
/** 逐块解码 base64 音频片段并拼接，再整体编码回 base64 */
function concatBase64Chunks(chunks: string[]): string {
  const parts = chunks.map((chunk) => {
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  });

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }

  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < merged.length; index += chunkSize) {
    binary += String.fromCharCode(...merged.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * 豆包（火山方舟）TTS：HTTP 单向流式接口，一次性发送文本，
 * JSONL 分块返回 base64 音频片段（code 0 = 成功）。
 */
async function requestDoubaoTTSAudio(
  context: TTSProviderRequestContext
): Promise<TTSAudioData> {
  const { config, text } = context;

  if (!isDoubaoTTSConfigured(config)) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const doubaoTTSConfig = config.doubao_tts;
  if (!doubaoTTSConfig) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_NOT_CONFIGURED",
    });
  }

  const apiKey = doubaoTTSConfig.api_key.trim();
  const requestBody = {
    req_params: {
      text,
      speaker: normalizeDoubaoTTSVoice(doubaoTTSConfig.voice),
      audio_params: {
        format: DOUBAO_TTS_AUDIO_FORMAT,
        sample_rate: DOUBAO_TTS_SAMPLE_RATE,
      },
    },
  };

  let response: globalThis.Response;

  try {
    response = await fetch(DOUBAO_TTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-Resource-Id": DOUBAO_TTS_RESOURCE_ID,
        "X-Api-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_NETWORK_ERROR",
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    const errorMessage = extractTTSErrorMessage(responseText);
    const classification = classifyTTSError(response.status, errorMessage);

    throw createTTSError({
      provider: "doubao",
      code: classification.code,
      hint: classification.hint,
      httpStatus: response.status,
      detail: errorMessage || responseText.trim() || undefined,
    });
  }

  // JSONL 分块解析：{"code":0,"message":"","data":"<base64>"}
  const audioChunks: string[] = [];
  for (const line of responseText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let chunk: { code?: number; message?: string; data?: string };
    try {
      chunk = JSON.parse(trimmed);
    } catch {
      throw createTTSError({
        provider: "doubao",
        code: "TTS_UNKNOWN_ERROR",
        detail: `豆包响应包含非 JSON 行：${trimmed.slice(0, 120)}`,
      });
    }

    if (chunk.code !== 0) {
      throw createTTSError({
        provider: "doubao",
        code: "TTS_UNKNOWN_ERROR",
        detail: chunk.message || `豆包合成失败（code=${chunk.code}）`,
      });
    }

    if (chunk.data) {
      audioChunks.push(chunk.data);
    }
  }

  if (audioChunks.length === 0) {
    throw createTTSError({
      provider: "doubao",
      code: "TTS_AUDIO_INVALID",
      detail: responseText.trim() || "豆包合成未返回音频数据",
    });
  }

  return {
    audioBase64: concatBase64Chunks(audioChunks),
    mimeType: "audio/mpeg",
    provider: "doubao",
  };
}
```

并在文件顶部 `from "../types"` import 块中追加：

```ts
  DOUBAO_TTS_API_URL,
  DOUBAO_TTS_RESOURCE_ID,
  normalizeDoubaoTTSVoice,
```

- [ ] **Step 3: requestTTSAudioByProvider 加分支**

将 `requestTTSAudioByProvider`（当前为 minimax/xiaomi 三元）改为：

```ts
async function requestTTSAudioByProvider(
  provider: TTSProviderId,
  context: TTSProviderRequestContext,
  progress?: TTSSynthesisProgressContext
): Promise<TTSAudioData> {
  if (provider === "minimax") {
    return requestMiniMaxTTSAudio(context, progress);
  }
  if (provider === "xiaomi") {
    return requestXiaomiTTSAudio(context);
  }
  return requestDoubaoTTSAudio(context);
}
```

- [ ] **Step 4: 测试连接文本选择改为映射**

`handleTestTTSConnection` 中（约 line 1774）：

```ts
    const text = provider === "minimax" ? MINIMAX_TTS_TEST_TEXT : XIAOMI_TTS_TEST_TEXT;
```

改为：

```ts
    const TTS_TEST_TEXTS: Record<TTSProviderId, string> = {
      minimax: MINIMAX_TTS_TEST_TEXT,
      xiaomi: XIAOMI_TTS_TEST_TEXT,
      doubao: DOUBAO_TTS_TEST_TEXT,
    };
    const text = TTS_TEST_TEXTS[provider];
```

- [ ] **Step 5: corpus.ts 识别 doubao**

`src/corpus/corpus.ts` 的 `applyAITTSConfig`（约 line 164-179）中，把：

```ts
  } else if (selection === "minimax" || selection === "xiaomi") {
```

改为：

```ts
  } else if (
    selection === "minimax" ||
    selection === "xiaomi" ||
    selection === "doubao"
  ) {
```

同时把向后兼容分支（检查 API Key 存在）中的判断改为包含 doubao：

```ts
    aiTTSEnabled = Boolean(
      config.minimax_tts?.api_key?.trim() ||
        config.xiaomi_tts?.api_key?.trim() ||
        config.doubao_tts?.api_key?.trim()
    );
```

- [ ] **Step 6: 类型检查 + lint + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bun run lint && bunx vitest run`
Expected: 无错误；lint 0 errors；全部测试 PASS

- [ ] **Step 7: Commit**

```bash
git add apps/browser-extension/src/background/service-worker.ts apps/browser-extension/src/corpus/corpus.ts
git commit -m "feat(browser-extension): service worker 新增豆包 TTS 合成（HTTP 单向流式）"
```

---

### Task 3: popup 豆包手风琴

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.ts`

- [ ] **Step 1: 提供者下拉新增豆包**

`src/popup/popup.html` 的 `ttsProviderSelect`（约 line 358-362）中，`<option value="xiaomi">小米</option>` 之后插入：

```html
                  <option value="doubao">豆包</option>
```

- [ ] **Step 2: 新增豆包手风琴 HTML**

在小米手风琴结束（`id="xiaomi-tts"` 的 accordion-body 所属 `accordion-item nested` 整体结束）之后，插入完整豆包手风琴：

```html
              <div class="accordion-item nested">
                <div class="accordion-header nested-header with-test" data-accordion="doubao-tts" data-nested="true" role="button" tabindex="0">
                  <div class="accordion-header-main">
                    <span>豆包</span>
                    <button
                      type="button"
                      id="testDoubaoTTSBtn"
                      class="service-test-btn is-disabled"
                      disabled
                      title="填写 API Key 后可测试"
                      aria-label="测试豆包语音合成服务"
                    ></button>
                  </div>
                  <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div id="doubaoTTSStatus" class="status-message service-test-status"></div>
                <div class="accordion-body nested-body" id="doubao-tts">
                  <div class="accordion-inner">
                    <div class="settings-row">
                      <label class="settings-label" for="doubaoTTSBaseUrl">端点</label>
                      <input
                        type="text"
                        id="doubaoTTSBaseUrl"
                        class="settings-input"
                        value="https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional"
                        readonly
                      >
                    </div>
                    <div class="settings-divider"></div>
                    <div class="settings-row">
                      <label class="settings-label" for="doubaoTTSApiKey">API Key</label>
                      <div class="password-input">
                        <input type="password" id="doubaoTTSApiKey" class="settings-input" placeholder="火山方舟 API Key">
                        <button type="button" id="showDoubaoTTSKeyBtn" class="show-key-btn">显示</button>
                      </div>
                    </div>
                    <div class="settings-divider"></div>
                    <div class="settings-row">
                      <label class="settings-label" for="doubaoTTSVoice">音色</label>
                      <select id="doubaoTTSVoice" class="settings-select">
                        <option value="en_female_allison_uranus_bigtts">Allison（美式女声，默认）</option>
                        <option value="en_female_brittney_pimintel_uranus_bigtts">Zoe（美式女声）</option>
                        <option value="en_male_alex_uranus_bigtts">Alex（美式男声）</option>
                        <option value="en_male_alberto_uranus_bigtts">Alberto（美式男声）</option>
                      </select>
                    </div>
                    <p class="settings-hint">
                      <a href="https://www.volcengine.com/docs/82379/2516286" target="_blank" rel="noopener">查看火山方舟语音模型接入文档 →</a>
                    </p>
                  </div>
                </div>
              </div>
```

- [ ] **Step 3: popup.ts DOM 引用**

在小米 DOM 引用区（`xiaomiTTSStatus` 之后）追加：

```ts
const doubaoTTSApiKeyInput = document.getElementById(
  "doubaoTTSApiKey"
) as HTMLInputElement;
const showDoubaoTTSKeyBtn = document.getElementById(
  "showDoubaoTTSKeyBtn"
) as HTMLButtonElement;
const doubaoTTSVoiceSelect = document.getElementById(
  "doubaoTTSVoice"
) as HTMLSelectElement;
const testDoubaoTTSBtn = document.getElementById(
  "testDoubaoTTSBtn"
) as HTMLButtonElement;
const doubaoTTSStatus = document.getElementById(
  "doubaoTTSStatus"
) as HTMLElement;
```

- [ ] **Step 4: popup.ts 状态变量与辅助函数**

4a. 状态变量区（`let isTestingXiaomiTTS = false;` 之后）追加：

```ts
let doubaoTTSResetTimer: number | null = null;
let isTestingDoubaoTTS = false;
```

4b. 小米辅助函数区（`clearXiaomiTTSResetTimer` 之后）追加：

```ts
function clearDoubaoTTSResetTimer(): void {
  clearServiceTestResetTimer(doubaoTTSResetTimer);
  doubaoTTSResetTimer = null;
}

function showDoubaoTTSStatus(
  message: string,
  type: "success" | "error" | "loading"
): void {
  showServiceTestStatus(doubaoTTSStatus, message, type);
}

function hideDoubaoTTSStatus(): void {
  hideServiceTestStatus(doubaoTTSStatus);
}

function setDoubaoTTSButtonState(
  state: ServiceTestState,
  disabled: boolean,
  title: string
): void {
  setServiceTestButtonState(testDoubaoTTSBtn, state, disabled, title);
}

function updateDoubaoTTSButtonAvailability(): void {
  clearDoubaoTTSResetTimer();
  if (isTestingDoubaoTTS) return;

  if (!doubaoTTSApiKeyInput.value.trim()) {
    setDoubaoTTSButtonState("idle", true, "填写 API Key 后可测试");
    return;
  }

  setDoubaoTTSButtonState("idle", false, "测试豆包语音合成服务");
}
```

（`hideServiceTestStatus`、`clearServiceTestResetTimer`、`setServiceTestButtonState`、`showServiceTestStatus` 均已存在，直接复用。）

4c. 错误文案函数（`getXiaomiTTSFailureReason` 之后）追加：

```ts
function getDoubaoTTSFailureReason(
  response: TestTTSConnectionResponse
): string {
  switch (response.errorCode) {
    case "TTS_NOT_CONFIGURED":
      return "请先填写 API Key";
    case "TTS_BAD_REQUEST":
      return appendTTSErrorDetail("请求参数不正确", response);
    case "TTS_AUTH_ERROR":
      return "API Key 无效或无权限";
    case "TTS_FORBIDDEN":
      return "当前地区不可用，或 API Key 被风控";
    case "TTS_CONTENT_BLOCKED":
      return "输入内容触发审核拦截";
    case "TTS_ENDPOINT_ERROR":
      return appendTTSErrorDetail("端点不可用", response);
    case "TTS_NETWORK_ERROR":
      return "网络异常或端点无法访问";
    case "TTS_RATE_LIMIT":
      return "请求过于频繁或额度受限";
    case "TTS_SERVER_ERROR":
      return "豆包服务内部异常";
    case "TTS_SERVER_BUSY":
      return "豆包服务负载过高，请稍后重试";
    case "TTS_AUDIO_INVALID":
      return appendTTSErrorDetail("服务返回了无效音频数据", response);
    default:
      return appendTTSErrorDetail("请求失败", response);
  }
}
```

4d. 事件 handler（`handleTestXiaomiTTS` 之后）追加：

```ts
function handleDoubaoTTSConfigInput(): void {
  isTestingDoubaoTTS = false;
  hideDoubaoTTSStatus();
  updateDoubaoTTSButtonAvailability();
}

async function handleDoubaoTTSVoiceChange(): Promise<void> {
  handleDoubaoTTSConfigInput();
  await autoSave();
}

async function handleTestDoubaoTTS(event: Event): Promise<void> {
  event.stopPropagation();

  if (testDoubaoTTSBtn.disabled || !doubaoTTSApiKeyInput.value.trim()) {
    return;
  }

  isTestingDoubaoTTS = true;
  setDoubaoTTSButtonState("loading", true, "测试中...");
  showDoubaoTTSStatus("正在测试豆包语音合成服务...", "loading");

  try {
    await autoSave();

    const response: TestTTSConnectionResponse = await chrome.runtime.sendMessage({
      type: MessageType.TEST_TTS_CONNECTION,
      payload: { provider: "doubao" },
    });

    if (response.success) {
      showDoubaoTTSStatus("连接成功", "success");
      setDoubaoTTSButtonState("success", true, "测试成功");
    } else {
      const failureReason = getDoubaoTTSFailureReason(response);
      showDoubaoTTSStatus(`连接失败：${failureReason}`, "error");
      setDoubaoTTSButtonState("error", true, `连接失败：${failureReason}`);
    }
  } catch {
    showDoubaoTTSStatus("连接失败：测试请求发送失败", "error");
    setDoubaoTTSButtonState("error", true, "连接失败：测试请求发送失败");
  } finally {
    clearDoubaoTTSResetTimer();
    doubaoTTSResetTimer = window.setTimeout(() => {
      isTestingDoubaoTTS = false;
      hideDoubaoTTSStatus();
      updateDoubaoTTSButtonAvailability();
    }, 5000);
  }
}
```

- [ ] **Step 5: 事件绑定**

在小米绑定区（`testXiaomiTTSBtn.addEventListener(...)` 之后）追加：

```ts
  // Settings - 豆包 TTS 配置自动保存
  doubaoTTSApiKeyInput.addEventListener("input", handleDoubaoTTSConfigInput);
  doubaoTTSApiKeyInput.addEventListener("blur", autoSave);
  doubaoTTSVoiceSelect.addEventListener("change", handleDoubaoTTSVoiceChange);

  // Settings - 显示/隐藏豆包 API Key
  showDoubaoTTSKeyBtn.addEventListener("click", () => {
    const isPassword = doubaoTTSApiKeyInput.type === "password";
    doubaoTTSApiKeyInput.type = isPassword ? "text" : "password";
    showDoubaoTTSKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  // Settings - 测试豆包 TTS 连接
  testDoubaoTTSBtn.addEventListener("click", handleTestDoubaoTTS);
```

- [ ] **Step 6: collectConfig 与 updateSettingsForm**

6a. `collectConfig` 中小米段之后追加：

```ts
  // 豆包 TTS 配置（API Key 为空视为禁用）
  const doubaoTTSApiKey = doubaoTTSApiKeyInput.value.trim();
  const doubaoTTSVoice = normalizeDoubaoTTSVoice(doubaoTTSVoiceSelect.value);
  const hasCustomDoubaoVoice = doubaoTTSVoice !== DOUBAO_TTS_DEFAULT_VOICE;

  if (doubaoTTSApiKey || hasCustomDoubaoVoice) {
    currentConfig.doubao_tts = {
      api_key: doubaoTTSApiKey,
      ...(hasCustomDoubaoVoice ? { voice: doubaoTTSVoice } : {}),
    };
  } else {
    delete currentConfig.doubao_tts;
  }
```

6b. `updateSettingsForm` 中小米回填（`xiaomiTTSVoiceSelect.value = ...` 之后）追加：

```ts
  doubaoTTSApiKeyInput.value = currentConfig.doubao_tts?.api_key || "";
  doubaoTTSVoiceSelect.value = normalizeDoubaoTTSVoice(
    currentConfig.doubao_tts?.voice
  );
```

6c. `updateSettingsForm` 开头状态重置区（`isTestingXiaomiTTS = false;` 附近）追加：

```ts
  isTestingDoubaoTTS = false;
  clearDoubaoTTSResetTimer();
  hideDoubaoTTSStatus();
```

并在该函数尾部调用 `updateXiaomiTTSButtonAvailability()` 之后追加：

```ts
  updateDoubaoTTSButtonAvailability();
```

- [ ] **Step 7: import 补充**

popup.ts 顶部 `from "../types"` import 块中追加：

```ts
  DOUBAO_TTS_DEFAULT_VOICE,
  normalizeDoubaoTTSVoice,
```

- [ ] **Step 8: 类型检查 + lint + 构建 + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bun run lint && bun run build && bunx vitest run`
Expected: 无错误；lint 0 errors；构建成功；全部测试 PASS

- [ ] **Step 9: Commit**

```bash
git add apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts
git commit -m "feat(browser-extension): 设置页新增豆包 TTS 手风琴（API Key/音色/测试连接）"
```

---

### Task 4: 真实 key 实测 + 人工验证

- [ ] **Step 1: curl 实测 4 个音色**

用用户提供的方舟 API key（会话中已提供）：

```bash
for voice in en_female_allison_uranus_bigtts en_female_brittney_pimintel_uranus_bigtts en_male_alex_uranus_bigtts en_male_alberto_uranus_bigtts; do
  curl -s -X POST "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional" \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: $ARK_API_KEY" \
    -H "X-Api-Resource-Id: seed-tts-2.0" \
    -H "X-Api-Request-Id: $(uuidgen)" \
    -d "{\"req_params\":{\"text\":\"Hello from Lingride.\",\"speaker\":\"$voice\",\"audio_params\":{\"format\":\"mp3\",\"sample_rate\":24000}}}" \
    | head -c 60
  echo "  <- $voice"
done
```

Expected: 每个音色首行都是 `{"code":0,...`

- [ ] **Step 2: 端到端验证 JSONL 解析逻辑（离线）**

Run: `cd apps/browser-extension && bun run typecheck && bunx vitest run && bun run build`
Expected: 全绿

- [ ] **Step 3: 人工验证**

`dist/` 加载到 Chrome：设置页选"豆包"→ 填 key → 测试连接成功；语料库听力训练选豆包播放正常；切换音色生效。

- [ ] **Step 4: 最终 Commit（如有修复）**

```bash
git add -A apps/browser-extension
git commit -m "fix(browser-extension): 人工验证发现的问题修复"
```
