import { describe, expect, it } from "vitest";

import { MemoryFact } from "../types/companion";
import {
  MAX_MEMORY_FACTS,
  applyMemoryUpdate,
  clearCompanionMemory,
  loadMemoryFacts,
  saveMemoryFacts,
} from "./companionMemory";
import { extractJsonText } from "./aiJsonExtract";

/** 内存版 chrome.storage.StorageArea，避免依赖 chrome 全局 */
function createFakeStorageArea(): chrome.storage.StorageArea {
  const data = new Map<string, unknown>();
  return {
    get: async (key?: string | string[] | null) => {
      if (typeof key === "string") {
        return data.has(key) ? { [key]: data.get(key) } : {};
      }
      return Object.fromEntries(data);
    },
    set: async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k);
    },
    clear: async () => data.clear(),
  } as unknown as chrome.storage.StorageArea;
}

function fact(text: string, lastSeenAt: number): MemoryFact {
  return { text, createdAt: lastSeenAt, lastSeenAt };
}

describe("extractJsonText", () => {
  it("无代码围栏时原样返回", () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });
  it("剥离 ```json 围栏与首尾空白", () => {
    expect(extractJsonText('前缀文字\n```json\n{"a":1}\n```\n后缀')).toBe(
      '{"a":1}'
    );
  });
});

describe("applyMemoryUpdate", () => {
  it("add 新增事实（带时间戳），重复添加（大小写/空白归一化）只刷新 lastSeenAt", () => {
    const now = 1000;
    const result = applyMemoryUpdate(
      [fact("User likes coffee", 100)],
      { add: ["User likes tea", "  user LIKES coffee  "] },
      now
    );
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.text)).toContain("User likes tea");
    // 重复项未新增，lastSeenAt 被刷新
    const coffee = result.find((f) => f.text === "User likes coffee");
    expect(coffee).toBeDefined();
    expect(coffee?.lastSeenAt).toBe(now);
    expect(coffee?.createdAt).toBe(100);
  });

  it("remove 按归一化文本删除旧事实", () => {
    const result = applyMemoryUpdate(
      [fact("User likes coffee", 1), fact("User has a cat", 2)],
      { remove: ["user likes coffee"] },
      1000
    );
    expect(result).toEqual([fact("User has a cat", 2)]);
  });

  it("超出 MAX_MEMORY_FACTS 时按 lastSeenAt 淘汰最旧", () => {
    const old = Array.from({ length: MAX_MEMORY_FACTS }, (_, i) =>
      fact(`old-${i}`, i + 1)
    );
    const result = applyMemoryUpdate(old, { add: ["brand new"] }, 9999);
    expect(result).toHaveLength(MAX_MEMORY_FACTS);
    expect(result.map((f) => f.text)).toContain("brand new");
    expect(result.map((f) => f.text)).not.toContain("old-0");
  });

  it("add/remove 缺省或含空白项时健壮处理", () => {
    const result = applyMemoryUpdate([fact("a", 1)], { add: ["", "  "] }, 10);
    expect(result).toEqual([fact("a", 1)]);
    expect(applyMemoryUpdate([fact("a", 1)], {}, 10)).toEqual([fact("a", 1)]);
  });
});

describe("记忆存储读写", () => {
  it("load/save/clear 全链路（含坏数据回退为空数组）", async () => {
    const area = createFakeStorageArea();
    expect(await loadMemoryFacts(area)).toEqual([]);

    await saveMemoryFacts([fact("f1", 1)], area);
    expect(await loadMemoryFacts(area)).toEqual([fact("f1", 1)]);

    // 写入坏数据后读取应回退空数组而不是抛错
    await area.set({ companion_memory: "not-an-array" });
    expect(await loadMemoryFacts(area)).toEqual([]);

    await clearCompanionMemory(area);
    expect(await loadMemoryFacts(area)).toEqual([]);
  });
});
