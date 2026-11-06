/**
 * @file flashcardSpeech.ts
 * @description 认图卡片整段朗读文本：单词三遍加分类例句，一次交给 TTS 合成
 */

import type { FlashcardCategoryId } from "../model/flashcard";

const UNCOUNTABLE_WORDS: Partial<Record<FlashcardCategoryId, ReadonlySet<string>>> = {
  food: new Set(["bread", "rice", "cheese", "butter", "yogurt", "honey", "jam", "peanut butter", "cereal", "oatmeal", "toast", "bacon", "ham", "chicken", "beef", "pork", "lamb", "fish", "shrimp", "crab", "lobster", "soup"]),
  drinks: new Set(["water", "milk", "juice", "tea", "coffee", "lemonade", "soda", "mineral water", "sparkling water", "soda water", "tonic water", "coconut water", "orange juice", "apple juice", "grape juice", "iced tea", "iced coffee", "green tea", "black tea", "herbal tea", "hot chocolate", "espresso", "hot water", "cold water", "warm water"]),
  vegetables: new Set(["broccoli", "cauliflower", "lettuce", "spinach", "kale", "celery", "asparagus", "corn", "garlic", "ginger", "bok choy"]),
  school: new Set(["chalk", "paper", "glue", "tape"]),
  bathroom: new Set(["toilet paper", "toothpaste", "mouthwash", "shampoo", "conditioner", "body wash", "hand soap", "sanitizer", "lotion", "cream", "shaving cream"]),
};

const NOUN_PHRASE_OVERRIDES: Record<string, string> = {
  soap: "a bar of soap",
  jeans: "a pair of jeans",
  gloves: "a pair of gloves",
  scissors: "a pair of scissors",
  chopsticks: "a pair of chopsticks",
  tongs: "a pair of tongs",
  uniform: "a uniform",
};

export function buildFlashcardSpeechText(
  category: FlashcardCategoryId,
  word: string
): string {
  const repeated = `${word}, ${word}, ${word}.`;
  const article = /^[aeiou]/i.test(word) ? "an" : "a";
  switch (category) {
    case "animals":
    case "shapes":
    case "transport":
    case "fruits":
    case "vegetables":
    case "food":
    case "drinks":
    case "clothing":
    case "school":
    case "toys":
    case "furniture":
    case "appliances":
    case "kitchen":
    case "bathroom":
      if (UNCOUNTABLE_WORDS[category]?.has(word)) {
        return `${repeated} This is ${word}.`;
      }
      return `${repeated} This is ${NOUN_PHRASE_OVERRIDES[word] ?? `${article} ${word}`}.`;
    case "colors":
      return `${repeated} This is ${word}.`;
    case "actions":
      return `${repeated} I can ${word}.`;
  }
}
