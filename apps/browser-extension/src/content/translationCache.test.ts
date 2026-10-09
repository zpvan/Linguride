import { describe, expect, it } from "vitest";

import {
  clearCache,
  getCachedEnglishDefinition,
  getCacheStats,
  setCachedEnglishDefinition,
} from "./translationCache";

const SAMPLE_RESULT = {
  definition: "a toy consisting of a spool that is reeled up and down",
  examples: ["He played with a yo-yo."],
  synonyms: ["plaything"],
  usageNotes: "informal",
};

describe("英英释义缓存", () => {
  it("写入后能按相同文本与等级命中", () => {
    clearCache();
    setCachedEnglishDefinition("yo-yo", SAMPLE_RESULT, "A2");

    expect(getCachedEnglishDefinition("yo-yo", "A2")).toEqual(SAMPLE_RESULT);
  });

  it("等级不同则未命中", () => {
    clearCache();
    setCachedEnglishDefinition("yo-yo", SAMPLE_RESULT, "A2");

    expect(getCachedEnglishDefinition("yo-yo", "C1")).toBeUndefined();
  });

  it("clearCache 清空释义缓存", () => {
    clearCache();
    setCachedEnglishDefinition("yo-yo", SAMPLE_RESULT, "A2");
    clearCache();

    expect(getCachedEnglishDefinition("yo-yo", "A2")).toBeUndefined();
  });

  it("统计包含释义缓存大小", () => {
    clearCache();
    setCachedEnglishDefinition("yo-yo", SAMPLE_RESULT, "A2");

    expect(getCacheStats().englishDefinitionSize).toBe(1);
  });
});
