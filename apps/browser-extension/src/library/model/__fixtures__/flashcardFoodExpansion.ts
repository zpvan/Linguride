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
    ["chili", e("🌶️"), B.red], ["okra", i("vegetables-okra"), B.lime],
    ["artichoke", i("vegetables-artichoke"), B.purple], ["bok choy", i("vegetables-bok-choy"), B.white],
  ],
  food: [
    ["cheese", e("🧀"), B.yellow], ["butter", e("🧈"), B.yellow],
    ["yogurt", i("food-yogurt"), B.white], ["honey", e("🍯"), B.orange],
    ["jam", i("food-jam"), B.pink], ["peanut butter", i("food-peanut-butter"), B.brown],
    ["cereal", i("food-cereal"), B.yellow], ["oatmeal", i("food-oatmeal"), B.brown],
    ["pancake", e("🥞"), B.orange], ["waffle", e("🧇"), B.yellow],
    ["toast", i("food-toast"), B.orange], ["bacon", e("🥓"), B.pink],
    ["sausage", i("food-sausage"), B.brown], ["ham", i("food-ham"), B.red],
    ["chicken", i("food-chicken"), B.orange], ["beef", e("🥩"), B.red],
    ["pork", i("food-pork"), B.pink], ["lamb", i("food-lamb"), B.brown],
    ["fish", i("food-fish"), B.blue], ["shrimp", e("🦐"), B.orange],
    ["crab", e("🦀"), B.red], ["lobster", e("🦞"), B.pink],
    ["soup", e("🍲"), B.yellow], ["dumpling", e("🥟"), B.white],
  ],
  drinks: [
    ["mineral water", i("drinks-mineral-water"), B.blue], ["sparkling water", i("drinks-sparkling-water"), B.purple],
    ["milkshake", i("drinks-milkshake"), B.gray], ["sports drink", i("drinks-sports-drink"), B.yellow],
    ["coconut water", i("drinks-coconut-water"), B.white], ["orange juice", i("drinks-orange-juice"), B.orange],
    ["apple juice", i("drinks-apple-juice"), B.red], ["grape juice", i("drinks-grape-juice"), B.purple],
    ["iced tea", i("drinks-iced-tea"), B.amber], ["iced coffee", i("drinks-iced-coffee"), B.gray],
    ["milk tea", i("drinks-milk-tea"), B.brown], ["bubble tea", e("🧋"), B.pink],
    ["green tea", i("drinks-green-tea"), B.green], ["black tea", i("drinks-black-tea"), B.gray],
    ["herbal tea", i("drinks-herbal-tea"), B.mint], ["hot chocolate", i("drinks-hot-chocolate"), B.brown],
    ["cappuccino", i("drinks-cappuccino"), B.orange], ["latte", i("drinks-latte"), B.white],
    ["espresso", i("drinks-espresso"), B.darkRoast], ["energy drink", i("drinks-energy-drink"), B.blue],
    ["hot cider", i("drinks-hot-cider"), B.purple], ["soy milk", i("drinks-soy-milk"), B.orange],
    ["tomato juice", i("drinks-tomato-juice"), B.ice], ["pear juice", i("drinks-pear-juice"), B.yellow],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
