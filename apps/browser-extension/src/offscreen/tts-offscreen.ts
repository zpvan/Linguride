/**
 * @file tts-offscreen.ts
 * @description 在扩展自有上下文中播放 AI TTS 音频，绕过站点 CSP 对 data/blob 媒体的限制
 */

import {
  OFFSCREEN_TTS_PLAY,
  OFFSCREEN_TTS_STOP,
  OffscreenTTSMessage,
  OffscreenTTSPlayMessage,
  OffscreenTTSResponse,
} from "../shared/offscreenTTSProtocol";

interface ActiveOffscreenPlayback {
  audio: HTMLAudioElement;
  objectUrl: string;
  respond: (response: OffscreenTTSResponse) => void;
  settled: boolean;
}

let activePlayback: ActiveOffscreenPlayback | null = null;

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function settlePlayback(
  playback: ActiveOffscreenPlayback,
  response: OffscreenTTSResponse
): void {
  if (playback.settled) {
    return;
  }

  playback.settled = true;

  if (activePlayback === playback) {
    activePlayback = null;
  }

  playback.audio.pause();
  playback.audio.currentTime = 0;
  playback.audio.src = "";
  URL.revokeObjectURL(playback.objectUrl);
  playback.respond(response);
}

function stopActivePlayback(response: OffscreenTTSResponse): void {
  if (!activePlayback) {
    return;
  }

  settlePlayback(activePlayback, response);
}

async function handlePlayMessage(
  message: OffscreenTTSPlayMessage
): Promise<OffscreenTTSResponse> {
  stopActivePlayback({
    success: false,
    error: "AI 语音播放已被新的请求中断",
  });

  return new Promise<OffscreenTTSResponse>((resolve) => {
    const audioBlob = base64ToBlob(
      message.payload.audioBase64,
      message.payload.mimeType
    );
    const objectUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(objectUrl);
    audio.preload = "auto";
    audio.playbackRate = message.payload.rate;

    const playback: ActiveOffscreenPlayback = {
      audio,
      objectUrl,
      respond: resolve,
      settled: false,
    };
    activePlayback = playback;

    audio.onended = () => {
      settlePlayback(playback, { success: true });
    };

    audio.onerror = () => {
      settlePlayback(playback, {
        success: false,
        error: "扩展内音频播放失败",
      });
    };

    void audio.play().catch((error) => {
      settlePlayback(playback, {
        success: false,
        error: "扩展内音频播放失败",
        detail: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

chrome.runtime.onMessage.addListener(
  (
    message: OffscreenTTSMessage,
    _sender,
    sendResponse: (response: OffscreenTTSResponse) => void
  ) => {
    switch (message.type) {
      case OFFSCREEN_TTS_PLAY:
        void handlePlayMessage(message).then(sendResponse);
        return true;

      case OFFSCREEN_TTS_STOP:
        stopActivePlayback({ success: true });
        sendResponse({ success: true });
        return false;

      default:
        return false;
    }
  }
);
