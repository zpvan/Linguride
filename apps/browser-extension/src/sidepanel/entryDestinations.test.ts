import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readPage(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const pages = [
  {
    oldName: "资料库",
    name: "文库",
    path: "../library/library.html",
    title: "文库 - Lingride",
    heading: '<div class="sidebar-title">文库</div>',
  },
  {
    oldName: "语料库",
    name: "听写",
    path: "../corpus/corpus.html",
    title: "听写",
    heading: '<h1 class="header-title">听写</h1>',
  },
  {
    oldName: "语镜",
    name: "研习",
    path: "../tutor/tutor.html",
    title: "研习",
    heading: '<h1 class="header-title">研习</h1>',
  },
  {
    oldName: "语伴",
    name: "对谈",
    path: "../companion/companion.html",
    title: "对谈",
    heading: '<h1 class="header-title">💬 对谈</h1>',
  },
] as const;

describe("学习入口目的页面命名", () => {
  it.each(pages)("$name 页面标题与主标题一致", ({ oldName, path, title, heading }) => {
    const html = readPage(path);
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(heading);
    expect(html).not.toContain(oldName);
  });

  it("文库返回与错误提示使用新名称", () => {
    const html = readPage("../library/library.html");
    const ts = readPage("../library/library.ts");
    expect(html).toContain('<p>文库数据加载失败</p>');
    expect(html).toContain('>‹ 文库</button>');
    expect(ts).toContain("文库 index.json 结构非法（跑 doctor 检查）");
  });

  it("对谈记忆与 Echo 介绍使用自然的新名称", () => {
    const html = readPage("../companion/companion.html");
    const ts = readPage("../companion/companion.ts");
    expect(html).toContain("清除对谈记忆");
    expect(html).toContain("我是 Echo，你的英语对谈伙伴。");
    expect(ts).toContain('setStatus("对谈记忆已清除", "info")');
    expect(ts).toContain("[Lingride] 对谈读取配置失败，使用默认配置:");
  });
});
