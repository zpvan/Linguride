import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("./sidepanel.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./sidepanel.css", import.meta.url), "utf8");

const entries = [
  ["libraryBtn", "文库"],
  ["corpusBtn", "听写"],
  ["tutorBtn", "研习"],
  ["companionBtn", "对谈"],
] as const;

function getButton(source: string, id: string): string {
  return (
    source.match(new RegExp(`<button id="${id}"[\\s\\S]*?<\\/button>`))?.[0] ??
    ""
  );
}

describe("侧边栏学习入口", () => {
  it("主头部为两行，四个入口保留 ID 并按固定顺序排列", () => {
    const header =
      html.match(/<header class="header main-header">([\s\S]*?)<\/header>/)?.[1] ??
      "";
    expect(header).not.toBe("");
    expect(header).toContain('class="header-topline"');
    expect(header).toContain('<nav class="header-actions" aria-label="学习空间">');

    const positions = entries.map(([id]) => header.indexOf(`id="${id}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(header.indexOf('id="levelBadge"')).toBeLessThan(positions[0]);
    expect(header.indexOf('id="settingsBtn"')).toBeLessThan(positions[0]);
    expect(header.match(/class="nav-entry"/g)).toHaveLength(4);
    expect(header.match(/class="nav-entry-icon"/g)).toHaveLength(4);
  });

  it.each(entries)("%s 使用一致的新可见名称与无障碍名称", (id, name) => {
    const button = getButton(html, id);
    expect(button).toContain(`aria-label="${name}"`);
    expect(button).toContain(`title="${name}"`);
    expect(button).toContain(`<span class="nav-entry-label">${name}</span>`);
  });

  it("使用可收缩四列、完整标签和清晰键盘焦点", () => {
    expect(css).toMatch(/\.main-header\s*\{\s*display:\s*block;\s*\}/);
    expect(css).toMatch(
      /\.header-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s
    );
    expect(css).toMatch(/\.nav-entry\s*\{[^}]*min-width:\s*0;[^}]*height:\s*58px;/s);
    expect(css).toMatch(/\.nav-entry-label\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(css).toContain(".icon-btn:focus-visible");
    expect(css).toContain(".nav-entry:focus-visible");
  });
});
