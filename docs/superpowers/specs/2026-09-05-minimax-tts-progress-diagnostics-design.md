# MiniMax TTS 合成进度可见性 + 可用性诊断 设计文档

- 日期：2026-09-05
- 范围：`apps/browser-extension`（语料库听力训练 + MiniMax TTS）
- 状态：已获用户批准（分节确认）

## 背景与问题

语料库听力训练页使用 MiniMax 异步语音合成（`t2a_async_v2`）：创建任务 → 每 500ms 轮询 `t2a_async_query_v2` → `files/retrieve_content` 下载音频。用户反馈**大多数句子合成失败、偶尔成功、且等待很久**，而界面上：

1. 点播放后按钮立即变为"播放中"样式（`onStart` 在请求发出时即触发），实际音频可能还在排队合成；
2. 合成失败时静默回退浏览器朗读，用户无法区分"在合成"与"已失败"；
3. 无任何合成进度展示，失败根因（限流/排队/鉴权）不可知。

MiniMax 异步接口只提供 `Processing / Success / Failed / Expired` 状态，无百分比进度，因此进度粒度为**阶段级**。

## 目标

1. 语料库页能看到 AI 语音合成的阶段进度（阶段文案 + 已等待秒数 + 进度条动画），并可取消；
2. 取消后立即用浏览器朗读当前句，不打断学习流程；
3. 合成失败时显示具体原因（本地化错误文案），不再静默；
4. 提供 MiniMax 合成服务可用性诊断：一次性脚本（定位当前根因）+ 插件内置深度诊断（可随时自测）。

## 方案总览

采用**页面轮询合成状态**机制（对比过长连接 Port 推送与页面直连 MiniMax 查询，均否决：前者 MV3 下 Port 生命周期复杂，后者泄露 API key）。service worker 维护活跃合成任务表，页面每 700ms 轮询状态，取消复用现有 `ttsPlaybackEpoch` 机制。

## 1. Service worker：合成任务表与消息协议

### 任务表

```ts
interface TTSSynthesisTaskState {
  stage: 'submitting' | 'synthesizing' | 'downloading' | 'ready' | 'failed' | 'cancelled';
  taskId?: number;      // MiniMax 异步任务 ID
  startedAt: number;    // 计算已等待时长
  errorCode?: string;   // 复用现有 classifyTTSError 错误码
}
```

`activeSynthesisTasks: Map<requestId, TTSSynthesisTaskState>`。

### 阶段流转

`submitting`（创建任务请求中）→ `synthesizing`（轮询中，对应 MiniMax `Processing`）→ `downloading`（拉取音频）→ `ready`；任何一步失败 → `failed`（带 errorCode）；用户取消 → `cancelled`。

### 消息协议（新增 2 个 MessageType，改造 1 个）

| 消息 | 方向 | 说明 |
|---|---|---|
| `SYNTHESIZE_SPEECH`（改造） | 页→SW | 请求体新增 `requestId`；handler 每推进一步更新任务表 |
| `GET_TTS_SYNTHESIS_STATUS` | 页→SW | 入参 `requestId`，返回 `{stage, elapsedMs, errorCode?}`；未知 `requestId` 返回 `{stage: 'unknown'}` |
| `CANCEL_TTS_SYNTHESIS` | 页→SW | 入参 `requestId`：`ttsPlaybackEpoch` +1 作废轮询循环，任务置 `cancelled`，挂起的 Promise 以 `TTS_CANCELLED` 拒绝 |

### 清理

任务终态（`ready/failed/cancelled`）后保留 5 分钟供页面查询最终状态，之后惰性删除，防泄漏。

## 2. hybridTTSPlayer 与语料库页 UI

### hybridTTSPlayer（底层统一，其他场景行为不变）

- 新增可选回调 `onProgress(state: {stage, elapsedMs})` 与选项 `{cancellable: true}`；
- 发起 AI 合成时生成 `requestId` 随 `SYNTHESIZE_SPEECH` 发出；等待响应期间每 700ms 轮询 `GET_TTS_SYNTHESIS_STATUS` 并推给 `onProgress`；收到 `unknown` 视为已结束，停止轮询；
- 新增 `cancelAIPlayback()`：发 `CANCEL_TTS_SYNTHESIS` 并终止本地等待；
- `playTextInternal` 捕获 `TTS_CANCELLED` → 立即用浏览器朗读同一句话；
- 划词工具条等其他场景不传 `onProgress`/`cancellable`，行为完全不变。

### 语料库页 UI

- 播放按钮旁新增进度区：indeterminate 进度条动画 + 阶段文案 + 已等待秒数（如 `合成中… 8s`），阶段变化时更新（`提交中… / 合成中… / 下载音频…`）；
- 进度区右侧取消按钮：点击后停止等待、立即回退浏览器朗读当前句；
- 合成失败时状态栏显示具体原因（复用 `getTTSErrorMessage` 本地化文案，如"鉴权失败，请检查 API key"），同时照常回退浏览器朗读；
- 修正 `onStart` 时机：`ready`（音频真正开始播放）时才标 `playing`，避免按钮状态误导。

## 3. 诊断

### 3.1 一次性诊断脚本

`apps/browser-extension/scripts/diagnose-minimax-tts.mjs`（Node 18+ fetch，零依赖）：

- 输入：环境变量 `MINIMAX_API_KEY`（必填）、`MINIMAX_TTS_MODEL`（默认 `speech-2.8-turbo`）、采样次数（默认 5）；
- 每次采样走完整链路：`POST /v1/t2a_async_v2`（短句 ~50 字符）→ 轮询 `t2a_async_query_v2` → `files/retrieve_content` 下载；
- 记录：各阶段耗时、状态流转序列、HTTP 状态码、MiniMax `base_resp.status_code/status_msg`、最终成功/失败；
- 输出汇总表：成功率、各阶段 avg/p50/max 耗时、错误分布 → 定位限流/排队慢/鉴权问题；
- 脚本提交到 `scripts/`，不作为构建产物。

### 3.2 插件内置深度诊断

- 设置页现有"测试连接"按钮旁加"深度诊断"按钮 → 发 `DIAGNOSE_TTS` 消息（第 1 节消息表之外另行新增的消息类型）→ service worker 顺序跑 3 次采样合成（短句）；
- 返回：成功率、每次耗时、失败时的 errorCode 列表（复用 `classifyTTSError` 保证错误码口径一致）；
- UI 展示如：`3/3 成功 · 平均 4.2s（2.1s ~ 8.7s）` 或 `1/3 成功 · 失败原因：限流 ×2`；
- 诊断期间禁用按钮防重复点击，单次采样超时 60s。

## 4. 错误处理

- `TTS_CANCELLED` 不算错误：静默回退浏览器朗读，不显示警告条；
- 未知 `requestId` 的状态查询返回 `{stage: 'unknown'}`，页面端停止轮询；
- 失败回退保持现有浏览器朗读路径与一次性警告条逻辑。

## 5. 测试（vitest）

- 任务表：阶段流转、TTL 清理、并发 requestId 隔离；
- 取消：cancel 后轮询循环终止、Promise 以 `TTS_CANCELLED` 拒绝、epoch 递增；
- `hybridTTSPlayer`：`onProgress` 轮询节流、`TTS_CANCELLED` 回退浏览器朗读路径、不传回调时行为不变；
- 诊断 handler：多次采样聚合逻辑（mock fetch）。

## 修订记录

### 2026-09-05 修订：短文本改走同步 t2a_v2 接口

诊断脚本实测结论（5 次采样，speech-2.8-turbo，短句 ~60 字符）：

- 异步 `t2a_async_v2`：合成耗时 6~15s，1/5 排队超过 60s 不完成（processing 挂起）
- 同步 `t2a_v2`：~1s 稳定返回（3/3 成功）

根因：异步接口面向长文本/批量任务，短句排队被低优先级调度，表现为"等很久才出声，偶尔永远出不来"。

修订内容：`requestMiniMaxTTSAudio` 增加路由——文本 ≤ 10,000 字符走同步 `t2a_v2`（响应 `data.audio` 为 hex 编码，转 base64 后复用现有播放链路）；> 10,000 字符保留异步管线。进度机制下同步路径只有 `submitting → ready` 两个阶段。诊断功能与"测试连接"因采样文本为短句，自动走同步路径。

## 非目标（YAGNI）

- 不做百分比进度（MiniMax 接口不支持）；
- 不改动划词工具条等其他 TTS 场景的 UI（仅底层能力就绪）；
- 不做自动重试（失败即回退浏览器朗读，保持学习流程不中断；是否重试待诊断脚本定位根因后再议）；
- 不改 WebSocket 流式合成（异步 HTTP 已满足当前场景）。
