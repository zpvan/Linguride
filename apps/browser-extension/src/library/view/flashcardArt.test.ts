/**
 * @file flashcardArt.test.ts
 * @description 认图卡片矢量图案的轮廓与可辨识性测试
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { createFlashcardArt } from "./flashcardArt";

class FakeElement {
  readonly children: FakeElement[] = [];
  private readonly attributes = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
}

describe("createFlashcardArt", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("为浅色矢量样本提供可见轮廓", () => {
    vi.stubGlobal("document", {
      createElement: () => new FakeElement(),
      createElementNS: () => new FakeElement(),
    });
    const art = createFlashcardArt({ kind: "vector", shape: "circle", color: "#f5f5dc" });
    const circle = art.children[0].children[0];
    expect(circle.getAttribute("stroke")).toBe("rgba(0, 0, 0, 0.22)");
    expect(circle.getAttribute("stroke-width")).toBe("1.5");
  });
});
