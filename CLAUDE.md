# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Linguride** is a cross-platform AI-powered English language learning application based on the "Bicycle Method" – immersive, contextual language acquisition through AI conversation. The project is currently in the **planning phase** with only documentation present.

**Current Status**: Pre-implementation planning
- Single commit: `304a45a (doc) Linguride-PRD#draft`
- Repository contains only documentation and Claude configuration
- Development branch `dev_cc` active, parallel to `main`
- Project follows documentation-driven development approach

## Key Documentation

- **Primary Documentation**: `/docs/Linguride-PRD.md` (Chinese)
  - Comprehensive Product Requirements Document (optimized in v1.1)
  - Covers vision, user personas, features, UX, technical architecture, business model, roadmap
  - Details "Bicycle Method" learning methodology
  - Includes risk management, monetization strategy, and PRD reading guide
- **No README.md, CONTRIBUTING.md, or other standard documentation yet**

## Planned Architecture

### Tech Stack (Updated per PRD v1.1)
- **Frontend**: TypeScript + Tauri (跨平台桌面应用)
  - UI Framework: React + TypeScript
  - State Management: Zustand
  - CSS: Tailwind CSS
  - Runtime/Toolchain: Bun (运行时、打包工具、测试运行器、包管理器)
- **Backend**: Node.js + Python (cloud services) - 保持不变
- **AI/ML**: GPT-4/Claude API (dialogue), Whisper/Azure Speech (ASR), ElevenLabs/Azure Neural TTS - 保持不变
- **Local Storage**: SQLite (通过Tauri Rust后端访问)

### Core Components
1. **Client Layer**: Cross-platform Tauri application (React + TypeScript前端，Rust后端)
2. **API Gateway**: Central entry point for cloud services
3. **Microservices**:
   - LLM Service (dialogue engine)
   - Speech Service (ASR + TTS)
   - User Service (progress tracking)

### Architectural Patterns
- **Client-Server Separation**: Tauri客户端 ↔ Cloud API gateway ↔ Microservices
- **Microservices Architecture**: Independent services for LLM, speech, and user data
- **Offline-First Design**: Local SQLite storage with sync capabilities via Tauri Rust backend
- **Real-Time Audio Pipeline**: Speech recognition → AI processing → Feedback delivery
- **Cross-Platform Consistency**: Single codebase for macOS, Windows, Linux via Tauri

## Development Setup

**Note**: No code, build systems, or test infrastructure currently exists. Development should begin by setting up the foundational structure outlined in the PRD.

### Expected Development Workflow
1. **Tauri project setup**: Initialize Tauri + React + TypeScript + Bun project
2. **Backend services**: Initialize Node.js/Python microservices with API gateway
3. **Core infrastructure**: Set up LLM integration, speech processing pipeline
4. **UI development**: Implement core conversation flow and user interface

### Claude Permissions
The `.claude/settings.local.json` file currently grants:
- `Bash(ls:*)` - List files
- `Bash(cat:*)` - Read files
- `Bash(git checkout:*)` - Git branch operations

## Implementation Priorities (from PRD)

### Phase 1: Foundation (Month 1-3)
- Core dialogue engine (LLM integration)
- 20+ basic conversational scenarios
- Pronunciation assessment MVP
- Cross-platform desktop app release (macOS/Windows/Linux)

### Core Features (P0)
- AI对话伙伴 (AI dialogue partner with voice interaction)
- 场景化课程库 (Scenario-based course library)
- 发音评估引擎 (Pronunciation assessment engine)
- 智能纠错 (Intelligent error correction)

## Important Concepts

### The Bicycle Method
The pedagogical approach central to Linguride:
1. **RIDE** - Enter scenario, start conversation
2. **WOBBLE** - AI identifies errors, provides gentle hints
3. **BALANCE** - Immediate correction, repeat correct expressions
4. **RIDE AGAIN** - Spaced repetition for memory reinforcement
5. **FREEDOM** - Form instinct, natural output

### Design Principles
- **Invisible Learning**: Users feel they're "conversing" not "studying"
- **Zero Friction**: Click-and-speak, no complex setup
- **Instant Gratification**: Perceivable progress each session
- **Calm Technology**: Clean interface, focus on content

## Next Steps for Development

When starting implementation:
1. **Read the updated PRD (v1.1)** to understand the pedagogical vision and technical architecture
2. **Set up Tauri + React + TypeScript + Bun project** for cross-platform development
3. **Implement the core dialogue loop** before adding advanced features
4. **Leverage Tauri's Rust backend** for system integration and performance
5. **Prioritize real-time audio processing** for seamless conversation

## Branch Strategy
- `dev_cc`: Current development branch
- `main`: Stable releases (currently empty)

**Note**: This is a brand-new project. All architecture and implementation decisions should align with the vision outlined in the PRD while following modern software engineering best practices.