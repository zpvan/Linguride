# 英文释义功能

> 将网页英文内容改写为适合用户水平的版本，基于克拉申的"可理解性输入假说"（i+1 理论）设计。

## 解决什么问题

英语学习者在阅读原版英文内容时，常常遇到两难困境：
- 原版内容难度过高，生词太多，读不下去
- 简化版本失去了原文的丰富性和地道表达

英文释义功能通过 AI 智能改写，将高难度英文内容调整到"略高于用户当前水平"的难度，实现：
- 大部分内容可理解（约 95%）
- 保留少量新词汇促进学习（约 5%，即 i+1）
- 保持原文的核心信息和观点

## 工作原理

```
用户选择自己的 CEFR 水平（如 A2）
                ↓
        点击「英文释义」开关
                ↓
        系统计算目标水平（A2 → B1）
                ↓
     提取页面可见区域的英文段落
                ↓
       调用 AI 进行智能改写
                ↓
     释义结果显示在原文下方（绿色边框）
```

### 目标等级计算

```typescript
function calculateTargetLevel(userLevel: CEFRLevel): CEFRLevel {
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const currentIndex = levels.indexOf(userLevel);
  const targetIndex = Math.min(currentIndex + 1, levels.length - 1);
  return levels[targetIndex];
}
```

| 用户水平 | 目标水平 | 说明 |
|---------|---------|------|
| A1 | A2 | 入门 → 初级 |
| A2 | B1 | 初级 → 中级 |
| B1 | B2 | 中级 → 中高级 |
| B2 | C1 | 中高级 → 高级 |
| C1 | C2 | 高级 → 精通 |
| C2 | C2 | 已是最高级，AI 判断是否需要改写 |

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         Popup UI                            │
│   • CEFR 水平选择器（立即保存）                               │
│   • 英文释义开关（与翻译互斥）                                 │
│   • 高级设置：自定义释义 Prompt                               │
└─────────────────────────────────────────────────────────────┘
                              ↓ TOGGLE_PARAPHRASE
┌─────────────────────────────────────────────────────────────┐
│                     Background Service                       │
│   handleToggleParaphrase() - 状态管理，互斥逻辑               │
│   handleParaphrase() - 构建 Prompt，调用 AI                  │
└─────────────────────────────────────────────────────────────┘
                              ↓ PARAPHRASE
┌────────────────────────┐    ┌────────────────────────────────┐
│    Content Script      │    │      DeepSeekProvider          │
│    • 视口优先策略       │    │      • 批量释义请求             │
│    • 释义结果注入       │    │      • 编号格式解析             │
│    • 互斥状态管理       │    │                                │
└────────────────────────┘    └────────────────────────────────┘
```

## 核心设计

### 1. 功能互斥

翻译和释义功能互斥，开启一个自动关闭另一个：

```typescript
// TabState 互斥逻辑
export function setParaphraseState(tabId: number, enabled: boolean): void {
  tabStates.set(tabId, {
    translationEnabled: enabled ? false : currentState?.translationEnabled,
    paraphraseEnabled: enabled,
    updatedAt: Date.now(),
  });
}
```

互斥原因：
- 避免页面内容混乱（原文 + 释义 + 翻译 = 3 份内容）
- 两个功能目的不同：释义帮助学英语，翻译帮助快速理解
- 简化用户心智模型

### 2. 视口优先策略

复用翻译功能的视口优先策略：
- 只释义用户当前可见的内容
- 滚动时动态释义新内容
- 提前一屏预加载，确保滚动流畅

### 3. 批量处理

使用编号格式进行批量释义，减少 API 调用：

```
输入格式：
1---
Original paragraph 1
---

2---
Original paragraph 2
---

输出格式：
1---
Simplified paragraph 1 with some challenging (difficult) words explained
---

2---
Simplified paragraph 2
---
```

### 4. 用户水平立即保存

用户选择英文水平后立即保存，无需点击保存按钮：

```typescript
englishLevelSelect.addEventListener('change', async () => {
  currentConfig.user_english_level = newLevel;
  await saveConfig(currentConfig);
  
  // 如果释义已开启，触发重新释义
  if (isParaphraseEnabled) {
    await restartParaphrase();
  }
});
```

## Prompt 设计

### System Prompt

```
You are an expert English language teacher who adapts complex texts for different proficiency levels.

Your task for each numbered paragraph:
1. First, assess if the text needs simplification for the target level
2. If already suitable, output unchanged (add "[✓]" prefix)
3. Otherwise, rewrite to match the target CEFR level
4. Keep 2-3 challenging words with (simple explanation)
5. Maintain numbered format in response
```

### User Prompt 模板

```
Rewrite the following English paragraphs for a {{target_level}} level reader.
The reader's current level is {{user_level}}.

{{texts}}

Output each paragraph in format: NUMBER---rewritten content---
```

## 样式设计

释义结果使用绿色边框，与翻译的灰色边框区分：

```css
.lingride-paraphrase {
  color: #2e7d32;
  border-left: 3px solid #4caf50;
  background: rgba(76, 175, 80, 0.05);
  padding: 0.5em 0.75em;
  margin: 0.5em 0;
}
```

暗色模式自动适配：

```css
@media (prefers-color-scheme: dark) {
  .lingride-paraphrase {
    color: #81c784;
    background: rgba(76, 175, 80, 0.1);
  }
}
```

## 数据流

```
Popup                   Background              Content Script
  │                         │                         │
  │ TOGGLE_PARAPHRASE       │                         │
  │────────────────────────>│                         │
  │                         │ setParaphraseState()    │
  │                         │ (互斥：关闭翻译)          │
  │                         │                         │
  │                         │ PARAPHRASE_STATE_CHANGED│
  │                         │────────────────────────>│
  │                         │                         │ startParaphrase()
  │                         │                         │ (互斥：停止翻译)
  │                         │                         │
  │                         │           PARAPHRASE    │
  │                         │<────────────────────────│
  │                         │                         │
  │                         │ ──── AI API Call ────   │
  │                         │                         │
  │                         │────────────────────────>│
  │                         │  { paraphrases }        │ showParaphrase()
```

## 配置存储

新增配置字段：

```typescript
interface LingridConfig {
  // ... 现有字段
  user_english_level?: CEFRLevel;  // 用户英文水平
  paraphrase_prompts?: {           // 释义 Prompt 配置
    system_prompt: string;
    user_prompt_template: string;
  };
}
```

## 文件清单

| 文件 | 说明 |
|------|------|
| `types/config.ts` | 新增 CEFRLevel、ParaphrasePromptConfig、calculateTargetLevel |
| `types/messages.ts` | 新增释义相关消息类型 |
| `constants/paraphrasePrompts.ts` | 默认释义 Prompt |
| `popup/popup.html` | 水平选择器 + 释义开关 + 高级设置 |
| `popup/popup.css` | 水平选择器样式 |
| `popup/popup.ts` | 水平选择和释义开关逻辑 |
| `background/service-worker.ts` | 释义消息处理 |
| `background/tabState.ts` | 互斥状态管理 |
| `content/index.ts` | 释义流程和互斥处理 |
| `content/translationInjector.ts` | 释义 DOM 注入 |
| `content/styles.css` | 释义样式（绿色边框） |

## 与翻译功能的对比

| 特性 | 翻译功能 | 释义功能 |
|------|---------|---------|
| 目的 | 快速理解内容 | 学习英语 |
| 输出语言 | 中文 | 英文（简化版） |
| 边框颜色 | 灰色 | 绿色 |
| 缓存 | 有 | 无（因为依赖用户水平） |
| 视口优先 | 是 | 是 |
| 批量处理 | 是 | 是 |
