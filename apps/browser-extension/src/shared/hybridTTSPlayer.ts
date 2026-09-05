/**
 * @file hybridTTSPlayer.ts
 * @description AI 优先、浏览器回退的统一 TTS 播放器
 */

import {
  GetTTSSynthesisStatusResponse,
  MessageType,
  SynthesizeSpeechResponse,
  TTSSpeed,
  TTSSynthesisStage,
} from "../types";

const DEFAULT_FALLBACK_WARNING =
  "AI 语音合成暂不可用，已切换为浏览器朗读";

interface ActivePlayback {
  utterance?: SpeechSynthesisUtterance;
  resolve: () => void;
  settled: boolean;
  onEnd?: () => void;
}

/** AI 合成进度 */
export interface TTSSynthesisProgress {
  stage: TTSSynthesisStage;
  elapsedMs: number;
}

export interface PlayTextOptions {
  text: string;
  rate: TTSSpeed;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onFallbackWarning?: (message: string) => void;
  fallbackWarningMessage?: string;
  /** AI 合成进度回调（传入后启用进度跟踪，onStart 延迟到 ready 阶段触发） */
  onProgress?: (progress: TTSSynthesisProgress) => void;
  /** AI 合成失败回调，携带具体失败原因 */
  onAIError?: (message: string) => void;
}

export interface HybridTTSPlayer {
  playText(options: PlayTextOptions): Promise<void>;
  playTextTwice(options: PlayTextOptions & { gapMs?: number }): Promise<void>;
  /** 取消正在进行中的 AI 合成（不影响后续的浏览器回退朗读） */
  cancelAIPlayback(): void;
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

/**
 * 系统自带的音效/搞怪声音（如 macOS 的 Whisper、Bells），
 * 回退朗读时必须排除，否则会播放出诡异的低语或音效声。
 */
const NOVELTY_VOICE_KEYWORDS = [
  "whisper",
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "carnival",
  "cellos",
  "deranged",
  "good news",
  "hysterical",
  "jester",
  "organ",
  "princess",
  "superstar",
  "trinoids",
  "wobble",
  "zarvox",
];

function normalizeVoiceLang(lang: string): string {
  return lang.toLowerCase().replace("_", "-");
}

/**
 * 从浏览器可用声音中挑选一个自然朗读声音。
 *
 * 优先精确匹配语言（如 en-US），其次匹配语言前缀（如 en）；
 * 排除音效声音，并优先返回系统默认声音。
 * 找不到匹配声音时返回 null，由浏览器自行决定。
 */
export function selectNaturalBrowserVoice(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const normalizedLang = normalizeVoiceLang(lang);
  const langPrefix = normalizedLang.split("-")[0];

  const exactMatches = voices.filter(
    (voice) => normalizeVoiceLang(voice.lang) === normalizedLang
  );
  const prefixMatches = voices.filter((voice) =>
    normalizeVoiceLang(voice.lang).startsWith(langPrefix)
  );
  const candidates = exactMatches.length > 0 ? exactMatches : prefixMatches;
  if (candidates.length === 0) return null;

  const natural = candidates.filter(
    (voice) =>
      !NOVELTY_VOICE_KEYWORDS.some((keyword) =>
        voice.name.toLowerCase().includes(keyword)
      )
  );
  const pool = natural.length > 0 ? natural : candidates;

  return pool.find((voice) => voice.default) ?? pool[0];
}

export function createHybridTTSPlayer(
  options: CreateHybridTTSPlayerOptions
): HybridTTSPlayer {
  let activePlayback: ActivePlayback | null = null;
  let activeRunToken: number | null = null;
  let fallbackWarningShown = false;
  let runToken = 0;
  // 仅当本实例发起过 AI 播放时才为 true，用于避免向 service worker
  // 发送全局 STOP_TTS_PLAYBACK 时误停其他页面的播放
  let ownsAIPlayback = false;
  // AI 合成进度轮询间隔
  const AI_STATUS_POLL_INTERVAL_MS = 700;
  // 当前进行中的 AI 合成请求 ID（未启用进度跟踪时为 null）
  let activeAIRequestId: string | null = null;
  let aiRequestCounter = 0;

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
    if (!ownsAIPlayback) return;
    ownsAIPlayback = false;

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

      const voice = selectNaturalBrowserVoice(
        window.speechSynthesis.getVoices(),
        lang
      );
      if (voice) {
        utterance.voice = voice;
      }

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

  interface PlayAICallbacks {
    onStart?: () => void;
    onEnd?: () => void;
    onProgress?: (progress: TTSSynthesisProgress) => void;
  }

  async function pollAISynthesisStatus(
    requestId: string,
    token: number,
    onProgress: (progress: TTSSynthesisProgress) => void,
    onReady: () => void
  ): Promise<void> {
    try {
      const response: GetTTSSynthesisStatusResponse =
        await chrome.runtime.sendMessage({
          type: MessageType.GET_TTS_SYNTHESIS_STATUS,
          payload: { requestId },
        });

      if (!response?.success || !response.data || !isCurrentRun(token)) return;
      if (response.data.stage === "unknown") return;

      onProgress({
        stage: response.data.stage,
        elapsedMs: response.data.elapsedMs,
      });

      if (response.data.stage === "ready") {
        onReady();
      }
    } catch {
      // Service worker 休眠等场景，忽略本次轮询
    }
  }

  async function playAISpeech(
    text: string,
    rate: TTSSpeed,
    token: number,
    callbacks: PlayAICallbacks
  ): Promise<SynthesizeSpeechResponse> {
    const { onStart, onEnd, onProgress } = callbacks;

    if (!isCurrentRun(token)) {
      return {
        success: false,
        errorCode: "TTS_CANCELLED",
        error: "朗读已取消",
      };
    }

    const trackProgress = typeof onProgress === "function";
    const requestId = trackProgress
      ? `tts-${Date.now()}-${++aiRequestCounter}`
      : undefined;
    activeAIRequestId = requestId ?? null;

    // 未启用进度跟踪时 onStart 已在请求发出时触发，不再补发 ready 通知
    let readyNotified = !trackProgress;
    const notifyReady = () => {
      if (readyNotified || !isCurrentRun(token)) return;
      readyNotified = true;
      onStart?.();
    };

    // 未启用进度跟踪时保持原行为：请求发出即标记播放中
    if (!trackProgress) {
      onStart?.();
    }

    let pollTimer: ReturnType<typeof setInterval> | undefined;
    if (requestId && onProgress) {
      void pollAISynthesisStatus(requestId, token, onProgress, notifyReady);
      pollTimer = setInterval(() => {
        void pollAISynthesisStatus(requestId, token, onProgress, notifyReady);
      }, AI_STATUS_POLL_INTERVAL_MS);
    }

    ownsAIPlayback = true;
    try {
      const response: SynthesizeSpeechResponse =
        await chrome.runtime.sendMessage({
          type: MessageType.SYNTHESIZE_SPEECH,
          payload: { text, rate, requestId },
        });

      if (response.success && isCurrentRun(token)) {
        notifyReady();
        onEnd?.();
      }

      return response;
    } finally {
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
      }
      activeAIRequestId = null;
      ownsAIPlayback = false;
    }
  }

  function cancelAIPlayback(): void {
    const requestId = activeAIRequestId;
    if (!requestId) return;

    void chrome.runtime
      .sendMessage({
        type: MessageType.CANCEL_TTS_SYNTHESIS,
        payload: { requestId },
      })
      .catch(() => {
        // Service worker 可能已休眠，忽略取消失败
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
      onProgress,
      onAIError,
      onFallbackWarning,
      fallbackWarningMessage = DEFAULT_FALLBACK_WARNING,
    } = playOptions;

    const shouldTryAI = options.isAIEnabled();

    if (shouldTryAI) {
      try {
        const response = await playAISpeech(text, rate, token, {
          onStart,
          onEnd,
          onProgress,
        });

        if (!isCurrentRun(token)) return;

        if (response.success && response.data) {
          if (response.data.fallbackWarningMessage && !fallbackWarningShown) {
            fallbackWarningShown = true;
            onFallbackWarning?.(response.data.fallbackWarningMessage);
          }
          return;
        }

        // 用户主动取消：静默回退浏览器朗读，不显示警告
        if (response.errorCode === "TTS_CANCELLED") {
          // fall through
        } else if (response.error && onAIError) {
          fallbackWarningShown = true;
          onAIError(response.error);
        } else if (
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
    cancelAIPlayback,
    stop,
    isPlaying,
  };
}
