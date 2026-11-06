import { describe, expect, it } from "vitest";

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
    ["bathroom", "soap", "soap, soap, soap. This is a soap."],
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
});
