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
  "小米语音合成暂不可用，已切换为浏览器朗读";

interface ActivePlayback {
  audio?: HTMLAudioElement;
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

  function stop(): void {
    runToken += 1;
    activeRunToken = null;

    const playback = activePlayback;
    if (!playback) return;

    if (playback.audio) {
      playback.audio.pause();
      playback.audio.currentTime = 0;
      playback.audio.src = "";
    }

    if (isBrowserTTSAvailable()) {
      window.speechSynthesis.cancel();
    }

    finishPlayback(playback, false);
  }

  function beginRun(): number {
    stop();
    activeRunToken = runToken;
    return runToken;
  }

  function finishRun(token: number): void {
    if (activeRunToken === token) {
      activeRunToken = null;
    }
  }

  async function playAudioFromBase64(
    audioBase64: string,
    mimeType: string,
    rate: TTSSpeed,
    token: number,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!isCurrentRun(token)) {
        resolve();
        return;
      }

      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audio.preload = "auto";
      audio.playbackRate = rate;

      const playback: ActivePlayback = {
        audio,
        resolve,
        settled: false,
        onEnd,
      };
      activePlayback = playback;

      audio.onended = () => {
        finishPlayback(playback, true);
      };

      audio.onerror = () => {
        if (playback.settled) return;
        if (activePlayback === playback) {
          activePlayback = null;
        }
        playback.settled = true;
        reject(new Error("AI 语音播放失败"));
      };

      audio
        .play()
        .then(() => {
          if (!isCurrentRun(token)) {
            finishPlayback(playback, false);
            return;
          }
          onStart?.();
        })
        .catch((error) => {
          if (playback.settled) return;
          if (activePlayback === playback) {
            activePlayback = null;
          }
          playback.settled = true;
          reject(
            error instanceof Error ? error : new Error("AI 语音播放失败")
          );
        });
    });
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
        const response: SynthesizeSpeechResponse = await chrome.runtime.sendMessage(
          {
            type: MessageType.SYNTHESIZE_SPEECH,
            payload: { text, rate },
          }
        );

        if (!isCurrentRun(token)) return;

        if (response.success && response.data) {
          fallbackWarningShown = false;
          await playAudioFromBase64(
            response.data.audioBase64,
            response.data.mimeType,
            rate,
            token,
            onStart,
            onEnd
          );
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
