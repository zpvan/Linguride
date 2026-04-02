/**
 * @file vite.config.ts
 * @description Vite 构建配置
 *
 * 使用 vite-plugin-web-extension 插件实现 Chrome 扩展的现代化开发体验，
 * 支持热更新、TypeScript 编译等功能。
 */

import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    webExtension({
      manifest: "src/manifest.json",
      // 使用 Manifest V3
      browser: "chrome",
      // Avoid flaky network-bound schema fetches during CI builds.
      skipManifestValidation: true,
      // 额外的 HTML 入口点
      additionalInputs: [
        "src/permissions/permissions.html",
        "src/tutor/tutor.html",
        "src/corpus/corpus.html",
      ],
    }),
  ],
  build: {
    outDir: "dist",
    // 确保代码可读，便于调试
    minify: false,
  },
});
