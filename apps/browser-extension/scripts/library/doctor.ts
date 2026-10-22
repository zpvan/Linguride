/**
 * @file doctor.ts
 * @description 资料库体检：schema/业务规则/hash 一致性/index 一致性/孤儿与源漂移检测
 *
 * 用法：npm run library:doctor -- [--fix] [--source <story-ppt目录>]
 *
 * --fix 自动修 fixable 级问题（空白归一化、hash 重算、index 重建、孤儿 JSON 删除）。
 * 存在 error 时退出码为 1。
 */

import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LibraryIndex, Story } from "../../src/library/model/types";
import { computeContentHash, computeNormalizedHash } from "../../src/library/pipeline/storyHash";
import {
  buildLibraryIndex,
  fixStoryInPlace,
  lintStoryContent,
  validateLibraryIndex,
  validateStoryShape,
  type Issue,
} from "../../src/library/pipeline/validate";

const EXT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(EXT_ROOT, "src", "library", "data");
const STORIES_DIR = path.join(DATA_DIR, "stories");

interface DoctorOptions {
  fix: boolean;
  source?: string;
}

function parseArgs(argv: string[]): DoctorOptions {
  // 同时兼容 --source <path> 与 --source=<path>
  let source: string | undefined;
  const eq = argv.find((a) => a.startsWith("--source="));
  if (eq) source = eq.slice("--source=".length);
  const index = argv.indexOf("--source");
  if (index !== -1 && argv[index + 1]) source = argv[index + 1];
  return { fix: argv.includes("--fix"), source: source ? path.resolve(source) : undefined };
}

async function main(): Promise<void> {
  const { fix, source } = parseArgs(process.argv.slice(2));
  const issues: Issue[] = [];
  const stories = new Map<string, Story>();
  const storyFiles = new Map<string, string>(); // id → 文件名

  // 1. 加载全部 story JSON
  const files = (await readdir(STORIES_DIR)).filter((f) => f.endsWith(".json")).sort();
  for (const file of files) {
    const full = path.join(STORIES_DIR, file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(full, "utf8"));
    } catch (error) {
      issues.push({
        level: "error",
        code: "INVALID_JSON_SHAPE",
        file: `stories/${file}`,
        message: `JSON 语法损坏：${error instanceof Error ? error.message : error}`,
      });
      continue;
    }
    issues.push(...validateStoryShape(parsed, `stories/${file}`));
    const story = parsed as Story;
    if (typeof story?.id === "string") {
      stories.set(story.id, story);
      storyFiles.set(story.id, file);
    }
  }

  // 2. 内容 lint + hash 检查
  for (const [id, story] of stories) {
    const storyFile = storyFiles.get(id);
    if (!storyFile) continue;
    const file = `stories/${storyFile}`;
    issues.push(...lintStoryContent(story));
    const normalizedHash = await computeNormalizedHash(story);
    if (normalizedHash !== story.source.normalizedHash) {
      issues.push({
        level: "fixable",
        code: "STALE_HASH",
        file,
        message: "normalizedHash 过期（JSON 可能被手工修改过）",
      });
    }
  }

  // 3. index 一致性
  let index: LibraryIndex | undefined;
  try {
    index = JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8")) as LibraryIndex;
  } catch (error) {
    issues.push({
      level: "error",
      code: "INVALID_JSON_SHAPE",
      file: "index.json",
      message: `index.json 无法解析：${error instanceof Error ? error.message : error}`,
    });
  }
  if (index) {
    issues.push(...validateLibraryIndex(index, [...stories.values()]));
  }

  // 4. 源漂移与孤儿（需要 --source）
  if (source) {
    const sourceFiles = new Set(
      (await readdir(source)).filter((f) => /^episode-\d+-.+\.html$/.test(f))
    );
    for (const [id, story] of stories) {
      const storyFile = storyFiles.get(id);
      if (!storyFile) continue;
      const file = `stories/${storyFile}`;
      if (!sourceFiles.has(story.source.file)) {
        issues.push({
          level: "fixable",
          code: "ORPHAN_STORY",
          file,
          message: `源文件 ${story.source.file} 已不存在（孤儿）`,
        });
        continue;
      }
      const html = await readFile(path.join(source, story.source.file), "utf8");
      if ((await computeContentHash(html)) !== story.source.contentHash) {
        issues.push({
          level: "warning",
          code: "SOURCE_DRIFT",
          file,
          message: "源文件已更新但尚未同步（跑 library-sync-story）",
        });
      }
    }
  } else {
    console.log("（未提供 --source，跳过源漂移与孤儿检测）");
  }

  // 5. --fix
  if (fix) {
    const fixed: string[] = [];
    for (const [id, story] of stories) {
      const storyFile = storyFiles.get(id);
      if (!storyFile) continue;
      const applied = await fixStoryInPlace(story);
      if (applied.length > 0) {
        await writeFile(
          path.join(STORIES_DIR, storyFile),
          JSON.stringify(story, null, 2) + "\n",
          "utf8"
        );
        fixed.push(...applied.map((a) => `stories/${storyFile}: ${a}`));
      }
    }
    if (issues.some((i) => i.code === "INDEX_MISMATCH")) {
      await writeFile(
        path.join(DATA_DIR, "index.json"),
        JSON.stringify(buildLibraryIndex([...stories.values()]), null, 2) + "\n",
        "utf8"
      );
      fixed.push("index.json: 重建");
    }
    for (const issue of issues.filter((i) => i.code === "ORPHAN_STORY")) {
      await unlink(path.join(DATA_DIR, issue.file));
      fixed.push(`${issue.file}: 孤儿已删除`);
    }
    for (const line of fixed) console.log(`🔧 已修复 ${line}`);
    if (fixed.length > 0) console.log("\n修复完成，重跑 doctor 确认。");
  }

  // 6. 报告
  const remaining = fix ? issues.filter((i) => i.level !== "fixable") : issues;
  for (const issue of remaining) {
    const icon = issue.level === "error" ? "❌" : issue.level === "warning" ? "⚠️" : "🔧";
    console.log(`${icon} [${issue.code}] ${issue.file}: ${issue.message}`);
  }
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;
  const fixableCount = issues.filter((i) => i.level === "fixable").length;
  console.log(
    `\n体检结果：${errorCount} error / ${warningCount} warning / ${fixableCount} fixable${fix ? "" : "（--fix 可自动修）"}`
  );
  if (errorCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
