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

export const foodExpansion = {
  fruits: [
    ["lemon", e("🍋"), B.yellow], ["lime", e("🍋🟢"), B.green],
    ["coconut", e("🥥"), B.brown], ["pineapple", e("🍍"), B.yellow],
    ["mango", e("🥭"), B.orange], ["papaya", e("🟠⚫"), B.pink],
    ["melon", e("🍈"), B.green], ["cantaloupe", e("🍈🟠"), B.orange],
    ["cherry", e("🍒"), B.red], ["plum", e("🟣🍑"), B.purple],
    ["apricot", e("🟠🍑"), B.orange], ["kiwi", e("🥝"), B.green],
    ["fig", e("🟤🍐"), B.brown], ["date", e("🌴🟤"), B.yellow],
    ["pomegranate", e("🔴🍎"), B.red], ["raspberry", e("🔴🔴🌿"), B.purple],
    ["blackberry", e("🫐⚫"), B.gray], ["blueberry", e("🫐"), B.blue],
    ["cranberry", e("🫐🔴"), B.red], ["gooseberry", e("🫐🟢"), B.green],
    ["passion fruit", e("🟣🟡"), B.purple], ["dragon fruit", e("🐉🍓"), B.purple],
    ["guava", e("🍐🟢"), B.mint], ["lychee", e("🍒⚪"), B.white],
  ],
  vegetables: [
    ["broccoli", e("🥦"), B.green], ["cauliflower", e("🥦⚪"), B.white],
    ["cabbage", e("🥬"), B.green], ["lettuce", e("🥬🥗"), B.mint],
    ["spinach", e("🍃🥗"), B.green], ["kale", e("🍃🟢"), B.lime],
    ["celery", e("🌿🟢"), B.green], ["asparagus", e("🌱🟢"), B.mint],
    ["zucchini", e("🥒🟢"), B.lime], ["eggplant", e("🍆"), B.purple],
    ["radish", e("🔴🌱"), B.red], ["turnip", e("🟣🌱"), B.purple],
    ["beet", e("🟣🥔"), B.pink], ["pea", e("🫛"), B.green],
    ["bean", e("🫘"), B.brown], ["chickpea", e("🫘🟡"), B.yellow],
    ["lentil", e("🫘🟤"), B.orange], ["corn", e("🌽"), B.yellow],
    ["garlic", e("🧄"), B.white], ["ginger", e("🫚"), B.orange],
    ["chili", e("🌶️"), B.red], ["bell pepper", e("🫑🟢"), B.lime],
    ["artichoke", e("🌿🟣"), B.purple], ["bok choy", e("🥬🤍"), B.white],
  ],
  food: [
    ["cheese", e("🧀"), B.yellow], ["butter", e("🧈"), B.yellow],
    ["yogurt", e("🥣🥛"), B.white], ["honey", e("🍯"), B.orange],
    ["jam", e("🍓🫙"), B.pink], ["peanut butter", e("🥜🧈"), B.brown],
    ["cereal", e("🥣🌽"), B.yellow], ["oatmeal", e("🥣🌾"), B.brown],
    ["pancake", e("🥞"), B.orange], ["waffle", e("🧇"), B.yellow],
    ["toast", e("🍞🔥"), B.orange], ["bacon", e("🥓"), B.pink],
    ["sausage", e("🌭"), B.brown], ["ham", e("🍖"), B.red],
    ["chicken", e("🍗"), B.orange], ["beef", e("🥩"), B.red],
    ["pork", e("🥩🐷"), B.pink], ["lamb", e("🥩🐑"), B.brown],
    ["fish", e("🐟🍽️"), B.blue], ["shrimp", e("🦐"), B.orange],
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
