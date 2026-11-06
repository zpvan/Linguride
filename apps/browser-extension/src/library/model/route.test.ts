import { describe, expect, it } from "vitest";

import { parseLibraryRoute } from "./route";

describe("parseLibraryRoute", () => {
  it.each(["", "#/", "#/unknown"])("故事首页：%s", (hash) => {
    expect(parseLibraryRoute(hash)).toEqual({ kind: "storyHome" });
  });

  it("解析故事 ID", () => {
    expect(parseLibraryRoute("#/story/ep01-good-morning")).toEqual({
      kind: "storyPlayer",
      storyId: "ep01-good-morning",
    });
    expect(parseLibraryRoute("#/story/hello%20world")).toEqual({
      kind: "storyPlayer",
      storyId: "hello world",
    });
  });

  it("解析认图卡片首页", () => {
    expect(parseLibraryRoute("#/cards")).toEqual({ kind: "cardsHome" });
  });

  it.each(["animals", "shapes", "colors", "actions"] as const)("解析分类：%s", (category) => {
    expect(parseLibraryRoute(`#/cards/${category}`)).toEqual({
      kind: "cardsCategory",
      category,
    });
  });

  it.each(["#/cards/unknown", "#/cards/%ZZ", "#/cards/animals/extra"])(
    "非法卡片路由回退分类首页：%s",
    (hash) => {
      expect(parseLibraryRoute(hash)).toEqual({ kind: "cardsHome" });
    }
  );

  it("非法故事编码回退故事首页", () => {
    expect(parseLibraryRoute("#/story/%ZZ")).toEqual({ kind: "storyHome" });
  });
});
