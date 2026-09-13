# 语音识别服务添加 MiniMax 选项 — 设计文档

日期：2026-09-13
状态：已确认

## 1. 背景与目标

设置页「语音识别服务」目前已支持 豆包 / 腾讯云 / 阿里云 / 小米 / 浏览器 五种选择（见 `2026-09-06-asr-provider-selection-design.md` 与 `2026-09-13-xiaomi-asr-provider-design.md`）。本次增加 **MiniMax** 选项，复用刚落地的小米 ASR 模式（录完上传 → SSE 流式文本），让用户可以使用 MiniMax `asr-1.0` 模型做英语跟读识别。

参考文档：https://platform.minimax.cn/docs/api-reference/speech-to-text

### MiniMax Speech-to-Text API 关键事实

- 端点：`POST {base}/v1/speech_to_text`，其中 `{base}` 为国际线路 `https://api.minimaxi.com/v1` 或国内直连 `https://api.minimax.cn/v1`（与 MiniMax TTS 相同的两条线路）
- 认证：`Authorization: Bearer <API_KEY>`（与 MiniMax TTS 同一个 key，同平台通用）
- 请求体：`multipart/form-data`
  - `model=asr-1.0`（固定）
  - `file=<音频文件>`（wav / aiff / flac / m4a / mp3 / aac / opus / ogg，≤ 50MB，≤ 500 秒，不支持裸 PCM）
  - `response_format=json`（json / verbose_json / srt / vtt）
  - `stream=true|false` —— 流式语义为**上传完整文件后 SSE 增量返回文本**，与小米 ASR 相同，不是边录边传
  - `timestamp_level=word|sentence`（json 格式下被忽略，本插件不使用）
- 语言：可选 **请求头** `language: en|zh|yue|ja|ko|...`；省略为自动/混合。本插件固定 `en`
- 非流式响应：`{ "text": "...", "duration": 26.325, "trace_id": "..." }`
- 流式响应：SSE 事件，事件 JSON 含增量文本（第三方 SDK 显示字段为 `delta` / `finish` / `duration`；确切字段名以实测为准，解析器按宽容模式实现）

## 2. 已确认的决策

| 问题 | 决策 |
| --- | --- |
| API Key | **复用 `minimax_tts.api_key`**，不新增独立 ASR key 字段 |
| stream 参数 | `stream: true`（与小米一致） |
| 迁移链位置 | 豆包 > 腾讯 > 阿里 > **MiniMax** > 小米 > 浏览器（插在小米之前） |
| 端点线路 | 复用 `normalizeMiniMaxTTSBaseUrl(minimax_tts.api_base_url)`，跟随 TTS 的国际/国内设置 |
| 共享代码 | 方案 A：`encodeWavFromPCM` 提取为共享模块；SSE 解析各自实现 |
| 失败行为 | 沿用既有约定：识别失败直接报错，不自动切换其他 provider |

## 3. 配置层（src/types/config.ts）

**零新增存储字段** —— 复用 `minimax_tts`，`configManager.getConfig()` 白名单无需改动（`minimax_tts` 与 `asr_selection` 均已在白名单中）。

- `ASRProviderId` 增加 `"minimax"`：`"doubao" | "tencent" | "alibaba" | "minimax" | "xiaomi"`
- 新增判定函数：
  ```ts
  /** MiniMax ASR 是否已配置（复用 MiniMax TTS 的 API Key） */
  export function isMiniMaxASRConfigured(config: LingridConfig): boolean {
    return !!config.minimax_tts?.api_key?.trim();
  }
  ```
- `resolveASRSelection` 迁移链：豆包 > 腾讯 > 阿里 > MiniMax > 小米 > browser
- 新增常量：
  ```ts
  /** MiniMax ASR 固定模型名 */
  export const MINIMAX_ASR_MODEL = "asr-1.0";
  ```
- `src/types/index.ts` 同步导出

## 4. 识别器（src/tutor/minimaxASRRecognizer.ts）

镜像 `xiaomiASRRecognizer` 的结构与契约：

- 类 `MiniMaxASRRecognizer implements ISpeechRecognizer`，构造注入 `LingridConfig`
- `start()`：`isMiniMaxASRConfigured` 检查，缺 key 抛错；用 `createPCMCapture` 攒 16kHz PCM chunks；`onInterimResult` 不提供（上传式识别无中间结果，与小米一致）
- `stop(): Promise<string>` **从不 reject**：
  1. 停止 pcmCapture，拼接 PCM；空 PCM → `onError?.("未录制到音频")` + 返回 `""`
  2. `encodeWavFromPCM`（共享模块）生成 WAV
  3. 构造 `FormData`：`model=asr-1.0`、`file`（WAV Blob，文件名 `audio.wav`）、`response_format=json`、`stream=true`
  4. `fetch POST {normalizeMiniMaxTTSBaseUrl(minimax_tts.api_base_url)}/speech_to_text`，headers：`Authorization: Bearer <key>`、`language: en`
  5. SSE 解析（宽容模式）：跨 chunk buffer 拼接（`split("\n")` + pop 保留不完整行，`TextDecoder` stream 模式）；每个 `data:` 事件解析 JSON，优先累加 `delta` 字段，无 `delta` 时尝试 `text` 增量；`finish: true`、`[DONE]` 或流结束终止；循环结束后残余 buffer 补解析一次
  6. HTTP 非 2xx / 空文本 → `onError?.(…)` + 返回 `""`
  7. `AbortController` 30 秒超时；finally 中 `reader.releaseLock()`

## 5. 共享代码（方案 A）

- 新建 `src/tutor/wavEncoder.ts`：移出 `encodeWavFromPCM`（44 字节 RIFF 头，16kHz/mono/16bit PCM）
- `xiaomiASRRecognizer.ts` 改为 import；`uint8ToBase64` 仅小米需要，留在原文件
- SSE 解析两家事件格式不同（OpenAI 兼容 `choices[0].delta.content` vs MiniMax `delta/finish`），各自实现，不强行抽象

## 6. 接入（src/tutor/tutor.ts）

`createRecognizer()` 的 switch 加 `case "minimax"`：

- 先 `isMiniMaxASRConfigured(config)`，未配置抛 `Error("MiniMax 语音识别未配置 API Key（复用语音合成服务的 MiniMax Key）")`
- `console.log("[Lingride Tutor] 使用 MiniMax ASR 识别器")`
- `return new MiniMaxASRRecognizer(config)`

其余同步机制（`handleTTSSpeedStorageChange` 整体展开合并、`handleShadowRecord` 重建识别器）均已通用，无需改动。

## 7. 设置页（src/popup/popup.html / popup.ts）

- 「优先」下拉 `asrProviderSelect` 增加「MiniMax」选项（`value="minimax"`），位于小米之前，与迁移链顺序一致
- **无独立 key 面板**。选中 MiniMax 时在 ASR 区块显示说明：「复用语音合成服务的 MiniMax API Key」
- 未配置时沿用现有黄色提示（`asrProviderHint`）：「请先在语音合成服务中配置 MiniMax API Key」
- `updateASRProviderHint` 的 labels/checkers 数组加 `{ id: "minimax", label: "MiniMax", isConfigured: isMiniMaxASRConfigured }`
- 保存/加载逻辑无需改动（无新字段；`resolveASRSelection` 自动正确回填）

## 8. 测试

- `src/types/config.test.ts` 补：
  - `isMiniMaxASRConfigured`：`minimax_tts.api_key` 非空为 true，空白/缺失为 false
  - 迁移链：同时配置 MiniMax TTS 与小米 ASR 且无显式选择时解析为 `minimax`
  - 显式 `asr_selection="xiaomi"` 优先于迁移链
- `src/tutor/minimaxASRRecognizer.test.ts`：SSE 解析纯函数用例（delta 累加、`finish: true` 终止、`[DONE]` 终止、非 data 行跳过、畸形 JSON 跳过、跨 chunk 行拼接、残余 buffer 补解析）
- `wavEncoder` 的 WAV 头字段断言沿用小米测试中的用例，随提取一并搬迁
- 验证：`bun run typecheck` + 全部 vitest + `bun run build`；Playwright E2E（填 MiniMax TTS key → ASR 选 MiniMax → 重开回填 → tutor 日志确认「使用 MiniMax ASR 识别器」）

## 9. 风险与开放点

- **SSE 事件字段名以实测为准**：官方文档示例只给了非流式响应。实现按宽容模式解析（delta 优先、text 兜底），联调时用真实 key 实测校准；若实测格式与预期差异大，再迭代解析器，不影响其他模块
- 录音上限：MiniMax 限制 ≤ 500 秒 / ≤ 50MB，跟读场景（≤ 60 秒）远低于上限，不做额外限制

## 10. 非目标

- 不改腾讯/阿里/豆包/小米识别器的行为
- 不做说话人分离、时间戳、字幕导出（`verbose_json`/`srt`/`vtt`）
- 不做边录边传的实时识别
