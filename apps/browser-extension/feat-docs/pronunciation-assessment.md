# 口语练习录音评估

> 在长难句分析输入框新增录音练习功能，用户可对照原文朗读英文并获得 AI 发音评估反馈。

## 解决什么问题

英语学习者在阅读理解之外，更需要开口说的练习机会。传统方式缺乏即时反馈——读得对不对、哪里需要改进，全凭自己感觉。本功能让用户在分析长难句的同时，可以直接录音练习朗读，AI 会对比原文和识别结果，给出具体的发音评分和改进建议。

## 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│  用户操作流程                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   输入英文句子 ──→ 点击录音按钮 ──→ 朗读句子 ──→ 点击停止        │
│        │                               │                        │
│        │                               ▼                        │
│        │                    Web Speech API 实时识别              │
│        │                               │                        │
│        ▼                               ▼                        │
│   模式 A (有原文)                 识别文本                       │
│        │                               │                        │
│        └───────────────┬───────────────┘                        │
│                        │                                        │
│                        ▼                                        │
│              ┌─────────────────┐                                │
│              │   AI 发音评估    │                                │
│              │  (DeepSeek API) │                                │
│              └────────┬────────┘                                │
│                       │                                        │
│                       ▼                                        │
│   ┌─────────────────────────────────────────────────┐          │
│   │  评估结果：评分、准确度、流利度、问题列表、建议   │          │
│   └─────────────────────────────────────────────────┘          │
│                                                                 │
│   模式 B (无原文)                                                │
│        │                                                        │
│        ▼                                                        │
│   仅显示识别结果（自由练习模式）                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**两种练习模式：**
- **模式 A（对照练习）**：输入框有英文句子时，AI 会对比原文和识别结果进行评估
- **模式 B（自由练习）**：输入框为空时，仅显示语音识别结果，不进行评估

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Popup (popup.ts)                        │
│  ┌───────────────────┐  ┌───────────────────────────────────┐  │
│  │ WebSpeechRecognizer│  │       UI 交互逻辑                  │  │
│  │ (ISpeechRecognizer)│  │ - 录音按钮状态切换                 │  │
│  │                   │  │ - 实时识别预览                     │  │
│  │ - start()         │  │ - 评估结果渲染                     │  │
│  │ - stop()          │  │ - TTS 语音反馈                     │  │
│  │ - onInterimResult │  │                                   │  │
│  └─────────┬─────────┘  └─────────────────┬─────────────────┘  │
│            │                              │                     │
│            │  chrome.runtime.sendMessage  │                     │
│            └──────────────────────────────┼─────────────────────┤
│                                           ▼                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Service Worker (service-worker.ts)            │   │
│  │                                                          │   │
│  │  handleAssessPronunciation(original, recognized)         │   │
│  │  - 加载 Prompt 配置                                       │   │
│  │  - 调用 DeepSeek API                                      │   │
│  │  - 解析 JSON 结果                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 主要模块

| 模块 | 文件路径 | 职责 |
|------|---------|------|
| 类型定义 | `types/pronunciationAssessment.ts` | 定义 ISpeechRecognizer 接口、评估结果结构 |
| Web Speech 类型 | `types/webSpeech.d.ts` | 补充浏览器 Web Speech API 的 TypeScript 类型 |
| Prompt 配置 | `constants/pronunciationPrompts.ts` | AI 发音评估的 System/User Prompt |
| 权限页面 | `permissions/permissions.html/.ts` | 独立的麦克风授权页面 |
| UI 入口 | `popup/popup.html` | 录音按钮、状态指示、评估结果展示区 |
| 样式 | `popup/popup.css` | 录音动画、评估结果卡片样式 |
| 核心逻辑 | `popup/popup.ts` | WebSpeechRecognizer 实现、录音交互、结果渲染 |
| 消息定义 | `types/messages.ts` | ASSESS_PRONUNCIATION 消息类型 |
| 后端处理 | `background/service-worker.ts` | 发音评估 API 调用和结果解析 |

## 技术亮点

### 1. 接口抽象设计

定义了 `ISpeechRecognizer` 抽象接口，当前实现 `WebSpeechRecognizer` 使用浏览器原生 API，未来可无缝切换到 Whisper API：

```typescript
interface ISpeechRecognizer {
  start(): Promise<void>;
  stop(): Promise<string>;
  isRecognizing(): boolean;
  onInterimResult?: (text: string) => void;
  onError?: (error: Error) => void;
}
```

### 2. Chrome 扩展权限处理

Chrome 扩展的 Popup 窗口无法直接请求麦克风权限（会被拒绝），因此设计了独立的授权页面：
- 当权限被拒绝时，自动打开 `permissions.html`
- 用户在新标签页完成授权后，返回 Popup 即可正常使用
- 通过 `web_accessible_resources` 配置页面可访问性

### 3. 实时识别预览

录音过程中通过 `onInterimResult` 回调实时显示识别文本，让用户知道系统"听到"了什么，增强交互感知。

### 4. 语音示范反馈

评估完成后，用户可点击「示范发音」按钮：
- 有问题时：用 TTS 慢速朗读最需要改进的单词两遍
- 无问题时：播放英语鼓励语 "Perfect! Great job!"

### 5. 降级策略

当 AI 评估失败时，仍会显示识别结果（降级到自由练习模式），保证基本功能可用。

## 数据结构

**发音评估结果 (`PronunciationAssessmentResult`)：**

```typescript
{
  score: 85,           // 总分 0-100
  accuracy: 90,        // 准确度
  fluency: 80,         // 流利度
  issues: [{           // 问题列表
    word: "example",
    issue: "发音不清晰",
    correction: "注意重音在第二音节 /ɪɡˈzæmpəl/",
    severity: "minor"  // minor | moderate | major
  }],
  suggestions: [...],  // 改进建议
  encouragement: "...",// 鼓励语
  comparison: {        // 文本对比
    original: "...",
    recognized: "...",
    matchRate: 0.85,
    mismatches: [...]
  }
}
```

## 用户体验设计

- **一键录音**：麦克风图标按钮，点击开始，再点停止
- **状态可见**：录音中显示红色脉冲动画和计时器
- **防呆设计**：录音时间太短（<1s）或无识别结果时给出友好提示
- **超时保护**：最长录音 60 秒自动停止，防止意外长录
- **互斥处理**：朗读（TTS）和录音不会同时进行
