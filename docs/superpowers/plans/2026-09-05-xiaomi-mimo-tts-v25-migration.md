# 小米 MiMo TTS 迁移 v2.5 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小米 TTS 从已下线的 `mimo-v2-tts` 迁移到 `mimo-v2.5-tts`，音色列表换成 v2.5 英文音色，移除失效的 v2 风格标签体系。

**Architecture:** 音色选项与 normalize 逻辑当前在 service-worker.ts 和 popup.ts 各有一份重复定义，本次统一到 `types/config.ts` 单一出处。风格体系（`<style>` 标签注入）整体移除：service worker 直接传原文，popup 删除风格 UI。

**Tech Stack:** TypeScript、Chrome Extension MV3、vitest。

**Spec:** `docs/superpowers/specs/2026-09-05-xiaomi-mimo-tts-v25-migration-design.md`

**已验证的根因**（2026-09-05 实测，用户真实 key）：
- `mimo-v2-tts` → HTTP 400 `Unsupported model mimo-v2-tts`
- `mimo-v2.5-tts` + `Mia` → 成功返回 base64 音频

**工作目录：** `apps/browser-extension`（以下相对路径均相对于它）

**注意：** popup.css 中 `xiaomi-tts-style-*` 样式类被 MiniMax 情绪 UI 复用，**不要删除 CSS**，只删小米区块的 HTML 与 TS 逻辑。

---

### Task 1: 音色/模型迁移到 v2.5（统一到 types/config.ts）

**Files:**
- Modify: `src/types/config.ts`
- Test: `src/types/config.test.ts`

- [ ] **Step 1: 编写失败测试**

在 `src/types/config.test.ts` 末尾追加：

```ts
import { normalizeXiaomiTTSVoice, XIAOMI_TTS_VOICE_OPTIONS } from "./config";

describe("normalizeXiaomiTTSVoice", () => {
  it("returns mimo_default for empty input", () => {
    expect(normalizeXiaomiTTSVoice(undefined)).toBe("mimo_default");
    expect(normalizeXiaomiTTSVoice("")).toBe("mimo_default");
  });

  it("accepts v2.5 voices", () => {
    expect(normalizeXiaomiTTSVoice("Mia")).toBe("Mia");
    expect(normalizeXiaomiTTSVoice("Dean")).toBe("Dean");
  });

  it("migrates legacy v2 voices to mimo_default", () => {
    expect(normalizeXiaomiTTSVoice("default_zh")).toBe("mimo_default");
    expect(normalizeXiaomiTTSVoice("default_en")).toBe("mimo_default");
  });

  it("voice options contain only v2.5 voices", () => {
    expect(XIAOMI_TTS_VOICE_OPTIONS).toEqual([
      "mimo_default",
      "Mia",
      "Chloe",
      "Milo",
      "Dean",
    ]);
  });
});
```

若文件已有 import 块，把 `normalizeXiaomiTTSVoice, XIAOMI_TTS_VOICE_OPTIONS` 合并进现有 `from "./config"` 的 import。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: FAIL（`normalizeXiaomiTTSVoice` 未导出）

- [ ] **Step 3: 修改 types/config.ts**

3a. `XIAOMI_TTS_MODEL`（约 line 444）改为：

```ts
export const XIAOMI_TTS_MODEL = "mimo-v2.5-tts";
```

3b. `XiaomiTTSVoice`（约 line 203）改为：

```ts
export type XiaomiTTSVoice = "mimo_default" | "Mia" | "Chloe" | "Milo" | "Dean";
```

3c. 在 `XiaomiTTSVoice` 类型之后追加统一的声音选项与 normalize 函数：

```ts
/** 小米 TTS 可选音色（v2.5，仅开放英文场景音色） */
export const XIAOMI_TTS_VOICE_OPTIONS: XiaomiTTSVoice[] = [
  "mimo_default",
  "Mia",
  "Chloe",
  "Milo",
  "Dean",
];

/** 小米 TTS 默认音色 */
export const XIAOMI_TTS_DEFAULT_VOICE: XiaomiTTSVoice = "mimo_default";

/**
 * 规范化小米 TTS 音色；旧 v2 音色（default_zh/default_en）迁移为 mimo_default
 */
export function normalizeXiaomiTTSVoice(value?: string | null): XiaomiTTSVoice {
  if (value && XIAOMI_TTS_VOICE_OPTIONS.includes(value as XiaomiTTSVoice)) {
    return value as XiaomiTTSVoice;
  }

  return XIAOMI_TTS_DEFAULT_VOICE;
}
```

3d. `src/types/index.ts` 的 `from "./config"` 导出块中（现有 `XiaomiTTSVoice,` 附近，约 line 64）追加：

```ts
  XIAOMI_TTS_VOICE_OPTIONS,
  XIAOMI_TTS_DEFAULT_VOICE,
  normalizeXiaomiTTSVoice,
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/browser-extension && bunx vitest run src/types/config.test.ts`
Expected: 新增 4 个测试 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/types/config.ts apps/browser-extension/src/types/config.test.ts apps/browser-extension/src/types/index.ts
git commit -m "feat(browser-extension): 小米 TTS 模型/音色迁移到 v2.5，统一到 types/config.ts"
```

---

### Task 2: service worker 清理（去风格体系 + 收敛重复定义）

**Files:**
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: 删除本地重复的音色常量与 normalize 函数**

1a. 删除本地默认音色常量（约 line 152）：

```ts
const XIAOMI_TTS_DEFAULT_VOICE: XiaomiTTSVoice = "mimo_default";
```

1b. 删除本地音色选项（约 line 307-311）：

```ts
const XIAOMI_TTS_VOICE_OPTIONS: XiaomiTTSVoice[] = [
  "mimo_default",
  "default_zh",
  "default_en",
];
```

1c. 删除本地 normalize 函数（约 line 435-441）：

```ts
function normalizeXiaomiTTSVoice(value?: string | null): XiaomiTTSVoice {
  if (value && XIAOMI_TTS_VOICE_OPTIONS.includes(value as XiaomiTTSVoice)) {
    return value as XiaomiTTSVoice;
  }

  return XIAOMI_TTS_DEFAULT_VOICE;
}
```

1d. 在文件顶部的 `from "../types"` import 块中追加：

```ts
  normalizeXiaomiTTSVoice,
```

（`XIAOMI_TTS_DEFAULT_VOICE` 和 `XIAOMI_TTS_VOICE_OPTIONS` 若 typecheck 报未使用则不引入；`normalizeXiaomiTTSVoice` 被 `getXiaomiTTSVoice` 使用。）

- [ ] **Step 2: 删除风格体系**

2a. 删除风格类型别名（约 line 169-172）：

```ts
type XiaomiTTSStyleGroupKey = keyof XiaomiTTSStyleSelection;
type XiaomiTTSStyleValue = NonNullable<
  XiaomiTTSStyleSelection[XiaomiTTSStyleGroupKey]
>;
```

2b. 删除 `XIAOMI_TTS_STYLE_GROUP_ORDER`（约 line 316-322）与 `XIAOMI_TTS_STYLE_PROMPTS`（约 line 323 起的整个 Record 常量）。

2c. 删除 `normalizeXiaomiTTSStyles` 与 `hasXiaomiTTSStyles` 两个函数（约 line 476-497）。

2d. 将 `buildXiaomiTTSAssistantContent`（约 line 556-586）整体简化为直接内联——删除该函数，并在 `requestXiaomiTTSAudio` 中把：

```ts
  const assistantContent = buildXiaomiTTSAssistantContent(text, config);
```

改为：

```ts
  const assistantContent = text;
```

2e. 从 `from "../types"` import 块中删除不再使用的 `XiaomiTTSStyleSelection`（如存在）。

- [ ] **Step 3: 类型检查 + lint**

Run: `cd apps/browser-extension && bun run typecheck && bun run lint`
Expected: 无错误（lint 0 errors；若有 unused 报错，删掉对应残留引用）

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension/src/background/service-worker.ts
git commit -m "refactor(browser-extension): service worker 移除小米 v2 风格标签体系"
```

---

### Task 3: popup 清理（删风格 UI + 音色下拉更新）

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.ts`

- [ ] **Step 1: popup.html 音色下拉更新为 v2.5 英文音色**

将 `xiaomiTTSVoice` 下拉（约 line 509-513）改为：

```html
                      <select id="xiaomiTTSVoice" class="settings-select">
                        <option value="mimo_default">默认音色</option>
                        <option value="Mia">Mia（英文女声）</option>
                        <option value="Chloe">Chloe（英文女声）</option>
                        <option value="Milo">Milo（英文男声）</option>
                        <option value="Dean">Dean（英文男声）</option>
                      </select>
```

- [ ] **Step 2: popup.html 删除风格区块**

删除从音色行之后的 `<div class="settings-divider"></div>` 开始、到风格区块结束的整段（约 line 515-569），即：

- `<div class="settings-divider"></div>`（音色行之后那个）
- 整个 `<div class="xiaomi-tts-style-section">…</div>`（含语速/情绪/角色/风格/方言五组 pill 按钮）

保留其后的 `<p class="settings-hint">风格仅对 AI 语音合成生效…</p>`？——不，该提示也随之删除（约 line 570）。保留下一行小米开放平台链接。

- [ ] **Step 3: popup.ts 删除风格逻辑**

3a. 删除类型别名（约 line 89-92）：

```ts
type XiaomiTTSStyleGroupKey = keyof XiaomiTTSStyleSelection;
type XiaomiTTSStyleValue = NonNullable<
  XiaomiTTSStyleSelection[XiaomiTTSStyleGroupKey]
>;
```

3b. 删除常量：`XIAOMI_TTS_STYLE_GROUP_ORDER`（约 line 114-120）、`XIAOMI_TTS_STYLE_GROUP_LABELS`（约 line 121-129）、`XIAOMI_TTS_STYLE_OPTIONS`（约 line 140-167）。同时删除本地重复的 `XIAOMI_TTS_DEFAULT_VOICE`（约 line 113）、`XIAOMI_TTS_VOICE_OPTIONS`（约 line 130-134）与本地 `normalizeXiaomiTTSVoice` 函数（约 line 882-888）。

3c. 在 popup.ts 顶部 `from "../types"` import 块中追加：

```ts
  XIAOMI_TTS_DEFAULT_VOICE,
  normalizeXiaomiTTSVoice,
```

并删除 import 中的 `XiaomiTTSStyleSelection`。

3d. 删除 DOM 引用（约 line 427-434）：

```ts
const xiaomiTTSStyleSummary = document.getElementById(
  "xiaomiTTSStyleSummary"
) as HTMLElement;
const clearXiaomiTTSStylesBtn = document.getElementById(
  "clearXiaomiTTSStylesBtn"
) as HTMLButtonElement;
const xiaomiTTSStyleButtons = Array.from(
  document.querySelectorAll("[data-xiaomi-tts-style-group]")
) as HTMLButtonElement[];
```

3e. 删除函数：`isValidXiaomiTTSStyleValue`、`normalizeXiaomiTTSStyles`、`hasXiaomiTTSStyles`、`getXiaomiTTSStyleLabel`、`setXiaomiTTSStyleValue`（约 line 895-975）、`renderXiaomiTTSStyleSummary`（约 line 977-1006）、`applyXiaomiTTSStyleSelection`（约 line 1008-1020）、`getXiaomiTTSStylesFromUI`（约 line 1022-1038）、`handleClearXiaomiTTSStyles`（约 line 2171-2176）、`handleXiaomiTTSStyleClick`（约 line 2178-2198）。

3f. 修改 `collectConfig` 中的小米段（约 line 1958-1970），删除风格收集：

```ts
  // 小米 TTS 配置（API Key 为空视为禁用，直接使用浏览器 TTS）
  const xiaomiTTSApiKey = xiaomiTTSApiKeyInput.value.trim();
  const xiaomiTTSVoice = normalizeXiaomiTTSVoice(xiaomiTTSVoiceSelect.value);
  const hasCustomVoice = xiaomiTTSVoice !== XIAOMI_TTS_DEFAULT_VOICE;

  if (xiaomiTTSApiKey || hasCustomVoice) {
    currentConfig.xiaomi_tts = {
      api_key: xiaomiTTSApiKey,
      ...(hasCustomVoice ? { voice: xiaomiTTSVoice } : {}),
    };
  } else {
    delete currentConfig.xiaomi_tts;
  }
```

3g. `updateSettingsForm` 中删除（约 line 2060）：

```ts
  applyXiaomiTTSStyleSelection(currentConfig.xiaomi_tts?.styles);
```

3h. 事件绑定区删除（约 line 1362-1365）：

```ts
  clearXiaomiTTSStylesBtn.addEventListener("click", handleClearXiaomiTTSStyles);
  xiaomiTTSStyleButtons.forEach((button) => {
    button.addEventListener("click", handleXiaomiTTSStyleClick);
  });
```

- [ ] **Step 4: types/config.ts 删除风格类型**

删除 `XiaomiTTSStyleSelection` 接口（约 line 205-217），并把 `XiaomiTTSConfig` 中的 `styles` 字段删除：

```ts
export interface XiaomiTTSConfig {
  /** 小米 API Key */
  api_key: string;

  /** 可选音色，留空时使用 mimo_default */
  voice?: XiaomiTTSVoice;
}
```

（旧配置中残留的 `styles` 字段会被自然忽略，不需要迁移删除用户数据。）

- [ ] **Step 5: 类型检查 + lint + 构建 + 全量测试**

Run: `cd apps/browser-extension && bun run typecheck && bun run lint && bun run build && bunx vitest run`
Expected: 无错误；lint 0 errors；构建成功；全部测试 PASS

- [ ] **Step 6: Commit**

```bash
git add apps/browser-extension/src/popup/popup.html apps/browser-extension/src/popup/popup.ts apps/browser-extension/src/types/config.ts
git commit -m "refactor(browser-extension): popup 移除小米风格选择 UI，音色切换为 v2.5 英文音色"
```

---

### Task 4: 真实 key 实测验证

- [ ] **Step 1: curl 实测 mimo-v2.5-tts 各英文音色**

用用户提供的小米 API key（会话中已提供）：

```bash
for voice in mimo_default Mia Chloe Milo Dean; do
  curl -s -X POST "https://api.xiaomimimo.com/v1/chat/completions" \
    -H "api-key: $XIAOMI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"mimo-v2.5-tts\",\"messages\":[{\"role\":\"assistant\",\"content\":\"Hello from Lingride.\"}],\"audio\":{\"format\":\"wav\",\"voice\":\"$voice\"}}" \
    | head -c 120
  echo "  <- $voice"
done
```

Expected: 每个音色都返回 `{"id":...,"choices":[...audio...]`（无 error 字段）

- [ ] **Step 2: 人工验证**

`dist/` 加载到 Chrome：设置页小米区块音色下拉显示 5 个 v2.5 音色、无风格区块；"测试连接"成功；语料库页选小米 TTS 播放正常。

- [ ] **Step 3: 最终 Commit（如有修复）**

```bash
git add -A apps/browser-extension
git commit -m "fix(browser-extension): 人工验证发现的问题修复"
```
