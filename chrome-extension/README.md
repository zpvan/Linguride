# Lingride - 双语翻译 Chrome 扩展

🌐 一个简洁的英文网页双语对照翻译扩展，保留原文同时显示中文翻译。

## 功能特点

- **双语对照**：在原文下方显示中文翻译，保留英文原文
- **智能批量翻译**：动态分批处理，优化 API 调用
- **页面级缓存**：避免重复翻译，提升响应速度
- **暗色主题 UI**：现代化的设置界面
- **可配置 Prompt**：自定义翻译风格和行为
- **支持 DeepSeek API**：兼容 OpenAI API 格式

## 安装

### 方式一：使用安装脚本（推荐）

```bash
# 进入项目目录
cd chrome-extension

# 安装依赖
npm install
# 或使用 bun
bun install

# 运行安装脚本
npm run install:mac
```

脚本会自动：
1. 构建扩展
2. 打开 Chrome 扩展管理页面
3. 复制安装路径到剪贴板

### 方式二：手动安装

```bash
# 安装依赖
npm install

# 构建
npm run build

# 在 Chrome 中：
# 1. 打开 chrome://extensions/
# 2. 开启「开发者模式」
# 3. 点击「加载已解压的扩展程序」
# 4. 选择 dist 目录
```

## 开发

```bash
# 开发模式（支持热更新）
npm run dev

# 构建生产版本
npm run build
```

## 配置

1. 点击浏览器工具栏的 Lingride 图标
2. 填写 API 配置：
   - **API 端点**：`https://api.deepseek.com`（默认）
   - **API Key**：您的 DeepSeek API 密钥
   - **模型**：`deepseek-chat`（推荐）
3. 点击「测试连接」验证配置
4. 点击「保存设置」

### 高级设置

可在「高级设置」中自定义：
- **System Prompt**：定义翻译助手的角色和风格
- **User Prompt 模板**：使用 `{{texts}}` 占位符表示待翻译内容

## 使用

1. 打开任意英文网页
2. 点击 Lingride 图标
3. 开启翻译开关
4. 页面中的英文段落下方将显示中文翻译

## 技术栈

- **构建工具**：Vite + vite-plugin-web-extension
- **语言**：TypeScript
- **扩展规范**：Chrome Extension Manifest V3
- **API**：DeepSeek API（OpenAI 兼容格式）

## 项目结构

```
chrome-extension/
├── src/
│   ├── background/        # Background Service Worker
│   │   ├── service-worker.ts   # 消息路由和 API 调用
│   │   ├── configManager.ts    # 配置管理
│   │   └── tabState.ts         # Tab 状态管理
│   ├── content/           # Content Script（注入网页）
│   │   ├── index.ts            # 入口和状态管理
│   │   ├── textExtractor.ts    # 文本提取
│   │   ├── translationInjector.ts  # 翻译注入
│   │   ├── translationCache.ts     # 页面级缓存
│   │   ├── batchManager.ts     # 动态批量管理
│   │   └── styles.css          # 翻译样式
│   ├── popup/             # Popup UI
│   │   ├── popup.html          # HTML 结构
│   │   ├── popup.css           # 暗色主题样式
│   │   └── popup.ts            # 交互逻辑
│   ├── providers/         # 翻译服务提供者
│   │   ├── ITranslateProvider.ts   # 接口定义
│   │   ├── DeepSeekProvider.ts     # DeepSeek 实现
│   │   └── index.ts
│   ├── types/             # TypeScript 类型定义
│   │   ├── config.ts           # 配置类型
│   │   ├── messages.ts         # 消息类型
│   │   ├── translation.ts      # 翻译类型
│   │   └── index.ts
│   └── manifest.json      # 扩展清单
├── public/
│   └── icons/             # 扩展图标
│       └── icon.svg
├── scripts/
│   └── install-mac.sh     # macOS 安装脚本
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 许可证

MIT License
