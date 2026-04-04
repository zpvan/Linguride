/**
 * @file hybridTTSPlayer.ts
 * @description AI 优先、浏览器回退的统一 TTS 播放器
 */

import {
  MessageType,
  SynthesizeSpeechResponse,
  TTSSpeed,
} from "../types";

const DEFAULT_FALLBACK_WARNING =
  "AI 语音合成暂不可用，已切换为浏览器朗读";

interface ActivePlayback {
  utterance?: SpeechSynthesisUtterance;
  resolve: () => void;
  settled: boolean;
  onEnd?: () => void;
}

export interface PlayTextOptions {
  text: string;
  rate: TTSSpeed;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onFallbackWarning?: (message: string) => void;
  fallbackWarningMessage?: string;
}

export interface HybridTTSPlayer {
  playText(options: PlayTextOptions): Promise<void>;
  playTextTwice(options: PlayTextOptions & { gapMs?: number }): Promise<void>;
  stop(): void;
  isPlaying(): boolean;
}

interface CreateHybridTTSPlayerOptions {
  isAIEnabled: () => boolean;
}

function isBrowserTTSAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function createHybridTTSPlayer(
  options: CreateHybridTTSPlayerOptions
): HybridTTSPlayer {
  let activePlayback: ActivePlayback | null = null;
  let activeRunToken: number | null = null;
  let fallbackWarningShown = false;
  let runToken = 0;

  function isCurrentRun(token: number): boolean {
    return token === runToken;
  }

  function finishPlayback(playback: ActivePlayback, invokeOnEnd: boolean): void {
    if (playback.settled) return;

    playback.settled = true;
    if (activePlayback === playback) {
      activePlayback = null;
    }

    if (invokeOnEnd) {
      playback.onEnd?.();
    }

    playback.resolve();
  }

  function requestStopAIPlayback(): void {
    void chrome.runtime
      .sendMessage({
        type: MessageType.STOP_TTS_PLAYBACK,
      })
      .catch(() => {
        // Service worker 可能已休眠，忽略停止失败并保持前台状态可恢复。
      });
  }

  function stop(): void {
    runToken += 1;
    activeRunToken = null;

    requestStopAIPlayback();

    const playback = activePlayback;

    if (isBrowserTTSAvailable()) {
      window.speechSynthesis.cancel();
    }

    if (!playback) return;

    finishPlayback(playback, false);
  }

  function beginRun(): number {
    stop();
    fallbackWarningShown = false;
    activeRunToken = runToken;
    return runToken;
  }

  function finishRun(token: number): void {
    if (activeRunToken === token) {
      activeRunToken = null;
    }
  }

  async function playBrowserText(
    text: string,
    rate: TTSSpeed,
    token: number,
    lang: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (!isBrowserTTSAvailable()) {
      throw new Error("浏览器语音能力不可用");
    }

    await new Promise<void>((resolve, reject) => {
      if (!isCurrentRun(token)) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;

      const playback: ActivePlayback = {
        utterance,
        resolve,
        settled: false,
        onEnd,
      };
      activePlayback = playback;

      utterance.onstart = () => {
        if (!isCurrentRun(token)) return;
        onStart?.();
      };

      utterance.onend = () => {
        finishPlayback(playback, true);
      };

      utterance.onerror = () => {
        if (playback.settled) return;
        if (activePlayback === playback) {
          activePlayback = null;
        }
        playback.settled = true;
        reject(new Error("浏览器语音播放失败"));
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  async function playAISpeech(
    text: string,
    rate: TTSSpeed,
    token: number,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<SynthesizeSpeechResponse> {
    if (!isCurrentRun(token)) {
      return {
        success: false,
        errorCode: "TTS_UNKNOWN_ERROR",
        error: "朗读已取消",
      };
    }

    onStart?.();

    const response: SynthesizeSpeechResponse = await chrome.runtime.sendMessage({
      type: MessageType.SYNTHESIZE_SPEECH,
      payload: { text, rate },
    });

    if (response.success && isCurrentRun(token)) {
      onEnd?.();
    }

    return response;
  }

  async function playTextInternal(
    token: number,
    playOptions: PlayTextOptions
  ): Promise<void> {
    const text = playOptions.text.trim();
    if (!text) return;

    const {
      rate,
      lang = "en-US",
      onStart,
      onEnd,
      onFallbackWarning,
      fallbackWarningMessage = DEFAULT_FALLBACK_WARNING,
    } = playOptions;

    const shouldTryAI = options.isAIEnabled();

    if (shouldTryAI) {
      try {
        const response = await playAISpeech(text, rate, token, onStart, onEnd);

        if (!isCurrentRun(token)) return;

        if (response.success && response.data) {
          if (response.data.fallbackWarningMessage && !fallbackWarningShown) {
            fallbackWarningShown = true;
            onFallbackWarning?.(response.data.fallbackWarningMessage);
          }
          return;
        }

        if (
          response.errorCode !== "TTS_NOT_CONFIGURED" &&
          !fallbackWarningShown
        ) {
          fallbackWarningShown = true;
          onFallbackWarning?.(fallbackWarningMessage);
        }
      } catch {
        if (!isCurrentRun(token)) return;

        if (!fallbackWarningShown) {
          fallbackWarningShown = true;
          onFallbackWarning?.(fallbackWarningMessage);
        }
      }
    }

    await playBrowserText(text, rate, token, lang, onStart, onEnd);
  }

  async function playText(playOptions: PlayTextOptions): Promise<void> {
    const token = beginRun();
    try {
      await playTextInternal(token, playOptions);
    } finally {
      finishRun(token);
    }
  }

  async function playTextTwice(
    playOptions: PlayTextOptions & { gapMs?: number }
  ): Promise<void> {
    const { gapMs = 500 } = playOptions;
    const token = beginRun();

    try {
      await playTextInternal(token, playOptions);
      if (!isCurrentRun(token)) return;

      await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
      if (!isCurrentRun(token)) return;

      await playTextInternal(token, playOptions);
    } finally {
      finishRun(token);
    }
  }

  function isPlaying(): boolean {
    return activePlayback !== null || activeRunToken !== null;
  }

  return {
    playText,
    playTextTwice,
    stop,
    isPlaying,
  };
}
