/**
 * @file playerPage.ts
 * @description 资料库播放器页面组装（占位实现，Task 12 补全渲染与连播）
 */

import type { TTSSpeed } from "../../types";
import type { Story } from "../model/types";

export interface PlayerPageDeps {
  player: {
    playText(options: { text: string; rate: TTSSpeed }): Promise<void>;
    stop(): void;
  };
  getRate(): TTSSpeed;
  ttsAvailable(): boolean;
}

/** 占位实现：Task 12 替换为完整播放器 */
export function renderPlayerPage(story: Story, deps: PlayerPageDeps): void {
  void deps;
  const title = document.getElementById("playerTitle") as HTMLElement;
  const scroll = document.getElementById("playerScroll") as HTMLElement;
  title.textContent = `Ep.${story.episode} ${story.title}`;
  scroll.textContent = `播放器实现中…（${story.scenes.length} 场景）`;
}
