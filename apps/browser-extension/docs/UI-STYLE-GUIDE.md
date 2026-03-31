# Linguride Chrome Extension UI/UX 设计规范

> 基于 iOS Settings 深色模式风格的完整设计系统，为语言学习应用打造沉浸式体验。

## 设计哲学

**"自如 (Natural Flow)"** — 我们的核心设计理念

- **渐进展示**：主视图聚焦学习，设置隐于次层
- **直接操控**：所有切换即时生效，无需保存
- **学习光谱可视化**：通过 Segmented Control 呈现模式光谱
- **隐形学习**：用户感觉在"对话"而非"学习"

### iOS Settings 风格核心要点

1. **深度层级**：通过不同明度的背景色建立视觉层级
2. **克制的装饰**：移除不必要的边框和阴影，用颜色区分
3. **呼吸感**：充足的留白让内容自然呼吸
4. **微妙的光泽**：卡片顶部渐变模拟真实光照

---

## 1. Design Tokens

所有设计变量定义在 CSS 变量中，确保全局一致性。

### 1.1 颜色系统

#### 背景色 (Backgrounds)

```css
:root {
  --bg-primary: #000000;      /* 主背景：纯黑 */
  --bg-secondary: #1C1C1E;    /* 卡片背景 */
  --bg-tertiary: #2C2C2E;     /* 输入框、二级容器 */
  --bg-quaternary: #3A3A3C;   /* 悬浮状态、三级容器 */
  --bg-elevated: #1C1C1E;     /* 浮层背景（Dropdown） */
}
```

**使用场景**：
| Token | 用途 |
|-------|------|
| `--bg-primary` | 页面底色 |
| `--bg-secondary` | 卡片 (Card) 背景 |
| `--bg-tertiary` | 输入框、内嵌容器、分析结果块 |
| `--bg-quaternary` | Hover 状态、滚动条、禁用按钮 |
| `--bg-elevated` | Dropdown、浮层菜单 |

#### 文字色 (Text)

```css
:root {
  --text-primary: rgba(255, 255, 255, 0.92);   /* 主要文字 */
  --text-secondary: rgba(235, 235, 245, 0.6);  /* 次要说明 */
  --text-tertiary: rgba(235, 235, 245, 0.3);   /* 占位符、禁用态 */
}
```

**使用场景**：
| Token | 用途 |
|-------|------|
| `--text-primary` | 标题、正文、重要信息 |
| `--text-secondary` | Section Label、辅助说明、副标题 |
| `--text-tertiary` | Placeholder、Hint、禁用文字、字数统计 |

#### 强调色 (Accent)

```css
:root {
  --accent: #0A84FF;                        /* iOS System Blue */
  --accent-soft: rgba(10, 132, 255, 0.15);  /* Tinted 背景（常态） */
  --accent-hover: rgba(10, 132, 255, 0.22); /* Tinted 背景（悬浮/按下） */
  --accent-tinted-bg: rgba(10, 132, 255, 0.12); /* 更淡的 Tinted 背景 */
}
```

**使用场景**：
| Token | 用途 |
|-------|------|
| `--accent` | 链接、重要按钮文字、活动指示器 |
| `--accent-soft` | Tinted Button 悬浮态 |
| `--accent-hover` | Tinted Button 按下态 |
| `--accent-tinted-bg` | Tinted Button 常态、Level Badge 背景 |

#### 语义色 (Semantic)

```css
:root {
  --success: #30D158;                    /* 成功、优秀评分 */
  --error: #FF453A;                      /* 错误、警告 */
  --warning: #FFD60A;                    /* 中等评分、注意 */
  --separator: rgba(84, 84, 88, 0.36);   /* 分隔线 */
}
```

**额外语义色（组件内定义）**：
```css
#FF9F0A  /* 橙色：高级难度、较好评分 */
#BF5AF2  /* 紫色：补语标签 */
#34c759  /* 浅绿：良好评分 */
#e74c3c  /* 录音红：录音状态、停止按钮 */
```

---

### 1.2 间距系统 (Spacing)

```css
:root {
  --space-xs: 4px;   /* 最小间距：图标间隙、紧密元素 */
  --space-sm: 8px;   /* 小间距：按钮组间隙、列表项内 */
  --space-md: 12px;  /* 中间距：卡片内边距、表单项间隙 */
  --space-lg: 16px;  /* 大间距：Section 间隙、卡片内边距 */
  --space-xl: 24px;  /* 超大间距：页面边距、Header 下方 */
}
```

**使用指南**：
- **相邻元素**：使用 `--space-sm` 或 `--space-md`
- **卡片内边距**：Popup 使用 `--space-lg`，Tutor 使用 `--space-xl`
- **Section 间隔**：`--space-lg` 到 `--space-xl`
- **页面边距**：`--space-lg`（Popup）或 `--space-xl`（Tutor）

---

### 1.3 圆角系统 (Border Radius)

```css
:root {
  --radius-sm: 8px;      /* 小圆角：按钮、输入框、标签 */
  --radius-md: 10px;     /* 中圆角：主按钮、Dropdown */
  --radius-lg: 12px;     /* 大圆角：大型容器、弹窗 */
  --radius-card: 12px;   /* 卡片圆角 */
  --radius-pill: 18px;   /* 胶囊圆角：Level Badge、Pill 选择器 */
  --radius-segment: 8px; /* Segmented Control 圆角 */
}
```

**使用场景**：
| Token | 用途 |
|-------|------|
| `--radius-sm` | Icon Button、输入框、Tag、Toast |
| `--radius-md` | Primary Button、Speak/Record Button、Dropdown |
| `--radius-lg` | Dropdown 菜单容器 |
| `--radius-card` | 卡片组件 |
| `--radius-pill` | Level Badge、Pill 选择器 |
| `--radius-segment` | Segmented Control |

---

### 1.4 阴影系统 (Shadows)

```css
:root {
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  --card-border: 0.5px solid rgba(255, 255, 255, 0.06);
}
```

**Dropdown 阴影**（更强烈）：
```css
box-shadow: 
  0 8px 32px rgba(0, 0, 0, 0.35),
  0 0 0 0.5px rgba(255, 255, 255, 0.08);
```

**Segment Indicator 阴影**：
```css
box-shadow: 
  0 1px 2px rgba(0, 0, 0, 0.2),
  0 0 0 0.5px rgba(255, 255, 255, 0.04);
```

**设计原则**：
- 阴影克制，仅用于建立层级
- 配合微弱的白色边框增加质感
- Dropdown 等浮层使用更明显的阴影

---

### 1.5 动画系统 (Animation)

```css
:root {
  --ease-out: cubic-bezier(0.25, 0.1, 0.25, 1);     /* 标准缓出 */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.1); /* iOS 弹性 */
  --duration: 0.25s;  /* 默认过渡时长 */
}
```

**动画时长指南**：
| 场景 | 时长 |
|------|------|
| 悬浮反馈 | `0.12s` - `0.15s` |
| 状态切换 | `0.2s` - `0.25s` |
| 页面切换 | `0.25s` |
| Dropdown 展开 | `0.2s`（配合 `ease-spring`） |

**脉冲动画（录音/朗读状态）**：
```css
@keyframes recordPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
/* 使用：animation: recordPulse 1.5s ease-in-out infinite; */
```

---

## 2. 字体规范

### 2.1 字体族

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 
                 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
}
```

**代码/数字字体**：
```css
font-family: 'SF Mono', Monaco, monospace;
```

### 2.2 字号层级

| 层级 | 字号 | 用途 |
|------|------|------|
| H1 | `20px` | 页面标题、Brand Logo |
| H2 | `17px` | 设置页标题 |
| Body Large | `15px` | 正文、结果文本（Tutor 页） |
| Body | `14px` | 通用正文、结果文本（Popup） |
| Label | `13px` | 按钮文字、Section Label、表单标签 |
| Small | `12px` | 辅助说明、Hint、Badge 描述 |
| Tiny | `11px` | 字数统计、最小标签 |

### 2.3 字重使用

| 字重 | 场景 |
|------|------|
| `700` | 大标题、Brand Logo、评分数字 |
| `600` | 按钮、活动状态、强调文字 |
| `500` | 副标题、表单标签、Segment |
| `400` | 正文、说明文字 |

### 2.4 其他排版属性

```css
body {
  line-height: 1.47;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 3. 组件规范

### 3.1 卡片 (Card)

iOS Grouped List 风格的卡片容器。

```css
.card {
  background: var(--bg-secondary);
  border-radius: var(--radius-card);  /* 12px */
  padding: var(--space-lg);           /* 16px (Popup) */
  margin-bottom: var(--space-md);     /* 12px */
  box-shadow: var(--card-shadow);
  border: var(--card-border);
  /* 顶部微光效果 */
  background-image: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.03) 0%,
    transparent 50%
  );
}

/* Tutor 页面使用更大内边距 */
.tutor .card {
  padding: var(--space-xl);  /* 24px */
}
```

**设计要点**：
- 顶部 3% 白色渐变模拟真实光照
- 0.5px 微弱白色边框增加质感
- 避免使用明显边框，通过背景色区分

---

### 3.2 分段控件 (Segmented Control)

iOS UISegmentedControl 风格的模式切换器。

```css
.segmented-control {
  position: relative;
  display: flex;
  background: rgba(118, 118, 128, 0.12);  /* iOS 标准灰 */
  border-radius: var(--radius-segment);    /* 8px */
  padding: 2px;
}

.segment {
  flex: 1;
  padding: 7px 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.segment.active {
  color: var(--text-primary);
}

/* 滑动指示器 */
.segment-indicator {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(33.333% - 1.33px);  /* 根据选项数调整 */
  height: calc(100% - 4px);
  background: var(--bg-tertiary);
  border-radius: calc(var(--radius-segment) - 1px);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 0 0 0.5px rgba(255, 255, 255, 0.04);
  transition: transform var(--duration) var(--ease-spring);
}

/* 位置控制 */
.segment-indicator.pos-0 { transform: translateX(0); }
.segment-indicator.pos-1 { transform: translateX(100%); }
.segment-indicator.pos-2 { transform: translateX(200%); }
```

**交互效果**：
- 指示器使用 `ease-spring` 弹性动画
- 未选中项 Hover 时文字变亮
- 选中项背景滑动跟随

---

### 3.3 按钮 (Button)

#### 3.3.1 主按钮 (Tinted Style)

iOS 的 Tinted Button 风格，半透明蓝色背景。

```css
.btn-analyze {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  border: none;
  background: var(--accent-tinted-bg);  /* rgba(10, 132, 255, 0.12) */
  color: var(--accent);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-md);  /* 10px */
  transition: all 0.15s var(--ease-out);
}

.btn-analyze:hover {
  background: var(--accent-soft);  /* rgba(10, 132, 255, 0.15) */
}

.btn-analyze:active {
  transform: scale(0.98);
  background: var(--accent-hover);  /* rgba(10, 132, 255, 0.22) */
}

.btn-analyze:disabled {
  background: rgba(118, 118, 128, 0.12);
  color: var(--text-tertiary);
  cursor: not-allowed;
  transform: none;
}
```

#### 3.3.2 图标按钮 (Speak / Record)

44×44px 的正方形 Tinted 图标按钮。

```css
.btn-speak,
.btn-record {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: var(--accent-tinted-bg);
  color: var(--accent);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.15s var(--ease-out);
}

/* 录音中/朗读中状态 */
.btn-record.recording,
.btn-speak.speaking {
  background: #e74c3c;
  animation: recordPulse 1.5s ease-in-out infinite;
}
```

#### 3.3.3 Segmented 风格按钮

用于设置页的操作按钮，与 Segmented Control 视觉一致。

```css
.settings-action-btn {
  display: block;
  width: 100%;
  padding: 7px 0;
  background: rgba(118, 118, 128, 0.12);
  border: none;
  border-radius: var(--radius-segment);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

/* 危险操作按钮 */
.reset-btn {
  background: rgba(255, 69, 58, 0.12);
  color: var(--error);
}
```

#### 3.3.4 图标按钮 (32px)

Header 区域的小型图标按钮。

```css
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s var(--ease-out);
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.icon-btn:active {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.1);
}

/* 返回按钮特殊样式 */
.back-btn {
  color: var(--accent);
}

.back-btn:hover {
  background: var(--accent-tinted-bg);
  color: var(--accent);
}
```

---

### 3.4 Level Badge 和 Dropdown

等级选择器，点击展开下拉菜单。

```css
/* Badge */
.level-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  background: var(--accent-tinted-bg);
  border: none;
  border-radius: var(--radius-pill);  /* 18px */
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.level-badge:active {
  transform: scale(0.96);
}

/* Dropdown */
.level-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  min-width: 160px;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-xs);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 0.5px rgba(255, 255, 255, 0.08);
  /* 动画 */
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px) scale(0.96);
  transition: all 0.2s var(--ease-spring);
  z-index: 100;
}

.level-dropdown.open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}

/* 选项 */
.level-option {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
}

.level-option:hover {
  background: rgba(255, 255, 255, 0.06);
}

.level-option.active {
  background: var(--accent-tinted-bg);
  color: var(--accent);
}
```

---

### 3.5 输入框 (Input & Textarea)

#### 3.5.1 文本域 (Textarea)

```css
.sentence-input {
  width: 100%;
  padding: var(--space-md);
  padding-bottom: calc(var(--space-md) + 16px);  /* 为字数统计留空间 */
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 72px;
  outline: none;
}

.sentence-input::placeholder {
  color: var(--text-tertiary);
}

.sentence-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* 字数统计 */
.char-count {
  position: absolute;
  bottom: var(--space-sm);
  right: var(--space-md);
  font-size: 11px;
  color: var(--text-tertiary);
  pointer-events: none;
}
```

#### 3.5.2 设置页输入框 (Inline Style)

```css
.settings-input {
  flex: 1;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  text-align: right;
  outline: none;
}

.settings-input::placeholder {
  color: var(--text-tertiary);
}
```

---

### 3.6 手风琴列表 (Accordion)

可展开的设置组。

```css
.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  min-height: 44px;
}

.accordion-header:hover {
  background: rgba(118, 118, 128, 0.12);
}

.accordion-chevron {
  color: var(--text-tertiary);
  transition: transform 0.25s var(--ease-out);
}

.accordion-header.expanded .accordion-chevron {
  transform: rotate(90deg);
}

.accordion-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s var(--ease-out);
  padding: 0 var(--space-lg);
}

.accordion-body.open {
  max-height: 500px;
  padding: 0 var(--space-lg) var(--space-md);
}
```

---

### 3.7 Section 标签

iOS Settings 风格的分组标签。

```css
.section-label {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: -0.08px;
  margin-bottom: var(--space-md);
}
```

---

### 3.8 状态消息 (Status Message)

```css
.status-message {
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  text-align: center;
  display: none;
}

.status-message.success {
  display: block;
  background: rgba(48, 209, 88, 0.1);
  color: var(--success);
}

.status-message.error {
  display: block;
  background: rgba(255, 69, 58, 0.1);
  color: var(--error);
}

.status-message.loading {
  display: block;
  background: var(--accent-soft);
  color: var(--accent);
}
```

---

### 3.9 结构标签 (Structure Tags)

用于句子结构分析的彩色标签。

```css
.structure-tag {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
}

.tag-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

/* 颜色变体 */
.tag-subject .tag-label {
  background: rgba(10, 132, 255, 0.2);
  color: #0A84FF;  /* 蓝色：主语 */
}

.tag-predicate .tag-label {
  background: rgba(48, 209, 88, 0.2);
  color: #30D158;  /* 绿色：谓语 */
}

.tag-object .tag-label {
  background: rgba(255, 159, 10, 0.2);
  color: #FF9F0A;  /* 橙色：宾语 */
}

.tag-complement .tag-label {
  background: rgba(191, 90, 242, 0.2);
  color: #BF5AF2;  /* 紫色：补语 */
}
```

---

### 3.10 分隔线 (Separator)

iOS 缩进分隔线风格。

```css
.settings-divider {
  height: 0.5px;
  background: var(--separator);  /* rgba(84, 84, 88, 0.36) */
  margin-left: var(--space-lg);
  margin-right: 0;
}
```

---

## 4. 交互规范

### 4.1 状态反馈

| 状态 | 视觉反馈 |
|------|----------|
| **Hover** | 背景变亮 6%-10%，或切换到 `--accent-soft` |
| **Active/Pressed** | `scale(0.96-0.98)` 轻微缩小 + 背景加深 |
| **Disabled** | `opacity: 0.5` 或使用 `--text-tertiary` 文字色 |
| **Focus** | 1px `--accent` 边框 + box-shadow |
| **Loading** | 脉冲动画 1.5s 循环 |

### 4.2 Hover 背景色

```css
/* 通用悬浮 */
background: rgba(255, 255, 255, 0.06);

/* Segmented/Action Button 悬浮 */
background: rgba(118, 118, 128, 0.18);

/* Tinted Button 悬浮 */
background: var(--accent-soft);  /* rgba(10, 132, 255, 0.15) */
```

### 4.3 Active 缩放

```css
/* 大按钮 */
transform: scale(0.98);

/* 小按钮、Badge */
transform: scale(0.96);

/* 图标按钮 */
transform: scale(0.92);
```

### 4.4 过渡时长

```css
/* 快速反馈 */
transition: all 0.12s var(--ease-out);  /* Hover 高亮 */

/* 标准过渡 */
transition: all 0.15s var(--ease-out);  /* 按钮状态 */

/* 布局变化 */
transition: all 0.2s var(--ease-out);   /* Dropdown、Accordion */

/* 页面切换 */
transition: transform 0.25s var(--ease-out);
```

---

## 5. 页面布局

### 5.1 Popup 页面 (380px 宽)

```css
body {
  width: 380px;
  min-height: 400px;
  max-height: 600px;
  overflow: hidden;
}

.view {
  padding: var(--space-lg) var(--space-lg) var(--space-xl);
  overflow-y: auto;
}

/* 滚动条 */
.view::-webkit-scrollbar {
  width: 4px;
}

.view::-webkit-scrollbar-thumb {
  background: var(--bg-quaternary);
  border-radius: 2px;
}
```

### 5.2 Tutor 全屏页面

```css
body {
  min-height: 100vh;
}

.tutor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
  padding-bottom: 60px;
}

/* 响应式 */
@media (max-width: 600px) {
  .tutor-container {
    padding: var(--space-lg) var(--space-md);
  }
}
```

---

## 6. 代码示例

### 6.1 创建一个 Tinted 按钮

```html
<button class="btn-analyze" id="analyzeBtn">
  分析句子
</button>
```

```css
.btn-analyze {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  border: none;
  background: var(--accent-tinted-bg);
  color: var(--accent);
  font-family: var(--font-family);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.15s var(--ease-out);
}

.btn-analyze:hover { background: var(--accent-soft); }
.btn-analyze:active { transform: scale(0.98); background: var(--accent-hover); }
.btn-analyze:disabled { background: rgba(118, 118, 128, 0.12); color: var(--text-tertiary); }
```

### 6.2 创建一个 Card

```html
<div class="card">
  <div class="section-label">学习模式</div>
  <div class="segmented-control">
    <!-- segments here -->
  </div>
</div>
```

### 6.3 创建状态消息

```javascript
// 显示成功消息
statusEl.className = 'status-message success';
statusEl.textContent = '分析完成！';

// 显示错误消息
statusEl.className = 'status-message error';
statusEl.textContent = '网络错误，请重试';

// 显示加载状态
statusEl.className = 'status-message loading';
statusEl.textContent = '正在分析...';
```

---

## 7. 设计检查清单

在开发新功能时，请确保遵循以下规范：

- [ ] 使用 Design Tokens 变量，不硬编码颜色/间距
- [ ] 按钮使用 `0.15s` 过渡 + `scale(0.98)` 按下效果
- [ ] 输入框 Focus 状态有 `--accent` 边框
- [ ] 卡片包含顶部渐变光泽效果
- [ ] 禁用状态使用 `--text-tertiary` 文字色
- [ ] Dropdown 使用 `ease-spring` 弹性动画
- [ ] 分隔线使用 iOS 缩进风格（左边距对齐内容）
- [ ] 字体大小在规定层级内选择
- [ ] 所有可点击元素有 `cursor: pointer`

---

## 更新日志

- **2026-02-08**: 初始版本，基于 popup.css 和 tutor.css 提取
