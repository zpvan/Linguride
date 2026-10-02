/**
 * @file theme.ts
 * @description 「语伴」主题三态（跟随系统/浅色/深色）逻辑
 *
 * - auto：不设置 data-theme，由 CSS 的 prefers-color-scheme 媒体查询决定
 * - light/dark：在 <html> 上设置 data-theme，CSS 变量按手动值生效
 * - 选择经 localStorage 持久化（key: companion-theme）
 *
 * 纯逻辑无 DOM 依赖（root/storage 均可注入），供单测与页面共用。
 *
 * @author Lingride Team
 * @since 1.1.0
 */

export type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "companion-theme";
const VALID_MODES: readonly ThemeMode[] = ["auto", "light", "dark"];

/** 模式图标（header 按钮显示当前模式） */
export const THEME_MODE_ICONS: Record<ThemeMode, string> = {
  auto: "🖥️",
  light: "☀️",
  dark: "🌙",
};

/** 模式中文文案（按钮 title 提示） */
export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  auto: "跟随系统",
  light: "浅色",
  dark: "深色",
};

/** 读取持久化的主题模式（默认/坏值回退 auto） */
export function loadThemeMode(storage?: Storage): ThemeMode {
  const store = storage ?? localStorage;
  const raw = store.getItem(STORAGE_KEY);
  return VALID_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : "auto";
}

/** 持久化主题模式 */
export function saveThemeMode(mode: ThemeMode, storage?: Storage): void {
  (storage ?? localStorage).setItem(STORAGE_KEY, mode);
}

/** 三态循环：auto → light → dark → auto */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  return current === "auto" ? "light" : current === "light" ? "dark" : "auto";
}

interface ThemeRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** 应用主题到根元素（auto 移除 data-theme，由媒体查询接管） */
export function applyTheme(mode: ThemeMode, root?: ThemeRoot): void {
  const el = root ?? document.documentElement;
  if (mode === "auto") {
    el.removeAttribute("data-theme");
  } else {
    el.setAttribute("data-theme", mode);
  }
}
