# 影子跟读语音识别优化

> 解决 Web Speech API 对非母语者识别不准的问题，提供"优化浏览器识别 + 腾讯云专业识别"的双轨方案。

## 解决什么问题

影子跟读功能依赖语音识别将用户的跟读转为文本。浏览器内置的 Web Speech API 对标准英语发音表现良好，但对非母语者的口音识别误差较大，常出现"说对了却识别错"的情况，严重影响学习体验和评估准确性。

本次优化提供两层解决方案：无需额外配置即可享受优化效果，进阶用户可接入腾讯云 ASR 获得更高准确率。

## 工作原理

```
用户开始录音
     ↓
检查腾讯云配置 ──是→ 使用 TencentASRRecognizer
     │                    ↓
     否               建立 WebSocket 连接
     ↓                    ↓
使用 WebSpeechRecognizer    实时发送 16kHz PCM 音频
     ↓                    ↓
获取多候选结果            接收识别结果
     ↓                    ↓
选择置信度最高         失败时自动降级到 WebSpeech
     ↓                    ↓
     └────────→ 返回识别文本 ←────────┘
```

## 架构概览

| 模块 | 职责 | 文件 |
|------|------|------|
| ISpeechRecognizer | 统一接口，定义 start/stop/isRecognizing | types/pronunciationAssessment.ts |
| WebSpeechRecognizer | 浏览器原生识别，多候选优选 | tutor/tutor.ts |
| TencentASRRecognizer | 腾讯云 WebSocket 实时识别 | tutor/tencentASRRecognizer.ts |
| createRecognizer | 工厂函数，根据配置选择识别器 | tutor/tutor.ts |
| handleTencentASRSign | 签名生成（HMAC-SHA1） | background/service-worker.ts |
| TencentASRConfig | 配置类型定义 | types/config.ts |

## 三个优化方案

### 方案 A：优化 Web Speech API 配置

**无需配置，即时生效。**

1. 设置 `maxAlternatives = 3` 获取多个候选结果
2. 遍历候选，选择置信度（confidence）最高的
3. 新增 `getLastConfidence()` 方法供调试
4. 打印置信度日志帮助分析识别质量

```typescript
// 遍历所有候选，选择置信度最高的
for (let j = 1; j < result.length; j++) {
  if (result[j].confidence > bestConfidence) {
    bestAlternative = result[j];
    bestConfidence = result[j].confidence;
  }
}
```

### 方案 B：腾讯云实时语音识别

**可选配置，专业准确。**

1. 用户在设置页面填写 AppID、SecretID、SecretKey
2. 录音时自动采集音频，重采样到 16kHz
3. 通过 WebSocket 实时发送 PCM 数据
4. 接收中间结果和最终结果，实时更新预览

**技术要点：**
- WebSocket 协议：`wss://asr.cloud.tencent.com/asr/v2/{appid}?{params}`
- 音频格式：16000Hz、16bits、单声道 PCM
- 签名算法：HMAC-SHA1 + Base64
- 签名在 background 生成，保护密钥安全

### 方案 C：智能降级

**透明无感，保证可用。**

1. `createRecognizer()` 工厂函数根据配置动态选择
2. 腾讯云连接失败时自动降级到 Web Speech API
3. 显示 warning 提示告知用户当前使用浏览器识别
4. 不中断用户流程，保证功能始终可用

## 用户使用流程

1. **零配置体验**：安装后直接使用，自动享受方案 A 优化
2. **进阶配置**：设置 → 语音识别 → 填写腾讯云密钥
3. **自动生效**：配置后下次录音自动使用腾讯云
4. **无缝降级**：腾讯云异常时自动切换，无需手动干预

## 技术亮点

1. **接口抽象**：`ISpeechRecognizer` 统一两种识别器，调用方无需关心底层实现
2. **工厂模式**：`createRecognizer()` 封装选择逻辑，支持未来扩展更多识别器
3. **音频重采样**：AudioContext + 线性插值，将浏览器采样率转换为 16kHz
4. **安全设计**：密钥存储在 chrome.storage.local，签名在 background Service Worker 生成
5. **优雅降级**：错误回调 + 自动切换，保证功能在各种网络环境下可用

## 相关文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| tutor/tencentASRRecognizer.ts | 新增 | 腾讯云 ASR 识别器实现 |
| tutor/tutor.ts | 修改 | WebSpeechRecognizer 优化 + createRecognizer 工厂 |
| tutor/tutor.css | 修改 | warning 状态样式 |
| background/service-worker.ts | 修改 | TENCENT_ASR_SIGN 消息处理 + HMAC-SHA1 签名 |
| types/config.ts | 修改 | TencentASRConfig 类型 |
| types/messages.ts | 修改 | TENCENT_ASR_SIGN 消息类型 |
| types/index.ts | 修改 | 导出新类型 |
| popup/popup.html | 修改 | 腾讯云配置表单 |
| popup/popup.ts | 修改 | 配置保存/读取逻辑 |
| popup/popup.css | 修改 | 表单样式（已有） |
