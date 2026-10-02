import { describe, expect, it } from "vitest";

import {
  applyTheme,
  loadThemeMode,
  nextThemeMode,
  saveThemeMode,
  THEME_MODE_ICONS,
  THEME_MODE_LABELS,
  ThemeMode,
} from "./theme";

function createFakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k) ?? null : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe("nextThemeMode", () => {
  it("auto → light → dark → auto 循环", () => {
    expect(nextThemeMode("auto")).toBe("light");
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("auto");
  });
});

describe("loadThemeMode / saveThemeMode", () => {
  it("无存储值时默认 auto；坏值回退 auto", () => {
    const storage = createFakeStorage();
    expect(loadThemeMode(storage)).toBe("auto");
    storage.setItem("companion-theme", "garbage");
    expect(loadThemeMode(storage)).toBe("auto");
  });

  it("三种合法值可正确往返读写", () => {
    const storage = createFakeStorage();
    for (const mode of ["auto", "light", "dark"] as ThemeMode[]) {
      saveThemeMode(mode, storage);
      expect(loadThemeMode(storage)).toBe(mode);
    }
  });
});

describe("applyTheme", () => {
  function createFakeRoot(): {
    attrs: Map<string, string>;
    setAttribute: (k: string, v: string) => void;
    removeAttribute: (k: string) => void;
  } {
    const attrs = new Map<string, string>();
    return {
      attrs,
      setAttribute: (k, v) => void attrs.set(k, v),
      removeAttribute: (k) => void attrs.delete(k),
    };
  }

  it("light/dark 设置 data-theme；auto 移除", () => {
    const root = createFakeRoot();
    applyTheme("dark", root);
    expect(root.attrs.get("data-theme")).toBe("dark");
    applyTheme("light", root);
    expect(root.attrs.get("data-theme")).toBe("light");
    applyTheme("auto", root);
    expect(root.attrs.has("data-theme")).toBe(false);
  });
});

describe("图标与文案", () => {
  it("三种模式都有图标与中文文案", () => {
    expect(THEME_MODE_ICONS.auto).toBeTruthy();
    expect(THEME_MODE_ICONS.light).toBeTruthy();
    expect(THEME_MODE_ICONS.dark).toBeTruthy();
    expect(THEME_MODE_LABELS.auto).toContain("系统");
    expect(THEME_MODE_LABELS.light).toContain("浅");
    expect(THEME_MODE_LABELS.dark).toContain("深");
  });
});
