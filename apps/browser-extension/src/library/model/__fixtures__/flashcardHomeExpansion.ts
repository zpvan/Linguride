/**
 * @file flashcardHomeExpansion.ts
 * @description 第四批交通、家具、家电、厨房、浴室扩充卡片的精确测试数据
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
} as const;
const e = (emoji: string): FlashcardArt => ({ kind: "emoji", emoji });

export const homeExpansion = {
  transport: [
    ["truck", e("🚚"), B.gray], ["van", e("🚐"), B.white],
    ["ambulance", e("🚑"), B.white], ["police car", e("🚓"), B.gray],
    ["fire truck", e("🚒"), B.red], ["school bus", e("🚌🎒"), B.yellow],
    ["subway", e("🚇"), B.gray], ["tram", e("🚋"), B.green],
    ["metro", e("🚇🎫"), B.cyan], ["boat", e("⛵"), B.cyan],
    ["ferry", e("⛴️"), B.gray], ["yacht", e("🛥️"), B.white],
    ["canoe", e("🛶"), B.brown], ["kayak", e("🛶↔️"), B.mint],
    ["helicopter", e("🚁"), B.gray], ["rocket", e("🚀"), B.purple],
    ["scooter", e("🛴"), B.green], ["skateboard", e("🛹"), B.orange],
    ["tractor", e("🚜"), B.green], ["bulldozer", e("🚧🟨"), B.yellow],
    ["excavator", e("⛏️🚧"), B.orange], ["crane", e("🏗️"), B.gray],
    ["camper", e("🚐🏕️"), B.green], ["sled", e("🛷"), B.cyan],
  ],
  furniture: [
    ["coffee table", e("☕🪑"), B.yellow], ["dining table", e("🍽️🪑"), B.orange],
    ["desk", e("🪑💻"), B.blue], ["bookshelf", e("📚🧱"), B.brown],
    ["bookcase", e("📚🗄️"), B.yellow], ["cabinet", e("🗄️"), B.gray],
    ["cupboard", e("🗄️🍽️"), B.orange], ["drawer", e("🗄️➡️"), B.brown],
    ["wardrobe", e("🚪👕"), B.purple], ["closet", e("🚪📦"), B.gray],
    ["armchair", e("💺"), B.purple], ["rocking chair", e("🪑↔️"), B.cyan],
    ["stool", e("🪑1️⃣"), B.orange], ["bench", e("🪑👥"), B.green],
    ["ottoman", e("🛋️🦶"), B.pink], ["nightstand", e("🛏️💡"), B.yellow],
    ["dresser", e("🗄️👕"), B.green], ["chest", e("🟫🔒"), B.orange],
    ["tv stand", e("📺🗄️"), B.gray], ["shoe rack", e("👟🗄️"), B.orange],
    ["coat rack", e("🧥🪝"), B.brown], ["hanger", e("🪝👕"), B.purple],
    ["cushion", e("🛋️🟨"), B.yellow], ["curtain", e("🪟🧵"), B.pink],
  ],
  appliances: [
    ["refrigerator", e("🧊🚪"), B.cyan], ["freezer", e("🧊❄️"), B.blue],
    ["washing machine", e("🧺⚙️"), B.blue], ["dryer", e("🧺💨"), B.gray],
    ["dishwasher", e("🍽️💦"), B.cyan], ["oven", e("🔥📦"), B.orange],
    ["microwave", e("♨️📦"), B.gray], ["stove", e("🍳🔥"), B.red],
    ["rice cooker", e("🍚⚙️"), B.white], ["pressure cooker", e("🍲💨"), B.gray],
    ["air fryer", e("🍟♨️"), B.orange], ["blender", e("🥤⚙️"), B.pink],
    ["juicer", e("🍊⚙️"), B.orange], ["mixer", e("🥣⚙️"), B.yellow],
    ["toaster", e("🍞♨️"), B.brown], ["kettle", e("🫖⚙️"), B.gray],
    ["coffee maker", e("☕⚙️"), B.brown], ["fan", e("🌀💨"), B.cyan],
    ["air conditioner", e("❄️💨"), B.blue], ["heater", e("🔥💨"), B.red],
    ["humidifier", e("💧💨"), B.purple], ["dehumidifier", e("💧🚫"), B.gray],
    ["air purifier", e("🍃💨"), B.green], ["vacuum cleaner", e("🧹⚙️"), B.gray],
    ["iron", e("👕♨️"), B.purple], ["hair dryer", e("💇💨"), B.pink],
    ["shaver", e("🪒"), B.blue], ["scale", e("⚖️"), B.gray],
  ],
  kitchen: [
    ["fork", e("🍴"), B.gray], ["knife", e("🔪"), B.gray],
    ["chopsticks", e("🥢"), B.brown], ["ladle", e("🥄🍲"), B.yellow],
    ["spatula", e("🍳🔀"), B.purple], ["whisk", e("🥣🌀"), B.cyan],
    ["tongs", e("🍗🤏"), B.gray], ["peeler", e("🥔🔪"), B.brown],
    ["grater", e("🧀🔪"), B.yellow], ["cutting board", e("🔪🟫"), B.brown],
    ["mixing bowl", e("🥣🥄"), B.green], ["saucepan", e("🍲🥄"), B.gray],
    ["frying pan", e("🍳"), B.orange], ["pot", e("🍲"), B.blue],
    ["skillet", e("🍳🥩"), B.red], ["kettle", e("🫖♨️"), B.cyan],
    ["lid", e("🍲⭕"), B.gray], ["oven mitt", e("🧤🔥"), B.red],
    ["apron", e("👕🍳"), B.blue], ["napkin", e("📄🍽️"), B.white],
    ["placemat", e("🟨🍽️"), B.yellow], ["tray", e("🍽️⬜"), B.gray],
    ["teapot", e("🫖🍵"), B.green], ["coffee pot", e("☕🫖"), B.brown],
    ["measuring cup", e("🥛📏"), B.white], ["measuring spoon", e("🥄📏"), B.blue],
    ["strainer", e("🍝🕳️"), B.yellow], ["colander", e("🥦🕳️"), B.green],
  ],
  bathroom: [
    ["bath towel", e("🛁🧺💧"), B.cyan], ["hand towel", e("🧺🙌"), B.purple],
    ["washcloth", e("🧼🧵"), B.yellow], ["bath mat", e("🛁🟦"), B.blue],
    ["shower curtain", e("🚿🧵"), B.purple], ["showerhead", e("🚿💧"), B.cyan],
    ["faucet", e("🚰"), B.gray], ["sink", e("🚰🪥"), B.white],
    ["toilet", e("🚽"), B.white], ["toilet paper", e("🧻"), B.brown],
    ["tissue", e("🤧📄"), B.pink], ["toothpaste", e("🪥🧴"), B.mint],
    ["mouthwash", e("🥤🦷"), B.cyan], ["shampoo", e("🧴🚿"), B.blue],
    ["conditioner", e("🧴💇"), B.purple], ["body wash", e("🧼🚿"), B.cyan],
    ["hand soap", e("🧼🙌"), B.yellow], ["sanitizer", e("🧴🙌"), B.mint],
    ["lotion", e("🧴🤲"), B.pink], ["cream", e("🫙🤍"), B.white],
    ["razor", e("🪒"), B.gray], ["shaving cream", e("🪒🫧"), B.cyan],
    ["comb", e("🪮"), B.purple], ["hairbrush", e("💇✨"), B.pink],
    ["hair tie", e("🎀"), B.red], ["cotton swab", e("👂☁️"), B.white],
    ["cotton ball", e("☁️⚪"), B.cyan], ["scale", e("⚖️"), B.gray],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
