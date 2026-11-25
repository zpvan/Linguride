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
    ["monorail", i("transport-monorail"), B.cyan], ["boat", e("⛵"), B.cyan],
    ["ferry", e("⛴️"), B.gray], ["yacht", e("🛥️"), B.white],
    ["canoe", e("🛶"), B.brown], ["kayak", i("transport-kayak"), B.mint],
    ["helicopter", e("🚁"), B.gray], ["rocket", e("🚀"), B.purple],
    ["scooter", e("🛴"), B.green], ["skateboard", e("🛹"), B.orange],
    ["tractor", e("🚜"), B.green], ["bulldozer", i("transport-bulldozer"), B.yellow],
    ["excavator", i("transport-excavator"), B.orange], ["crane", e("🏗️"), B.gray],
    ["camper", i("transport-camper"), B.green], ["sled", e("🛷"), B.cyan],
  ],
  furniture: [
    ["rug", i("furniture-rug"), B.yellow], ["wall clock", i("furniture-wall-clock"), B.orange],
    ["desk", i("furniture-desk"), B.blue], ["bookshelf", i("furniture-bookshelf"), B.brown],
    ["picture frame", i("furniture-picture-frame"), B.yellow], ["filing cabinet", e("🗄️"), B.gray],
    ["cupboard", i("furniture-cupboard"), B.orange], ["drawer", i("furniture-drawer"), B.brown],
    ["wardrobe", i("furniture-wardrobe"), B.purple], ["vase", i("furniture-vase"), B.gray],
    ["armchair", i("furniture-armchair"), B.purple], ["rocking chair", i("furniture-rocking-chair"), B.cyan],
    ["stool", i("furniture-stool"), B.orange], ["bench", i("furniture-bench"), B.green],
    ["ottoman", i("furniture-ottoman"), B.pink], ["nightstand", i("furniture-nightstand"), B.yellow],
    ["dresser", i("furniture-dresser"), B.green], ["chest", i("furniture-chest"), B.orange],
    ["tv stand", i("furniture-tv-stand"), B.gray], ["shoe rack", i("furniture-shoe-rack"), B.orange],
    ["coat rack", i("furniture-coat-rack"), B.brown], ["hanger", i("furniture-hanger"), B.purple],
    ["cushion", i("furniture-cushion"), B.yellow], ["curtain", i("furniture-curtain"), B.pink],
  ],
  appliances: [
    ["refrigerator", i("appliances-refrigerator"), B.cyan], ["freezer", i("appliances-freezer"), B.blue],
    ["washing machine", i("appliances-washing-machine"), B.blue], ["clothes dryer", i("appliances-clothes-dryer"), B.gray],
    ["dishwasher", i("appliances-dishwasher"), B.cyan], ["oven", i("appliances-oven"), B.orange],
    ["microwave", i("appliances-microwave"), B.gray], ["stove", i("appliances-stove"), B.red],
    ["rice cooker", i("appliances-rice-cooker"), B.white], ["pressure cooker", i("appliances-pressure-cooker"), B.gray],
    ["air fryer", i("appliances-air-fryer"), B.orange], ["blender", i("appliances-blender"), B.pink],
    ["juicer", i("appliances-juicer"), B.orange], ["mixer", i("appliances-mixer"), B.yellow],
    ["toaster", i("appliances-toaster"), B.brown], ["electric kettle", i("appliances-electric-kettle"), B.gray],
    ["coffee maker", i("appliances-coffee-maker"), B.brown], ["fan", i("appliances-fan"), B.cyan],
    ["air conditioner", i("appliances-air-conditioner"), B.blue], ["heater", i("appliances-heater"), B.red],
    ["humidifier", i("appliances-humidifier"), B.purple], ["water dispenser", i("appliances-water-dispenser"), B.gray],
    ["air purifier", i("appliances-air-purifier"), B.green], ["vacuum cleaner", i("appliances-vacuum-cleaner"), B.gray],
    ["iron", i("appliances-iron"), B.purple], ["hair dryer", i("appliances-hair-dryer"), B.pink],
    ["electric shaver", i("appliances-electric-shaver"), B.blue], ["sewing machine", i("appliances-sewing-machine"), B.gray],
  ],
  kitchen: [
    ["fork", e("🍴"), B.gray], ["knife", e("🔪"), B.gray],
    ["chopsticks", e("🥢"), B.brown], ["ladle", i("kitchen-ladle"), B.yellow],
    ["spatula", i("kitchen-spatula"), B.purple], ["whisk", i("kitchen-whisk"), B.cyan],
    ["tongs", i("kitchen-tongs"), B.gray], ["peeler", i("kitchen-peeler"), B.brown],
    ["grater", i("kitchen-grater"), B.yellow], ["cutting board", i("kitchen-cutting-board"), B.brown],
    ["rolling pin", i("kitchen-rolling-pin"), B.green], ["dish rack", i("kitchen-dish-rack"), B.gray],
    ["frying pan", e("🍳"), B.orange], ["pot", e("🍲"), B.blue],
    ["can opener", i("kitchen-can-opener"), B.red], ["kettle", i("kitchen-kettle"), B.cyan],
    ["lid", i("kitchen-lid"), B.gray], ["oven mitt", i("kitchen-oven-mitt"), B.red],
    ["apron", i("kitchen-apron"), B.blue], ["napkin", i("kitchen-napkin"), B.white],
    ["placemat", i("kitchen-placemat"), B.yellow], ["tray", i("kitchen-tray"), B.gray],
    ["teapot", i("kitchen-teapot"), B.green], ["kitchen timer", i("kitchen-kitchen-timer"), B.brown],
    ["measuring cup", i("kitchen-measuring-cup"), B.white], ["measuring spoon", i("kitchen-measuring-spoon"), B.blue],
    ["sponge", i("kitchen-sponge"), B.yellow], ["colander", i("kitchen-colander"), B.green],
  ],
  bathroom: [
    ["bath towel", i("bathroom-bath-towel"), B.cyan], ["plunger", i("bathroom-plunger"), B.purple],
    ["washcloth", i("bathroom-washcloth"), B.yellow], ["bath mat", i("bathroom-bath-mat"), B.blue],
    ["shower curtain", i("bathroom-shower-curtain"), B.purple], ["showerhead", i("bathroom-showerhead"), B.cyan],
    ["faucet", e("🚰"), B.gray], ["sink", i("bathroom-sink"), B.white],
    ["toilet", e("🚽"), B.white], ["toilet paper", e("🧻"), B.brown],
    ["tissue", i("bathroom-tissue"), B.pink], ["toothpaste", i("bathroom-toothpaste"), B.mint],
    ["mouthwash", i("bathroom-mouthwash"), B.cyan], ["shampoo", i("bathroom-shampoo"), B.blue],
    ["conditioner", i("bathroom-conditioner"), B.purple], ["body wash", i("bathroom-body-wash"), B.cyan],
    ["hand soap", i("bathroom-hand-soap"), B.yellow], ["sanitizer", i("bathroom-sanitizer"), B.mint],
    ["lotion", i("bathroom-lotion"), B.pink], ["cream", i("bathroom-cream"), B.white],
    ["razor", e("🪒"), B.gray], ["shaving cream", i("bathroom-shaving-cream"), B.cyan],
    ["comb", i("bathroom-comb"), B.purple], ["hairbrush", i("bathroom-hairbrush"), B.pink],
    ["hair tie", e("🎀"), B.red], ["cotton swab", i("bathroom-cotton-swab"), B.white],
    ["cotton ball", i("bathroom-cotton-ball"), B.cyan], ["scale", i("bathroom-scale"), B.gray],
  ],
} satisfies Record<string, readonly ExpansionEntry[]>;
