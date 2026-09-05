# 语音识别服务手动选择 Provider 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 语音识别服务支持手动选择 provider（豆包/腾讯云/阿里云/浏览器识别），与语音合成服务的选择体验对齐；识别失败直接报错，不再自动降级。

**Architecture:** `LingridConfig` 新增 `asr_selection` 字段；三个 `isXxxASRConfigured` 判定函数下沉到 `src/types/config.ts` 并新增纯函数 `resolveASRSelection`（显式选择优先，否则按已配置者迁移默认）；`tutor.ts` 的 `createRecognizer` 从优先级链改为显式分派并删除降级包装；设置页 ASR 区块顶部加下拉选择。

**Tech Stack:** TypeScript、Chrome Extension MV3、vitest（`bunx vitest run`）

**Spec:** `docs/superpowers/specs/2026-09-06-asr-provider-selection-design.md`

**工作目录：** 所有相对路径基于 `apps/browser-extension/`。git 命令在仓库根 `/Users/knox/Documents/GitWorkSpace/Linguride` 执行。

---

### Task 1: 类型与判定函数下沉（config.ts）

**Files:**
- Modify: `src/types/config.ts`（ASR 配置类型区约 157-197 行；`LingridConfig` 约 440-447 行）
- Modify: `src/types/index.ts`
- Test: `src/types/config.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/types/config.test.ts` 末尾追加：

```ts
import {
  resolveASRSelection,
  isDoubaoASRConfigured,
  isTencentASRConfigured,
  isAlibabaASRConfigured,
} from "./config";
// 注意：合并进文件顶部现有 import 块，不要重复 import 语句

describe("resolveASRSelection", () => {
  it("passes through explicit selection", () => {
    expect(
      resolveASRSelection({ asr_selection: "browser", doubao_asr: { api_key: "k" } } as never)
    ).toBe("browser");
  });

  it("prefers doubao when nothing explicit and doubao configured", () => {
    expect(
      resolveASRSelection({ doubao_asr: { api_key: "k" } } as never)
    ).toBe("doubao");
  });

  it("falls to tencent when only tencent configured", () => {
    expect(
      resolveASRSelection({
        tencent_asr: { app_id: "a", secret_id: "s", secret_key: "k" },
      } as never)
    ).toBe("tencent");
  });

  it("falls to alibaba when only alibaba configured", () => {
    expect(
      resolveASRSelection({ alibaba_asr: { api_key: "k" } } as never)
    ).toBe("alibaba");
  });

  it("falls back to browser when nothing configured", () => {
    expect(resolveASRSelection({} as never)).toBe("browser");
  });
});

describe("isXxxASRConfigured", () => {
  it("doubao requires non-empty trimmed api_key", () => {
    expect(isDoubaoASRConfigured({} as never)).toBe(false);
    expect(isDoubaoASRConfigured({ doubao_asr: { api_key: "  " } } as never)).toBe(false);
    expect(isDoubaoASRConfigured({ doubao_asr: { api_key: "k" } } as never)).toBe(true);
  });

  it("tencent requires all three fields", () => {
    expect(
      isTencentASRConfigured({ tencent_asr: { app_id: "a", secret_id: "", secret_key: "k" } } as never)
    ).toBe(false);
    expect(
      isTencentASRConfigured({ tencent_asr: { app_id: "a", secret_id: "s", secret_key: "k" } } as never)
    ).toBe(true);
  });

  it("alibaba requires api_key", () => {
    expect(isAlibabaASRConfigured({} as never)).toBe(false);
    expect(isAlibabaASRConfigured({ alibaba_asr: { api_key: "k" } } as never)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: FAIL（`resolveASRSelection is not a function` 或导入错误）

- [ ] **Step 3: 实现类型与函数**

在 `src/types/config.ts` 中，紧跟 `DoubaoASRConfig` 接口（约 190 行）之后插入：

```ts
/**
 * 语音识别服务标识
 */
export type ASRProviderId = "doubao" | "tencent" | "alibaba";

/**
 * 语音识别服务选择模式
 *
 * 用户手动选择的语音识别服务；browser 表示浏览器内置 Web Speech API。
 * 识别失败直接报错，不自动切换。
 */
export type ASRSelectionMode = ASRProviderId | "browser";

/** 豆包 ASR 是否已配置（API Key 非空） */
export function isDoubaoASRConfigured(config: LingridConfig): boolean {
  return !!config.doubao_asr?.api_key?.trim();
}

/** 腾讯云 ASR 是否已配置（AppID/SecretID/SecretKey 齐全） */
export function isTencentASRConfigured(config: LingridConfig): boolean {
  return !!(
    config.tencent_asr?.app_id &&
    config.tencent_asr?.secret_id &&
    config.tencent_asr?.secret_key
  );
}

/** 阿里云 ASR 是否已配置（API Key 非空） */
export function isAlibabaASRConfigured(config: LingridConfig): boolean {
  return !!config.alibaba_asr?.api_key;
}

/**
 * 解析当前生效的语音识别服务选择。
 *
 * 1. 用户显式选择优先；
 * 2. 老配置无 asr_selection 字段时，按 豆包 > 腾讯 > 阿里 取第一个已配置的；
 * 3. 全未配置回退浏览器识别。
 */
export function resolveASRSelection(config: LingridConfig): ASRSelectionMode {
  if (config.asr_selection) return config.asr_selection;
  if (isDoubaoASRConfigured(config)) return "doubao";
  if (isTencentASRConfigured(config)) return "tencent";
  if (isAlibabaASRConfigured(config)) return "alibaba";
  return "browser";
}
```

在 `LingridConfig` 接口的 `doubao_asr?: DoubaoASRConfig;`（约 447 行）之后插入：

```ts
  /** 语音识别服务选择（用户手动选择，识别失败直接报错；缺省按已配置者迁移） */
  asr_selection?: ASRSelectionMode;
```

同时更新三处过时注释（可选但推荐，保持文档一致）：
- `AlibabaASRConfig` 注释中的 `优先级：腾讯云 ASR > 阿里云 ASR > Web Speech API` 删除该行
- `DoubaoASRConfig` 注释中 `配置后优先级最高：豆包 > 腾讯云 > 阿里云 > Web Speech API。` 改为 `可在设置页「语音识别服务」中手动选择启用。`
- `LingridConfig.tencent_asr` 注释 `不配置则使用 Web Speech API` 改为 `不配置则不可手动选择`
- `LingridConfig.alibaba_asr` 注释 `优先级低于腾讯云 ASR` 删除该说法
- `LingridConfig.doubao_asr` 注释 `配置后优先级最高` 删除该说法

在 `src/types/index.ts` 的 `export { ... } from "./config"` 块中加入 `resolveASRSelection, isDoubaoASRConfigured, isTencentASRConfigured, isAlibabaASRConfigured`，在 `export type { ... }` 块中加入 `ASRProviderId, ASRSelectionMode`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: PASS（含既有用例全部通过）

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/types/config.ts apps/browser-extension/src/types/config.test.ts apps/browser-extension/src/types/index.ts
git commit -m "feat(browser-extension): ASR 选择类型与 resolveASRSelection 解析函数

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 识别器模块改为 re-export

**Files:**
- Modify: `src/tutor/doubaoASRRecognizer.ts:27-29`
- Modify: `src/tutor/tencentASRRecognizer.ts:435-442`
- Modify: `src/tutor/alibabaASRRecognizer.ts:443-447`

- [ ] **Step 1: 豆包识别器改为 re-export**

`src/tutor/doubaoASRRecognizer.ts`：删除 `isDoubaoASRConfigured` 函数体（27-29 行），在文件顶部 import 块中从 `../types` 导入处改为 re-export。文件已有 `import { ... LingridConfig ... } from "../types"`；在 import 语句之后加：

```ts
export { isDoubaoASRConfigured } from "../types";
```

若 `LingridConfig` 类型在该文件中不再被使用，从 import 中移除（以 typecheck 为准）。

- [ ] **Step 2: 腾讯识别器改为 re-export**

`src/tutor/tencentASRRecognizer.ts`：删除 435-442 行的 `isTencentASRConfigured` 定义，在 import 区后加：

```ts
export { isTencentASRConfigured } from "../types";
```

注意原签名是结构化的 `config: { tencent_asr?: {...} }`，新签名是 `LingridConfig`——`LingridConfig` 是该结构超集，所有调用方传的都是完整 config，typecheck 会验证。

- [ ] **Step 3: 阿里识别器改为 re-export**

`src/tutor/alibabaASRRecognizer.ts`：删除 443-447 行的 `isAlibabaASRConfigured` 定义，在 import 区后加：

```ts
export { isAlibabaASRConfigured } from "../types";
```

- [ ] **Step 4: typecheck + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bunx vitest run`
Expected: typecheck 0 错误；全部测试 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/tutor/doubaoASRRecognizer.ts apps/browser-extension/src/tutor/tencentASRRecognizer.ts apps/browser-extension/src/tutor/alibabaASRRecognizer.ts
git commit -m "refactor(browser-extension): ASR 判定函数下沉到 config.ts，识别器模块 re-export

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: tutor.ts createRecognizer 显式分派

**Files:**
- Modify: `src/tutor/tutor.ts:712-768`（createRecognizer）、`1500-1504`（发音评估调用点）、`1839-1846`（影子跟读调用点）

- [ ] **Step 1: 替换 createRecognizer 实现**

将 `tutor.ts` 712-768 行整个 `createRecognizer` 函数（含上文注释块）替换为：

```ts
/**
 * 根据用户在设置页选择的语音识别服务创建识别器。
 *
 * 选择云端服务但未配置时抛出明确错误；识别失败不再自动降级。
 */
function createRecognizer(): ISpeechRecognizer {
  const selection = resolveASRSelection(userConfig ?? DEFAULT_CONFIG);

  switch (selection) {
    case "doubao":
      if (!isDoubaoASRConfigured(userConfig ?? DEFAULT_CONFIG)) {
        throw new Error("豆包识别未配置 API Key，请到设置页配置或切换识别服务");
      }
      console.log("[Lingride Tutor] 使用豆包 ASR 识别器");
      return new DoubaoASRRecognizer();
    case "tencent":
      if (!isTencentASRConfigured(userConfig ?? DEFAULT_CONFIG)) {
        throw new Error("腾讯云识别未配置密钥，请到设置页配置或切换识别服务");
      }
      console.log("[Lingride Tutor] 使用腾讯云 ASR 识别器");
      return new TencentASRRecognizer();
    case "alibaba":
      if (!isAlibabaASRConfigured(userConfig ?? DEFAULT_CONFIG)) {
        throw new Error("阿里云识别未配置 API Key，请到设置页配置或切换识别服务");
      }
      console.log("[Lingride Tutor] 使用阿里云 ASR 识别器");
      return new AlibabaASRRecognizer();
    case "browser":
      console.log("[Lingride Tutor] 使用 Web Speech API 识别器");
      return new WebSpeechRecognizer();
  }
}

/**
 * 创建一个 start() 即拒绝的 stub 识别器。
 *
 * 用于影子跟读初始化时配置缺失的场景：页面初始化不能因配置问题中断，
 * 错误延迟到用户点击录音时暴露。
 * （ISpeechRecognizer 定义见 src/types/pronunciationAssessment.ts：
 *  start(): Promise<void>、stop(): Promise<string>、isRecognizing(): boolean，
 *  回调 onInterimResult/onError 为可选属性，stub 无需声明。）
 */
function createFailedRecognizer(message: string): ISpeechRecognizer {
  return {
    async start(): Promise<void> {
      throw new Error(message);
    },
    async stop(): Promise<string> {
      return "";
    },
    isRecognizing(): boolean {
      return false;
    },
  };
}
```

在文件顶部 import 中：从 `../types` 加入 `resolveASRSelection`；`isDoubaoASRConfigured`/`isTencentASRConfigured`/`isAlibabaASRConfigured` 维持从各 recognizer 模块导入（它们已 re-export，无需改 import 来源）。

- [ ] **Step 2: 简化发音评估调用点（约 1500 行）**

将：

```ts
    recognizer = createRecognizer({
      onFallback: (reason) => {
        showStatus(pronunciationStatus, reason, "warning");
      },
    });
```

改为：

```ts
    recognizer = createRecognizer();
```

（该调用点在 `startRecording` 的 try 块内，`createRecognizer` 抛出的配置错误会被 1535 行的 catch 捕获并红字显示，行为正确。）

同时更新 1499 行注释 `// 初始化识别器（根据配置选择腾讯云或 Web Speech API）` 为 `// 初始化识别器（按设置页选择的服务）`。

- [ ] **Step 3: 影子跟读调用点加兜底（约 1839-1846 行）**

将：

```ts
  // 创建并注入语音识别器（根据配置选择腾讯云或 Web Speech API）
  const shadowRecognizer = createRecognizer({
    onFallback: (reason) => {
      // 显示降级提示
      showStatus(shadowStatus, reason, "warning");
    },
  });
  shadow.injectRecognizer(shadowRecognizer);
```

改为：

```ts
  // 创建并注入语音识别器（按设置页选择的服务；配置缺失时延迟到录音时报错）
  let shadowRecognizer: ISpeechRecognizer;
  try {
    shadowRecognizer = createRecognizer();
  } catch (error) {
    const message = error instanceof Error ? error.message : "语音识别服务未配置";
    shadowRecognizer = createFailedRecognizer(message);
  }
  shadow.injectRecognizer(shadowRecognizer);
```

- [ ] **Step 4: typecheck + lint + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bunx eslint src/tutor/tutor.ts && bunx vitest run`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/tutor/tutor.ts
git commit -m "feat(browser-extension): 语音识别按设置页选择显式分派，移除自动降级

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 设置页 UI（popup.html + popup.ts）

**Files:**
- Modify: `src/popup/popup.html:272-364`（语音识别服务区块）
- Modify: `src/popup/popup.ts`（元素声明约 408 行、事件绑定约 1217 行、保存约 1831 行、加载约 1929 行）

- [ ] **Step 1: HTML 加选择行与提示元素**

`src/popup/popup.html`：将 283 行：

```html
              <p class="settings-desc nested-desc">配置云端 ASR 可提高影子跟读的语音识别准确率。优先级：豆包 → 腾讯云 → 阿里云 → 浏览器内置。</p>
```

替换为：

```html
              <p class="settings-desc nested-desc">选择语音识别服务。识别失败将直接报错，不会自动切换。</p>
              <div class="settings-row">
                <label class="settings-label label-muted" for="asrProviderSelect">优先</label>
                <select id="asrProviderSelect" class="settings-select">
                  <option value="doubao">豆包</option>
                  <option value="tencent">腾讯云</option>
                  <option value="alibaba">阿里云</option>
                  <option value="browser">浏览器识别</option>
                </select>
              </div>
              <p id="asrProviderHint" class="settings-hint" style="display:none;color:#b45309;"></p>
```

同时将 343 行豆包手风琴标题 `<span>豆包（优先级最高）</span>` 改为 `<span>豆包</span>`（优先级概念已移除）。

- [ ] **Step 2: popup.ts 元素声明与事件**

`src/popup/popup.ts`：

a) 在 `ttsProviderSelect` 声明（约 408-410 行）之后加：

```ts
const asrProviderSelect = document.getElementById(
  "asrProviderSelect"
) as HTMLSelectElement;
const asrProviderHint = document.getElementById(
  "asrProviderHint"
) as HTMLParagraphElement;
```

b) 在 `ttsProviderSelect.addEventListener("change", ...)`（约 1217-1219 行）之后加：

```ts
  // Settings - ASR 提供者选择
  asrProviderSelect.addEventListener("change", async () => {
    await autoSave();
    updateASRProviderHint();
  });
```

c) 在文件顶部 `../types` import 块中加入 `ASRSelectionMode, resolveASRSelection, isDoubaoASRConfigured, isTencentASRConfigured, isAlibabaASRConfigured`。

- [ ] **Step 3: 保存与加载逻辑**

a) 保存：在 `currentConfig.tts_selection = ...`（约 1831 行）之后加：

```ts
  // ASR 提供者选择
  currentConfig.asr_selection = asrProviderSelect.value as ASRSelectionMode;
```

b) 加载：在 `ttsProviderSelect.value = currentConfig.tts_selection || "browser";`（约 1929 行）之后加：

```ts
  // ASR 提供者选择（老配置无字段时按已配置者迁移默认）
  asrProviderSelect.value = resolveASRSelection(currentConfig);
  updateASRProviderHint();
```

c) 新增提示函数（放在 `updateSettingsForm` 定义之后即可）：

```ts
/**
 * 选中云端 ASR 但未配置密钥时，在下拉下方显示黄色提示。
 */
function updateASRProviderHint(): void {
  const selection = asrProviderSelect.value as ASRSelectionMode;
  const labels: Record<string, string> = {
    doubao: "豆包",
    tencent: "腾讯云",
    alibaba: "阿里云",
  };
  const configuredCheckers: Record<string, (c: LingridConfig) => boolean> = {
    doubao: isDoubaoASRConfigured,
    tencent: isTencentASRConfigured,
    alibaba: isAlibabaASRConfigured,
  };

  const label = labels[selection];
  const checker = configuredCheckers[selection];
  if (label && checker && !checker(currentConfig)) {
    asrProviderHint.textContent = `尚未配置${label}的 API 密钥，当前选择不会生效`;
    asrProviderHint.style.display = "block";
  } else {
    asrProviderHint.style.display = "none";
  }
}
```

注意：`currentConfig` 是模块级变量（保存时已同步），`autoSave` 先于 `updateASRProviderHint` 执行，提示反映的是保存后的配置。ASR key 输入框 blur 时也会触发 `autoSave`（既有绑定），为让填完 key 后提示即时消失，把 1133-1135 与 1145、1148 行共 5 处 `addEventListener("blur", autoSave)`（tencentAppIdInput / tencentSecretIdInput / tencentSecretKeyInput / alibabaApiKeyInput / doubaoAsrApiKeyInput）逐行改为：

```ts
tencentAppIdInput.addEventListener("blur", () => {
  void autoSave().then(updateASRProviderHint);
});
tencentSecretIdInput.addEventListener("blur", () => {
  void autoSave().then(updateASRProviderHint);
});
tencentSecretKeyInput.addEventListener("blur", () => {
  void autoSave().then(updateASRProviderHint);
});
alibabaApiKeyInput.addEventListener("blur", () => {
  void autoSave().then(updateASRProviderHint);
});
doubaoAsrApiKeyInput.addEventListener("blur", () => {
  void autoSave().then(updateASRProviderHint);
});
```

- [ ] **Step 4: typecheck + lint**

Run: `cd apps/browser-extension && bun run typecheck && bunx eslint src/popup/popup.ts`
Expected: 0 错误

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts
git commit -m "feat(browser-extension): 设置页语音识别服务支持手动选择 provider

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 全量验证与手动测试

**Files:** 无（验证任务）

- [ ] **Step 1: CI gate 全绿**

Run: `cd apps/browser-extension && bun run typecheck && bunx eslint src && bunx vitest run`
Expected: typecheck 0 错误、lint 0 错误、全部测试 PASS

- [ ] **Step 2: 打包扩展**

Run: `cd apps/browser-extension && bun run build`（以 package.json 实际脚本为准）
Expected: 构建成功

- [ ] **Step 3: 手动验证清单（用户在 Chrome 中执行）**

1. 设置页 → 语音识别服务：顶部出现「优先」下拉，默认选中豆包（因已配置豆包 key）
2. 切换到「阿里云」（未配置）→ 下拉下方出现黄色提示「尚未配置阿里云的 API 密钥」
3. tutor 页录音 → 红字报错「阿里云识别未配置 API Key…」，**不**自动切浏览器
4. 切回「豆包」→ 录音识别正常（console 日志「使用豆包 ASR 识别器」）
5. 切到「浏览器识别」→ 录音走 Web Speech API
6. 影子跟读模式重复 3-5 验证 stub 兜底不破坏页面初始化

- [ ] **Step 4: 用户确认后 push**

```bash
git pull --rebase && git push origin main
```
