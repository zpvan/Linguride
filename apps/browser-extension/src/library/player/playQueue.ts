/**
 * @file playQueue.ts
 * @description 资料库连播队列：逐句播放、当前句回调、暂停/恢复（恢复时重播当前句）
 *
 * 不依赖 DOM：进度与高亮通过回调交给页面层；player/sleep 均可注入（测试友好）。
 */

import type { TTSSpeed } from "../../types";

export interface QueueLine {
  id: string;
  text: string;
}

/** 满足该接口即可驱动队列（HybridTTSPlayer 结构兼容） */
export interface QueueTTSPlayer {
  playText(options: { text: string; rate: TTSSpeed }): Promise<void>;
  stop(): void;
}

export interface PlayQueueCallbacks {
  onLineStart?(lineId: string, index: number): void;
  onProgress?(played: number, total: number): void;
  onFinish?(): void;
  onError?(message: string): void;
}

export type PlayQueueState = "idle" | "playing" | "paused";

export class PlayQueue {
  private state: PlayQueueState = "idle";
  private index = 0;
  private runToken = 0;
  private readonly gapMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly player: QueueTTSPlayer,
    private readonly lines: QueueLine[],
    private readonly rate: TTSSpeed,
    private readonly callbacks: PlayQueueCallbacks = {},
    options: { gapMs?: number; sleep?: (ms: number) => Promise<void> } = {}
  ) {
    this.gapMs = options.gapMs ?? 2000;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  getState(): PlayQueueState {
    return this.state;
  }

  getCurrentIndex(): number {
    return this.index;
  }

  /** 从指定句开始连播（会先停止当前播放） */
  async startFrom(index: number): Promise<void> {
    this.stop();
    this.index = Math.max(0, Math.min(index, this.lines.length - 1));
    this.state = "playing";
    await this.runLoop(++this.runToken);
  }

  /** 暂停：停止当前句的合成/播放；恢复时从当前句重播 */
  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.player.stop();
  }

  async resume(): Promise<void> {
    if (this.state !== "paused") return;
    this.state = "playing";
    await this.runLoop(++this.runToken);
  }

  stop(): void {
    this.state = "idle";
    this.runToken += 1;
    this.player.stop();
  }

  private async runLoop(token: number): Promise<void> {
    while (token === this.runToken && this.state === "playing") {
      if (this.index >= this.lines.length) {
        this.state = "idle";
        this.callbacks.onFinish?.();
        return;
      }
      const line = this.lines[this.index];
      this.callbacks.onLineStart?.(line.id, this.index);
      try {
        await this.player.playText({ text: line.text, rate: this.rate });
      } catch (error) {
        if (this.state === "playing") {
          this.state = "idle";
          this.callbacks.onError?.(
            error instanceof Error ? error.message : "播放失败"
          );
        }
        return;
      }
      if (token !== this.runToken || this.state !== "playing") return;

      // 进度在句末立即更新；索引在句间等待后才前进，句间暂停才能重播本句。
      this.callbacks.onProgress?.(this.index + 1, this.lines.length);
      if (this.index < this.lines.length - 1) {
        await this.sleep(this.gapMs);
        if (token !== this.runToken || this.state !== "playing") return;
      }
      this.index += 1;
    }
  }
}
