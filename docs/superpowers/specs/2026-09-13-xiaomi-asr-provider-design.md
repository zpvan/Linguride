# 小米 MiMo 语音识别 Provider — 设计文档

- **日期**：2026-09-13
- **状态**：已确认
- **范围**：`apps/browser-extension`

## 背景与目标

「语音识别服务」当前支持豆包 / 腾讯云 / 阿里云 / 浏览器识别四家手动选择。小米 MiMo 平台已上线 `mimo-v2.5-asr` 模型（OpenAI 兼容 chat/completions 协议），与已接入的小米 TTS 同平台同 key 体系。目标：为 ASR 增加小米选项。

## 官方接口要点（参考：https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/Speech-Recognition）

- **端点**：`POST https://api.xiaomimimo.com/v1/chat/completions`，`api-key` 头认证（与小米 TTS 同构）
- **模型**：`mimo-v2.5-asr`（当前唯一 ASR 模型）
- **音频输入**：整段音频 base64，`input_audio.data` 传 `data:audio/wav;base64,...`；仅支持 wav/mp3，base64 后 ≤10MB
- **流式**：`stream: true` 为 SSE 文本流——**上传完整音频后**逐 token 出识别文本（非边录边传的实时流式）
- **语言**：`asr_options.language` = `auto` / `zh` / `en`；本插件英语学习场景固定用 `en`
- **响应**：SSE chunk 的 `choices[0].delta.content` 为增量文本，`finish_reason: "stop"` 结束

## 已确认的决策

1. **配置**：独立的 `xiaomi_asr` key 字段（与豆包 TTS/ASR 分开配置的模式一致），**不**复用小米 TTS 的 key
2. **响应模式**：流式 `stream: true`（录完后 SSE 逐 token 出文本，体验优于一次性返回）
3. **迁移默认**：小米加入 `resolveASRSelection` 迁移链末尾（豆包 > 腾讯 > 阿里 > 小米 > browser）；已手动选过的用户不受影响
4. **实现位置**：页面侧直接 fetch（不经 service-worker 中转——HTTPS 直 fetch 无 WS 握手头注入需求，host_permissions 已覆盖）

## 设计

### 1. 类型与配置（`src/types/config.ts`）

```ts
export interface XiaomiASRConfig {
  /** 小米 MiMo API Key */
  api_key: string;
}

export const XIAOMI_ASR_API_URL =
  "https://api.xiaomimimo.com/v1/chat/completions";
export const XIAOMI_ASR_MODEL = "mimo-v2.5-asr";

export function isXiaomiASRConfigured(config: LingridConfig): boolean {
  return !!config.xiaomi_asr?.api_key?.trim();
}
```

- `ASRProviderId` 加 `"xiaomi"`：`"doubao" | "tencent" | "alibaba" | "xiaomi"`
- `LingridConfig` 新增 `xiaomi_asr?: XiaomiASRConfig;`
- `resolveASRSelection` 迁移链：显式选择 > 豆包 > 腾讯 > 阿里 > **小米** > browser
- `src/types/index.ts` 导出 `XiaomiASRConfig`、`XIAOMI_ASR_API_URL`、`XIAOMI_ASR_MODEL`、`isXiaomiASRConfigured`

### 2. PCM 采集抽取（新建 `src/tutor/pcmCapture.ts`）

将 `doubaoASRRecognizer.ts` 中的 PCM 采集片段抽为公共模块，供豆包与小米共用：

- `createPCMCapture()`：AudioContext（16kHz 优先，失败回退默认采样率 + 重采样）+ ScriptProcessor + float32ToInt16
- 暴露 `onPCMChunk: (chunk: Int16Array) => void` 回调与 `start(stream)`/`stop()` 生命周期
- 豆包识别器改为调用该模块（行为不变：回调里攒 pendingChunks + 定时 flush 发 WS 帧）；小米识别器复用同一模块（回调里只攒不发）

### 3. 小米识别器（新建 `src/tutor/xiaomiASRRecognizer.ts`）

实现 `ISpeechRecognizer`：

- **`start()`**：`acquireStream()` + PCM 采集启动，`pendingChunks` 只攒不发；`_isRecognizing = true`
- **`stop(): Promise<string>`**：
  1. 停采集、flush 合并所有 Int16 PCM
  2. 包 WAV 头（44 字节 RIFF，16kHz/mono/16bit PCM）→ `encodeWavFromPCM(pcm: Int16Array): Uint8Array` 纯函数
  3. base64 编码 → 请求体 `{ model: "mimo-v2.5-asr", messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: "data:audio/wav;base64,..." } }] }], asr_options: { language: "en" }, stream: true }`
  4. `fetch(XIAOMI_ASR_API_URL, { headers: { "api-key": key, "Content-Type": "application/json" } })` 直连
  5. 读 `response.body` 按 SSE 行解析：每个 `data:` chunk 的 `choices[0].delta.content` 增量拼接并触发 `onInterimResult(累计文本)`；`finish_reason: "stop"` 或 `data: [DONE]` 结束
  6. 返回拼接全文
- **`isRecognizing()`**：采集进行中或 SSE 读取中均为 true
- **错误处理**：
  - HTTP 非 2xx：解析响应体 `error.message` 上浮；401 提示「小米 ASR API Key 无效」
  - SSE 中断 / 空结果：抛「未识别到语音内容，请重试」
  - 失败不回退（与四家现有策略一致）

### 4. 接入与设置页

**`tutor.ts`**：`createRecognizer` switch 加：

```ts
case "xiaomi":
  if (!isXiaomiASRConfigured(config)) {
    throw new Error("小米识别未配置 API Key，请到设置页配置或切换识别服务");
  }
  console.log("[Lingride Tutor] 使用小米 ASR 识别器");
  return new XiaomiASRRecognizer();
```

**`popup.html`**：
- `asrProviderSelect` 加 `<option value="xiaomi">小米</option>`（阿里云之后、浏览器识别之前）
- ASR 区块加「小米」嵌套手风琴：单 API Key 字段（`xiaomiAsrApiKey`），hint 链接 `https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/Speech-Recognition`

**`popup.ts`**：
- 保存：`xiaomi_asr = { api_key }`（空 key 删除字段，与其他家一致）
- 加载：回填 key 输入框
- `updateASRProviderHint` 的 labels/checkers 加小米；小米 key 输入框 blur 刷新提示

**`manifest.json`**：无需改动（`https://api.xiaomimimo.com/*` 已存在）。

### 5. 测试

- `resolveASRSelection` 补 2 用例：仅小米已配置 → `xiaomi`；显式 `xiaomi` 直通
- 新建 `src/tutor/xiaomiASRRecognizer.test.ts`：
  - `encodeWavFromPCM`：WAV 头字段（RIFF 魔数、采样率、位深、数据长度）正确性
  - SSE 增量解析：多 chunk 拼接、`[DONE]` 终止、错误行跳过
- PCM 抽取后豆包行为不变：typecheck + 既有 72 测试全绿兜底
- 手动验证：设置页选小米 + 填 key → tutor 录音 → 出英文文本；选小米不填 key → 录音前报错

## 影响文件

| 文件 | 改动 |
|---|---|
| `src/types/config.ts` | XiaomiASRConfig、常量、isXiaomiASRConfigured、ASRProviderId、resolveASRSelection |
| `src/types/index.ts` | 导出新增 |
| `src/types/config.test.ts` | resolveASRSelection 2 新用例 |
| `src/tutor/pcmCapture.ts` | 新建，PCM 采集公共模块 |
| `src/tutor/doubaoASRRecognizer.ts` | 改用 pcmCapture，删内联采集代码 |
| `src/tutor/xiaomiASRRecognizer.ts` | 新建 |
| `src/tutor/xiaomiASRRecognizer.test.ts` | 新建，WAV 编码 + SSE 解析单测 |
| `src/tutor/tutor.ts` | createRecognizer 加 xiaomi 分支 |
| `src/popup/popup.html` | 下拉选项 + 小米手风琴 |
| `src/popup/popup.ts` | 保存/加载/提示 |

## 非目标

- 不改动既有四家识别器内部实现
- 不为小米 ASR 加「测试连接」按钮
- 不动 `xiaomi_tts` 配置结构（TTS 与 ASR key 独立）
- 不支持 mp3 输入（录音场景统一产出 wav）
