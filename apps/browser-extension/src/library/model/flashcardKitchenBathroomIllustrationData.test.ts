/**
 * @file flashcardKitchenBathroomIllustrationData.test.ts
 * @description 厨房、浴室SVG资源检查与全部377张定制插画完成度验证
 */

import { describe, expect, it } from "vitest";

import actions from "../data/flashcards/actions.json";
import animals from "../data/flashcards/animals.json";
import appliances from "../data/flashcards/appliances.json";
import bathroom from "../data/flashcards/bathroom.json";
import bicycleParts from "../data/flashcards/bicycle-parts.json";
import clothing from "../data/flashcards/clothing.json";
import colors from "../data/flashcards/colors.json";
import drinks from "../data/flashcards/drinks.json";
import food from "../data/flashcards/food.json";
import fruits from "../data/flashcards/fruits.json";
import furniture from "../data/flashcards/furniture.json";
import kitchen from "../data/flashcards/kitchen.json";
import marineAnimals from "../data/flashcards/marine-animals.json";
import school from "../data/flashcards/school.json";
import shapes from "../data/flashcards/shapes.json";
import sports from "../data/flashcards/sports.json";
import toys from "../data/flashcards/toys.json";
import transport from "../data/flashcards/transport.json";
import vegetables from "../data/flashcards/vegetables.json";
import weather from "../data/flashcards/weather.json";
import { getFlashcardIllustration } from "../assets/flashcardArt";

const TARGET_IDS = new Set([
  "kitchen-ladle", "kitchen-spatula", "kitchen-whisk", "kitchen-tongs", "kitchen-peeler", "kitchen-grater",
  "kitchen-cutting-board", "kitchen-rolling-pin", "kitchen-dish-rack", "kitchen-can-opener", "kitchen-kettle",
  "kitchen-lid", "kitchen-oven-mitt", "kitchen-apron", "kitchen-napkin", "kitchen-placemat", "kitchen-tray",
  "kitchen-teapot", "kitchen-kitchen-timer", "kitchen-measuring-cup", "kitchen-measuring-spoon", "kitchen-sponge", "kitchen-colander",
  "bathroom-bathtub", "bathroom-mirror", "bathroom-bath-towel", "bathroom-plunger", "bathroom-washcloth", "bathroom-bath-mat",
  "bathroom-shower-curtain", "bathroom-showerhead", "bathroom-sink", "bathroom-tissue", "bathroom-toothpaste",
  "bathroom-mouthwash", "bathroom-shampoo", "bathroom-conditioner", "bathroom-body-wash", "bathroom-hand-soap",
  "bathroom-sanitizer", "bathroom-lotion", "bathroom-cream", "bathroom-shaving-cream", "bathroom-comb", "bathroom-hairbrush",
  "bathroom-cotton-swab", "bathroom-cotton-ball", "bathroom-scale",
]);
const decks = { kitchen, bathroom };
const EXPECTED_ILLUSTRATION_IDS = new Set([
  ...TARGET_IDS,
  "shapes-octagon", "shapes-cube", "shapes-sphere", "shapes-cone", "shapes-cylinder", "shapes-pyramid", "shapes-prism",
  "shapes-right-triangle", "shapes-zigzag",
  "actions-eat", "actions-drink", "actions-read", "actions-sit",
  "actions-wake-up", "actions-get-up", "actions-go", "actions-come",
  "actions-listen", "actions-watch", "actions-ask", "actions-answer",
  "actions-open", "actions-close",
  "transport-school-bus", "transport-monorail", "transport-kayak",
  "transport-bulldozer", "transport-excavator", "transport-camper",
  "fruits-lime", "fruits-papaya", "fruits-cantaloupe", "fruits-plum",
  "fruits-apricot", "fruits-fig", "fruits-date", "fruits-pomegranate",
  "fruits-raspberry", "fruits-blackberry", "fruits-cranberry", "fruits-gooseberry",
  "fruits-passion-fruit", "fruits-dragon-fruit", "fruits-guava", "fruits-lychee",
  "vegetables-cauliflower", "vegetables-lettuce", "vegetables-spinach", "vegetables-kale",
  "vegetables-celery", "vegetables-asparagus", "vegetables-zucchini", "vegetables-radish",
  "vegetables-turnip", "vegetables-beet", "vegetables-chickpea", "vegetables-lentil",
  "vegetables-okra", "vegetables-artichoke", "vegetables-bok-choy",
  "food-yogurt", "food-jam", "food-peanut-butter", "food-cereal", "food-oatmeal",
  "food-toast", "food-sausage", "food-ham", "food-chicken", "food-pork", "food-lamb", "food-fish",
  "drinks-smoothie", "drinks-soda", "drinks-mineral-water", "drinks-sparkling-water",
  "drinks-milkshake", "drinks-sports-drink", "drinks-coconut-water", "drinks-orange-juice",
  "drinks-apple-juice", "drinks-grape-juice", "drinks-iced-tea", "drinks-iced-coffee",
  "drinks-milk-tea", "drinks-green-tea", "drinks-black-tea", "drinks-herbal-tea",
  "drinks-hot-chocolate", "drinks-cappuccino", "drinks-latte", "drinks-espresso",
  "drinks-energy-drink", "drinks-hot-cider", "drinks-soy-milk", "drinks-tomato-juice", "drinks-pear-juice",
  "clothing-shirt", "clothing-t-shirt", "clothing-skirt", "clothing-sweater", "clothing-cardigan", "clothing-hoodie",
  "clothing-jacket", "clothing-blazer", "clothing-raincoat", "clothing-pajamas", "clothing-mitten",
  "clothing-slipper", "clothing-beanie", "clothing-belt",
  "school-marker", "school-highlighter", "school-chalk", "school-eraser", "school-sharpener",
  "school-pencil-case", "school-pencil-box", "school-textbook", "school-stapler", "school-dictionary", "school-storybook",
  "school-comic-book", "school-library-card", "school-lunchbox", "school-water-bottle", "school-glue", "school-tape", "school-calculator", "school-globe",
  "toys-rubber-duck", "toys-building-block", "toys-board-game", "toys-toy-car", "toys-toy-plane", "toys-toy-drum", "toys-spinning-top",
  "toys-hula-hoop", "toys-jump-rope", "toys-bubble-wand", "toys-rattle", "toys-pacifier",
  "toys-rocking-horse", "toys-tricycle", "toys-wagon", "toys-swing", "toys-seesaw", "toys-sandbox",
  "furniture-table", "furniture-lamp", "furniture-rug", "furniture-wall-clock", "furniture-desk", "furniture-bookshelf",
  "furniture-picture-frame", "furniture-cupboard", "furniture-drawer", "furniture-wardrobe", "furniture-vase", "furniture-armchair",
  "furniture-rocking-chair", "furniture-stool", "furniture-bench", "furniture-ottoman", "furniture-nightstand",
  "furniture-dresser", "furniture-chest", "furniture-tv-stand", "furniture-shoe-rack", "furniture-coat-rack",
  "furniture-hanger", "furniture-cushion", "furniture-curtain",
  "appliances-refrigerator", "appliances-freezer", "appliances-washing-machine", "appliances-clothes-dryer",
  "appliances-dishwasher", "appliances-oven", "appliances-microwave", "appliances-stove", "appliances-rice-cooker",
  "appliances-pressure-cooker", "appliances-air-fryer", "appliances-blender", "appliances-juicer", "appliances-mixer",
  "appliances-toaster", "appliances-electric-kettle", "appliances-coffee-maker", "appliances-fan", "appliances-air-conditioner",
  "appliances-heater", "appliances-humidifier", "appliances-water-dispenser", "appliances-air-purifier",
  "appliances-vacuum-cleaner", "appliances-iron", "appliances-hair-dryer", "appliances-electric-shaver", "appliances-sewing-machine",
  "sports-soccer", "sports-basketball", "sports-volleyball", "sports-tennis", "sports-table-tennis", "sports-badminton",
  "sports-baseball", "sports-rugby", "sports-golf", "sports-handball", "sports-field-hockey", "sports-ice-hockey",
  "sports-water-polo", "sports-swimming", "sports-diving", "sports-rowing", "sports-sailing", "sports-surfing",
  "sports-gymnastics", "sports-marathon", "sports-cycling", "sports-equestrian", "sports-fencing", "sports-boxing",
  "sports-judo", "sports-taekwondo", "sports-archery", "sports-shooting", "sports-weightlifting", "sports-skiing",
  "sports-snowboarding", "sports-curling",
  "bicycle-parts-frame", "bicycle-parts-fork", "bicycle-parts-handlebar", "bicycle-parts-grip", "bicycle-parts-saddle", "bicycle-parts-seatpost",
  "bicycle-parts-wheel", "bicycle-parts-tire", "bicycle-parts-inner-tube", "bicycle-parts-rim", "bicycle-parts-spoke", "bicycle-parts-hub",
  "bicycle-parts-chain", "bicycle-parts-chainring", "bicycle-parts-crank-arm", "bicycle-parts-pedal", "bicycle-parts-cassette", "bicycle-parts-derailleur",
  "bicycle-parts-gear-shifter", "bicycle-parts-brake-lever", "bicycle-parts-brake-caliper", "bicycle-parts-brake-pad", "bicycle-parts-brake-cable", "bicycle-parts-headset",
  "bicycle-parts-stem", "bicycle-parts-kickstand", "bicycle-parts-mudguard", "bicycle-parts-chain-guard", "bicycle-parts-bell", "bicycle-parts-water-bottle-cage",
  "bicycle-parts-front-light", "bicycle-parts-reflector",
  "weather-sunny", "weather-partly-cloudy", "weather-cloudy", "weather-rainy", "weather-drizzle", "weather-thunderstorm",
  "weather-lightning", "weather-snowy", "weather-blizzard", "weather-sleet", "weather-hail", "weather-foggy",
  "weather-windy", "weather-stormy", "weather-tornado", "weather-hurricane", "weather-rainbow", "weather-frost",
  "weather-ice", "weather-dew", "weather-hot", "weather-cold", "weather-warm", "weather-cool",
  "weather-humid", "weather-dry", "weather-drought", "weather-flood", "weather-heat-wave", "weather-monsoon",
  "weather-tropical-climate", "weather-polar-climate",
  "marine-animals-shark", "marine-animals-hammerhead-shark", "marine-animals-ray", "marine-animals-jellyfish",
  "marine-animals-starfish", "marine-animals-seahorse", "marine-animals-sea-turtle", "marine-animals-seal",
  "marine-animals-sea-lion", "marine-animals-walrus", "marine-animals-sea-otter", "marine-animals-manatee",
  "marine-animals-beluga", "marine-animals-narwhal", "marine-animals-orca", "marine-animals-squid",
  "marine-animals-cuttlefish", "marine-animals-nautilus", "marine-animals-sea-urchin", "marine-animals-sea-anemone",
  "marine-animals-coral", "marine-animals-clownfish", "marine-animals-angelfish", "marine-animals-pufferfish",
  "marine-animals-swordfish", "marine-animals-eel", "marine-animals-flying-fish", "marine-animals-sea-snake",
  "marine-animals-horseshoe-crab", "marine-animals-krill", "marine-animals-sea-cucumber", "marine-animals-hermit-crab",
]);

function expectSafeSvg(svg: string, cardId: string): void {
  expect(svg).toContain('viewBox="0 0 100 100"');
  expect(svg).not.toMatch(/<(?:script|text|image|foreignObject)\b/i);
  expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
  expect(svg).not.toMatch(/(?:href|src)\s*=/i);
  expect(svg).not.toMatch(/@import|url\(\s*['"]?(?:https?:|\/\/|data:|file:)/i);
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id.startsWith(`${cardId}-`)).toBe(true);
  for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) {
    expect(match[1].startsWith(`${cardId}-`)).toBe(true);
    expect(ids).toContain(match[1]);
  }
  for (const match of svg.matchAll(/<(?:path|g|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/g)) {
    const tag = match[0];
    if (/\bstroke\s*=/.test(tag)) expect(/\bfill\s*=/.test(tag), `${cardId} 描边元素缺少 fill`).toBe(true);
  }
}

describe("厨房与浴室定制 SVG", () => {
  it("只将48个目标词条连接到同名安全资源", () => {
    let count = 0;
    for (const deck of Object.values(decks)) {
      for (const card of deck.cards) {
        if (!TARGET_IDS.has(card.id)) {
          expect(card.art.kind).not.toBe("illustration");
          continue;
        }
        count += 1;
        expect(card.art).toEqual({ kind: "illustration", illustration: card.id });
        const svg = getFlashcardIllustration(card.id);
        expect(svg, `${card.id} 缺少 SVG`).toBeDefined();
        if (!svg) throw new Error(`${card.id} 缺少 SVG`);
        expectSafeSvg(svg, card.id);
      }
    }
    expect(count).toBe(48);
  });

  it("同分类没有完全相同的 SVG", () => {
    for (const deck of Object.values(decks)) {
      const svgs = deck.cards.filter((card) => TARGET_IDS.has(card.id)).map((card) => getFlashcardIllustration(card.id));
      expect(new Set(svgs).size).toBe(svgs.length);
    }
  });

  it("浴室不再并排使用难以仅凭图案区分的近义词", () => {
    const words = new Set(bathroom.cards.map((card) => card.word));
    for (const removed of ["towel", "hand towel", "shower"]) expect(words.has(removed)).toBe(false);
    for (const added of ["bathtub", "mirror", "plunger", "bath towel", "washcloth", "showerhead"]) {
      expect(words.has(added)).toBe(true);
    }
  });

  it("厨房不再并排使用同义锅具或形近工具", () => {
    const words = new Set(kitchen.cards.map((card) => card.word));
    for (const removed of ["mixing bowl", "saucepan", "skillet", "coffee pot", "strainer"]) {
      expect(words.has(removed)).toBe(false);
    }
    for (const added of ["rolling pin", "dish rack", "can opener", "kitchen timer", "sponge"]) {
      expect(words.has(added)).toBe(true);
    }
    for (const retained of ["bowl", "pot", "frying pan", "kettle", "teapot", "colander"]) {
      expect(words.has(retained)).toBe(true);
    }
  });

  it("全部377张组合Emoji已替换且20类仍为640张", () => {
    const allDecks = { animals, shapes, colors, actions, transport, fruits, vegetables, food, drinks, clothing, school, toys, furniture, appliances, kitchen, bathroom, sports, "bicycle-parts": bicycleParts, weather, "marine-animals": marineAnimals };
    const cards = Object.values(allDecks).flatMap((deck) => deck.cards);
    expect(cards).toHaveLength(640);
    expect(Object.values(allDecks).every((deck) => deck.cards.length === 32)).toBe(true);
    expect(cards.filter((card) => card.art.kind === "illustration").map((card) => card.id).sort())
      .toEqual([...EXPECTED_ILLUSTRATION_IDS].sort());
    expect(EXPECTED_ILLUSTRATION_IDS.size).toBe(377);
  });
});
