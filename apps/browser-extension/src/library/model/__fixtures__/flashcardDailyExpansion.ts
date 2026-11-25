/**
 * @file flashcardDailyExpansion.ts
 * @description 第三批衣物、学习用品、玩具扩充卡片的精确测试数据
 */

import type { FlashcardArt } from "../flashcard";
import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  green: ["#e5f8ed", "#bce6cc"], purple: ["#f0e6ff", "#d6c1f5"],
  pink: ["#fff0f5", "#f6c9da"], yellow: ["#fff8d9", "#f3e2a4"],
  red: ["#fff1f2", "#fecdd3"], cyan: ["#e0f7fa", "#b2ebf2"],
  gray: ["#f0f0f5", "#d5d5e2"], brown: ["#f3eadf", "#dfc3a5"],
  white: ["#f8fafc", "#e2e8f0"], mint: ["#f0fdf4", "#bbf7d0"],
  lime: ["#f7fee7", "#d9f99d"], lavender: ["#faf5ff", "#e9d5ff"],
} as const;
const e = (emoji: string): FlashcardArt => ({ kind: "emoji", emoji });
const i = (cardId: string): FlashcardArt => ({ kind: "illustration", illustration: cardId });

export const dailyExpansion = {
  clothing: [
    ["t-shirt", i("clothing-t-shirt"), B.blue], ["jeans", e("👖"), B.blue],
    ["skirt", i("clothing-skirt"), B.pink], ["blouse", e("👚"), B.lavender],
    ["sweater", i("clothing-sweater"), B.orange], ["cardigan", i("clothing-cardigan"), B.brown],
    ["hoodie", i("clothing-hoodie"), B.gray], ["jacket", i("clothing-jacket"), B.cyan],
    ["blazer", i("clothing-blazer"), B.lavender], ["suit", e("🤵"), B.gray],
    ["uniform", e("🧑‍✈️"), B.blue], ["raincoat", i("clothing-raincoat"), B.blue],
    ["pajamas", i("clothing-pajamas"), B.white], ["vest", e("🦺"), B.orange],
    ["scarf", e("🧣"), B.red], ["gloves", e("🧤"), B.blue],
    ["mitten", i("clothing-mitten"), B.pink], ["sock", e("🧦"), B.white],
    ["boot", e("🥾"), B.gray], ["sneaker", e("👟"), B.green],
    ["shoe", e("👞"), B.brown], ["sandal", e("🩴"), B.orange],
    ["slipper", i("clothing-slipper"), B.pink], ["cap", e("🧢"), B.blue],
    ["beanie", i("clothing-beanie"), B.lavender], ["helmet", e("⛑️"), B.red],
    ["belt", i("clothing-belt"), B.brown], ["tie", e("👔"), B.purple],
  ],
  school: [
    ["crayon", e("🖍️"), B.orange], ["marker", i("school-marker"), B.gray],
    ["highlighter", i("school-highlighter"), B.lime], ["chalk", i("school-chalk"), B.green],
    ["eraser", i("school-eraser"), B.pink], ["sharpener", i("school-sharpener"), B.gray],
    ["pencil case", i("school-pencil-case"), B.purple], ["pencil box", i("school-pencil-box"), B.brown],
    ["notebook", e("📓"), B.blue], ["textbook", i("school-textbook"), B.green],
    ["stapler", i("school-stapler"), B.orange], ["dictionary", i("school-dictionary"), B.cyan],
    ["storybook", i("school-storybook"), B.purple], ["comic book", i("school-comic-book"), B.red],
    ["library card", i("school-library-card"), B.green], ["backpack", e("🎒"), B.red],
    ["lunchbox", i("school-lunchbox"), B.orange], ["water bottle", i("school-water-bottle"), B.cyan],
    ["scissors", e("✂️"), B.gray], ["glue", i("school-glue"), B.white],
    ["tape", i("school-tape"), B.pink], ["paper", e("📄"), B.white],
    ["clipboard", e("📋"), B.brown], ["folder", e("📁"), B.yellow],
    ["calculator", i("school-calculator"), B.gray], ["calendar", e("📅"), B.red],
    ["map", e("🗺️"), B.green], ["globe", i("school-globe"), B.blue],
  ],
  toys: [
    ["teddy bear", e("🧸"), B.brown], ["rubber duck", i("toys-rubber-duck"), B.pink],
    ["building block", i("toys-building-block"), B.red], ["puzzle", e("🧩"), B.purple],
    ["board game", i("toys-board-game"), B.green], ["card game", e("🃏"), B.red],
    ["video game", e("🎮"), B.blue], ["toy car", i("toys-toy-car"), B.orange],
    ["toy train", e("🚂"), B.gray], ["toy plane", i("toys-toy-plane"), B.cyan],
    ["action figure", e("🦸"), B.purple], ["toy drum", i("toys-toy-drum"), B.yellow],
    ["yo-yo", e("🪀"), B.green], ["spinning top", i("toys-spinning-top"), B.cyan],
    ["hula hoop", i("toys-hula-hoop"), B.pink], ["jump rope", i("toys-jump-rope"), B.orange],
    ["frisbee", e("🥏"), B.blue], ["balloon", e("🎈"), B.red],
    ["bubble wand", i("toys-bubble-wand"), B.cyan], ["rattle", i("toys-rattle"), B.yellow],
    ["pacifier", i("toys-pacifier"), B.pink], ["rocking horse", i("toys-rocking-horse"), B.brown],
    ["tricycle", i("toys-tricycle"), B.green], ["wagon", i("toys-wagon"), B.brown],
    ["slide", e("🛝"), B.blue], ["swing", i("toys-swing"), B.purple],
    ["seesaw", i("toys-seesaw"), B.yellow], ["sandbox", i("toys-sandbox"), B.orange],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
