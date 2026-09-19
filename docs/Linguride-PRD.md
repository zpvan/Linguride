
# Linguride
## Product Requirements Document

**Version**: 1.1
**Date**: 2026-01-06
**Last Updated**: 2026-01-06
**Author**: Product Design Team

> **状态说明（2026-09）**：本文档是产品的远期愿景文档，其中桌面应用、移动端、云端微服务等规划**尚未实施**。当前仓库实际维护的产物只有 Chrome 浏览器插件（`apps/browser-extension`），工程现状以 [README.md](../README.md) 与 [CLAUDE.md](../CLAUDE.md) 为准。
**Status**: Draft (Optimized)

*主要变更：更新技术架构为TypeScript+Tauri，添加商业模式，扩展风险管理*  

---

## 1. Executive Summary

### 1.1 Vision
> Learn English like riding a bicycle — once mastered, never forgotten.

Linguride 重新定义英语学习方式。我们相信语言不应该被"学习"，而应该被"习得"——通过沉浸式、高频次、情境化的练习，让英语从"知识"转化为"本能"。

### 1.2 Problem Statement

| 传统方法的问题 | 用户痛点 |
|---------------|---------|
| 过度依赖记忆和翻译 | 说英语前总要先在脑中翻译，反应慢 |
| 练习场景单一 | 学的是"教科书英语"，真实场景无法应对 |
| 缺乏即时反馈 | 不知道发音是否准确、表达是否地道 |
| 学习动力难以维持 | 枯燥的课程导致用户流失率高 |

### 1.3 Solution Overview

构建一个**以口语对话为核心**的学习系统，通过：
- 🎯 **AI 实时对话** — 无限场景模拟，随时随地练习
- 🔄 **间隔重复系统** — 科学记忆曲线，巩固薄弱环节
- 🎭 **角色沉浸** — 扮演真实身份，在情境中自然输出
- 📊 **智能诊断** — 精准定位发音、语法、表达问题

---

## 2. Target Users

### 2.1 Primary Persona

**Alex，28岁，互联网产品经理**
- 英语基础：CET-6，能读能写，但**开口困难**
- 目标：流利参与英文会议，与海外同事顺畅沟通
- 痛点：没有英语环境，找外教时间成本高
- 行为特征：碎片时间多，喜欢高效学习工具

### 2.2 Secondary Personas

| 用户类型 | 特征 | 核心需求 |
|---------|------|---------|
| 留学备考生 | 18-25岁，准备托福/雅思口语 | 模拟考试场景，获得评分反馈 |
| 职场新人 | 22-30岁，外企工作 | 商务英语、邮件/会议场景 |
| 英语爱好者 | 各年龄段，自我提升 | 日常对话、旅行英语 |

---

## 3. Core Features

### 3.1 Feature Matrix

| Feature | Priority | Description |
|---------|----------|-------------|
| **AI 对话伙伴** | P0 | 基于 LLM 的智能对话，支持语音交互 |
| **场景化课程库** | P0 | 覆盖生活、职场、学术等 50+ 真实场景 |
| **发音评估引擎** | P0 | 实时分析发音准确度，标注改进点 |
| **智能纠错** | P0 | 语法、用词、表达地道性即时反馈 |
| **进度追踪** | P1 | 可视化学习数据，识别薄弱环节 |
| **间隔复习** | P1 | 基于遗忘曲线的智能复习提醒 |
| **社区挑战** | P2 | 用户间口语 PK，增加学习动力 |

### 3.2 Core Loop: The Bicycle Method

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ① RIDE（骑行）                                    │
│   进入场景，开始对话                                 │
│           ↓                                         │
│   ② WOBBLE（摇晃）                                  │
│   AI 识别错误，轻推提示                              │
│           ↓                                         │
│   ③ BALANCE（平衡）                                 │
│   即时纠正，重复正确表达                             │
│           ↓                                         │
│   ④ RIDE AGAIN（再次骑行）                          │
│   间隔复习，强化记忆                                 │
│           ↓                                         │
│   ⑤ FREEDOM（自由驰骋）                             │
│   形成本能，自然输出                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 4. User Experience

### 4.1 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Invisible Learning** | 用户感觉在"对话"而非"上课" |
| **Zero Friction** | 点击即说，无需繁琐设置 |
| **Instant Gratification** | 每次对话都有可感知的进步 |
| **Calm Technology** | 界面简洁，专注内容本身 |

### 4.2 Key Screens

#### 4.2.1 Home — Daily Ride
- 今日推荐场景（基于用户水平和目标）
- 连续学习天数 & 本周口语时长
- 快速进入上次未完成的对话

#### 4.2.2 Scenarios — Choose Your Path
- 场景分类：Daily Life / Work / Travel / Academic
- 难度标签：Beginner / Intermediate / Advanced
- 场景预览：对话背景、你将扮演的角色、学习目标

#### 4.2.3 Conversation — The Ride
- 全屏对话界面，沉浸感优先
- 底部：麦克风按钮（按住说话 / 点击切换）
- 实时字幕 + 发音评分（可折叠）
- 对话结束后：Summary Card（亮点 & 改进点）

#### 4.2.4 Review — Strengthen Memory
- 本周高频错误 Top 5
- 待复习表达（间隔重复算法调度）
- "Shadow Reading" 模式：跟读标准发音

#### 4.2.5 Progress — Your Journey
- 口语能力雷达图：发音 / 流利度 / 词汇 / 语法 / 地道性
- 历史对话回放
- 里程碑成就系统

### 4.3 Interaction Flows

**Flow 1: First Time User Onboarding**
```
Welcome → Select Goal（工作/留学/日常）→ 
Voice Sample（30秒自我介绍）→ AI 评估当前水平 → 
生成个性化学习路径 → 开始第一次对话
```

**Flow 2: Daily Practice Session**
```
打开 App → 点击"Start Today's Ride" → 
进入推荐场景 → 完成 5-10 分钟对话 → 
查看 Summary → 标记待复习表达 → 
获得经验值 & 连续天数 +1
```

---

## 5. Technical Architecture

### 5.1 Platform Support & Technology Stack

**跨平台桌面应用架构：TypeScript + Tauri**

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| **前端框架** | React + TypeScript | 现代UI框架，类型安全 |
| **跨平台运行时** | Tauri (Rust + WebView) | 轻量级跨平台桌面应用框架 |
| **JavaScript 运行时** | Bun | 高性能JavaScript运行时、包管理器、打包工具、测试运行器 |
| **状态管理** | Zustand | 轻量级状态管理库 |
| **CSS 框架** | Tailwind CSS | 实用优先的CSS框架 |
| **后端服务** | Node.js + Python 微服务 | 云原生微服务架构 |
| **AI/ML 服务** | GPT-4/Claude API + Whisper/Azure Speech + ElevenLabs/Azure Neural TTS | 对话引擎、语音识别、语音合成 |
| **本地存储** | SQLite (通过Tauri Rust后端访问) | 离线数据缓存 |

### 5.2 Core Components & System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   跨平台客户端 (Tauri)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 前端: React + TypeScript + Tailwind CSS             │    │
│  │ 状态管理: Zustand                                   │    │
│  │ 运行时: Bun                                         │    │
│  └───────────┬─────────────────────────────────────────┘    │
│              │                                              │
│  ┌───────────┴─────────────────────────────────────────┐    │
│  │ Tauri Rust后端: 本地API、SQLite访问、系统集成          │    │
│  └──────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   云服务 API Gateway                         │
└──────────────────────┬──────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   LLM       │ │   Speech    │ │   User      │
│   Service   │ │   Service   │ │   Service   │
│ (Dialogue)  │ │ (ASR + TTS) │ │ (Progress)  │
└─────────────┘ └─────────────┘ └─────────────┘
```

### 5.3 Architecture Advantages

1. **跨平台一致性**: 一套代码支持 macOS、Windows、Linux
2. **性能优势**: Tauri使用系统WebView，比Electron轻量70-80%；Bun运行时性能优于Node.js
3. **安全性**: Rust后端提供内存安全保证，减少安全漏洞
4. **开发效率**: 现代前端技术栈 + 一体化工具链 (Bun)
5. **离线优先**: 通过Tauri Rust后端实现可靠的本地数据存储和同步

### 5.4 Key Technology Decisions

| 技术领域 | 选型 | 理由 | 替代方案 |
|----------|------|------|----------|
| **跨平台框架** | Tauri | 轻量、安全、性能好，使用系统WebView | Electron (更重)、Flutter (需要学习Dart) |
| **前端框架** | React + TypeScript | 生态丰富、类型安全、团队熟悉 | Vue 3、Svelte |
| **工具链** | Bun | 一体化工具链 (运行时+打包+测试+包管理)，性能卓越 | Node.js + npm/yarn/pnpm + Webpack/Vite |
| **状态管理** | Zustand | 轻量、简单、TypeScript友好 | Redux Toolkit、MobX |
| **UI样式** | Tailwind CSS | 开发效率高、实用优先、设计一致性 | Styled Components、CSS Modules |

### 5.5 Development & Deployment

- **开发环境**: Bun + TypeScript + React + Tauri CLI
- **构建工具**: Tauri Builder + Bun 打包
- **包管理**: Bun (替代 npm/yarn/pnpm)
- **测试框架**: Bun 测试运行器 + Vitest/Jest
- **CI/CD**: GitHub Actions + Tauri 自动构建多平台发布

---

## 6. Success Metrics

### 6.1 North Star Metric
> **Weekly Active Speaking Minutes (WASM)**  
> 用户每周累计口语练习时长

### 6.2 Key Metrics

| Category | Metric | Target (6 months) |
|----------|--------|-------------------|
| Engagement | DAU/MAU | > 40% |
| Engagement | Avg. Session Duration | > 8 min |
| Retention | D7 Retention | > 35% |
| Retention | D30 Retention | > 20% |
| Learning | Weekly Speaking Minutes | > 60 min |
| Quality | Pronunciation Improvement Rate | > 15% (30 days) |

---

## 7. Business Model & Monetization

### 7.1 Revenue Streams

| 收入流 | 描述 | 目标用户 |
|--------|------|----------|
| **免费增值模式** | 基础功能免费，高级功能付费 | 所有用户 |
| **订阅制** | 月付/季付/年付订阅，解锁全部功能 | 重度用户、职场人士 |
| **企业版** | B2B企业培训解决方案，按员工数收费 | 中小企业、大型企业 |
| **场景包** | 特定场景包一次性购买（如商务谈判、旅行应急） | 有特定需求的用户 |

### 7.2 Pricing Strategy

**免费层 (Free Tier):**
- 每日5次基础对话练习
- 基础发音评估
- 10个常用场景
- 基础进度追踪

**高级订阅 (Premium Subscription):**
- **月付**: ¥68/月
- **季付**: ¥168/季 (节省18%)
- **年付**: ¥588/年 (节省28%)
- **功能包括**: 无限对话、高级发音评估、50+场景、个性化学习路径、离线模式、优先支持

**企业版 (Enterprise):**
- 定制化定价 (¥199/用户/月起)
- 企业管理员面板
- 定制场景开发
- 使用数据报表
- SSO集成
- 专属客户支持

### 7.3 Market Positioning & Value Proposition

**核心价值主张:**
> "以1/10的外教成本，获得7x24小时的AI英语陪练"

**竞争优势矩阵:**
| 维度 | Linguride | 传统外教 | 竞品APP |
|------|-----------|----------|----------|
| 成本 | 低 (¥588/年) | 高 (¥200-500/小时) | 中 (¥1000-2000/年) |
| 可用性 | 7x24小时 | 需预约 | 随时可用 |
| 个性化 | AI实时调整 | 依赖老师经验 | 有限个性化 |
| 场景丰富度 | 50+真实场景 | 依赖老师准备 | 20-30个场景 |
| 即时反馈 | 实时发音评估 | 依赖老师听力 | 有限反馈 |

### 7.4 Customer Acquisition & Growth Strategy

1. **内容营销**: 英语学习博客、短视频教程、社交媒体
2. **合作伙伴**: 留学机构、英语培训机构、企业HR部门
3. **推荐计划**: 用户推荐奖励机制
4. **应用商店优化**: 针对"英语口语"、"AI对话"等关键词优化
5. **免费试用**: 14天高级功能免费试用

### 7.5 Financial Projections (12个月目标)

| 指标 | 目标值 | 备注 |
|------|--------|------|
| 付费用户数 | 10,000 | 月活用户的5%转化率 |
| 月经常性收入 (MRR) | ¥588,000 | 基于年付用户平均 |
| 客户获取成本 (CAC) | < ¥200 | 通过内容营销降低 |
| 用户生命周期价值 (LTV) | > ¥800 | 基于18个月留存 |
| LTV:CAC 比率 | > 4:1 | 健康商业模式指标 |

---
## 8. Roadmap

### Phase 1: Foundation (Month 1-3)
- [ ] 核心对话引擎上线
- [ ] 20 个基础场景
- [ ] 发音评估 MVP
- [ ] 跨平台桌面应用发布 (macOS/Windows/Linux)

### Phase 2: Growth (Month 4-6)
- [ ] 场景库扩展至 50+
- [ ] 间隔复习系统
- [ ] 用户进度追踪
- [ ] 社交分享功能

### Phase 3: Expansion (Month 7-12)
- [ ] 移动端（iOS / Android）
- [ ] 企业版（B2B）
- [ ] 多语言支持（日语、西班牙语）
- [ ] AI 教练个性化辅导

---

## 9. Risks & Mitigations

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| LLM API成本超出预算 | High | Medium | 实现响应缓存、使用更小模型、成本监控预警 |
| 实时音频处理延迟 >500ms | High | Medium | 优化音频管道、边缘计算、性能测试 |
| Tauri跨平台兼容性问题 | Medium | Low | 早期跨平台测试、特性降级方案 |
| 第三方服务API变更 | Medium | Medium | 抽象服务层、多供应商备选方案 |
| 数据同步冲突 | Medium | Low | 冲突解决策略、离线优先设计 |

### 9.2 Business & Market Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 用户付费意愿低 | High | Medium | 免费增值模式、延长试用期、价值沟通 |
| 市场竞争加剧 | High | High | 差异化定位、快速迭代、品牌建设 |
| 用户留存率低 | High | Medium | 个性化推荐、社区功能、学习成就感设计 |
| AI对话质量不稳定 | High | Low | 多LLM供应商、质量监控、用户反馈循环 |

### 9.3 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 内容制作速度跟不上需求 | Medium | Medium | UGC内容生态、模板化场景生成 |
| 客户支持压力大 | Medium | Low | AI客服辅助、知识库建设、社区互助 |
| 数据隐私与合规风险 | High | Low | GDPR/CCPA合规设计、数据加密、隐私政策 |

### 9.4 Risk Management Strategy

1. **风险监控**: 建立关键风险指标 (KRIs) 监控仪表板
2. **应急预案**: 为高影响风险制定详细应急预案
3. **定期评审**: 季度风险评审会议，更新风险登记册
4. **风险所有权**: 为每个风险指定负责人和应对团队

---

## 10. Appendix

### 10.1 Competitive Analysis

| Product | Strengths | Gaps |
|---------|-----------|------|
| Duolingo | 游戏化强、用户基数大 | 口语练习深度不足 |
| Speak | AI 对话体验好 | 场景有限、价格较高 |
| Cambly | 真人外教 | 需预约、成本高 |
| **Linguride** | 无限场景 + 即时反馈 + 本能化方法论 | — |

### 10.2 Design References
- Apple Fitness+ — 沉浸式体验、进度追踪
- Headspace — 简洁界面、引导式交互
- Notion — 跨平台一致性

### 10.3 PRD Reading Guide

本PRD为不同角色提供了针对性的阅读路径，帮助团队快速理解产品核心。

#### 产品经理 & 业务负责人
**关注章节**: 1, 2, 7, 8
**核心问题**:
- 我们解决什么用户问题？市场机会多大？
- 商业模式如何？盈利路径是什么？
- 产品路线图和时间规划？
- 关键成功指标有哪些？

**阅读时间**: 20-30分钟
**产出**: 产品战略对齐，资源规划

#### 技术负责人 & 开发团队
**关注章节**: 5, 8 (技术相关), 9.1
**核心问题**:
- 技术架构和选型是什么？
- 系统组件和接口如何设计？
- 性能和安全要求是什么？
- 主要技术风险和应对措施？

**阅读时间**: 30-45分钟
**产出**: 技术可行性评估，开发估算

#### 设计师 & UX研究员
**关注章节**: 2, 4, 3.2 (Core Loop)
**核心问题**:
- 目标用户是谁？他们的痛点和动机是什么？
- 用户体验流程和关键界面是什么？
- 设计原则和参考是什么？
- 可访问性要求是什么？

**阅读时间**: 25-35分钟
**产出**: 设计方向，用户研究计划

#### 测试 & 质量保障团队
**关注章节**: 3.1 (功能矩阵), 5.5, 9.1
**核心问题**:
- 功能需求和验收标准是什么？
- 性能测试基准是什么？
- 技术风险和测试重点是什么？
- 部署和监控策略是什么？

**阅读时间**: 20-30分钟
**产出**: 测试计划，自动化策略

#### 高管 & 投资者
**关注章节**: 1, 7, 8 (摘要)
**核心问题**:
- 产品愿景和市场机会？
- 商业模式和财务潜力？
- 竞争优势和护城河？
- 关键里程碑和资源需求？

**阅读时间**: 15-20分钟
**产出**: 投资决策，战略优先级

---

*"The goal is not to learn English. The goal is to become someone who speaks English."*

