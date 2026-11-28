/**
 * @file flashcardEmotionsEmojiData.test.ts
 * @description 情绪与感觉卡片的 Emoji 对应关系、完整性与唯一性检查
 */

import { describe, expect, it } from "vitest";

import emotions from "../data/flashcards/emotions.json";
import { emotionsExpansion } from "./__fixtures__/flashcardEmotionsExpansion";

const EXPECTED_EMOJIS: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  surprised: "😮",
  scared: "😨",
  tired: "😴",
  excited: "🤩",
  nervous: "😰",
  calm: "🧘",
  relaxed: "😌",
  proud: "🏆",
  confident: "😎",
  shy: "🫣",
  embarrassed: "😳",
  bored: "😑",
  curious: "🤔",
  confused: "😕",
  worried: "😟",
  stressed: "😩",
  frustrated: "😣",
  disappointed: "😞",
  jealous: "😒",
  grateful: "🙏",
  hopeful: "🤞",
  cheerful: "😄",
  silly: "🤪",
  playful: "😜",
  lonely: "🧍",
  loved: "🥰",
  safe: "🛡️",
  brave: "💪",
  guilty: "😔",
};

describe("情绪与感觉 Emoji", () => {
  it("32 个情绪词条都使用语义明确且互不重复的 Emoji", () => {
    expect(emotions.id).toBe("emotions");
    expect(emotions.cards).toHaveLength(32);
    expect(emotionsExpansion.map(([word]) => word)).toEqual(Object.keys(EXPECTED_EMOJIS));
    for (const card of emotions.cards) {
      expect(card.id).toBe(`emotions-${card.word}`);
      expect(card.art).toEqual({ kind: "emoji", emoji: EXPECTED_EMOJIS[card.word] });
    }
    expect(new Set(emotions.cards.map((card) => card.art.emoji)).size).toBe(32);
  });
});
