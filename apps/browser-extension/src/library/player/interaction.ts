/**
 * @file interaction.ts
 * @description 资料库选区点击抑制与空格播放决策（纯函数，不依赖 DOM）
 */

export type SpaceQueueState = "idle" | "playing" | "paused";

export type SpacePlaybackAction =
  | "start"
  | "pause"
  | "resume"
  | "stop-selection"
  | "none";

/** 是否存在会抑制台词行 click 的非空文本选区 */
export function hasNonCollapsedTextSelection(
  selection: Selection | null
): boolean {
  return Boolean(
    selection && !selection.isCollapsed && selection.toString().trim().length > 0
  );
}

export interface SpacePlaybackContext {
  selectionSpeechActive: boolean;
  queueState: SpaceQueueState;
  ttsAvailable: boolean;
}

/** 决定空格应执行的动作；弹窗发音优先停止，TTS 不可用则不启动队列 */
export function resolveSpacePlaybackAction(
  context: SpacePlaybackContext
): SpacePlaybackAction {
  if (context.selectionSpeechActive) return "stop-selection";
  if (context.queueState === "playing") return "pause";
  if (!context.ttsAvailable) return "none";
  switch (context.queueState) {
    case "paused":
      return "resume";
    case "idle":
      return "start";
  }
}

export interface SpaceKeyFilterContext {
  defaultPrevented: boolean;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  interactiveTarget: boolean;
}

/** 是否可接管空格；调用方另行判断按键本身与播放器可见性 */
export function shouldHandleSpaceKey(
  context: SpaceKeyFilterContext
): boolean {
  return !(
    context.defaultPrevented ||
    context.repeat ||
    context.ctrlKey ||
    context.metaKey ||
    context.altKey ||
    context.interactiveTarget
  );
}
