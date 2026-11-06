import { describe, expect, it } from "vitest";

import type { FlashcardCategoryId } from "../model/flashcard";
import { buildFlashcardSpeechText } from "./flashcardSpeech";

describe("buildFlashcardSpeechText", () => {
  it("动物重复三遍并使用 This is a 例句", () => {
    expect(buildFlashcardSpeechText("animals", "cat")).toBe(
      "cat, cat, cat. This is a cat."
    );
  });

  it("形状重复三遍并使用 This is a 例句", () => {
    expect(buildFlashcardSpeechText("shapes", "circle")).toBe(
      "circle, circle, circle. This is a circle."
    );
  });

  it.each([
    ["animals", "elephant", "elephant, elephant, elephant. This is an elephant."],
    ["animals", "owl", "owl, owl, owl. This is an owl."],
    ["animals", "octopus", "octopus, octopus, octopus. This is an octopus."],
    ["shapes", "oval", "oval, oval, oval. This is an oval."],
  ] as const)("元音开头单词使用 an：%s", (category, word, expected) => {
    expect(buildFlashcardSpeechText(category, word)).toBe(expected);
  });

  it("颜色使用不带冠词的例句", () => {
    expect(buildFlashcardSpeechText("colors", "red")).toBe(
      "red, red, red. This is red."
    );
  });

  it("动作使用 I can 例句", () => {
    expect(buildFlashcardSpeechText("actions", "run")).toBe(
      "run, run, run. I can run."
    );
  });

  it.each([
    ["transport", "car", "car, car, car. This is a car."],
    ["fruits", "orange", "orange, orange, orange. This is an orange."],
    ["vegetables", "onion", "onion, onion, onion. This is an onion."],
    ["clothing", "shirt", "shirt, shirt, shirt. This is a shirt."],
    ["school", "pencil", "pencil, pencil, pencil. This is a pencil."],
    ["toys", "ball", "ball, ball, ball. This is a ball."],
    ["furniture", "chair", "chair, chair, chair. This is a chair."],
    ["appliances", "television", "television, television, television. This is a television."],
    ["kitchen", "cup", "cup, cup, cup. This is a cup."],
    ["bathroom", "soap", "soap, soap, soap. This is a bar of soap."],
  ] as const)("新增名词分类：%s", (category, word, expected) => {
    expect(buildFlashcardSpeechText(category, word)).toBe(expected);
  });

  it("smoothie 使用冠词 a", () => {
    expect(buildFlashcardSpeechText("drinks", "smoothie")).toBe(
      "smoothie, smoothie, smoothie. This is a smoothie."
    );
  });

  it.each([
    ["food", "bread"],
    ["food", "rice"],
    ["drinks", "water"],
    ["drinks", "milk"],
    ["drinks", "juice"],
    ["drinks", "tea"],
    ["drinks", "coffee"],
    ["drinks", "lemonade"],
    ["drinks", "soda"],
  ] as const)("不可数名词不使用冠词：%s", (category, word) => {
    expect(buildFlashcardSpeechText(category, word)).toBe(
      `${word}, ${word}, ${word}. This is ${word}.`
    );
  });

  it.each([
    ["transport", "fire truck", "fire truck, fire truck, fire truck. This is a fire truck."],
    ["appliances", "washing machine", "washing machine, washing machine, washing machine. This is a washing machine."],
    ["actions", "wake up", "wake up, wake up, wake up. I can wake up."],
    ["colors", "sky blue", "sky blue, sky blue, sky blue. This is sky blue."],
    ["clothing", "uniform", "uniform, uniform, uniform. This is a uniform."],
    ["animals", "chicken", "chicken, chicken, chicken. This is a chicken."],
    ["animals", "fish", "fish, fish, fish. This is a fish."],
    ["bathroom", "tissue", "tissue, tissue, tissue. This is a tissue."],
  ] as const)("短语和分类特例：%s %s", (category, word, expected) => {
    expect(buildFlashcardSpeechText(category, word)).toBe(expected);
  });

  it.each([
    ["clothing", "jeans", "a pair of jeans"],
    ["clothing", "gloves", "a pair of gloves"],
    ["school", "scissors", "a pair of scissors"],
    ["kitchen", "chopsticks", "a pair of chopsticks"],
    ["kitchen", "tongs", "a pair of tongs"],
  ] as const)("成对物品使用固定短语：%s", (category, word, phrase) => {
    expect(buildFlashcardSpeechText(category, word)).toBe(
      `${word}, ${word}, ${word}. This is ${phrase}.`
    );
  });

  const uncountableCases = {
    food: ["bread", "rice", "cheese", "butter", "yogurt", "honey", "jam", "peanut butter", "cereal", "oatmeal", "toast", "bacon", "ham", "chicken", "beef", "pork", "lamb", "fish", "shrimp", "crab", "lobster", "soup"],
    drinks: ["water", "milk", "juice", "tea", "coffee", "lemonade", "soda", "mineral water", "sparkling water", "soda water", "tonic water", "coconut water", "orange juice", "apple juice", "grape juice", "iced tea", "iced coffee", "green tea", "black tea", "herbal tea", "hot chocolate", "espresso", "hot water", "cold water", "warm water"],
    vegetables: ["broccoli", "cauliflower", "lettuce", "spinach", "kale", "celery", "asparagus", "corn", "garlic", "ginger", "bok choy"],
    school: ["chalk", "paper", "glue", "tape"],
    bathroom: ["toilet paper", "toothpaste", "mouthwash", "shampoo", "conditioner", "body wash", "hand soap", "sanitizer", "lotion", "cream", "shaving cream"],
  } as const;

  it.each(
    Object.entries(uncountableCases).flatMap(([category, words]) =>
      words.map((word) => [category, word] as const)
    )
  )("不可数名词按分类处理：%s %s", (category, word) => {
    expect(buildFlashcardSpeechText(category as FlashcardCategoryId, word)).toBe(
      `${word}, ${word}, ${word}. This is ${word}.`
    );
  });
});
