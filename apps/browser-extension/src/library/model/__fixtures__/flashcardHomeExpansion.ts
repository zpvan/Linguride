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
const i = (cardId: string): FlashcardArt => ({ kind: "illustration", illustration: cardId });

export const homeExpansion = {
  transport: [
    ["truck", e("🚚"), B.gray], ["van", e("🚐"), B.white],
    ["ambulance", e("🚑"), B.white], ["police car", e("🚓"), B.gray],
    ["fire truck", e("🚒"), B.red], ["school bus", i("transport-school-bus"), B.yellow],
    ["subway", e("🚇"), B.gray], ["tram", e("🚋"), B.green],
    ["metro", i("transport-metro"), B.cyan], ["boat", e("⛵"), B.cyan],
    ["ferry", e("⛴️"), B.gray], ["yacht", e("🛥️"), B.white],
    ["canoe", e("🛶"), B.brown], ["kayak", i("transport-kayak"), B.mint],
    ["helicopter", e("🚁"), B.gray], ["rocket", e("🚀"), B.purple],
    ["scooter", e("🛴"), B.green], ["skateboard", e("🛹"), B.orange],
    ["tractor", e("🚜"), B.green], ["bulldozer", i("transport-bulldozer"), B.yellow],
    ["excavator", i("transport-excavator"), B.orange], ["crane", e("🏗️"), B.gray],
    ["camper", i("transport-camper"), B.green], ["sled", e("🛷"), B.cyan],
  ],
  furniture: [
    ["coffee table", i("furniture-coffee-table"), B.yellow], ["dining table", i("furniture-dining-table"), B.orange],
    ["desk", i("furniture-desk"), B.blue], ["bookshelf", i("furniture-bookshelf"), B.brown],
    ["bookcase", i("furniture-bookcase"), B.yellow], ["cabinet", e("🗄️"), B.gray],
    ["cupboard", i("furniture-cupboard"), B.orange], ["drawer", i("furniture-drawer"), B.brown],
    ["wardrobe", i("furniture-wardrobe"), B.purple], ["closet", i("furniture-closet"), B.gray],
    ["armchair", e("💺"), B.purple], ["rocking chair", i("furniture-rocking-chair"), B.cyan],
    ["stool", i("furniture-stool"), B.orange], ["bench", i("furniture-bench"), B.green],
    ["ottoman", i("furniture-ottoman"), B.pink], ["nightstand", i("furniture-nightstand"), B.yellow],
    ["dresser", i("furniture-dresser"), B.green], ["chest", i("furniture-chest"), B.orange],
    ["tv stand", i("furniture-tv-stand"), B.gray], ["shoe rack", i("furniture-shoe-rack"), B.orange],
    ["coat rack", i("furniture-coat-rack"), B.brown], ["hanger", i("furniture-hanger"), B.purple],
    ["cushion", i("furniture-cushion"), B.yellow], ["curtain", i("furniture-curtain"), B.pink],
  ],
  appliances: [
    ["refrigerator", i("appliances-refrigerator"), B.cyan], ["freezer", i("appliances-freezer"), B.blue],
    ["washing machine", i("appliances-washing-machine"), B.blue], ["dryer", i("appliances-dryer"), B.gray],
    ["dishwasher", i("appliances-dishwasher"), B.cyan], ["oven", i("appliances-oven"), B.orange],
    ["microwave", i("appliances-microwave"), B.gray], ["stove", i("appliances-stove"), B.red],
    ["rice cooker", i("appliances-rice-cooker"), B.white], ["pressure cooker", i("appliances-pressure-cooker"), B.gray],
    ["air fryer", i("appliances-air-fryer"), B.orange], ["blender", i("appliances-blender"), B.pink],
    ["juicer", i("appliances-juicer"), B.orange], ["mixer", i("appliances-mixer"), B.yellow],
    ["toaster", i("appliances-toaster"), B.brown], ["kettle", i("appliances-kettle"), B.gray],
    ["coffee maker", i("appliances-coffee-maker"), B.brown], ["fan", i("appliances-fan"), B.cyan],
    ["air conditioner", i("appliances-air-conditioner"), B.blue], ["heater", i("appliances-heater"), B.red],
    ["humidifier", i("appliances-humidifier"), B.purple], ["dehumidifier", i("appliances-dehumidifier"), B.gray],
    ["air purifier", i("appliances-air-purifier"), B.green], ["vacuum cleaner", i("appliances-vacuum-cleaner"), B.gray],
    ["iron", i("appliances-iron"), B.purple], ["hair dryer", i("appliances-hair-dryer"), B.pink],
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
