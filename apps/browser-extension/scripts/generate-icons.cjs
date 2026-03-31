#!/usr/bin/env node

/**
 * @file generate-icons.js
 * @description 从 SVG 生成 PNG 图标
 * 
 * 使用方法：
 *   node scripts/generate-icons.js
 * 
 * 要求：
 *   npm install sharp
 * 
 * 如果没有 sharp，请手动将 public/icons/icon.svg 导出为：
 *   - public/icons/icon16.png  (16x16)
 *   - public/icons/icon48.png  (48x48)
 *   - public/icons/icon128.png (128x128)
 */

const fs = require('fs');
const path = require('path');

const ICON_SIZES = [16, 48, 128];
const SVG_PATH = path.join(__dirname, '../public/icons/icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

async function generateIcons() {
  try {
    // 尝试加载 sharp
    const sharp = require('sharp');
    
    console.log('正在生成 PNG 图标...');
    
    for (const size of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);
      
      await sharp(SVG_PATH)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ 已生成 icon${size}.png`);
    }
    
    console.log('\\n所有图标生成完成！');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('未安装 sharp 库，无法自动生成 PNG 图标。');
      console.log('\\n请手动执行以下步骤：');
      console.log('');
      console.log('方式 1: 安装 sharp 后重试');
      console.log('  npm install sharp');
      console.log('  node scripts/generate-icons.js');
      console.log('');
      console.log('方式 2: 使用在线工具转换');
      console.log('  1. 打开 https://svgtopng.com/');
      console.log('  2. 上传 public/icons/icon.svg');
      console.log('  3. 分别生成 16x16, 48x48, 128x128 尺寸');
      console.log('  4. 保存为 icon16.png, icon48.png, icon128.png');
      console.log('  5. 放入 public/icons/ 目录');
      console.log('');
      console.log('方式 3: 使用 macOS Preview');
      console.log('  1. 用 Preview 打开 icon.svg');
      console.log('  2. File > Export，选择 PNG 格式');
      console.log('  3. 调整尺寸并保存');
      
      // 创建占位 PNG 文件（使用最简单的 1x1 透明 PNG）
      console.log('\\n正在创建占位 PNG 文件...');
      
      // 最小的有效 PNG 文件（8x8 透明）
      const minimalPng = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG 签名
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR 块
        0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08, // 8x8
        0x08, 0x06, 0x00, 0x00, 0x00, 0xC4, 0x0F, 0xBE, 0x8B,
        0x00, 0x00, 0x00, 0x1A, 0x49, 0x44, 0x41, 0x54, // IDAT 块
        0x78, 0x9C, 0x62, 0x60, 0x60, 0x60, 0x60, 0x60,
        0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
        0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x49,
        0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND 块
        0xAE, 0x42, 0x60, 0x82
      ]);
      
      for (const size of ICON_SIZES) {
        const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);
        if (!fs.existsSync(outputPath)) {
          fs.writeFileSync(outputPath, minimalPng);
          console.log(`📝 已创建占位文件 icon${size}.png`);
        }
      }
      
      console.log('\\n⚠️  占位文件仅用于构建，请在发布前替换为正确的图标！');
    } else {
      throw err;
    }
  }
}

generateIcons().catch(console.error);
