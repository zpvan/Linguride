# 页面难度分析

> 一键评估当前网页的英文难度级别，帮助用户快速判断阅读材料是否适合自己的水平。

## 解决什么问题

英语学习者在选择阅读材料时，常面临两个困扰：选材过难导致挫败感，选材过易浪费时间。页面难度分析功能通过 AI 快速评估网页内容的语言复杂度，给出 CEFR 等级、综合分数和针对性学习建议，让用户在开始阅读前就能做出明智选择。

## 工作原理

```
用户点击「分析当前页面」
        ↓
   检测选中文本
  /            \
有选中（≥50字符）  无选中
        ↓               ↓
  分析选中内容    采样整页（最多2000字符）
        ↓               ↓
        └───────┬───────┘
                ↓
     调用 AI 进行难度分析
                ↓
     解析 JSON 结果并渲染
```

**关键设计决策：选中优先**

用户可以选中特定段落进行分析，适用于想要评估文章特定部分的场景。若无选中，则自动采样整页内容，避免超长文本导致的 API 成本和响应延迟问题。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         Popup UI                            │
│   popup.html / popup.css / popup.ts                         │
│   • 分析按钮                                                 │
│   • 结果卡片（难度徽章、进度条、指标网格、建议列表）           │
└─────────────────────────────────────────────────────────────┘
                              ↓ ANALYZE_DIFFICULTY
┌─────────────────────────────────────────────────────────────┐
│                     Background Service                       │
│   service-worker.ts :: handleAnalyzeDifficulty()             │
│   • 获取配置和 Prompt                                        │
│   • 向 Content Script 请求文本                               │
│   • 调用 Provider.chat() 进行分析                            │
│   • 解析 JSON 响应                                           │
└─────────────────────────────────────────────────────────────┘
         ↓ EXTRACT_PAGE_TEXT            ↓ chat()
┌────────────────────────┐    ┌────────────────────────────────┐
│    Content Script      │    │      DeepSeekProvider          │
│    content/index.ts    │    │      providers/*.ts            │
│    • 检测选中文本       │    │      • 发送 API 请求            │
│    • 采样页面内容       │    │      • 处理响应                 │
└────────────────────────┘    └────────────────────────────────┘
```

## 主要模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 类型定义 | `types/difficulty.ts` | 定义 DifficultyResult、VocabularyComplexity 等数据结构 |
| 消息类型 | `types/messages.ts` | 新增 ANALYZE_DIFFICULTY、EXTRACT_PAGE_TEXT 消息 |
| Prompt 配置 | `constants/difficultyPrompts.ts` | 默认的 System/User Prompt 模板 |
| Provider 接口 | `providers/ITranslateProvider.ts` | 新增 chat() 抽象方法支持通用对话 |
| Provider 实现 | `providers/DeepSeekProvider.ts` | 实现 chat() 方法调用 DeepSeek API |
| 文本提取 | `content/index.ts` | 处理 EXTRACT_PAGE_TEXT，返回选中或采样文本 |
| 业务逻辑 | `background/service-worker.ts` | handleAnalyzeDifficulty() 编排整个分析流程 |
| 界面 | `popup/popup.*` | 按钮、状态显示、结果卡片渲染 |

## 技术亮点

### 1. Provider 接口扩展

为支持难度分析这种「非翻译」场景，在 `ITranslateProvider` 接口新增了通用的 `chat()` 方法：

```typescript
chat(systemPrompt: string, userPrompt: string): Promise<string>;
```

这使得 Provider 不再局限于翻译，可复用于任何 LLM 对话场景（如摘要、问答等），提高了架构的可扩展性。

### 2. 选中文本优先策略

Content Script 中的文本提取逻辑采用「选中优先」策略：

```typescript
const selection = window.getSelection()?.toString().trim();
if (selection && selection.length >= 50) {
  return { text: selection, isSelection: true };
}
// 否则采样整页
```

50 字符阈值避免了误将短小的意外选中（如双击选词）当作有效输入。

### 3. Prompt 可定制

用户可在「高级设置」中自定义难度分析的 Prompt，存储在 `LingridConfig.difficulty_prompts`：

```typescript
export interface DifficultyPromptConfig {
  system_prompt: string;
  user_prompt_template: string;  // 使用 {text} 占位符
}
```

默认 Prompt 要求 AI 返回结构化 JSON，包含难度等级、CEFR 级别、词汇/句子复杂度指标等。

### 4. 结构化结果展示

分析结果通过精心设计的卡片呈现，包含：

- **双徽章系统**：难度等级（Beginner/Intermediate/Advanced/Expert）+ CEFR 等级（A1-C2）
- **可视化进度条**：0-100 分数的直观展示，渐变色表示难度区间
- **四项关键指标**：词汇复杂度、句子复杂度、阅读时间、采样词数
- **个性化建议**：AI 根据文本特点给出的学习建议列表

## 数据结构

```typescript
interface DifficultyResult {
  difficultyLevel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  score: number;  // 0-100
  vocabularyComplexity: {
    rareWordCount: number;
    academicWordCount: number;
    avgWordLength: number;
  };
  sentenceComplexity: {
    avgSentenceLength: number;
    complexSentenceRatio: number;  // 0-1
  };
  estimatedReadingTime: number;  // 分钟
  sampleWordCount: number;
  suggestions: string[];
  isSelection?: boolean;
}
```

## 消息流

```
Popup                   Background              Content Script
  │                         │                         │
  │ ANALYZE_DIFFICULTY      │                         │
  │────────────────────────>│                         │
  │                         │ EXTRACT_PAGE_TEXT       │
  │                         │────────────────────────>│
  │                         │                         │
  │                         │<────────────────────────│
  │                         │  { text, wordCount,     │
  │                         │    isSelection }        │
  │                         │                         │
  │                         │ ──── AI API Call ────   │
  │                         │                         │
  │<────────────────────────│                         │
  │  { difficultyLevel,     │                         │
  │    cefrLevel, ... }     │                         │
```
