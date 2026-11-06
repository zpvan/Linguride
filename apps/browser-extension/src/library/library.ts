/**
 * @file library.ts
 * @description 文库入口：故事/认图卡片数据加载、hash 路由、视图清理与 TTS 配置
 */

import { initSelectionToolbar } from "../content/selectionToolbar";
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
import {
  FLASHCARD_CATEGORY_IDS,
  isFlashcardDeck,
  type FlashcardCategoryId,
  type FlashcardDeck,
} from "./model/flashcard";
import { parseLibraryRoute } from "./model/route";
import { isLibraryIndex, isStory, type LibraryIndex, type Story } from "./model/types";
import { pauseLibraryPlaybackForExternalSpeech } from "./player/interaction";
import { renderFlashcardGrid } from "./view/flashcardGrid";
import { renderFlashcardHome } from "./view/flashcardHome";
import { renderLibraryNav, renderStoryHome, type LibraryHomeTab } from "./view/home";
import {
  handlePlayerKeyboard,
  pausePlayerForExternalSpeech,
  renderPlayerPage,
  stopPlayerPage,
} from "./view/playerPage";

import rawIndex from "./data/index.json";

interface LibraryData {
  index: LibraryIndex;
  stories: Map<string, Story>;
  flashcards: Map<FlashcardCategoryId, FlashcardDeck>;
  invalidFlashcards: Set<FlashcardCategoryId>;
}

function loadLibrary(): LibraryData {
  if (!isLibraryIndex(rawIndex)) {
    throw new Error("文库 index.json 结构非法（跑 doctor 检查）");
  }

  const stories = new Map<string, Story>();
  const storyModules = import.meta.glob("./data/stories/*.json", { eager: true });
  for (const [path, mod] of Object.entries(storyModules)) {
    const data = (mod as { default: unknown }).default;
    if (isStory(data)) stories.set(data.id, data);
    else console.warn("[Library] 跳过非法 story 数据:", path);
  }

  const flashcards = new Map<FlashcardCategoryId, FlashcardDeck>();
  const invalidFlashcards = new Set<FlashcardCategoryId>(FLASHCARD_CATEGORY_IDS);
  const cardModules = import.meta.glob("./data/flashcards/*.json", { eager: true });
  for (const category of FLASHCARD_CATEGORY_IDS) {
    const path = `./data/flashcards/${category}.json`;
    const mod = cardModules[path] as { default: unknown } | undefined;
    const data = mod?.default;
    if (isFlashcardDeck(data) && data.id === category) {
      flashcards.set(category, data);
      invalidFlashcards.delete(category);
    } else {
      console.warn("[Library] 认图卡片数据缺失或非法:", path);
    }
  }
  return { index: rawIndex, stories, flashcards, invalidFlashcards };
}

const homeView = document.getElementById("homeView") as HTMLElement;
const playerView = document.getElementById("playerView") as HTMLElement;
const categoryNav = document.getElementById("categoryNav") as HTMLElement;
const categoryTitle = document.getElementById("categoryTitle") as HTMLElement;
const homeSubtitle = document.getElementById("homeSubtitle") as HTMLElement;
const storyGrid = document.getElementById("storyGrid") as HTMLElement;
const homeError = document.getElementById("homeError") as HTMLElement;
const homeRetryBtn = document.getElementById("homeRetryBtn") as HTMLButtonElement;
const homeBackBtn = document.getElementById("homeBackBtn") as HTMLButtonElement;
const playerBackBtn = document.getElementById("playerBackBtn") as HTMLButtonElement;

let aiTTSEnabled = false;
let ttsSpeed: TTSSpeed = DEFAULT_TTS_SPEED;
const ttsPlayer = createHybridTTSPlayer({ isAIEnabled: () => aiTTSEnabled });

function applyAITTSConfig(config: Partial<LingridConfig>): void {
  const selection = config.tts_selection as TTSSelectionMode | undefined;
  if (selection === "browser") aiTTSEnabled = false;
  else if (selection === "minimax" || selection === "xiaomi" || selection === "doubao") aiTTSEnabled = true;
  else {
    aiTTSEnabled = Boolean(
      config.minimax_tts?.api_key?.trim() ||
        config.xiaomi_tts?.api_key?.trim() ||
        config.doubao_tts?.api_key?.trim()
    );
  }
}

function resolveTTSSpeed(value: unknown): TTSSpeed {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : Number.NaN;
  return TTS_SPEED_OPTIONS.includes(parsed as TTSSpeed) ? (parsed as TTSSpeed) : DEFAULT_TTS_SPEED;
}

async function loadConfig(): Promise<void> {
  try {
    const response: GetConfigResponse = await chrome.runtime.sendMessage({ type: MessageType.GET_CONFIG });
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

let library: LibraryData | null = null;
let cleanupFlashcardGrid: (() => void) | null = null;

function renderNav(active: LibraryHomeTab): void {
  renderLibraryNav(categoryNav, active, {
    onOpenStories: () => { location.hash = "#/"; },
    onOpenCards: () => { location.hash = "#/cards"; },
  });
}

function leaveCurrentView(): void {
  cleanupFlashcardGrid?.();
  cleanupFlashcardGrid = null;
  stopPlayerPage();
  ttsPlayer.stop();
  homeBackBtn.hidden = true;
}

function route(): void {
  if (!library) return;
  const next = parseLibraryRoute(location.hash);
  if (next.kind === "cardsHome" && location.hash !== "#/cards") {
    location.replace("#/cards");
    return;
  }
  if (next.kind === "storyHome" && location.hash !== "" && location.hash !== "#/") {
    location.replace("#/");
    return;
  }

  leaveCurrentView();
  homeError.hidden = true;
  storyGrid.hidden = false;

  if (next.kind === "storyPlayer") {
    const story = library.stories.get(next.storyId);
    if (!story) {
      location.replace("#/");
      return;
    }
    homeView.hidden = true;
    playerView.hidden = false;
    renderPlayerPage(story, {
      player: ttsPlayer,
      getRate: () => ttsSpeed,
      ttsAvailable: isTTSAvailable,
    });
    return;
  }

  playerView.hidden = true;
  homeView.hidden = false;
  if (next.kind === "storyHome") {
    renderNav("story");
    renderStoryHome(categoryTitle, homeSubtitle, storyGrid, library.index, (id) => {
      location.hash = `#/story/${encodeURIComponent(id)}`;
    });
    return;
  }

  renderNav("cards");
  if (next.kind === "cardsHome") {
    renderFlashcardHome(
      categoryTitle,
      homeSubtitle,
      storyGrid,
      library.flashcards,
      library.invalidFlashcards,
      { onOpenCategory: (category) => { location.hash = `#/cards/${category}`; } }
    );
    return;
  }

  const deck = library.flashcards.get(next.category);
  if (!deck) {
    location.replace("#/cards");
    return;
  }
  homeBackBtn.hidden = false;
  cleanupFlashcardGrid = renderFlashcardGrid(
    categoryTitle,
    homeSubtitle,
    storyGrid,
    deck,
    { player: ttsPlayer, getRate: () => ttsSpeed }
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  initSelectionToolbar({
    onSpeechStart: () => {
      pauseLibraryPlaybackForExternalSpeech(
        pausePlayerForExternalSpeech,
        () => cleanupFlashcardGrid?.()
      );
    },
  });
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
homeBackBtn.addEventListener("click", () => { location.hash = "#/cards"; });
playerBackBtn.addEventListener("click", () => { location.hash = "#/"; });
window.addEventListener("hashchange", route);

document.addEventListener("keydown", (event) => {
  if (playerView.hidden) return;
  handlePlayerKeyboard(event);
});
