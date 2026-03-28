# Lingride Chrome 扩展技术总结

## 它是什么

Lingride 是一个**双语对照翻译** Chrome 扩展。打开开关后，它会在英文网页的原文下方显示中文翻译，让你同时看到两种语言。

核心体验：**即开即用，滚到哪翻到哪**。

---

## 为什么这样设计

### 问题：翻译整页太慢

最初的设计是打开开关后翻译整个页面。一个普通网页有 100-200 个段落，分成 20 个批次调用 API，用户要等很久才能看到第一个翻译结果。

### 解决：视口优先

改用 **Intersection Observer** 监测用户视口：
- 只翻译用户**当前看到的内容**
- 滚动时**动态加载**新区域的翻译
- 提前一屏**预加载**，滚动时无缝衔接

这样用户打开开关后，1-2 秒内就能看到翻译结果。

---

## 架构一览

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome 扩展                          │
├─────────────┬─────────────────────┬─────────────────────────┤
│   Popup     │   Background        │   Content Script        │
│   (设置UI)   │   (消息中枢)         │   (页面注入)             │
├─────────────┼─────────────────────┼─────────────────────────┤
│ • 配置表单   │ • 消息路由          │ • 文本提取               │
│ • 翻译开关   │ • API 调用          │ • 视口监测               │
│ • 连接测试   │ • 配置存储          │ • 翻译注入               │
│             │ • Tab 状态          │ • 页面缓存               │
└─────────────┴─────────────────────┴─────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   DeepSeek API      │
              │   (OpenAI 兼容格式)  │
              └─────────────────────┘
```

三个模块通过 **Chrome Messaging API** 通信，职责清晰：
- **Popup**：用户界面，收集配置
- **Background**：中枢，调用 API，管理状态
- **Content Script**：注入页面，操作 DOM

---

## 数据流

用户点击翻译开关后，发生了什么：

```
1. Popup 发送 TOGGLE_TRANSLATION 消息
                ↓
2. Background 更新 Tab 状态，通知 Content Script
                ↓
3. Content Script 提取页面中的英文段落
                ↓
4. ViewportObserver 监测哪些段落在视口内
                ↓
5. 可见段落分批发送到 Background
                ↓
6. Background 调用 DeepSeek API 翻译
                ↓
7. 翻译结果返回，注入到页面 DOM
                ↓
8. 用户滚动 → 新段落进入视口 → 回到第 4 步
```

---

## 关键技术点

### 1. 视口优先翻译

`ViewportObserver` 类封装了 Intersection Observer：

```typescript
// 配置：上下各扩展一屏预加载
rootMargin: "100% 0px 100% 0px"
```

- 元素进入视口 10% 时触发
- 200ms 防抖，合并多个元素
- 翻译后停止观察该元素

### 2. 智能分批

`BatchManager` 控制每次请求的大小：

- 最多 10 个段落/批次
- 最多 2000 tokens/批次
- 最多 3 个并发请求

### 3. 页面级缓存

`TranslationCache` 避免重复翻译：

- 以原文哈希为 key
- 页面刷新后清空
- 再次滚动到已翻译段落时直接显示

### 4. 动态注入脚本

如果用户在扩展安装前就打开了页面，Content Script 不会自动加载。Background 会尝试动态注入：

```typescript
await chrome.scripting.executeScript({
  target: { tabId },
  files: ["src/content/index.js"],
});
```

---

## 配置存储

用户配置存储在 `chrome.storage.local`，包括：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| api_base_url | API 端点 | https://api.deepseek.com |
| api_key | 密钥 | (空) |
| model | 模型 | deepseek-chat |
| prompts.system_prompt | 系统提示词 | 翻译专家角色定义 |
| prompts.user_prompt_template | 用户提示词模板 | 包含 {{texts}} 占位符 |

---

## 文件结构

```
src/
├── background/          # 后台服务
│   ├── service-worker.ts   # 消息路由、API 调用
│   ├── configManager.ts    # 配置读写
│   └── tabState.ts         # Tab 状态管理
│
├── content/             # 注入页面的脚本
│   ├── index.ts            # 入口、流程控制
│   ├── viewportObserver.ts # 视口监测（核心优化）
│   ├── textExtractor.ts    # 英文段落提取
│   ├── translationInjector.ts # DOM 注入
│   ├── translationCache.ts # 页面缓存
│   ├── batchManager.ts     # 批次管理
│   └── styles.css          # 翻译样式
│
├── popup/               # 弹出界面
│   ├── popup.html
│   ├── popup.css           # 暗色主题
│   └── popup.ts
│
├── providers/           # 翻译服务
│   ├── ITranslateProvider.ts  # 接口定义
│   └── DeepSeekProvider.ts    # DeepSeek 实现
│
├── types/               # 类型定义
│   ├── config.ts
│   ├── messages.ts
│   └── translation.ts
│
└── manifest.json        # 扩展清单 (MV3)
```

---

## 构建与安装

```bash
# 安装依赖
npm install

# 构建
npm run build

# macOS 一键安装
npm run install:mac
```

构建产物在 `dist/` 目录，在 Chrome 扩展页面加载即可使用。

---

## 设计决策记录

| 决策 | 原因 |
|------|------|
| 使用 Manifest V3 | Chrome 新标准，2024 年后 V2 将不再支持 |
| 选择 vite-plugin-web-extension | CRXJS 已停止维护，这是活跃的替代品 |
| 视口优先而非全页翻译 | 用户体验优先，1-2 秒内看到结果 |
| 页面级缓存而非持久缓存 | 避免存储膨胀，简化实现 |
| 动态注入 Content Script | 兼容扩展安装前已打开的页面 |
| 暗色主题 UI | 符合现代设计趋势，减少视觉疲劳 |

---

## 已知限制

1. **PNG 图标**：当前使用占位图标，需手动从 SVG 导出
2. **特殊页面**：Chrome 内部页面（chrome://）无法注入脚本
3. **动态内容**：SPA 的动态加载内容需要手动刷新触发
4. **并发限制**：同时最多 3 个批次，避免 API 限流

---

## 后续优化方向

- [ ] 支持更多翻译服务（OpenAI、Anthropic）
- [ ] 自动检测 SPA 动态内容
- [ ] 翻译结果持久化缓存
- [ ] 右键菜单选中翻译
- [ ] 快捷键支持
