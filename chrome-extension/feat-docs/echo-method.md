# 回声法（Echo Method）

> 让用户回听自己的发音，与范读进行 A-B 对比，精准定位发音问题。

## 解决什么问题

用户在影子跟读练习中，往往只知道"哪里错了"，却很难感知"错成什么样"。回声法通过录制用户发音并提供即时回放，让用户可以：

- 听到自己真实的发音（而非脑海中的"完美版本"）
- 通过 A-B 对比快速识别与范读的差异
- 针对性地纠正特定发音问题

## 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                        影子跟读流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 获取共享 MediaStream                                        │
│     ↓                                                           │
│  2. 同时启动：语音识别 + 音频录制                                │
│     ↓                                                           │
│  3. 用户跟读                                                    │
│     ↓                                                           │
│  4. 停止录音 → 生成 Blob                                        │
│     ↓                                                           │
│  5. 显示评估结果 + 回声法面板                                   │
│     ↓                                                           │
│  6. 用户可选：听范读 / 听自己 / A-B 对比                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**A-B 对比播放流程：**
1. 播放范读（Web Speech API）
2. 间隔 800ms（给用户心理准备）
3. 播放用户录音（Audio API）

## 架构概览

```
tutor.ts (集成层)
    │
    ├── audioCapture.ts ─────────────── 共享 MediaStream 管理
    │       │
    │       └── 引用计数机制
    │
    └── echoMethod.ts ───────────────── 录音 + 播放逻辑
            │
            ├── MediaRecorder API ──── 录制用户发音
            ├── Audio API ──────────── 播放用户录音
            └── Web Speech API ─────── 播放范读（TTS）
```

## 主要模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 类型定义 | `types/echoMethod.ts` | 定义状态、错误类型、回调接口 |
| 音频采集 | `tutor/audioCapture.ts` | 统一管理麦克风流，引用计数 |
| 回声法核心 | `tutor/echoMethod.ts` | 录音、播放、A-B 对比 |
| UI 集成 | `tutor/tutor.ts` | 事件绑定、状态同步、UI 更新 |

## 技术亮点

### 1. 共享 MediaStream + 引用计数

**为什么这样做：** 浏览器中同时获取多个麦克风流会导致冲突，且权限请求体验差。

```typescript
// audioCapture.ts
let sharedStream: MediaStream | null = null;
let refCount = 0;

export async function acquireStream(): Promise<MediaStream> {
  if (sharedStream && sharedStream.active) {
    refCount++;  // 复用现有流
    return sharedStream;
  }
  // 否则请求新流...
}

export function releaseStream(): void {
  refCount--;
  if (refCount <= 0 && sharedStream) {
    sharedStream.getTracks().forEach(track => track.stop());
    sharedStream = null;
  }
}
```

### 2. 双重通知机制

**为什么这样做：** 回调适合实时 UI 更新（如按钮状态），Promise 适合流程控制（如等待播放完成再执行下一步）。

```typescript
// 回调：实时状态更新
echoMethod.setCallbacks({
  onStateChange: (state) => updateEchoButtonStates(state),
  onError: (error) => console.error(error),
});

// Promise：流程控制
await echoMethod.playABComparison(text, speed);
// 播放完成后继续...
```

### 3. 播放来源区分

**为什么这样做：** A-B 对比时需要知道当前播放的是范读还是用户录音，以更新对应的 UI 状态。

```typescript
type PlayingSource = "model" | "user" | "ab-model" | "ab-user" | null;
```

### 4. 快捷键支持

**E 键**：快速播放自己的录音（评估结果页面可用）

```typescript
case "KeyE":
  if (shadowAssessResult.style.display !== "none" && !echoPlayUserBtn.disabled) {
    handleEchoPlayUser();
  }
  break;
```

## 状态管理

```typescript
interface EchoMethodState {
  hasRecording: boolean;      // 是否有录音数据
  isPlaying: boolean;         // 是否正在播放
  playingSource: PlayingSource; // 当前播放来源
  recordingDuration: number;  // 录音时长（秒）
  isRecording: boolean;       // 是否正在录音
}
```

## 错误处理

| 错误类型 | 触发场景 | 处理方式 |
|----------|----------|----------|
| `recording-failed` | 录音启动失败 | 通知用户，重置状态 |
| `playback-failed` | 播放失败 | 通知用户，清理 Audio |
| `no-recording` | 无录音数据时播放 | 禁用按钮，提示用户 |
| `not-supported` | 浏览器不支持 | 静默降级，隐藏功能 |

## 资源清理

```typescript
// 切换句子时
echoMethod.clearRecording();  // 清理录音 URL、Blob

// 退出影子跟读时
echoMethod.reset();           // 完全重置模块状态
audioCapture.forceRelease();  // 强制释放麦克风流
```

## 限制与已知问题

1. **Web Speech TTS 质量**：范读使用浏览器内置 TTS，不同浏览器/系统效果差异大
2. **录音格式**：优先使用 `audio/webm;codecs=opus`，部分浏览器降级为 `audio/webm`
3. **无离线支持**：TTS 依赖浏览器实现，部分需要网络
