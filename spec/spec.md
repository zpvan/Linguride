# Linguride 项目规格说明书

## 概述
基于 PRD v1.1 创建的实施规格说明书，包含核心需求、技术栈、设计指南和开发里程碑。

## 1. 核心需求

### 1.1 优先级功能 (P0)
- **AI对话伙伴**: 基于LLM的智能对话，支持语音交互
- **场景化课程库**: 覆盖生活、职场、学术等50+真实场景
- **发音评估引擎**: 实时分析发音准确度，标注改进点
- **智能纠错**: 语法、用词、表达地道性即时反馈

### 1.2 核心学习循环: Bicycle Method
1. **RIDE**: 进入场景，开始对话
2. **WOBBLE**: AI识别错误，轻推提示
3. **BALANCE**: 即时纠正，重复正确表达
4. **RIDE AGAIN**: 间隔复习，强化记忆
5. **FREEDOM**: 形成本能，自然输出

### 1.3 关键用户界面
- **Home**: 每日推荐、连续学习天数、本周口语时长
- **Scenarios**: 场景分类、难度标签、场景预览
- **Conversation**: 全屏对话界面、麦克风控制、实时字幕
- **Review**: 高频错误、待复习表达、跟读模式
- **Progress**: 口语能力雷达图、历史对话回放、里程碑系统

## 2. 技术栈

### 2.1 跨平台桌面应用
- **前端框架**: React + TypeScript
- **跨平台运行时**: Tauri (Rust + WebView)
- **JavaScript运行时**: Bun (一体化工具链)
- **状态管理**: Zustand
- **CSS框架**: Tailwind CSS
- **本地存储**: SQLite (通过Tauri Rust后端访问)

### 2.2 后端服务 (云服务)
- **API Gateway**: Node.js
- **LLM Service**: GPT-4/Claude API (对话引擎)
- **Speech Service**: Whisper/Azure Speech (ASR) + ElevenLabs/Azure Neural TTS
- **User Service**: 用户进度追踪

### 2.3 开发工具链
- **包管理**: Bun
- **构建工具**: Tauri Builder + Bun打包
- **测试框架**: Bun测试运行器 + Vitest
- **CI/CD**: GitHub Actions + Tauri多平台构建

## 3. 设计指南

### 3.1 设计原则
- **Invisible Learning**: 用户感觉在"对话"而非"上课"
- **Zero Friction**: 点击即说，无需繁琐设置
- **Instant Gratification**: 每次对话都有可感知的进步
- **Calm Technology**: 界面简洁，专注内容本身

### 3.2 设计参考
- **Apple Fitness+**: 沉浸式体验、进度追踪
- **Headspace**: 简洁界面、引导式交互
- **Notion**: 跨平台一致性

### 3.3 关键交互流程
1. **新用户引导**: 欢迎 → 选择目标 → 语音样本 → AI评估 → 个性化路径
2. **日常练习**: 打开App → 开始今日练习 → 完成对话 → 查看总结 → 标记复习

## 4. 开发里程碑 (最多3个)

### 里程碑1: UI基础与假数据
**目标**: 建立UI框架，使用假数据展示核心功能

**关键交付物**:
- Tauri + React + TypeScript + Bun 项目初始化
- 核心页面: Home, Scenarios, Conversation, Review, Progress
- UI组件库和主题系统
- 假数据生成和展示系统

**成功标准**:
- 主要页面可导航
- UI组件一致
- 假数据显示正常
- 跨平台构建成功

### 里程碑2: 核心对话功能
**目标**: 实现AI对话和基础语音功能

**关键交付物**:
- AI对话集成 (LLM API)
- 基础语音功能 (ASR/TTS)
- 本地数据存储 (SQLite)
- 简单发音评估

### 里程碑3: 完整功能与发布
**目标**: 完善核心功能，发布跨平台应用

**关键交付物**:
- 高级功能: 发音评估、智能纠错、间隔复习
- 场景库实现 (20+场景)
- 用户系统和进度同步
- 应用打包和发布

---

*基于 PRD v1.1 (2026-01-06) 创建，适用于开发团队实施参考。*