# Spec: MiniMax-M3 默认模型 + TTS speech-2.8-turbo 默认模型

- **日期**: 2026-06-02
- **范围**: `apps/browser-extension/`
- **类型**: 配置默认值演进 + 模型列表缩减

## 背景

MiniMax 平台(minimaxi.com)近期动作:

1. **2026-06-01**: MiniMax 公司发布新一代旗舰模型 **M3**,基于自研 MSA 稀疏注意力架构,最高 1M 上下文,编程/Agent 能力前沿(参考多方新闻报道,平台官方文档 2026-05-22 索引时 M3 尚未列出)。
2. 平台语音模型当前以 **Speech-2.8 系列** 为主推(`Speech-2.8-HD` / `Speech-2.8-Turbo`),`Speech-2.6` 与 `Speech-02` 系列为历史/补位版本。

Lingride 扩展需要把这两个新模型的默认值同步进来,引导用户使用最新能力;同时主动清理过老的 TTS 模型选项,降低用户的认知负担。

## 目标

- AI 文本服务: 将 `MINIMAX_DEFAULT_MODEL` 从 `MiniMax-M2.7` 改为 `MiniMax-M3`,并把 `MiniMax-M3` 加入 `MINIMAX_MODEL_OPTIONS` 列表。
- 语音合成服务: 将 `MINIMAX_TTS_DEFAULT_MODEL` 从 `speech-2.8-hd` 改为 `speech-2.8-turbo`,并把 TTS 列表缩减为仅 `speech-2.8-hd` 与 `speech-2.8-turbo` 两个。
- 自动迁移现有用户: 若他们的配置仍指向旧默认或被移除的模型,内存中改写为新默认。

## 非目标

- 不改 MiniMaxProvider 的请求实现(模型名通过 config 透传)。
- 不调整 API 端点、认证头、请求超时等。
- 不引入 schema_version 字段。
- 不为 M3 添加 `-highspeed` 变体(目前官方未公布)。
- 不为 TTS 引入情绪以外的风格选项。

## 文件改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/types/config.ts` | 常量与类型调整(详见下文) |
| 2 | `src/popup/aiServiceOptions.ts` | `MINIMAX_MODEL_OPTIONS` 头部插入 M3 |
| 3 | `src/popup/popup.html` | TTS `<select>` 缩减为 2 个 option |
| 4 | `src/background/configManager.ts` | `getConfig()` 中追加迁移步骤 |
| 5 | `src/popup/popup.ts` | `MINIMAX_TTS_MODEL_OPTIONS` 数组缩减为 2 个 |
| 6 | `src/background/service-worker.ts` | `MINIMAX_TTS_MODEL_OPTIONS` 数组缩减为 2 个 |
| 7 | `src/popup/aiServiceOptions.test.ts` | 快照新增 `MiniMax-M3` |

## 详细设计

### 1. `src/types/config.ts`

```typescript
// === 旧 ===
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M2.7";
export const MINIMAX_TTS_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-hd";
export type MiniMaxTTSModel =
  | "speech-2.8-hd"
  | "speech-2.8-turbo"
  | "speech-2.6-hd"
  | "speech-2.6-turbo"
  | "speech-02-hd"
  | "speech-02-turbo";

// === 新 ===
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M3";
export const MINIMAX_LEGACY_DEFAULT_MODEL = "MiniMax-M2.7";
export const MINIMAX_TTS_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-turbo";
export const MINIMAX_TTS_LEGACY_DEFAULT_MODEL: MiniMaxTTSModel = "speech-2.8-hd";
export const MINIMAX_TTS_REMOVED_MODELS: MiniMaxTTSModel[] = [
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
];
export type MiniMaxTTSModel =
  | "speech-2.8-hd"
  | "speech-2.8-turbo";
```

> 决策: 联合类型直接收窄到 2 个。`MINIMAX_TTS_REMOVED_MODELS` 在 `configManager.ts` 中以 `as string[]` 形式比对(因为运行时 `stored` 中可能含已被类型剔除的旧值)。

### 2. `src/popup/aiServiceOptions.ts`

```typescript
export const MINIMAX_MODEL_OPTIONS: ModelOption[] = [
  { value: "MiniMax-M3", label: "MiniMax-M3" },   // 新增,置顶
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

`MINIMAX_DEFAULT_MODEL` 引用已指向 `"MiniMax-M3"`,`getDefaultModelForProvider` 无需修改。

### 3. `src/popup/popup.html`

定位 `<select id="minimaxTTSModel">`,将 options 替换为:

```html
<option value="speech-2.8-hd">speech-2.8-hd</option>
<option value="speech-2.8-turbo">speech-2.8-turbo</option>
```

(`speech-2.6-hd`、`speech-2.6-turbo`、`speech-02-hd`、`speech-02-turbo` 全部移除)

### 4. `src/background/configManager.ts`

在 `getConfig()` 的合并逻辑中,默认值回填之后、return 之前插入迁移步骤:

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

// 在 config 合并完成后,return 之前:
function migrateLegacyConfig(config: LingridConfig): LingridConfig {
  const next: LingridConfig = { ...config };

  // 迁移 1: AI 文本模型
  if (
    resolveConfigApiProvider(next) === "minimax" &&
    next.model === MINIMAX_LEGACY_DEFAULT_MODEL
  ) {
    next.model = "MiniMax-M3";
  }

  // 迁移 2: TTS 模型
  const ttsModel = next.minimax_tts?.model;
  if (
    typeof ttsModel === "string" &&
    (ttsModel === MINIMAX_TTS_LEGACY_DEFAULT_MODEL ||
      (MINIMAX_TTS_REMOVED_MODELS as string[]).includes(ttsModel))
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

并在 `getConfig()` 的 return 前调用 `return migrateLegacyConfig(config);`。

### 5 & 6. 数组同步

`src/popup/popup.ts:130-137` 和 `src/background/service-worker.ts:293-300` 中的 `MINIMAX_TTS_MODEL_OPTIONS` 数组都改为:

```typescript
const MINIMAX_TTS_MODEL_OPTIONS: MiniMaxTTSModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
];
```

### 7. 测试快照

`src/popup/aiServiceOptions.test.ts` 中第 24-33 行的 `MINIMAX_MODEL_OPTIONS` 期望值加 M3:

```typescript
expect(MINIMAX_MODEL_OPTIONS).toEqual([
  { value: "MiniMax-M3", label: "MiniMax-M3" },         // 新增
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

## 行为与边界条件

| 场景 | 行为 |
|---|---|
| 新装扩展 | `DEFAULT_CONFIG.model = "MiniMax-M3"`,`MINIMAX_TTS_DEFAULT_MODEL = "speech-2.8-turbo"` |
| 现有用户,AI 模型 = `MiniMax-M2.7`,provider = `minimax` | 内存中改写为 `MiniMax-M3` |
| 现有用户,AI 模型 = `MiniMax-M2.7`,provider = `deepseek` | **不迁移**(老默认仅在 minimax 下触发) |
| 现有用户,AI 模型 = 任意非 `M2.7` 值 | 不迁移 |
| 现有用户,`minimax_tts` 整体未配置 | 不迁移(undefined 不会误判) |
| 现有用户,`minimax_tts.model = "speech-2.8-hd"` | 迁移为 `speech-2.8-turbo` |
| 现有用户,`minimax_tts.model = "speech-2.6-hd"` 等被移除模型 | 迁移为 `speech-2.8-turbo` |
| 现有用户,`minimax_tts.model = "speech-2.8-turbo"` | 不变 |
| 现有用户,`minimax_tts.model = undefined` | 不迁移(未显式设过) |
| 迁移后用户清空 api_key | 重新加载时 `minimax_tts` 仍保持迁移后的 model 字段;`isConfigValid` 仍按现有规则判定 |

**关键不变量**: 用户的显式选择永远不被覆盖 — 迁移仅在 stored 命中老默认/被移除模型时才发生。

迁移仅在内存中生效,不主动回写 storage(沿用现有「用户主动改设置时 save」惯例)。

## 验证

### 命令

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride
npm run typecheck:browser-extension
npm run build:browser-extension
```

### 自动化测试

```bash
cd /Users/knox/Documents/GitWorkSpace/Linguride/apps/browser-extension
npx vitest run src/popup/aiServiceOptions.test.ts
```

### 手动验证(Chrome unpacked dist)

1. **AI 迁移 — minimax 用户**: 在设置中选 `MiniMax`、`model = MiniMax-M2.7`、填 API Key,保存。重新加载扩展。打开设置,确认 model 下拉选中 `MiniMax-M3`。点击「测试 AI 连接」,确认成功。
2. **AI 不迁移 — deepseek 用户**: 切到 DeepSeek,保存。重新加载。确认仍是 deepseek-chat,未被改写。
3. **TTS 迁移 — 旧默认**: 配 `minimax_tts.api_key`、`model = speech-2.8-hd`,保存。重新加载。打开设置,确认 minimax TTS 下拉选中 `speech-2.8-turbo`。
4. **TTS 迁移 — 被移除模型**: 用 DevTools 把 `minimax_tts.model` 改成 `speech-2.6-hd` 后保存。重新加载。确认变 `speech-2.8-turbo`。
5. **TTS 不迁移 — 未配置**: 不填 minimax TTS api_key。重新加载。确认 minimax_tts 仍为 undefined。
6. **TTS 播放**: 在 corpus/tutor 页面触发 TTS 朗读,确认听到新模型音频。

## 风险与权衡

- **被动迁移**: 用户主动选的 `speech-2.6-hd` 等老模型会被强制迁移为 `speech-2.8-turbo`。这是有意的产品决策(推动 2.8 系列采用),但应在 PR 描述和 README 中明确说明。
- **大小写**: 官方平台 UI 用 `Speech-2.8-HD` / `Speech-2.8-Turbo`(大写),但 API 参数与现有代码都用小写。本次不动命名。
- **M3 在文档中尚未列出**: 平台 docs 截至 2026-05-22 索引未含 M3,但 6 月 1 日新闻报道已确认发布。API ID 命名沿用 `MiniMax-M2.x` 模式。若平台上线后实际 API 名称不同(例如 `MiniMax-M3-highspeed` 而非 `MiniMax-M3`),需要小修。

## 回滚

如上线后平台反馈 M3 API ID 不存在,回滚方法:

1. 把 `MINIMAX_DEFAULT_MODEL` 改回 `"MiniMax-M2.7"`。
2. 从 `MINIMAX_MODEL_OPTIONS` 移除 `MiniMax-M3`。
3. 提交修复 commit。

迁移是单向的(无破坏性),回滚只会让新用户用回 `M2.7`,不影响已有数据。
