/**
 * @file offscreenTTSProtocol.ts
 * @description Service Worker 与 offscreen TTS 页面之间的内部消息协议
 */

import type { TTSSpeed } from "../types/tts";

export const OFFSCREEN_TTS_PLAY = "LINGRIDE_OFFSCREEN_TTS_PLAY";
export const OFFSCREEN_TTS_STOP = "LINGRIDE_OFFSCREEN_TTS_STOP";
export const OFFSCREEN_TTS_PAUSE = "LINGRIDE_OFFSCREEN_TTS_PAUSE";
export const OFFSCREEN_TTS_RESUME = "LINGRIDE_OFFSCREEN_TTS_RESUME";

export interface OffscreenTTSPlayMessage {
  type: typeof OFFSCREEN_TTS_PLAY;
  payload: {
    audioBase64: string;
    mimeType: string;
    rate: TTSSpeed;
  };
}

export interface OffscreenTTSStopMessage {
  type: typeof OFFSCREEN_TTS_STOP;
}

export interface OffscreenTTSPauseMessage {
  type: typeof OFFSCREEN_TTS_PAUSE;
}

export interface OffscreenTTSResumeMessage {
  type: typeof OFFSCREEN_TTS_RESUME;
}

export type OffscreenTTSMessage =
  | OffscreenTTSPlayMessage
  | OffscreenTTSStopMessage
  | OffscreenTTSPauseMessage
  | OffscreenTTSResumeMessage;

export interface OffscreenTTSResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

