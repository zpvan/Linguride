/**
 * @file library.ts
 * @description 资料库全屏页入口：数据加载、hash 路由（首页 ↔ 播放器）、TTS 配置
 */

import { createHybridTTSPlayer } from "../shared/hybridTTSPlayer";
import {
  DEFAULT_TTS_SPEED,
  MessageType,
  TTS_SPEED_OPTIONS,
  type GetConfigResponse,
  type LingridConfig,
  type TTSSpeed,
  type TTSSelectionMode,
} from "../types";
import { isLibraryIndex, isStory, type LibraryIndex, type Story } from "./model/types";
import { renderHome } from "./view/home";
import { renderPlayerPage } from "./view/playerPage";

import rawIndex from "./data/index.json";

// ====== 数据加载（构建期内联，import.meta.glob 打包 stories/*.json） ======

interface LibraryData {
  index: LibraryIndex;
  stories: Map<string, Story>;
}

function loadLibrary(): LibraryData {
  if (!isLibraryIndex(rawIndex)) {
    throw new Error("资料库 index.json 结构非法（跑 doctor 检查）");
  }
  const stories = new Map<string, Story>();
  const modules = import.meta.glob("./data/stories/*.json", { eager: true });
  for (const [path, mod] of Object.entries(modules)) {
    const data = (mod as { default: unknown }).default;
    if (isStory(data)) {
      stories.set(data.id, data);
    } else {
      console.warn("[Library] 跳过非法 story 数据:", path);
    }
  }
  return { index: rawIndex, stories };
}

// ====== DOM ======

const homeView = document.getElementById("homeView") as HTMLElement;
const playerView = document.getElementById("playerView") as HTMLElement;
const categoryNav = document.getElementById("categoryNav") as HTMLElement;
const categoryTitle = document.getElementById("categoryTitle") as HTMLElement;
const storyGrid = document.getElementById("storyGrid") as HTMLElement;
const homeError = document.getElementById("homeError") as HTMLElement;
const homeRetryBtn = document.getElementById("homeRetryBtn") as HTMLButtonElement;
const playerBackBtn = document.getElementById("playerBackBtn") as HTMLButtonElement;

// ====== TTS 配置（与 corpus 同款模式） ======

let aiTTSEnabled = false;
let ttsSpeed: TTSSpeed = DEFAULT_TTS_SPEED;

const ttsPlayer = createHybridTTSPlayer({ isAIEnabled: () => aiTTSEnabled });

function applyAITTSConfig(config: Partial<LingridConfig>): void {
  const selection = config.tts_selection as TTSSelectionMode | undefined;
  if (selection === "browser") {
    aiTTSEnabled = false;
  } else if (selection === "minimax" || selection === "xiaomi" || selection === "doubao") {
    aiTTSEnabled = true;
  } else {
    aiTTSEnabled = Boolean(
      config.minimax_tts?.api_key?.trim() ||
        config.xiaomi_tts?.api_key?.trim() ||
        config.doubao_tts?.api_key?.trim()
    );
  }
}

function resolveTTSSpeed(value: unknown): TTSSpeed {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : Number.NaN;
  return TTS_SPEED_OPTIONS.includes(parsed as TTSSpeed) ? (parsed as TTSSpeed) : DEFAULT_TTS_SPEED;
}

async function loadConfig(): Promise<void> {
  try {
    const response: GetConfigResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG,
    });
    if (response.success && response.data) {
      applyAITTSConfig(response.data);
      ttsSpeed = resolveTTSSpeed(response.data.tts_speed);
    }
  } catch (error) {
    console.error("[Library] 加载配置失败:", error);
  }
}

export function isTTSAvailable(): boolean {
  return aiTTSEnabled || "speechSynthesis" in window;
}

// ====== 路由 ======

let library: LibraryData | null = null;

function route(): void {
  if (!library) return;
  const match = /^#\/story\/(.+)$/.exec(location.hash);
  if (match) {
    const story = library.stories.get(decodeURIComponent(match[1]));
    if (story) {
      homeView.hidden = true;
      playerView.hidden = false;
      renderPlayerPage(story, {
        player: ttsPlayer,
        getRate: () => ttsSpeed,
        ttsAvailable: isTTSAvailable,
      });
      return;
    }
    location.hash = "#/";
    return;
  }
  playerView.hidden = true;
  homeView.hidden = false;
  renderHome(categoryNav, categoryTitle, storyGrid, library.index, {
    onOpenStory: (id) => {
      location.hash = `#/story/${encodeURIComponent(id)}`;
    },
  });
}

// ====== 启动 ======

document.addEventListener("DOMContentLoaded", async () => {
  try {
    library = loadLibrary();
    homeError.hidden = true;
  } catch (error) {
    console.error("[Library] 数据加载失败:", error);
    homeError.hidden = false;
    storyGrid.hidden = true;
  }
  await loadConfig();
  route();
});

homeRetryBtn.addEventListener("click", () => location.reload());
playerBackBtn.addEventListener("click", () => {
  location.hash = "#/";
});
window.addEventListener("hashchange", route);
