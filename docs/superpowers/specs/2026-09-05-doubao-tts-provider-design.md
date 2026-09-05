# 新增豆包（火山方舟）语音合成 设计文档

- 日期：2026-09-05
- 范围：`apps/browser-extension`（service worker / types / popup / manifest）
- 状态：已获用户批准（分节确认）

## 背景

设置页"语音合成服务"新增第三个 AI 提供者：豆包语音合成（火山方舟，doubao-seed-tts-2.0）。

**已实测确认**（2026-09-05，用户方舟 API Key）：
- `POST https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional` 可用
- 响应为 JSONL 分块：`{"code":0,"message":"","data":"<base64 音频片段>"}`，**code 0 表示成功**（旧版 API 的 3000 不适用）
- 音色 `en_female_allison_uranus_bigtts` 实测返回合法 mp3（ID3 头）

## 1. 接入方式

选 **HTTP Chunked 单向流式**接口（一次性发文本、一次性收完整音频）：与现有 `TTSAudioData` 流程（完整 base64 → offscreen 播放）完全契合。WebSocket 双向/单向流式的低延迟优势在听写练习场景用不上，复杂度高，不采用。

## 2. 数据流与配置

### 请求

- URL：`https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`
- Headers：`X-Api-Key: <api_key>`、`X-Api-Resource-Id: seed-tts-2.0`、`X-Api-Request-Id: <crypto.randomUUID()>`
- Body：`{ req_params: { text, speaker, audio_params: { format: "mp3", sample_rate: 24000 } } }`

### 响应解析

按行解析 JSONL：收集每行 `data`（base64 片段）→ 逐块 base64 解码拼接字节 → 转 base64 存入 `TTSAudioData`（mimeType `audio/mpeg`）。任一行 `code !== 0` → 失败（message 作为错误详情）；无 data 片段 → `TTS_AUDIO_INVALID`。

### 配置与类型

- `DoubaoTTSConfig { api_key, voice? }`；`LingridConfig` 新增 `doubao_tts?: DoubaoTTSConfig`
- `TTSProviderId` 与 `TTSSelectionMode` 增加 `"doubao"`
- `DoubaoTTSVoice`：`"en_female_allison_uranus_bigtts"` 等枚举 + `normalizeDoubaoTTSVoice`（未知值回退默认音色）
- manifest 增加 `https://openspeech.bytedance.com/*` host 权限

### 音色下拉（固定 4 项）

- 默认音色（Allison 女声）：`en_female_allison_uranus_bigtts`
- Zoe（英文女声）：`en_female_brittney_pimintel_uranus_bigtts`
- Alex（英文男声）：`en_male_alex_uranus_bigtts`
- Alberto（英文男声）：`en_male_alberto_uranus_bigtts`

### 错误处理

- 复用 `classifyTTSError` / `createTTSError`；`getTTSProviderLabel` 由二元三元表达式改为三家映射（minimax→MiniMax、xiaomi→小米、doubao→豆包）
- "测试连接"（`handleTestTTSConnection`）与"深度诊断"（`handleDiagnoseTTS`）走 `requestTTSAudioByProvider`，加 `doubao` 分支即自动支持

## 3. UI 与验证

- popup 设置页新增"豆包"手风琴：端点（只读）+ API Key（密码框 + 显示切换）+ 音色下拉 + 测试连接按钮；提供者选择下拉新增"豆包"
- 语料库页 `applyAITTSConfig` 识别 `doubao`；`hybridTTSPlayer` 无需改动（provider 无关）
- 测试：`normalizeDoubaoTTSVoice` 单测；`typecheck / lint / build / vitest` 全量
- 实测：用户方舟 key curl 验证各音色；加载 dist 人工验证

## 非目标（YAGNI）

- 不接 WebSocket 流式、双向流式、SSE
- 不接声音复刻（seed-icl-2.0）、SSML、情绪参数
- 不做音色自定义输入（仅固定下拉）
