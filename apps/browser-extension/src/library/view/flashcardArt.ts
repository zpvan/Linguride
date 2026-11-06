/**
 * @file flashcardArt.ts
 * @description 认图卡片图案渲染：Emoji 文本与八种本地 SVG 矢量形状
 */

import type { FlashcardArt, FlashcardShape } from "../model/flashcard";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function createShape(shape: FlashcardShape): SVGElement {
  switch (shape) {
    case "circle":
      return svgElement("circle", { cx: "50", cy: "50", r: "36" });
    case "square":
      return svgElement("rect", { x: "18", y: "18", width: "64", height: "64", rx: "6" });
    case "triangle":
      return svgElement("polygon", { points: "50,12 88,82 12,82" });
    case "rectangle":
      return svgElement("rect", { x: "10", y: "26", width: "80", height: "48", rx: "6" });
    case "oval":
      return svgElement("ellipse", { cx: "50", cy: "50", rx: "40", ry: "28" });
    case "star":
      return svgElement("polygon", { points: "50,8 61,36 91,36 67,54 76,84 50,66 24,84 33,54 9,36 39,36" });
    case "heart":
      return svgElement("path", { d: "M50 84C42 76 16 60 16 37C16 22 34 14 50 31C66 14 84 22 84 37C84 60 58 76 50 84Z" });
    case "diamond":
      return svgElement("polygon", { points: "50,10 86,50 50,90 14,50" });
  }
}

export function createFlashcardArt(art: FlashcardArt): HTMLElement {
  const container = document.createElement("span");
  container.className = "flashcard-art";
  container.setAttribute("aria-hidden", "true");
  if (art.kind === "emoji") {
    container.textContent = art.emoji;
    return container;
  }

  const svg = svgElement("svg", {
    viewBox: "0 0 100 100",
    role: "img",
    focusable: "false",
  });
  const shape = createShape(art.shape);
  shape.setAttribute("fill", art.color);
  svg.appendChild(shape);
  container.appendChild(svg);
  return container;
}
