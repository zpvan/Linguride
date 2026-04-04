# 混杂中英翻译

> 将英文网页内容转化为中英混杂文本（code-switching），保留用户能理解的英文，用中文替换超纲部分，模拟港台双语者的自然表达方式。

## 解决什么问题

英语学习者阅读英文网页时面临一个两难：
- 全英文阅读太难，生词不断打断阅读节奏
- 全中文翻译虽然看得懂，但失去了英文学习机会

混杂中英翻译提供了一条"中间路线"：保留用户当前水平能理解的英文，只用中文替换超出能力范围的部分。最终输出类似双语者日常 code-switching 的自然句子，在"可理解"的前提下最大化英文曝光量。这个设计基于克拉申的 i+1 可理解性输入假说。

## 工作原理

```
用户选择 CEFR 水平（如 B1）
            ↓
    点击「混杂中英」开关
            ↓
    系统计算英文保留比例（B1 → 50%）
            ↓
    提取页面可见区域的英文段落
            ↓
    调用 AI 生成中英混杂文本
            ↓
    后处理：高亮混杂文本中的英文部分
            ↓
    结果显示在原文下方（蓝紫色边框，英文蓝色加粗）
```

### CEFR 等级与英文保留比例

| 用户水平 | 英文保留 | 说明 |
|---------|---------|------|
| A1 入门 | ~20% | 只保留 hi、OK、email 等基本词汇 |
| A2 初级 | ~35% | 保留 so、but、good、want 等常见词 |
| B1 中级 | ~50% | 保留复合句、常见短语动词、日常表达 |
| B2 中高级 | ~65% | 保留专业词汇、大部分句子结构 |
| C1 高级 | ~80% | 保留复杂结构和习语，只替换罕见词 |
| C2 精通 | ~95% | 几乎全英文，仅注释极少文化特定表达 |

### 示例输出

原文：
> Climate change is accelerating at an unprecedented rate, with global temperatures rising faster than scientists predicted just a decade ago.

A2 输出：
> Climate change 正在以前所未有的速度加快，global temperatures 上升的速度比 scientists 十年前 predict 的还要 fast。

B1 输出：
> Climate change is accelerating at 前所未有的 rate, with global temperatures rising faster than scientists 十年前 predicted 的。

B2 输出：
> Climate change is accelerating at an 前所未有的(unprecedented) rate, with global temperatures rising faster than scientists predicted just a decade ago.

## 架构概览

```
┌───────────────────────────────────────────────────────────┐
│                       Popup UI                             │
│  • CEFR 水平选择器（立即保存，触发重新翻译）                    │
│  • 混杂中英开关（与翻译、释义三者互斥）                        │
│  • 高级设置：自定义混杂中英 Prompt                           │
│  • 动态提示：显示当前保留百分比                                │
└───────────────────────────────────────────────────────────┘
                            ↓ TOGGLE_MIXED_TRANSLATE
┌───────────────────────────────────────────────────────────┐
│                   Background Service                       │
│  handleToggleMixedTranslate() - 状态管理，三模式互斥         │
│  handleMixedTranslate() - 构建 Prompt，调用 AI             │
│  getRetentionPercent() - CEFR → 保留百分比映射              │
└───────────────────────────────────────────────────────────┘
                            ↓ MIXED_TRANSLATE
┌──────────────────────┐    ┌──────────────────────────────┐
│   Content Script     │    │     DeepSeekProvider         │
│   • 视口优先策略      │    │     • 批量翻译请求            │
│   • 英文高亮后处理    │    │     • 编号格式解析            │
│   • 三模式互斥管理    │    │                              │
└──────────────────────┘    └──────────────────────────────┘
```

## 主要模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Prompt 配置 | `constants/mixedTranslatePrompts.ts` | 定义默认 System Prompt（含 Few-shot 示例）和 User Prompt 模板 |
| 类型定义 | `types/config.ts` | `MixedTranslatePromptConfig` 接口、`getRetentionPercent()` 函数 |
| 消息类型 | `types/messages.ts` | 3 个消息类型 + 3 个消息接口 + 2 个响应接口 |
| Tab 状态 | `background/tabState.ts` | `mixedTranslateEnabled` 字段，三模式互斥逻辑 |
| 消息路由 | `background/service-worker.ts` | 3 个 handler：toggle、getState、translate |
| 内容脚本 | `content/index.ts` | start/stop/batch 完整生命周期，视口懒加载 |
| DOM 注入 | `content/translationInjector.ts` | `highlightEnglishParts()` 后处理、`showMixedTranslation()` 等 |
| 样式 | `content/styles.css` | 蓝紫色容器、蓝色英文高亮（含暗色模式） |
| Popup UI | `popup/popup.html` | 混杂中英开关 + 高级 Prompt 编辑区 |
| Popup 逻辑 | `popup/popup.ts` | `toggleMixedTranslate()`、`updateLevelHint()` 模式感知 |

## 技术亮点

### 1. 英文高亮后处理

AI 返回的是纯文本，需要后处理来高亮其中的英文部分。这里有一个安全与功能的平衡点：

```typescript
function highlightEnglishParts(text: string): string {
  // 第一步：HTML 转义防 XSS（因为最终用 innerHTML 注入）
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 第二步：正则匹配英文序列，包裹 <span>
  return escaped.replace(
    /([a-zA-Z0-9](?:[a-zA-Z0-9\s,.'\u2019\-]*[a-zA-Z0-9])?)/g,
    '<span class="lingride-en-highlight">$1</span>'
  );
}
```

先转义再正则，确保即使 AI 返回恶意内容也不会执行脚本。

### 2. 三模式互斥

翻译、释义、混杂中英三种模式在所有层级保持互斥：

- **TabState 层**：`setMixedTranslateState()` 开启时自动将另外两个设为 false
- **Content Script 层**：收到 `MIXED_TRANSLATE_STATE_CHANGED` 时，先 stop 其他两个模式
- **Popup UI 层**：成功开启后，取消勾选其他两个开关

三层互斥确保用户在任何操作路径下都不会看到多种模式同时运行。

### 3. 不使用缓存

与翻译功能不同，混杂中英翻译故意不缓存结果：

- 输出高度依赖用户 CEFR 等级设置
- 用户改变等级后，同一段文本需要生成完全不同的混杂比例
- 缓存键需要包含等级信息，复杂度增加但价值有限（等级变化不频繁时缓存命中率低）

### 4. 模式感知的水平提示

`updateLevelHint()` 根据当前活跃模式动态切换提示内容：

- 混杂中英开启时：显示"将保留约 **50%** 英文内容，其余用中文表达"
- 释义开启或默认：显示"内容将改写为 **B1** 水平（略高于您的水平）"

### 5. Prompt 设计

System Prompt 包含两组 Few-shot 示例（通用文章 + 技术文章），各展示 A2/B1/B2 三个水平的输出。这种设计让 AI 理解：
- 不同等级的保留粒度差异
- Code-switching 的自然切换边界（短语/从句级别，不拆分惯用表达）
- 技术术语（API、React）和专有名词始终保持英文

## 与其他模式的对比

| 特性 | 双语翻译 | 英文释义 | 混杂中英 |
|------|---------|---------|---------|
| 目的 | 快速理解内容 | 学习英语表达 | 沉浸式渐进学习 |
| 输出语言 | 中文 | 英文（简化版） | 中英混杂 |
| 边框颜色 | 灰色 | 绿色 | 蓝紫色 |
| 英文高亮 | 无 | 无 | 蓝色加粗 |
| 缓存 | 有 | 无 | 无 |
| CEFR 依赖 | 无 | 决定目标等级 | 决定保留比例 |
| 视口优先 | 是 | 是 | 是 |
| 批量处理 | 是 | 是 | 是 |

## 数据流

```
Popup                   Background              Content Script
  │                         │                         │
  │ TOGGLE_MIXED_TRANSLATE  │                         │
  │────────────────────────>│                         │
  │                         │ setMixedTranslateState()│
  │                         │ (互斥：关闭翻译和释义)     │
  │                         │                         │
  │                         │ MIXED_TRANSLATE_STATE   │
  │                         │     _CHANGED            │
  │                         │────────────────────────>│
  │                         │                         │ startMixedTranslate()
  │                         │                         │ (互斥：停止翻译和释义)
  │                         │                         │ (视口观察 → 批量请求)
  │                         │                         │
  │                         │     MIXED_TRANSLATE     │
  │                         │<────────────────────────│
  │                         │                         │
  │                         │ getRetentionPercent()   │
  │                         │ 构建 Prompt             │
  │                         │ ──── AI API Call ────   │
  │                         │                         │
  │                         │────────────────────────>│
  │                         │  { mixedTexts }         │ highlightEnglishParts()
  │                         │                         │ showMixedTranslation()
```
