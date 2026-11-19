/**
 * @file flashcardFoodExpansion.ts
 * @description 第二批水果、蔬菜、食物、饮品扩充卡片的精确测试数据
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
  lime: ["#f7fee7", "#d9f99d"], darkRoast: ["#f3eadf", "#c9b29a"],
  ice: ["#eff6ff", "#bfdbfe"], amber: ["#fff7ed", "#fed7aa"],
} as const;
const e = (emoji: string): FlashcardArt => ({ kind: "emoji", emoji });
const i = (cardId: string): FlashcardArt => ({ kind: "illustration", illustration: cardId });

export const foodExpansion = {
  fruits: [
    ["lemon", e("🍋"), B.yellow], ["lime", i("fruits-lime"), B.green],
    ["coconut", e("🥥"), B.brown], ["pineapple", e("🍍"), B.yellow],
    ["mango", e("🥭"), B.orange], ["papaya", i("fruits-papaya"), B.pink],
    ["melon", e("🍈"), B.green], ["cantaloupe", i("fruits-cantaloupe"), B.orange],
    ["cherry", e("🍒"), B.red], ["plum", i("fruits-plum"), B.purple],
    ["apricot", i("fruits-apricot"), B.orange], ["kiwi", e("🥝"), B.green],
    ["fig", i("fruits-fig"), B.brown], ["date", i("fruits-date"), B.yellow],
    ["pomegranate", i("fruits-pomegranate"), B.red], ["raspberry", i("fruits-raspberry"), B.purple],
    ["blackberry", i("fruits-blackberry"), B.gray], ["blueberry", e("🫐"), B.blue],
    ["cranberry", i("fruits-cranberry"), B.red], ["gooseberry", i("fruits-gooseberry"), B.green],
    ["passion fruit", i("fruits-passion-fruit"), B.purple], ["dragon fruit", i("fruits-dragon-fruit"), B.purple],
    ["guava", i("fruits-guava"), B.mint], ["lychee", i("fruits-lychee"), B.white],
  ],
  vegetables: [
    ["broccoli", e("🥦"), B.green], ["cauliflower", i("vegetables-cauliflower"), B.white],
    ["cabbage", e("🥬"), B.green], ["lettuce", i("vegetables-lettuce"), B.mint],
    ["spinach", i("vegetables-spinach"), B.green], ["kale", i("vegetables-kale"), B.lime],
    ["celery", i("vegetables-celery"), B.green], ["asparagus", i("vegetables-asparagus"), B.mint],
    ["zucchini", i("vegetables-zucchini"), B.lime], ["eggplant", e("🍆"), B.purple],
    ["radish", i("vegetables-radish"), B.red], ["turnip", i("vegetables-turnip"), B.purple],
    ["beet", i("vegetables-beet"), B.pink], ["pea", e("🫛"), B.green],
    ["bean", e("🫘"), B.brown], ["chickpea", i("vegetables-chickpea"), B.yellow],
    ["lentil", i("vegetables-lentil"), B.orange], ["corn", e("🌽"), B.yellow],
    ["garlic", e("🧄"), B.white], ["ginger", e("🫚"), B.orange],
    ["chili", e("🌶️"), B.red], ["bell pepper", i("vegetables-bell-pepper"), B.lime],
    ["artichoke", i("vegetables-artichoke"), B.purple], ["bok choy", i("vegetables-bok-choy"), B.white],
  ],
  food: [
    ["cheese", e("🧀"), B.yellow], ["butter", e("🧈"), B.yellow],
    ["yogurt", i("food-yogurt"), B.white], ["honey", e("🍯"), B.orange],
    ["jam", i("food-jam"), B.pink], ["peanut butter", i("food-peanut-butter"), B.brown],
    ["cereal", i("food-cereal"), B.yellow], ["oatmeal", i("food-oatmeal"), B.brown],
    ["pancake", e("🥞"), B.orange], ["waffle", e("🧇"), B.yellow],
    ["toast", i("food-toast"), B.orange], ["bacon", e("🥓"), B.pink],
    ["sausage", e("🌭"), B.brown], ["ham", e("🍖"), B.red],
    ["chicken", e("🍗"), B.orange], ["beef", e("🥩"), B.red],
    ["pork", i("food-pork"), B.pink], ["lamb", i("food-lamb"), B.brown],
    ["fish", i("food-fish"), B.blue], ["shrimp", e("🦐"), B.orange],
    ["crab", e("🦀"), B.red], ["lobster", e("🦞"), B.pink],
    ["soup", e("🍲"), B.yellow], ["dumpling", e("🥟"), B.white],
  ],
  drinks: [
    ["mineral water", e("💧⛰️"), B.blue], ["sparkling water", e("💧✨"), B.purple],
    ["soda water", e("🥤✨"), B.gray], ["tonic water", e("🥤🍋"), B.yellow],
    ["coconut water", e("🥥💧"), B.white], ["orange juice", e("🍊🧃"), B.orange],
    ["apple juice", e("🍎🧃"), B.red], ["grape juice", e("🍇🧃"), B.purple],
    ["iced tea", e("🍵🧊"), B.amber], ["iced coffee", e("☕🧊"), B.gray],
    ["milk tea", e("🥛🍵"), B.brown], ["bubble tea", e("🧋"), B.pink],
    ["green tea", e("🍵🟢"), B.green], ["black tea", e("🍵⚫"), B.gray],
    ["herbal tea", e("🍵🌿"), B.mint], ["hot chocolate", e("🍫🥛"), B.brown],
    ["cappuccino", e("☕🤎"), B.orange], ["latte", e("☕🥛"), B.white],
    ["espresso", e("☕⚫"), B.darkRoast], ["americano", e("☕💧"), B.blue],
    ["mocha", e("☕🍫"), B.purple], ["hot water", e("💧🔥"), B.orange],
    ["cold water", e("💧🧊"), B.ice], ["warm water", e("💧♨️"), B.yellow],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
