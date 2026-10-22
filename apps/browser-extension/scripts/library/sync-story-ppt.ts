/**
 * @file sync-story-ppt.ts
 * @description 从 story-ppt 源目录同步剧集到资料库
 *
 * 用法：npx tsx scripts/library/sync-story-ppt.ts --source <story-ppt目录>
 *
 * 行为（spec §4.1）：扫描源目录 episode-*.html → parse → normalize →
 * 全部在内存中跑 validate，零 error 才落盘 → 重算 index.json → 打印变更摘要。
 * 冲突（源与 JSON 手改双变更）不覆盖，报告后由人处理。
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { LibraryItemMeta, Story } from "../../src/library/model/types";
import { normalizeStory } from "../../src/library/pipeline/normalizeStory";
import { parseStoryPpt } from "../../src/library/pipeline/parseStoryPpt";
import { computeContentHash, computeNormalizedHash } from "../../src/library/pipeline/storyHash";
import {
  buildLibraryIndex,
  lintStoryContent,
  validateLibraryIndex,
  validateStoryShape,
  type Issue,
} from "../../src/library/pipeline/validate";

const EXT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(EXT_ROOT, "src", "library", "data");
const STORIES_DIR = path.join(DATA_DIR, "stories");

interface SyncOptions {
  source: string;
}

function parseArgs(argv: string[]): SyncOptions {
  // 同时兼容 --source <path> 与 --source=<path>（npx 会把空格形式误当 npm 配置）
  let source: string | undefined;
  const eq = argv.find((a) => a.startsWith("--source="));
  if (eq) source = eq.slice("--source=".length);
  const index = argv.indexOf("--source");
  if (index !== -1 && argv[index + 1]) source = argv[index + 1];
  if (!source) {
    console.error("用法: npx tsx scripts/library/sync-story-ppt.ts --source=<story-ppt目录>");
    process.exit(2);
  }
  return { source: path.resolve(source) };
}

async function loadExistingStories(): Promise<Map<string, Story>> {
  const map = new Map<string, Story>();
  let files: string[] = [];
  try {
    files = (await readdir(STORIES_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return map; // 目录不存在 → 首次同步
  }
  for (const file of files) {
    try {
      const story = JSON.parse(await readFile(path.join(STORIES_DIR, file), "utf8")) as Story;
      if (typeof story?.id === "string") map.set(story.id, story);
    } catch {
      console.warn(`⚠️  现有 ${file} 无法解析，将在校验阶段暴露`);
    }
  }
  return map;
}

type SyncStatus = "新增" | "更新" | "冲突" | "手改保留" | "无变化";

async function main(): Promise<void> {
  const { source } = parseArgs(process.argv.slice(2));
  const syncedAt = new Date().toISOString();

  const htmlFiles = (await readdir(source))
    .filter((f) => /^episode-\d+-.+\.html$/.test(f))
    .sort();
  if (htmlFiles.length === 0) {
    console.error(`源目录没有 episode-*.html：${source}`);
    process.exit(1);
  }

  // 1. parse + normalize（任何一集失败即整体中止）
  const normalized: { story: Story; meta: LibraryItemMeta }[] = [];
  for (const file of htmlFiles) {
    const html = await readFile(path.join(source, file), "utf8");
    const slides = parseStoryPpt(html, file);
    normalized.push(
      await normalizeStory(slides, {
        fileName: file,
        contentHash: await computeContentHash(html),
        syncedAt,
      })
    );
  }

  // 2. 与现有 JSON 对比，定状态
  const existing = await loadExistingStories();
  const status = new Map<string, SyncStatus>();
  const toWrite: Story[] = [];
  for (const { story } of normalized) {
    const old = existing.get(story.id);
    if (!old) {
      status.set(story.id, "新增");
      toWrite.push(story);
      continue;
    }
    if (old.source.contentHash === story.source.contentHash) {
      const handEdited = (await computeNormalizedHash(old)) !== old.source.normalizedHash;
      status.set(story.id, handEdited ? "手改保留" : "无变化");
      continue;
    }
    const oldFresh = (await computeNormalizedHash(old)) === old.source.normalizedHash;
    if (oldFresh) {
      status.set(story.id, "更新");
      toWrite.push(story);
    } else {
      status.set(story.id, "冲突");
    }
  }

  // 3. 落盘前全量校验（零 error 才写）
  const finalStories = new Map<string, Story>();
  for (const [id, story] of existing) finalStories.set(id, story);
  for (const story of toWrite) finalStories.set(story.id, story);

  const issues: Issue[] = [];
  for (const [id, story] of finalStories) {
    issues.push(...validateStoryShape(story, `stories/${id}.json`));
    issues.push(...lintStoryContent(story));
  }
  const nextIndex = buildLibraryIndex([...finalStories.values()]);
  issues.push(...validateLibraryIndex(nextIndex, [...finalStories.values()]));

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  for (const issue of issues) {
    const icon = issue.level === "error" ? "❌" : issue.level === "warning" ? "⚠️" : "🔧";
    console.log(`${icon} [${issue.code}] ${issue.file}: ${issue.message}`);
  }
  if (errors.length > 0) {
    console.error(`\n发现 ${errors.length} 个 error，未写入任何文件。`);
    process.exit(1);
  }

  // 4. 落盘
  await mkdir(STORIES_DIR, { recursive: true });
  for (const story of toWrite) {
    await writeFile(
      path.join(STORIES_DIR, `${story.id}.json`),
      JSON.stringify(story, null, 2) + "\n",
      "utf8"
    );
  }
  await writeFile(
    path.join(DATA_DIR, "index.json"),
    JSON.stringify(nextIndex, null, 2) + "\n",
    "utf8"
  );

  // 5. 摘要
  const count = (s: SyncStatus) => [...status.values()].filter((v) => v === s).length;
  console.log(
    `\n同步完成：新增 ${count("新增")} / 更新 ${count("更新")} / 冲突 ${count("冲突")} / 手改保留 ${count("手改保留")} / 无变化 ${count("无变化")}，共 ${finalStories.size} 集。`
  );
  if (warnings.length > 0) console.log(`（另有 ${warnings.length} 条 warning，可用 doctor 查看）`);
  const conflicts = [...status.entries()].filter(([, v]) => v === "冲突");
  for (const [id] of conflicts) {
    console.log(
      `冲突：${id}（源与 JSON 手改双变更。保留手改 → 跑 doctor --fix；以源为准 → 删除 src/library/data/stories/${id}.json 后重跑 sync）`
    );
  }
  const orphans = [...existing.keys()].filter((id) => !status.has(id));
  for (const id of orphans) {
    console.log(`孤儿：${id}（源文件已不存在，doctor --fix 可清理）`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
