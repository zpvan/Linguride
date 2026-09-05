# 语音识别服务手动选择 Provider — 设计文档

- **日期**：2026-09-06
- **状态**：已确认
- **范围**：`apps/browser-extension`

## 背景与目标

当前「语音识别服务」的选择逻辑是写死在 `src/tutor/tutor.ts` 的 `createRecognizer` 优先级链：豆包 → 腾讯云 → 阿里云 → Web Speech，且识别失败时自动降级到浏览器识别。用户无法手动指定走哪家。

目标：与「语音合成服务」（`tts_selection` + 设置页下拉）对齐，为 ASR 提供手动选择能力。

## 已确认的决策

1. **下拉选项**：仅 `豆包 / 腾讯云 / 阿里云 / 浏览器识别`，**不提供「自动」选项**
2. **失败行为**：识别失败**不回退**浏览器识别，直接报错（删除现有降级逻辑）
3. **默认值迁移**：老配置无 `asr_selection` 字段时，按豆包 > 腾讯 > 阿里顺序取第一个已配置的 provider；全未配置则 `browser`
4. **依赖处理**：三个 `isXxxASRConfigured` 判定逻辑下沉到 `src/types/config.ts`，recognizer 模块 re-export 保持兼容（方案 A）

## 设计

### 1. 类型与配置（`src/types/config.ts`）

```ts
export type ASRProviderId = "doubao" | "tencent" | "alibaba";
export type ASRSelectionMode = ASRProviderId | "browser";
```

`LingridConfig` 新增可选字段：

```ts
asr_selection?: ASRSelectionMode;
```

- `DEFAULT_CONFIG` **不写** `asr_selection`（保持 undefined → 走迁移解析，老用户行为不变）
- 两个新类型从 `src/types/index.ts` 导出

### 2. 判定函数下沉 + 解析函数

将 `isDoubaoASRConfigured` / `isTencentASRConfigured` / `isAlibabaASRConfigured` 的实现移到 `src/types/config.ts`（本质均为检查 config 对应字段的 key 非空）。`src/tutor/doubaoASRRecognizer.ts`、`tencentASRRecognizer.ts`、`alibabaASRRecognizer.ts` 改为从 config re-export，保持现有 import 兼容。

新增纯函数（放 `src/types/config.ts`）：

```ts
export function resolveASRSelection(config: LingridConfig): ASRSelectionMode {
  // 1. 显式选择优先
  if (config.asr_selection) return config.asr_selection;
  // 2. 迁移默认：豆包 > 腾讯 > 阿里，取第一个已配置的
  if (isDoubaoASRConfigured(config)) return "doubao";
  if (isTencentASRConfigured(config)) return "tencent";
  if (isAlibabaASRConfigured(config)) return "alibaba";
  // 3. 全未配置 → 浏览器识别
  return "browser";
}
```

迁移只发生在"读取解析"时，不回写 storage；用户首次在设置页保存后才真正写入 `asr_selection`。

### 3. 识别器选择改造（`src/tutor/tutor.ts`）

`createRecognizer` 从优先级链改为显式分派：

```ts
function createRecognizer(): ISpeechRecognizer {
  const selection = resolveASRSelection(userConfig ?? DEFAULT_CONFIG);
  switch (selection) {
    case "doubao":  return new DoubaoASRRecognizer();
    case "tencent": return new TencentASRRecognizer();
    case "alibaba": return new AlibabaASRRecognizer();
    case "browser": return new WebSpeechRecognizer();
  }
}
```

- 实例化前用对应 `isXxxASRConfigured` 检查；选中云端但未配置时直接 `throw new Error("XX 识别未配置 API Key，请到设置页配置或切换识别服务")`，录音启动前即暴露错误
- **删除**现有 `onFallback` 降级包装：识别错误直接经 `onError` 上浮到 UI 红字显示，不自动切换
- 两个调用点（发音评估约 `tutor.ts:1500`、影子跟读约 `tutor.ts:1840`）签名简化，移除 `onFallback` 参数
- 识别器创建时机保持现状：发音评估在每次录音开始时重建；影子跟读在页面初始化时注入一次，切换选择后刷新 tutor 页生效（与 TTS 配置生效方式一致）
- `initShadowMode` 中 `createRecognizer` 可能抛错（选中云端但未配置），需 try/catch 兜底注入一个 `start()` 即拒绝的 stub 识别器，避免破坏页面初始化
- 选豆包时 `DOUBAO_ASR_PREPARE` 流程不变；选 `browser` 时行为与现状完全一致

### 4. 设置页 UI（`src/popup/popup.html` / `popup.ts`）

在「语音识别服务」区块顶部、三个嵌套手风琴上方，加与 TTS 区块同款的选择行：

```html
<p class="settings-desc nested-desc">选择语音识别服务，识别失败将直接报错（不会自动切换）。</p>
<div class="settings-row">
  <label class="settings-label label-muted" for="asrProviderSelect">优先</label>
  <select id="asrProviderSelect" class="settings-select">
    <option value="doubao">豆包</option>
    <option value="tencent">腾讯云</option>
    <option value="alibaba">阿里云</option>
    <option value="browser">浏览器识别</option>
  </select>
</div>
```

- 保存时写 `asr_selection`；加载时用 `resolveASRSelection(config)` 回填（老用户首次打开即可见迁移后的默认选中项）
- 选中某云端 provider 但其 key 为空时，下拉下方显示黄色提示「尚未配置 XX 的 API Key」（复用下沉后的判定函数）；切换下拉时即时刷新提示
- 原描述文案"优先级：豆包 → 腾讯云 → ..."替换为上述新文案

### 5. 测试

- **`resolveASRSelection` 单测**（vitest，纯函数），5 个用例：
  1. 显式 `asr_selection` 直通
  2. 无字段 + 豆包已配置 → `doubao`
  3. 无字段 + 仅腾讯已配置 → `tencent`
  4. 无字段 + 仅阿里已配置 → `alibaba`
  5. 无字段 + 全未配置 → `browser`
- 判定函数下沉的兼容性由 typecheck 保证，不重复测
- `createRecognizer` 依赖 chrome 环境，不做单测；手动验证覆盖：设置页切换四个选项 → tutor 页录音确认走对应识别器（console 日志）
- CI gate：typecheck + lint + 全量单测通过

## 影响文件

| 文件 | 改动 |
|---|---|
| `src/types/config.ts` | 新增类型、`asr_selection` 字段、判定函数下沉、`resolveASRSelection` |
| `src/types/index.ts` | 导出新类型与函数 |
| `src/tutor/tutor.ts` | `createRecognizer` 改显式分派，删降级包装，两处调用点简化 |
| `src/tutor/{doubao,tencent,alibaba}ASRRecognizer.ts` | 判定函数改为 re-export |
| `src/popup/popup.html` | ASR 区块加选择行、改描述文案 |
| `src/popup/popup.ts` | 保存/加载 `asr_selection`，未配置提示 |
| `src/types/config.test.ts`（或新文件） | `resolveASRSelection` 5 个单测 |

## 非目标

- 不改动各识别器内部实现（音频采集、协议、错误码）
- 不为 ASR 加「测试连接」按钮（本次仅选择能力）
- 不动 `tts_selection` 相关逻辑
