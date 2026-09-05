# 新增豆包（火山方舟）语音识别 设计文档

- 日期：2026-09-05
- 范围：`apps/browser-extension`（tutor / types / popup / manifest / service worker）
- 状态：已获用户批准（分节确认）

## 背景

设置页"语音识别服务"新增豆包（doubao-seed-asr-2.0，火山方舟）选项，配置后**优先级最高**（豆包 > 腾讯 > 阿里 > Web Speech）。ASR 用于发音评估与影子跟读（tutor 页），统一走 `ISpeechRecognizer` 接口。

官方参考：`https://www.volcengine.com/docs/82379/2516286`（接入语音模型）+ `docs/6561/2628951`（单向流式 ASR）+ SAUC 协议官方示例。

## 1. 配置与优先级

- 新增 `DoubaoASRConfig { api_key }`（**独立 key 字段**，不复用 TTS 的）+ `LingridConfig.doubao_asr`；configManager 透传
- `createRecognizer()`（`src/tutor/tutor.ts:715`）优先级链改为：**豆包 > 腾讯 > 阿里 > Web Speech**（配置了豆包 key 即最高优先级）
- 设置页"语音识别服务"手风琴新增"豆包"嵌套区块：单个 API Key 输入（密码框 + 显示切换）+ 文档链接，镜像阿里云区块

## 2. 协议接入（SAUC 单向流式）

### 鉴权头注入

浏览器 WebSocket API 不支持自定义 header。manifest 增加 `declarativeNetRequest` 权限，service worker 在启动与配置保存时用 `chrome.declarativeNetRequest.updateSessionRules` 给 `openspeech.bytedance.com/api/v3/sauc/*` 的 WebSocket 握手注入三个头：

- `X-Api-Key: <doubao_asr.api_key>`
- `X-Api-Resource-Id: volc.seedasr.sauc.duration`
- `X-Api-Request-Id: <uuid>`

未配置豆包 key 时移除该规则。这样识别器可在 tutor 页直连 WS（镜像腾讯识别器结构，无需 Port 中转）。

### SAUC v1 二进制帧（全部大端序）

```
byte0: (protocol_version=1 << 4) | header_size=1（4 字节头）
byte1: (message_type << 4) | flags
byte2: (serialization << 4) | compression
byte3: reserved = 0
[flags 含序列号时] int32 sequence
uint32 payload_size
payload（compression=1 时 gzip）
```

- 消息类型：`1` full client request、`2` audio only、`9` full server response、`0b1011` server ack、`0b1111` error（此时 sequence 字段为错误码，payload 为错误消息）
- flags：`0` 无序列号、`1` 正序列号、`2` 负序列号、`3` 最后一包带序列号（音频最后一包：seq 取负）
- 响应中 sequence < 0 = 最后一包
- gzip 用浏览器原生 `CompressionStream`/`DecompressionStream`，零依赖

### 会话流程

1. 建连 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream`
2. 发 full client request（seq=1，JSON+gzip）：`{ user: { uid }, audio: { format: "pcm", codec: "raw", rate: 16000, bits: 16, channel: 1 }, request: { model_name: "bigmodel", enable_punc: true } }`
3. 复用现有 `audioCapture` 的 16kHz PCM 采集，每 ~200ms 一帧发 audio only request（seq 递增，gzip PCM）
4. stop：发负包（seq 取负），等服务端最后一包（sequence < 0）取整句结果
5. 结果 JSON 中取 `result.text`；错误帧按 code/payload 上报 `onError`（复用现有 onFallback 降级链）

### 代码结构

- 新建 `src/tutor/doubaoASRRecognizer.ts` 实现 `ISpeechRecognizer`（镜像 `tencentASRRecognizer.ts` 结构）
- 帧编/解码抽成纯函数 `src/tutor/saucProtocol.ts`（可单测，不依赖 WebSocket）
- `isDoubaoASRConfigured(config)` helper

## 3. 验证

- `saucProtocol.ts` 单测：full request 编码字节布局、gzip round-trip、音频帧序列号递增/取负、响应解析（含错误帧）
- 实测：方舟 key + 英文音频样本走通完整识别（返回正确文本）
- typecheck / lint / build / vitest 全量；加载 dist 人工验证发音评估与跟读

## 非目标（YAGNI）

- 不接双向流式 bigmodel_async（单向流式准确率更高，场景够用）
- 不接 HTTP 录音文件识别（AUC）
- 不做说话人分离、语种指定等高级参数（默认中英自动）
- 不做 ASR 提供者的 UI 排序配置（优先级按硬编码链）
