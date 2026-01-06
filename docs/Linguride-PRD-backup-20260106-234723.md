
# Linguride
## Product Requirements Document

**Version**: 1.0  
**Date**: 2026-01-06  
**Author**: Product Design Team  
**Status**: Draft  

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

### 5.1 Platform Support

| Platform | Framework | Min Version |
|----------|-----------|-------------|
| macOS | SwiftUI + AppKit | macOS 12.0+ |
| Windows | WinUI 3 / Electron | Windows 10+ |
| Cloud Backend | Node.js + Python | — |

### 5.2 Core Components

```
┌──────────────────────────────────────────────────┐
│                   Client Layer                   │
│  ┌─────────────┐          ┌─────────────┐       │
│  │   macOS     │          │   Windows   │       │
│  │   Native    │          │   Native    │       │
│  └──────┬──────┘          └──────┬──────┘       │
└─────────┼────────────────────────┼───────────────┘
          │                        │
          ▼                        ▼
┌──────────────────────────────────────────────────┐
│                   API Gateway                    │
└──────────────────────┬───────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   LLM       │ │   Speech    │ │   User      │
│   Service   │ │   Service   │ │   Service   │
│ (Dialogue)  │ │ (ASR + TTS) │ │ (Progress)  │
└─────────────┘ └─────────────┘ └─────────────┘
```

### 5.3 Key Technologies

| Component | Technology Choice | Rationale |
|-----------|-------------------|-----------|
| 对话引擎 | GPT-4 / Claude API | 自然对话、角色扮演能力 |
| 语音识别 | Whisper / Azure Speech | 高准确率、支持口音识别 |
| 发音评估 | Azure Pronunciation Assessment | 音素级别分析 |
| 语音合成 | ElevenLabs / Azure Neural TTS | 自然度高、多音色 |
| 本地存储 | SQLite + CoreData/Room | 离线缓存学习数据 |

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

## 7. Roadmap

### Phase 1: Foundation (Month 1-3)
- [ ] 核心对话引擎上线
- [ ] 20 个基础场景
- [ ] 发音评估 MVP
- [ ] macOS / Windows 双端发布

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

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM 响应延迟影响对话流畅度 | High | 本地缓存常见回复 + 流式输出 |
| 发音评估不够准确 | Medium | 多引擎对比 + 用户反馈校准 |
| 用户学习动力下降 | High | 游戏化机制 + 社区挑战 |
| 跨平台体验不一致 | Medium | 统一设计系统 + 严格 QA |

---

## 9. Appendix

### 9.1 Competitive Analysis

| Product | Strengths | Gaps |
|---------|-----------|------|
| Duolingo | 游戏化强、用户基数大 | 口语练习深度不足 |
| Speak | AI 对话体验好 | 场景有限、价格较高 |
| Cambly | 真人外教 | 需预约、成本高 |
| **Linguride** | 无限场景 + 即时反馈 + 本能化方法论 | — |

### 9.2 Design References
- Apple Fitness+ — 沉浸式体验、进度追踪
- Headspace — 简洁界面、引导式交互
- Notion — 跨平台一致性

---

*"The goal is not to learn English. The goal is to become someone who speaks English."*

