/**
 * @file flashcardGrid.ts
 * @description 认图卡片网格：独立 reveal、英文 TTS 播放反馈与视图清理
 */

import { stopSelectionSpeech } from "../../content/selectionToolbar";
import type { HybridTTSPlayer } from "../../shared/hybridTTSPlayer";
import type { TTSSpeed } from "../../types";
import { FLASHCARD_CATEGORY_META, type Flashcard, type FlashcardDeck } from "../model/flashcard";
import { FlashcardRevealState } from "../model/flashcardState";
import { buildFlashcardSpeechText } from "../player/flashcardSpeech";
import { getFlashcardRevealA11y } from "./flashcardA11y";
import { createFlashcardArt } from "./flashcardArt";

export interface FlashcardGridDeps {
  player: Pick<HybridTTSPlayer, "playText" | "stop">;
  getRate(): TTSSpeed;
}

const DEFAULT_HINT = "点击图案显示或隐藏单词 · 点击 ▶ 播放英文";

export function renderFlashcardGrid(
  title: HTMLElement,
  subtitle: HTMLElement,
  grid: HTMLElement,
  deck: FlashcardDeck,
  deps: FlashcardGridDeps
): () => void {
  const revealState = new FlashcardRevealState();
  let playbackToken = 0;
  let activeButton: HTMLButtonElement | null = null;

  title.textContent = FLASHCARD_CATEGORY_META[deck.id].name;
  subtitle.hidden = false;
  subtitle.textContent = DEFAULT_HINT;
  grid.textContent = "";
  grid.className = "flashcard-word-grid";

  function resetPlaybackButton(): void {
    if (activeButton) {
      activeButton.textContent = "▶";
      activeButton.disabled = false;
      activeButton = null;
    }
  }

  function playCard(card: Flashcard, button: HTMLButtonElement): void {
    const token = ++playbackToken;
    resetPlaybackButton();
    activeButton = button;
    button.textContent = "…";
    button.disabled = true;
    subtitle.textContent = DEFAULT_HINT;
    stopSelectionSpeech();

    void deps.player
      .playText({
        text: buildFlashcardSpeechText(deck.id, card.word),
        rate: deps.getRate(),
        lang: "en-US",
        onStart: () => {
          if (token === playbackToken) button.textContent = "🔊";
        },
        onEnd: () => {
          if (token === playbackToken) resetPlaybackButton();
        },
        onPlaybackError: () => {
          if (token === playbackToken) subtitle.textContent = "播放失败，请重试";
        },
      })
      .catch(() => {
        if (token === playbackToken) subtitle.textContent = "播放失败，请重试";
      })
      .finally(() => {
        if (token === playbackToken) resetPlaybackButton();
      });
  }

  for (const card of deck.cards) {
    const item = document.createElement("div");
    item.className = "flashcard-word-card";
    item.style.background = `linear-gradient(145deg, ${card.background[0]}, ${card.background[1]})`;

    const revealButton = document.createElement("button");
    revealButton.type = "button";
    revealButton.className = "flashcard-reveal";
    revealButton.setAttribute("aria-label", "显示单词");
    revealButton.setAttribute("aria-pressed", "false");
    revealButton.appendChild(createFlashcardArt(card.art));
    revealButton.addEventListener("click", () => {
      revealState.toggle(card.id);
      const revealed = revealState.isRevealed(card.id);
      const a11y = getFlashcardRevealA11y(card.id, revealed);
      revealButton.setAttribute("aria-pressed", a11y.pressed);
      revealButton.setAttribute("aria-label", a11y.label);
      if (a11y.describedBy) {
        revealButton.setAttribute("aria-describedby", a11y.describedBy);
      } else {
        revealButton.removeAttribute("aria-describedby");
      }
      revealButton.querySelector(".flashcard-word")?.remove();
      if (revealed) {
        const word = document.createElement("span");
        word.id = a11y.wordId;
        word.className = "flashcard-word";
        word.textContent = card.word;
        revealButton.appendChild(word);
      }
    });

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "flashcard-play";
    playButton.textContent = "▶";
    playButton.setAttribute("aria-label", "播放英文发音");
    playButton.addEventListener("click", (event) => {
      event.stopPropagation();
      playCard(card, playButton);
    });

    item.append(revealButton, playButton);
    grid.appendChild(item);
  }

  return () => {
    playbackToken += 1;
    resetPlaybackButton();
    deps.player.stop();
  };
}
