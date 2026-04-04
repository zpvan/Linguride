# 阿里云 ASR 集成

> 在 Chrome 扩展中集成阿里云百炼 Paraformer 实时语音识别，作为 ASR 服务的备选方案。

## 解决什么问题

腾讯云 ASR 虽然识别效果好，但配置相对繁琐（需要 AppID、SecretID、SecretKey 三项）。阿里云百炼只需一个 API Key，降低了用户使用门槛。同时，多 ASR 服务商支持也提供了更好的容错能力。

## 工作原理

```
┌─────────────┐    Port 连接     ┌──────────────────┐    WebSocket    ┌─────────────┐
│   Content   │ ◄───────────────► │    Background    │ ◄─────────────► │  阿里云 ASR  │
│   Script    │                   │  Service Worker  │                 │   服务端     │
│             │                   │                  │                 │             │
│ ┌─────────┐ │   音频数据(B64)   │ ┌──────────────┐ │   PCM 二进制    │             │
│ │Alibaba  │ │ ─────────────────► │ │ ASR Session  │ │ ───────────────► │             │
│ │ASR      │ │                   │ │ 管理器       │ │                 │             │
│ │Recognizer│ │   实时识别结果    │ └──────────────┘ │   识别结果      │             │
│ └─────────┘ │ ◄───────────────── │                  │ ◄─────────────── │             │
└─────────────┘                   └──────────────────┘                 └─────────────┘
```

### 核心流程

1. **建立连接**：Tutor 页面通过 `chrome.runtime.connect()` 建立 Port 长连接
2. **启动识别**：发送 `ALIBABA_ASR_START`，Background 建立 WebSocket 并发送 `run-task` 指令
3. **音频采集**：Content Script 采集麦克风音频，重采样至 16kHz，每 100ms 发送一次
4. **实时推送**：Background 接收识别结果，通过 Port 推送到 Content Script
5. **停止识别**：发送 `ALIBABA_ASR_STOP`，Background 发送 `finish-task` 指令并返回最终结果

## 架构概览

| 层次 | 文件 | 职责 |
|------|------|------|
| 类型定义 | `types/config.ts` | 定义 `AlibabaASRConfig` 接口 |
| 类型定义 | `types/messages.ts` | 定义 ASR 消息类型（Start/Audio/Stop/Result） |
| 代理层 | `tutor/alibabaASRRecognizer.ts` | 实现 `ISpeechRecognizer` 接口，管理音频采集 |
| 服务层 | `background/service-worker.ts` | 管理 WebSocket 连接，保护 API Key |
| 工厂层 | `tutor/tutor.ts` | `createRecognizer()` 按优先级选择 ASR 服务 |
| UI 层 | `popup/popup.html` / `popup.ts` | 阿里云 API Key 配置界面 |

## 主要模块

### AlibabaASRRecognizer（代理类）

实现 `ISpeechRecognizer` 接口，运行在 Content Script 中。负责：
- 建立与 Background 的 Port 长连接
- 采集麦克风音频并重采样至 16kHz
- 将 PCM 数据编码为 Base64 发送
- 接收实时识别结果并触发回调

### Background ASR 会话管理

在 Service Worker 中管理 WebSocket 连接。负责：
- 使用 API Key 建立 WebSocket 连接（保护密钥安全）
- 解析阿里云返回的事件（task-started / result-generated / task-finished）
- 累积中间结果和最终结果
- 通过 Port 向 Content Script 推送实时结果

### createRecognizer 工厂函数

按固定优先级选择 ASR 服务：
1. **腾讯云 ASR**（如已配置）
2. **阿里云 ASR**（如已配置）
3. **Web Speech API**（浏览器内置，作为降级方案）

## 技术亮点

### 1. API Key 安全保护

阿里云 ASR WebSocket 连接在 Background Service Worker 中建立，API Key 通过 URL 参数传递给阿里云服务端，永远不会暴露在 Content Script 中。

```typescript
// Background 中建立连接（Content Script 无法访问 apiKey）
const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/inference?token=${apiKey}`;
const ws = new WebSocket(wsUrl);
```

### 2. 音频发送间隔优化

阿里云建议每 100ms 发送一次音频数据（腾讯云是 200ms），以获得更好的实时性。

```typescript
const AUDIO_SEND_INTERVAL = 100; // 阿里云推荐 100ms
```

### 3. Port 长连接双向通信

使用 Chrome 的 Port API 实现双向通信，避免了 `sendMessage` 的请求-响应模式限制，更适合实时数据流场景。

```typescript
// Content Script 端
const port = chrome.runtime.connect({ name: "alibaba-asr" });
port.postMessage({ type: MessageType.ALIBABA_ASR_AUDIO, payload: { audioData } });
port.onMessage.addListener((msg) => { /* 处理实时结果 */ });
```

### 4. 音频重采样

支持任意采样率的麦克风，使用线性插值重采样至阿里云要求的 16kHz。

```typescript
private resample(inputData: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  // 线性插值算法
}
```

## ASR 服务优先级

| 优先级 | 服务 | 配置要求 | 特点 |
|--------|------|----------|------|
| 1 | 腾讯云 ASR | AppID + SecretID + SecretKey | 识别准确率高 |
| 2 | 阿里云 ASR | API Key | 配置简单 |
| 3 | Web Speech API | 无需配置 | 浏览器内置，离线不可用 |

## 消息类型

| 消息 | 方向 | 用途 |
|------|------|------|
| `ALIBABA_ASR_START` | Tutor → Background | 启动识别会话 |
| `ALIBABA_ASR_AUDIO` | Tutor → Background | 发送音频数据（Base64） |
| `ALIBABA_ASR_STOP` | Tutor → Background | 停止识别并获取最终结果 |
| `ALIBABA_ASR_RESULT` | Background → Tutor | 推送实时识别结果 |
