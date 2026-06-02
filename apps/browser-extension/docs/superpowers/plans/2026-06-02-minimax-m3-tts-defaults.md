# MiniMax-M3 默认模型 + TTS speech-2.8-turbo 默认值 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Lingride 扩展中 MiniMax AI 服务的默认文本模型从 `MiniMax-M2.7` 升级为 `MiniMax-M3`,把 MiniMax TTS 默认从 `speech-2.8-hd` 改为 `speech-2.8-turbo`,并把 TTS 列表缩减为仅 2.8 系列;同时为现有用户做一次性内存迁移。

**Architecture:** 沿用现有『常量驱动默认值 → 用户配置优先 → 一次性内存迁移』架构。在 `configManager.getConfig()` 中加 `migrateLegacyConfig` 步骤,在 `config.ts` 中收窄 `MiniMaxTTSModel` 联合类型并新增迁移锚点常量。改动局限在 7 个文件,分 8 个任务,每个任务独立提交。

**Tech Stack:** TypeScript, Chrome Extension Manifest V3, Vitest, Vite, Tauri(无影响)

**Spec:** `docs/superpowers/specs/2026-06-02-minimax-m3-tts-defaults-design.md`

---

## 文件结构(本计划涉及)

### 修改的文件

| 路径 | 职责 |
|---|---|
| `apps/browser-extension/src/types/config.ts` | 公开的常量、类型、配置联合类型 |
| `apps/browser-extension/src/popup/aiServiceOptions.ts` | 模型下拉选项、默认值、DeepSeek 列表缓存(本计划只动 MINIMAX 部分) |
| `apps/browser-extension/src/popup/aiServiceOptions.test.ts` | 现有 Vitest 单元测试 |
| `apps/browser-extension/src/popup/popup.html` | 设置页 UI(TTS `<select>`) |
| `apps/browser-extension/src/popup/popup.ts` | popup 逻辑(MINIMAX_TTS_MODEL_OPTIONS 数组) |
| `apps/browser-extension/src/background/service-worker.ts` | service worker(MINIMAX_TTS_MODEL_OPTIONS 数组) |
| `apps/browser-extension/src/background/configManager.ts` | chrome.storage 读写 + 迁移逻辑 |

### 不修改的文件

- `apps/browser-extension/src/providers/MiniMaxProvider.ts` — 模型名通过 config 透传
- `apps/browser-extension/src/providers/MiniMaxProvider.test.ts` — 用 `MiniMax-M1` 历史值,与本次无关
- 其他 popup.ts、service-worker.ts 内的具体逻辑 — 数组常量同步即可

---

## 任务列表

- [ ] **Task 1**: 更新 `config.ts` 中的常量与联合类型
- [ ] **Task 2**: 更新 `aiServiceOptions.ts` 的 `MINIMAX_MODEL_OPTIONS`
- [ ] **Task 3**: 更新 `aiServiceOptions.test.ts` 的快照
- [ ] **Task 4**: 运行 vitest 验证 Task 2 + Task 3
- [ ] **Task 5**: 同步 `popup.ts` 的 `MINIMAX_TTS_MODEL_OPTIONS`
- [ ] **Task 6**: 同步 `service-worker.ts` 的 `MINIMAX_TTS_MODEL_OPTIONS`
- [ ] **Task 7**: 更新 `popup.html` 的 TTS `<select>` 选项
- [ ] **Task 8**: 在 `configManager.ts` 中加迁移逻辑
- [ ] **Task 9**: 跑构建 + typecheck 验证全局
- [ ] **Task 10**: 手动验证(Chrome unpacked dist)

---

## Task 1: 更新 `config.ts` 中的常量与联合类型

> **修订说明** (2026-06-02): 经子 agent 实查,`MINIMAX_DEFAULT_MODEL` 实际在 `popup/aiServiceOptions.ts:15` 而**非** `types/config.ts`。本任务只动 `types/config.ts`;`MINIMAX_DEFAULT_MODEL` 字符串值的更新在 Task 2 完成。本任务新增的 `MINIMAX_LEGACY_DEFAULT_MODEL` 放在 `types/config.ts` 供 Task 8 的 `configManager` 从 `"../types"` import。

**Files:**
- Modify: `apps/browser-extension/src/types/config.ts`(在 `MiniMaxTTSModel` 联合类型附近,`MINIMAX_TTS_DEFAULT_MODEL` 常量附近)

- [ ] **Step 1: 收窄 `MiniMaxTTSModel` 联合类型**

打开 `apps/browser-extension/src/types/config.ts`,找到:

在同一文件中,找到:

```typescript
export type MiniMaxTTSModel =
  | "speech-2.8-hd"
  | "speech-2.8-turbo"
  | "speech-2.6-hd"
  | "speech-2.6-turbo"
  | "speech-02-hd"
  | "speech-02-turbo";
```

替换为:

```typescript
export type MiniMaxTTSModel =
  | "speech-2.8-hd"
  | "speech-2.8-turbo";

/**
 * 已被收窄的 TTS 模型 ID。仅供 configManager 在内存迁移中以
 * string[] 形式比对,运行时 stored 中可能仍含这些历史值。
 */
export const MINIMAX_TTS_REMOVED_MODELS: readonly string[] = [
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
] as const;
```

> 说明: 联合类型收窄到 2 个,数组用 `readonly string[]` 以接受 `as const` 推导的字面量数组。

- [ ] **Step 3: 调整 `MINIMAX_TTS_DEFAULT_MODEL` 与新增 legacy 常量**

在同一文件中,找到:

```typescript
export const MINIMAX_TTS_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-hd";
```

替换为:

```typescript
export const MINIMAX_TTS_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-turbo";

/**
 * 旧 TTS 默认模型,仅用于 configManager 中的一次性迁移识别。
 */
export const MINIMAX_TTS_LEGACY_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-hd";
```

- [ ] **Step 4: 新增 `MINIMAX_LEGACY_DEFAULT_MODEL` 迁移锚点常量**

在 `MINIMAX_TTS_LEGACY_DEFAULT_MODEL` 之后,新增:

```typescript
/**
 * 旧默认 AI 模型,仅用于 configManager 中的一次性迁移识别。
 * 新用户不会看到此值。
 */
export const MINIMAX_LEGACY_DEFAULT_MODEL = "MiniMax-M2.7";
```

> 注: 当前默认 `MINIMAX_DEFAULT_MODEL` 字符串字面量在 `popup/aiServiceOptions.ts` 中(将在 Task 2 更新为 `"MiniMax-M3"`)。

- [ ] **Step 5: 验证 import 顺序(通常不需要手动调整)**

TypeScript 会自动按使用顺序或文件原始顺序排列 import。本任务只动常量/类型,不动 import 路径。

- [ ] **Step 6: 跑 typecheck 看是否有类型错误**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride && npm run typecheck:browser-extension 2>&1 | tail -30`

Expected: 出现 `MiniMaxTTSModel` 类型收窄相关的下游错误(因为 `MINIMAX_TTS_MODEL_OPTIONS` 数组在 popup.ts/service-worker.ts 中还引用了被移除的字面量)。这是预期的,会在 Task 5/6 修复。

如果出现 `MINIMAX_LEGACY_DEFAULT_MODEL`、`MINIMAX_TTS_LEGACY_DEFAULT_MODEL`、`MINIMAX_TTS_REMOVED_MODELS` 未被使用导致的"declared but never used"或类似 lint 错误,这是预期的,Task 8 会用到。

如果出现其他意外错误,停下来排查。

- [ ] **Step 7: 提交**

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
git add apps/browser-extension/src/types/config.ts
git commit -m "refactor(browser-extension): MiniMax-M3 + speech-2.8-turbo 默认值与 TTS 联合类型收窄"
```

---

## Task 2: 更新 `aiServiceOptions.ts` 的 `MINIMAX_DEFAULT_MODEL` 与 `MINIMAX_MODEL_OPTIONS`

**Files:**
- Modify: `apps/browser-extension/src/popup/aiServiceOptions.ts:15`(在 `MINIMAX_DEFAULT_MODEL`)、`:39-48`(在 `MINIMAX_MODEL_OPTIONS`)

- [ ] **Step 1: 更新 `MINIMAX_DEFAULT_MODEL` 字面量**

打开 `apps/browser-extension/src/popup/aiServiceOptions.ts`,找到:

```typescript
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M2.7";
```

替换为:

```typescript
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M3";
```

- [ ] **Step 2: 在 `MINIMAX_MODEL_OPTIONS` 数组头部插入 M3**

在同一文件中,找到:

```typescript
export const MINIMAX_MODEL_OPTIONS: ModelOption[] = [
  { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
  { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
  { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
  { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
  { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
  { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
  { value: "MiniMax-M2", label: "MiniMax-M2" },
  { value: "custom", label: "自定义..." },
];
```

替换为:

```typescript
export const MINIMAX_MODEL_OPTIONS: ModelOption[] = [
  { value: "MiniMax-M3", label: "MiniMax-M3" },
  { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
  { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
  { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
  { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
  { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
  { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
  { value: "MiniMax-M2", label: "MiniMax-M2" },
  { value: "custom", label: "自定义..." },
];
```

> 说明: 其他模型(包括 M2.7)保留,只新增 M3 在头部。这样用户下拉时第一眼看到新模型,但仍可手动切回老模型。

- [ ] **Step 3: 提交(暂不提交,等 Task 3 一起)**

继续 Task 3。

---

## Task 3: 更新 `aiServiceOptions.test.ts` 的快照

**Files:**
- Modify: `apps/browser-extension/src/popup/aiServiceOptions.test.ts:24-33`

- [ ] **Step 1: 在快照期望值头部插入 M3**

打开 `apps/browser-extension/src/popup/aiServiceOptions.test.ts`,找到 `it("exposes the minimax preset endpoint and model list", ...)` 块中的:

```typescript
    expect(MINIMAX_MODEL_OPTIONS).toEqual([
      { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
      { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
      { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
      { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
      { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
      { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
      { value: "MiniMax-M2", label: "MiniMax-M2" },
      { value: "custom", label: "自定义..." },
    ]);
```

替换为:

```typescript
    expect(MINIMAX_MODEL_OPTIONS).toEqual([
      { value: "MiniMax-M3", label: "MiniMax-M3" },
      { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
      { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
      { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
      { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
      { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
      { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
      { value: "MiniMax-M2", label: "MiniMax-M2" },
      { value: "custom", label: "自定义..." },
    ]);
```

---

## Task 4: 运行 vitest 验证 Task 2 + Task 3

**Files:** 无

- [ ] **Step 1: 跑测试**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride/apps/browser-extension && npx vitest run src/popup/aiServiceOptions.test.ts 2>&1 | tail -30`

Expected: 所有测试 PASS,包括 `aiServiceOptions` 块和 `DeepSeek 模型列表缓存` 块。

如果 `MINIMAX_MODEL_OPTIONS` 快照失败,检查 Task 2 与 Task 3 数组顺序是否完全一致。

- [ ] **Step 2: 提交 Task 2 + Task 3**

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
git add apps/browser-extension/src/popup/aiServiceOptions.ts \
        apps/browser-extension/src/popup/aiServiceOptions.test.ts
git commit -m "feat(browser-extension): MINIMAX_MODEL_OPTIONS 头部加入 MiniMax-M3"
```

---

## Task 5: 同步 `popup.ts` 的 `MINIMAX_TTS_MODEL_OPTIONS`

**Files:**
- Modify: `apps/browser-extension/src/popup/popup.ts:130-137`

- [ ] **Step 1: 收窄数组**

打开 `apps/browser-extension/src/popup/popup.ts`,找到:

```typescript
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
];
```

替换为:

```typescript
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
];
```

---

## Task 6: 同步 `service-worker.ts` 的 `MINIMAX_TTS_MODEL_OPTIONS`

**Files:**
- Modify: `apps/browser-extension/src/background/service-worker.ts:293-300`

- [ ] **Step 1: 收窄数组**

打开 `apps/browser-extension/src/background/service-worker.ts`,找到:

```typescript
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
];
```

替换为:

```typescript
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
];
```

- [ ] **Step 2: 跑 typecheck 确认联合类型收窄无下游错误**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride && npm run typecheck:browser-extension 2>&1 | tail -30`

Expected: 这次不应该再报 `MiniMaxTTSModel` 字面量问题。如果还有,检查是否还有其他地方引用了被移除的字面量(grep `speech-2.6\|speech-02` 在 src/ 下)。

- [ ] **Step 3: 提交 Task 5 + Task 6**

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
git add apps/browser-extension/src/popup/popup.ts \
        apps/browser-extension/src/background/service-worker.ts
git commit -m "refactor(browser-extension): MINIMAX_TTS_MODEL_OPTIONS 收窄为 2.8 系列"
```

---

## Task 7: 更新 `popup.html` 的 TTS `<select>` 选项

**Files:**
- Modify: `apps/browser-extension/src/popup/popup.html:398-404`

- [ ] **Step 1: 替换 `<select id="minimaxTTSModel">` 的内容**

打开 `apps/browser-extension/src/popup/popup.html`,找到:

```html
                      <select id="minimaxTTSModel" class="settings-select">
                        <option value="speech-2.8-hd">speech-2.8-hd</option>
                        <option value="speech-2.6-hd">speech-2.6-hd</option>
                        <option value="speech-2.6-turbo">speech-2.6-turbo</option>
                        <option value="speech-02-hd">speech-02-hd</option>
                        <option value="speech-02-turbo">speech-02-turbo</option>
                      </select>
```

替换为:

```html
                      <select id="minimaxTTSModel" class="settings-select">
                        <option value="speech-2.8-hd">speech-2.8-hd</option>
                        <option value="speech-2.8-turbo">speech-2.8-turbo</option>
                      </select>
```

> 说明: `speech-2.8-turbo` 是新默认值,放在第二个 option 位置,让用户第一眼看到旧的 hd 备选,然后看到新的 turbo 默认(实际由 popup.ts 初始化下拉选中状态)。

- [ ] **Step 2: 检查 hint 文字**

文件中第 448 行附近应该有:

```html
                    <p class="settings-hint">情绪仅对 speech-2.8-hd 等模型生效。</p>
```

该提示对 2.8 系列仍然准确,**不动**。

- [ ] **Step 3: 提交**

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
git add apps/browser-extension/src/popup/popup.html
git commit -m "refactor(browser-extension): popup.html TTS 下拉收窄为 2.8 系列"
```

---

## Task 8: 在 `configManager.ts` 中加迁移逻辑

**Files:**
- Modify: `apps/browser-extension/src/background/configManager.ts`(在 import 块中加常量;在 getConfig 末尾加迁移)

- [ ] **Step 0(新发现,2026-06-02): 在 `types/index.ts` 中 re-export 3 个新常量**

> 修订说明: Task 8 的子 agent 发现 `configManager.ts` 通过 `"../types"` 导入,但 `types/index.ts` 没有 re-export 三个新常量(`MINIMAX_LEGACY_DEFAULT_MODEL` / `MINIMAX_TTS_LEGACY_DEFAULT_MODEL` / `MINIMAX_TTS_REMOVED_MODELS`),TypeScript 编译会报 `Module has no exported member`。先补这个 re-export。

打开 `apps/browser-extension/src/types/index.ts`,找到现有的 `export * from "./config";` 行(把 config.ts 里的所有 export 透传出来),在它**前面**添加:

```typescript
export {
  MINIMAX_LEGACY_DEFAULT_MODEL,
  MINIMAX_TTS_LEGACY_DEFAULT_MODEL,
  MINIMAX_TTS_REMOVED_MODELS,
} from "./config";
```

(只 export 这 3 个,因为其他常量已经通过 `export * from "./config"` 透传。注意命名 re-export 不能与 `export *` 共存,所以用 named re-export 列出要补充的 3 个。)

不要在这一步 commit。继续 Step 1。

- [ ] **Step 1: 在 import 块中加入新常量**

打开 `apps/browser-extension/src/background/configManager.ts`,找到 import 块:

```typescript
import {
  DEFAULT_CONFIG,
  LingridConfig,
  ProviderConfig,
  resolveConfigApiProvider,
  resolveConfigModel,
  resolveConfigOpenAIAuthMode,
  STORAGE_KEY,
  toProviderConfig,
} from "../types";
```

替换为:

```typescript
import {
  DEFAULT_CONFIG,
  LingridConfig,
  MINIMAX_LEGACY_DEFAULT_MODEL,
  MINIMAX_TTS_DEFAULT_MODEL,
  MINIMAX_TTS_LEGACY_DEFAULT_MODEL,
  MINIMAX_TTS_REMOVED_MODELS,
  ProviderConfig,
  resolveConfigApiProvider,
  resolveConfigModel,
  resolveConfigOpenAIAuthMode,
  STORAGE_KEY,
  toProviderConfig,
} from "../types";
```

- [ ] **Step 2: 在 `getConfig` 末尾添加迁移函数调用**

在 `getConfig` 函数中,找到 `return config;`(第 90 行附近)。把整个 `getConfig` 函数修改为:

```typescript
export async function getConfig(): Promise<LingridConfig> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<LingridConfig> | undefined;

    if (!stored) {
      console.log("[Lingride] 未找到配置，使用默认值");
      return { ...DEFAULT_CONFIG };
    }

    // 合并存储配置与默认配置，确保新增字段有默认值
    const config: LingridConfig = {
      api_provider:
        stored.api_provider || DEFAULT_CONFIG.api_provider,
      openai_auth_mode:
        stored.openai_auth_mode || DEFAULT_CONFIG.openai_auth_mode,
      openai_oauth_model:
        stored.openai_oauth_model || DEFAULT_CONFIG.openai_oauth_model,
      api_base_url: stored.api_base_url || DEFAULT_CONFIG.api_base_url,
      api_key: stored.api_key || DEFAULT_CONFIG.api_key,
      model: stored.model || DEFAULT_CONFIG.model,
      prompts: {
        system_prompt:
          stored.prompts?.system_prompt || DEFAULT_CONFIG.prompts.system_prompt,
        user_prompt_template:
          stored.prompts?.user_prompt_template ||
          DEFAULT_CONFIG.prompts.user_prompt_template,
      },
      // 可选字段：用户水平 & 各模式 Prompt 配置
      user_english_level:
        stored.user_english_level || DEFAULT_CONFIG.user_english_level,
      tts_speed: stored.tts_speed || DEFAULT_CONFIG.tts_speed,
      tts_selection: stored.tts_selection || DEFAULT_CONFIG.tts_selection,
      difficulty_prompts:
        stored.difficulty_prompts || DEFAULT_CONFIG.difficulty_prompts,
      paraphrase_prompts:
        stored.paraphrase_prompts || DEFAULT_CONFIG.paraphrase_prompts,
      english_definition_prompts:
        stored.english_definition_prompts ||
        DEFAULT_CONFIG.english_definition_prompts,
      explanation_prompt_preset_id:
        stored.explanation_prompt_preset_id ||
        DEFAULT_CONFIG.explanation_prompt_preset_id,
      mixed_translate_prompts:
        stored.mixed_translate_prompts ||
        DEFAULT_CONFIG.mixed_translate_prompts,
      sentence_analysis_prompts:
        stored.sentence_analysis_prompts ||
        DEFAULT_CONFIG.sentence_analysis_prompts,
      tencent_asr: stored.tencent_asr || DEFAULT_CONFIG.tencent_asr,
      alibaba_asr: stored.alibaba_asr || DEFAULT_CONFIG.alibaba_asr,
      xiaomi_tts: stored.xiaomi_tts || DEFAULT_CONFIG.xiaomi_tts,
      minimax_tts: stored.minimax_tts || DEFAULT_CONFIG.minimax_tts,
    };

    return migrateLegacyConfig(config);
  } catch (error) {
    console.error("[Lingride] 读取配置失败:", error);
    return { ...DEFAULT_CONFIG };
  }
}
```

主要改动:
- 末尾的 `return config;` → `return migrateLegacyConfig(config);`
- 中段增加 `minimax_tts` 字段合并(原本 spec 提到需要支持迁移,但原 `getConfig` 漏合并 `minimax_tts`!已顺手补上)

- [ ] **Step 3: 在文件末尾添加 `migrateLegacyConfig` 函数**

在 `configManager.ts` 文件末尾(在 `resetConfig` 函数之后)添加:

```typescript
/**
 * 一次性内存迁移
 *
 * 把仍在使用旧默认值或已被收窄的 TTS 模型的配置改写到新默认值。
 * 不会主动 saveConfig —— 沿用「用户主动改设置时才落盘」惯例。
 */
function migrateLegacyConfig(config: LingridConfig): LingridConfig {
  const next: LingridConfig = { ...config };

  // 迁移 1: AI 文本模型 — 仅在 minimax provider 下,且仍指向旧默认时
  if (
    resolveConfigApiProvider(next) === "minimax" &&
    next.model === MINIMAX_LEGACY_DEFAULT_MODEL
  ) {
    next.model = "MiniMax-M3";
  }

  // 迁移 2: TTS 模型 — 命中旧默认或已被收窄的模型时,改写为新默认
  const ttsModel = next.minimax_tts?.model;
  if (
    typeof ttsModel === "string" &&
    (ttsModel === MINIMAX_TTS_LEGACY_DEFAULT_MODEL ||
      MINIMAX_TTS_REMOVED_MODELS.includes(ttsModel))
  ) {
    next.minimax_tts = {
      ...next.minimax_tts,
      api_key: next.minimax_tts?.api_key ?? "",
      model: MINIMAX_TTS_DEFAULT_MODEL,
    };
  }

  return next;
}
```

- [ ] **Step 4: 跑 typecheck 验证**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride && npm run typecheck:browser-extension 2>&1 | tail -30`

Expected: 类型检查通过。如果出现 `MINIMAX_TTS_REMOVED_MODELS` 类型不匹配(`readonly` 数组 vs `.includes(string)`),这是已知的:`includes` 接受 `readonly string[]`,无需转型。

- [ ] **Step 5: 跑 vitest 看是否影响现有测试**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride/apps/browser-extension && npx vitest run 2>&1 | tail -30`

Expected: 所有现有测试 PASS(本次只动了 `configManager.ts`,没有新增测试)。

- [ ] **Step 6: 提交**

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
git add apps/browser-extension/src/background/configManager.ts
git commit -m "feat(browser-extension): 添加 MiniMax-M3 + speech-2.8-turbo 旧配置迁移"
```

---

## Task 9: 跑构建 + typecheck 验证全局

**Files:** 无

- [ ] **Step 1: 跑完整构建**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride && npm run build:browser-extension 2>&1 | tail -50`

Expected: 构建成功,在 `apps/browser-extension/dist/` 输出新版本。

- [ ] **Step 2: 跑全量测试**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride/apps/browser-extension && npx vitest run 2>&1 | tail -30`

Expected: 所有测试通过。

- [ ] **Step 3: 跑 lint**

Run: `cd /Users/knox/Documents/GitWorkSpace/Linguride && npm run lint:browser-extension 2>&1 | tail -30`

Expected: 无 lint 错误或仅有 pre-existing 警告(本次改动不应引入新警告)。

如果任何一步失败,停下来排查。

---

## Task 10: 手动验证(Chrome unpacked dist)

**Files:** 无

- [ ] **Step 1: 加载扩展**

1. 打开 Chrome,访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `apps/browser-extension/dist/`

- [ ] **Step 2: 验证 AI 迁移(minimax 用户)**

1. 打开扩展 popup,进入设置
2. 选 `MiniMax` provider,确认 model 下拉中第一项是 `MiniMax-M3`,且默认选中
3. 用 DevTools (Service Worker 控制台) 或 在 popup 里手动编辑 storage:
   - 在 popup 控制台执行: `chrome.storage.local.get('lingrid_config', c => console.log(c))`
4. 或者在 settings 里把 model 改成 `MiniMax-M2.7` 后保存 → 重新加载扩展 → 再次打开设置,确认 model 变成 `MiniMax-M3`
5. 点击「测试 AI 连接」,确认 200 响应或正常错误信息(取决于 API key 是否真实)

- [ ] **Step 3: 验证 AI 不迁移(deepseek 用户)**

1. 切到 `DeepSeek` provider
2. 重新加载扩展
3. 确认 model 仍是 `deepseek-chat`,未被改写

- [ ] **Step 4: 验证 TTS 迁移(旧默认)**

1. 在设置中填 MiniMax TTS API Key
2. 在 DevTools 中改 storage: `chrome.storage.local.set({lingrid_config: {...当前config, minimax_tts: {api_key: "fake", model: "speech-2.8-hd"}}})`
3. 重新加载扩展
4. 打开设置,确认 TTS model 下拉中只有 2 个选项(hd 与 turbo),且选中 `speech-2.8-turbo`

- [ ] **Step 5: 验证 TTS 迁移(被移除模型)**

1. 在 DevTools 中改 storage: 把 `minimax_tts.model` 设为 `speech-2.6-hd`
2. 重新加载扩展
3. 确认变 `speech-2.8-turbo`

- [ ] **Step 6: 验证 TTS 不迁移(未配置)**

1. 清空 `minimax_tts.api_key` 与 `minimax_tts.model`
2. 重新加载扩展
3. 确认 `minimax_tts` 仍为 undefined 或不带 model 字段

- [ ] **Step 7: 验证 TTS 播放**

1. 启用 MiniMax TTS(填一个真实 API key)
2. 打开 corpus 页面或 tutor 页面,触发一次 TTS 朗读
3. 确认能听到音频

如果任何一步不符合预期,停下来排查。

---

## 完成

- [ ] **所有 10 个任务完成**
- [ ] **推送分支**

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
git push origin <branch-name>
```

> 提醒: 本计划改动的 7 个文件 + spec 文档共 8 个 commit。如果用户在执行时想合并为更少的 commit,可在确认测试通过后做一次 interactive rebase。
