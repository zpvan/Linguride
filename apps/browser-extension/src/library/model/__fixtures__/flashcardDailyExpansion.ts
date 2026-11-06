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

export const dailyExpansion = {
  clothing: [
    ["t-shirt", e("👕🧒"), B.blue], ["jeans", e("👖"), B.blue],
    ["skirt", e("🔻🧵"), B.pink], ["blouse", e("👚"), B.lavender],
    ["sweater", e("🧶👕"), B.orange], ["cardigan", e("🧶🧥"), B.brown],
    ["hoodie", e("🧥🧢"), B.gray], ["jacket", e("🧥✨"), B.cyan],
    ["blazer", e("🧥👔"), B.lavender], ["suit", e("🤵"), B.gray],
    ["uniform", e("🧑‍✈️"), B.blue], ["raincoat", e("🧥🌧️"), B.blue],
    ["overcoat", e("🧥❄️"), B.white], ["vest", e("🦺"), B.orange],
    ["scarf", e("🧣"), B.red], ["gloves", e("🧤"), B.blue],
    ["mitten", e("🧤☝️"), B.pink], ["sock", e("🧦"), B.white],
    ["boot", e("🥾"), B.gray], ["sneaker", e("👟"), B.green],
    ["shoe", e("👞"), B.brown], ["sandal", e("🩴"), B.orange],
    ["slipper", e("🛏️👣"), B.pink], ["cap", e("🧢"), B.blue],
    ["beanie", e("🧶🧢"), B.lavender], ["helmet", e("⛑️"), B.red],
    ["belt", e("👖🔗"), B.brown], ["tie", e("👔"), B.purple],
  ],
  school: [
    ["crayon", e("🖍️"), B.orange], ["marker", e("🖊️⬛"), B.gray],
    ["highlighter", e("🖊️🟨"), B.lime], ["chalk", e("⬛✍️"), B.green],
    ["eraser", e("✏️❌"), B.pink], ["sharpener", e("✏️⚙️"), B.gray],
    ["pencil case", e("✏️👝"), B.purple], ["pencil box", e("✏️📦"), B.brown],
    ["notebook", e("📓"), B.blue], ["textbook", e("📚"), B.green],
    ["workbook", e("📔✍️"), B.orange], ["dictionary", e("📖🔤"), B.cyan],
    ["storybook", e("📖✨"), B.purple], ["comic book", e("📖💥"), B.red],
    ["library card", e("💳📚"), B.green], ["backpack", e("🎒"), B.red],
    ["lunchbox", e("🍱"), B.orange], ["water bottle", e("🎒💧"), B.cyan],
    ["scissors", e("✂️"), B.gray], ["glue", e("🧴"), B.white],
    ["tape", e("📦➰"), B.pink], ["paper", e("📄"), B.white],
    ["clipboard", e("📋"), B.brown], ["folder", e("📁"), B.yellow],
    ["calculator", e("🔢➕"), B.gray], ["calendar", e("📅"), B.red],
    ["map", e("🗺️"), B.green], ["globe", e("🌍"), B.blue],
  ],
  toys: [
    ["teddy bear", e("🧸"), B.brown], ["stuffed animal", e("🧸🐰"), B.pink],
    ["building block", e("🧱"), B.red], ["puzzle", e("🧩"), B.purple],
    ["board game", e("🎲"), B.green], ["card game", e("🃏"), B.red],
    ["video game", e("🎮"), B.blue], ["toy car", e("🚗🧸"), B.orange],
    ["toy train", e("🚂"), B.gray], ["toy plane", e("✈️🧸"), B.cyan],
    ["action figure", e("🦸"), B.purple], ["building set", e("🏗️🧱"), B.yellow],
    ["yo-yo", e("🪀"), B.green], ["spinning top", e("🌀🧸"), B.cyan],
    ["hula hoop", e("⭕💃"), B.pink], ["jump rope", e("🤸➰"), B.orange],
    ["frisbee", e("🥏"), B.blue], ["balloon", e("🎈"), B.red],
    ["bubble wand", e("🫧🪄"), B.cyan], ["rattle", e("👶🔔"), B.yellow],
    ["pacifier", e("👶😌"), B.pink], ["rocking horse", e("🐴🪑"), B.brown],
    ["tricycle", e("🚲3️⃣"), B.green], ["wagon", e("🧸🛞"), B.brown],
    ["slide", e("🛝"), B.blue], ["swing", e("🧒🪢"), B.purple],
    ["seesaw", e("🧒↕️🧒"), B.yellow], ["sandbox", e("🏖️🪣"), B.orange],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
