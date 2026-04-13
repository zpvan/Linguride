# Browser Extension `AI服务` 增加 `MiniMax` 服务商设计

日期：2026-04-14  
范围：`apps/browser-extension` 设置页、AI Provider 路由与 MiniMax Anthropic 兼容接入  
状态：已确认（方案 A）

## 1. 背景与目标

当前浏览器插件在 `设置 -> AI服务` 中支持 `DeepSeek / GLM / OpenAI / 自定义`。本次新增 `MiniMax` 服务商，并按 MiniMax 官方文档推荐方式接入 `Anthropic API 兼容` 文本能力。

明确目标：
- 在服务商下拉中新增 `MiniMax`
- `MiniMax` 使用固定端点：`https://api.minimaxi.com/anthropic`
- 在 UI 中提供官方文档对应的模型预设，并支持 `自定义...`
- 新增独立 `MiniMaxProvider`，适配现有 `ITranslateProvider`
- 保持现有 `DeepSeek / GLM / OpenAI / 自定义` 行为稳定

不在本次范围：
- 不把 `MiniMax` 降级为“自定义端点预设”
- 不把 `MiniMax` 接到 OpenAI 兼容路径
- 不改造现有 `MiniMax TTS` 能力与优先级
- 不引入流式响应、工具调用、多模态输入

## 2. 关键约束

- 接入方式遵循 MiniMax 官方推荐的 `Anthropic API 兼容` 页面，而不是 OpenAI 兼容页
- 现有 AI provider 抽象接口是：
  - `translate(texts)`
  - `chat(systemPrompt, userPrompt)`
  - `testConnection()`
- 现有 `DeepSeekProvider` 是 OpenAI Chat Completions 形态，不能直接复用其请求体
- 已有 `MiniMax TTS` 使用域名 `https://api.minimax.io/v1`，本次 AI provider 使用的是 `https://api.minimaxi.com/anthropic`，两者必须并存，不能混用
- 默认 provider 仍保持 `deepseek`

## 3. 方案选型

采用方案 A：`MiniMax` 独立配置 + 独立 `MiniMaxProvider` + Anthropic Messages 适配。

理由：
- 与用户指定的 MiniMax 官方示例一致
- 不把 Anthropic 兼容细节硬塞进现有 OpenAI 兼容实现，边界更清晰
- 后续如果增加 `thinking`、工具调用或更多 MiniMax 特性，有单独演进空间

放弃的方案：
- 方案 B：按 OpenAI 兼容接入，改动最小，但与本次设计目标不符
- 方案 C：仅做自定义端点预设，用户体验和维护性都不足

## 4. 架构与模块边界

### 4.1 类型与配置层

- 扩展 `AIProviderId`：
  - `"deepseek" | "openai" | "custom" | "glm" | "minimax"`
- 新增 `MiniMax` AI 固定端点常量：
  - `https://api.minimaxi.com/anthropic`
- `resolveConfigApiProvider` 增加 `minimax` 显式识别
- 当 `api_provider` 缺失但 `api_base_url` 为 `https://api.minimaxi.com/anthropic` 时，也应推断为 `minimax`
- `DEFAULT_CONFIG` 保持不变，不切换默认服务商

### 4.2 UI 层（popup）

- `服务商` 下拉新增 `MiniMax`
- 选中 `MiniMax` 时：
  - `api_base_url` 自动设置为 `https://api.minimaxi.com/anthropic`
  - `api_key` 继续使用通用输入框
  - `model` 切换为 MiniMax 预设下拉，并保留 `自定义...`
- 预设模型列表采用官方文档中的 Anthropic 兼容模型：
  - `MiniMax-M2.7`
  - `MiniMax-M2.7-highspeed`
  - `MiniMax-M2.5`
  - `MiniMax-M2.5-highspeed`
  - `MiniMax-M2.1`
  - `MiniMax-M2.1-highspeed`
  - `MiniMax-M2`
  - `自定义...`
- 默认模型使用 `MiniMax-M2.7`
- provider 切换时沿用现有“如果之前选中的是预设模型，则切到新 provider 的默认预设；自定义模型保持原值”的规则

### 4.3 Provider 层

- 新增 `MiniMaxProvider`
  - 继承 `BaseTranslateProvider`
  - 不继承 `DeepSeekProvider`
  - 对外 `name = "MiniMax"`
- 请求协议使用 Anthropic Messages 兼容格式
  - 发送 `system`
  - 发送 `messages`
  - 非流式
- 响应解析：
  - 从 `content[]` 中提取 `type = "text"` 的内容并拼接为最终文本
  - 忽略 `thinking` 块，不进入现有翻译结果解析流程
- 保持与现有 provider 一致的超时、重试、日志、错误包装风格

### 4.4 路由层（background/aiProvider）

- `openai + oauth`：继续走 `OpenAICodexProvider`
- `glm`：继续走 `GLMProvider`
- `minimax`：新增路由到 `MiniMaxProvider`
- 其余 provider 行为保持不变

### 4.5 权限与文档层

- `manifest.json` 新增 host permission：
  - `https://api.minimaxi.com/*`
- 保留现有 `https://api.minimax.io/*`
  - 原因：这是 `MiniMax TTS` 使用的域名
- `README.md` 的 AI 服务说明增加 `MiniMax`

## 5. 数据流

1. 用户在设置页选择 `MiniMax`
2. popup 将 `api_provider=minimax`
3. popup 自动写入固定 `api_base_url=https://api.minimaxi.com/anthropic`
4. 若原模型是旧 provider 的预设，则重置为 `MiniMax-M2.7`
5. 配置自动保存到 `chrome.storage.local`
6. background 读取配置并路由到 `MiniMaxProvider`
7. `MiniMaxProvider` 发送非流式 Anthropic Messages 请求
8. 返回文本结果后，继续复用现有翻译解析、难度分析、释义等上层业务流程

## 6. 请求与响应设计

### 6.1 端点与认证

- Base URL：`https://api.minimaxi.com/anthropic`
- 实际请求端点：推断为 `POST https://api.minimaxi.com/anthropic/v1/messages`
- 推断依据：
  - MiniMax 文档给出环境变量：`ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic`
  - Anthropic 官方 Messages API 为 `POST /v1/messages`
- 认证头预期为：
  - `x-api-key: <api_key>`
  - `anthropic-version: 2023-06-01`
  - `content-type: application/json`

说明：
- 上述 HTTP 细节中的 `POST /v1/messages`、`x-api-key`、`anthropic-version` 是根据 Anthropic 官方 API 规范推导出的兼容接法
- 如果 MiniMax 实际兼容层对请求头或路径有额外差异，实现阶段以实测为准，但规格默认采用该组合

### 6.2 请求体映射

- `systemPrompt` 映射到 `system`
- `userPrompt` 映射为单条 `messages`：
  - `role: "user"`
  - `content: [{ type: "text", text: userPrompt }]`
- `model` 直接使用用户配置值
- `max_tokens` 固定为 `8192`
  - 不在本次 UI 中暴露
  - 目的：满足翻译、释义、难度分析等现有文本任务的输出上限需求，同时避免实现阶段出现临时取值分歧
- `temperature` 固定为 `0.3`
  - 与现有 `DeepSeekProvider` 的翻译低温策略保持一致

### 6.3 响应体映射

- Anthropic 风格响应的 `content[]` 可能包含多个 block
- 本扩展只消费 `type = "text"` 的 block
- 若不存在任何文本 block，则判定为“API 返回空响应”
- `thinking`、`tool_use`、`tool_result` 在本次全部忽略

## 7. 兼容性与迁移策略

- 无破坏性存储迁移
- 老用户即使没有 `api_provider=minimax` 字段也不受影响
- `resolveConfigApiProvider` 的 base URL 推断保证：
  - 如果未来有用户通过旧配置或导入配置直接写入 `https://api.minimaxi.com/anthropic`
  - 系统仍能识别为 `minimax`
- `MiniMax TTS` 仍继续使用 `minimax_tts` 配置，不与 AI provider 共享字段

## 8. 错误处理策略

- 连接测试失败时应返回 `MiniMax` 语义错误，而不是 `DeepSeek` 或通用 provider 名称
- 对以下错误不做重试：
  - `400`
  - `401`
  - `403`
- 对以下错误保留指数退避重试：
  - 网络中断
  - 超时
  - 临时服务异常
- 若返回结构不符合预期，应抛出带 provider 前缀的格式错误
- 日志中 provider 名称固定为 `MiniMax`

## 9. 测试与验收标准

### 9.1 类型与构建

- `npm run typecheck --workspace apps/browser-extension` 通过，或在扩展目录 `npm run typecheck` 通过
- `npm run build --workspace apps/browser-extension` 通过，或在扩展目录 `npm run build` 通过

### 9.2 UI 验收

- 设置页展示 `MiniMax`
- 选择 `MiniMax` 后端点自动为 `https://api.minimaxi.com/anthropic`
- 模型下拉展示 MiniMax 预设列表
- 从 `DeepSeek / GLM / OpenAI / 自定义` 切换到 `MiniMax` 时，预设模型归一化行为正确

### 9.3 Provider 验收

- `测试连接` 能调用 `MiniMaxProvider`
- 请求地址为 `https://api.minimaxi.com/anthropic/v1/messages`
- 请求头包含 `x-api-key` 与 `anthropic-version`
- 返回文本可被 `translate()` 与 `chat()` 上层流程消费

### 9.4 回归验收

- `GLM` 行为不回归
- `OpenAI OAuth` 行为不回归
- `MiniMax TTS` 相关 host permission 和配置行为不受影响

## 10. 风险与控制策略

主要风险：
- 把 `MiniMax` 错接到 OpenAI 兼容实现，导致请求格式错误
- 混淆 `minimaxi.com` 与 `minimax.io` 两套域名
- Anthropic 响应包含 `thinking` 块，若解析不当会污染翻译结果
- provider 切换逻辑漏掉 `minimax`，导致模型值与 UI 不一致

控制策略：
- 新建独立 `MiniMaxProvider`，避免与 OpenAI 兼容实现耦合
- 将 `MiniMax AI` 与 `MiniMax TTS` 的 base URL 常量分开命名
- 响应解析仅提取 `text` block
- 构建验证加手工路径检查，确认 provider 切换和 host permissions 正确

## 11. 实施边界

本次实现只覆盖浏览器扩展内部的 AI 文本 provider 接入，不包含：
- 桌面端或 Android 端同步接入
- MiniMax 模型目录在线拉取
- `thinking` 内容展示
- 工具调用、图片输入、文档输入

## 12. 参考来源

- MiniMax Anthropic API 兼容文档：
  - https://platform.minimaxi.com/docs/api-reference/text-anthropic-api
- MiniMax 文本接口文档：
  - https://platform.minimaxi.com/docs/api-reference/text-post
- Anthropic API Overview：
  - https://platform.claude.com/docs/en/api/overview

## 13. 后续计划入口

本设计通过并经用户 review 后，下一步进入 `writing-plans`，产出逐文件实现计划与验证清单。
