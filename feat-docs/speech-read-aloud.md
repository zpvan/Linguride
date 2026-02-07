# 语音朗读 (Text-to-Speech)

> 在 Popup 长难句分析区域新增"朗读"按钮，使用浏览器原生 Web Speech API 实现零依赖的英文语音播放。

## 解决什么问题

英语学习者在分析长难句时，常常不确定句子的正确发音和语调。传统方案需要接入第三方 TTS API（如 ElevenLabs、Azure），增加配置成本和网络依赖。

本功能利用浏览器内置的 `speechSynthesis` API，无需额外配置即可获得即时语音反馈，降低学习摩擦。

## 工作原理

```
用户输入文本 → 点击朗读按钮 → 创建 SpeechSynthesisUtterance → 浏览器朗读
                    ↓
              [正在朗读中]
                    ↓
            再次点击 → speechSynthesis.cancel() → 停止
```

**关键流程：**
1. 按钮绑定 `handleSpeakSentence()` 点击事件
2. 检测当前是否正在朗读（`speechSynthesis.speaking`）
3. 若已在朗读则停止；否则创建 `SpeechSynthesisUtterance` 并播放
4. 通过 `utterance.onstart/onend/onerror` 回调切换按钮状态

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  popup.html                                             │
│  ├── .sentence-actions (flexbox 容器)                   │
│  │   ├── #analyzeSentenceBtn (分析按钮)                 │
│  │   └── #speakSentenceBtn   (朗读按钮，含双 SVG 图标)  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  popup.ts                                               │
│  ├── handleSpeakSentence()   → 控制朗读开始/停止        │
│  ├── handleSentenceInput()   → 输入变化时停止朗读       │
│  ├── visibilitychange 事件   → Popup 隐藏时停止         │
│  └── pagehide 事件           → 页面卸载时停止           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  浏览器原生 API                                         │
│  └── window.speechSynthesis + SpeechSynthesisUtterance  │
└─────────────────────────────────────────────────────────┘
```

## 主要模块

| 文件 | 职责 |
|------|------|
| `popup.html` | 定义双按钮布局和双 SVG 图标结构 |
| `popup.css` | 实现 `.btn-speak` 样式、`.speaking` 状态动画、图标切换 |
| `popup.ts` | 封装朗读逻辑、事件绑定、状态管理、Popup 关闭清理 |

## 技术亮点

### D1: Popup 关闭时主动停止语音

Chrome Extension 的 Popup 在关闭时不会自动中断 Web Speech API，可能导致"幽灵朗读"。采用双重兜底策略：

```typescript
document.addEventListener("visibilitychange", () => {
  if (document.hidden) speechSynthesis.cancel();
});
window.addEventListener("pagehide", () => {
  speechSynthesis.cancel();
});
```

### D2: 分析与朗读互斥

点击"分析句子"时自动停止正在进行的朗读，避免声音干扰用户阅读分析结果：

```typescript
if (speechSynthesis.speaking) {
  speechSynthesis.cancel();
  speakSentenceBtn.classList.remove("speaking");
}
```

### D3: CSS 驱动的图标切换

两个 SVG 图标始终存在于 DOM 中，通过 `.speaking` 类控制 `display` 属性切换，避免 JS 操作 DOM：

```css
.btn-speak .icon-stop { display: none; }
.btn-speak.speaking .icon-speak { display: none; }
.btn-speak.speaking .icon-stop { display: inline; }
```

### 零依赖方案

- 使用浏览器原生 Web Speech API，无需 API Key
- 纯前端实现，不涉及 background service-worker
- 语速设为 0.9（略慢），适合语言学习场景

## 交互状态

| 状态 | 按钮外观 | 点击行为 |
|------|----------|----------|
| 输入框为空 | 灰色禁用态 | 不可点击 |
| 有输入、未朗读 | 渐变色 + 扬声器图标 | 开始朗读 |
| 朗读中 | 红色背景 + 脉冲动画 + 停止图标 | 停止朗读 |

## 相关文件

- `chrome-extension/src/popup/popup.html` — 第 116-130 行
- `chrome-extension/src/popup/popup.css` — 第 401-465 行
- `chrome-extension/src/popup/popup.ts` — 第 144-148, 291-302, 838-877 行
