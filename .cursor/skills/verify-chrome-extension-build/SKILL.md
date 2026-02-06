---
name: verify-chrome-extension-build
description: 验证 chrome-extension 的编译构建结果。在完成 chrome-extension 功能开发或 plan-and-build 后自动使用。执行 TypeScript 编译检查、Vite 构建、dist 产物校验、manifest 完整性检查，并报告构建状态。触发词：构建验证、build verify、编译检查。
---

# Chrome Extension 构建验证

在 chrome-extension 完成功能开发后，执行全自动构建验证流程。

## 验证流程

复制此清单跟踪进度：

```
构建验证进度：
- [ ] Step 1: 环境检查
- [ ] Step 2: TypeScript 编译检查
- [ ] Step 3: Vite 构建
- [ ] Step 4: dist 产物校验
- [ ] Step 5: Manifest 完整性检查
- [ ] Step 6: 输出验证报告
```

---

### Step 1: 环境检查

在 `chrome-extension/` 目录下执行：

```bash
# 确认 node_modules 存在
ls node_modules/.package-lock.json 2>/dev/null && echo "OK: deps installed" || echo "WARN: run npm install first"
```

如果依赖未安装，先执行 `npm install`。

---

### Step 2: TypeScript 编译检查

```bash
cd chrome-extension && npx tsc --noEmit 2>&1
```

**判定规则**：
- 退出码 0 → 通过
- 有错误 → 记录所有 TS 错误，**停止后续步骤**，先修复编译错误

**常见错误处理**：
- `TS2304 Cannot find name` → 检查类型导入
- `TS2345 Argument type mismatch` → 检查函数签名
- `TS6133 declared but never read` → 移除未使用变量或加 `_` 前缀

---

### Step 3: Vite 构建

```bash
cd chrome-extension && npx vite build 2>&1
```

**判定规则**：
- 退出码 0 且输出 `✓ built in` → 通过
- 构建失败 → 记录错误信息，分析原因

**关注输出中的**：
- 打包体积是否异常（单文件 > 1MB 需关注）
- 是否有 warning（特别是 circular dependency）

---

### Step 4: dist 产物校验

构建完成后，验证 `dist/` 目录结构：

```bash
cd chrome-extension

# 检查 dist 目录是否存在
[ -d "dist" ] && echo "OK: dist exists" || echo "FAIL: dist missing"

# 检查关键文件
echo "=== 关键文件检查 ==="
for f in manifest.json; do
  [ -f "dist/$f" ] && echo "OK: $f" || echo "FAIL: $f missing"
done

# 列出 dist 完整结构
echo "=== dist 目录结构 ==="
find dist -type f | head -50 | sort
```

**必须存在的文件**：
| 文件 | 说明 |
|------|------|
| `dist/manifest.json` | 扩展清单（由插件从 src/manifest.json 生成） |
| Service Worker JS | background 脚本（编译自 service-worker.ts） |
| Content Script JS | 内容脚本（编译自 content/index.ts） |
| Content CSS | 内容样式（来自 content/styles.css） |
| Popup HTML | 弹出页面（来自 popup/popup.html） |
| Icon 文件 | 16/48/128 px 图标 |

注意：`vite-plugin-web-extension` 会改变输出文件名和路径结构，不要硬编码精确文件名，而是验证 manifest.json 中引用的文件都实际存在。

---

### Step 5: Manifest 完整性检查

读取 `dist/manifest.json` 并验证：

```bash
cd chrome-extension

# 读取并格式化 manifest
cat dist/manifest.json | python3 -m json.tool 2>/dev/null || cat dist/manifest.json
```

**校验清单**：
1. `manifest_version` 必须为 `3`
2. `background.service_worker` 指向的文件在 dist 中存在
3. `content_scripts[0].js` 指向的文件在 dist 中存在
4. `content_scripts[0].css` 指向的文件在 dist 中存在（如有）
5. `action.default_popup` 指向的文件在 dist 中存在
6. `icons` 中引用的图标文件都存在
7. `permissions` 和 `host_permissions` 符合预期

**用脚本一次性验证引用完整性**：

```bash
cd chrome-extension/dist

# 提取 manifest 中引用的所有文件路径并逐一检查
python3 -c "
import json, os, sys
m = json.load(open('manifest.json'))
files = []
# icons
for v in m.get('icons', {}).values(): files.append(v)
# action icons
for v in m.get('action', {}).get('default_icon', {}).values(): files.append(v)
# popup
p = m.get('action', {}).get('default_popup', '')
if p: files.append(p)
# background
sw = m.get('background', {}).get('service_worker', '')
if sw: files.append(sw)
# content scripts
for cs in m.get('content_scripts', []):
    files.extend(cs.get('js', []))
    files.extend(cs.get('css', []))
ok = fail = 0
for f in files:
    if os.path.isfile(f):
        print(f'  OK: {f}')
        ok += 1
    else:
        print(f'  FAIL: {f}')
        fail += 1
print(f'\nResult: {ok} found, {fail} missing')
sys.exit(1 if fail else 0)
"
```

---

### Step 6: 输出验证报告

汇总所有步骤结果，输出结构化报告：

```markdown
## Chrome Extension 构建验证报告

| 步骤 | 状态 | 备注 |
|------|------|------|
| 环境检查 | PASS/FAIL | |
| TypeScript 编译 | PASS/FAIL | N errors |
| Vite 构建 | PASS/FAIL | 体积: XXkB |
| dist 产物校验 | PASS/FAIL | N files |
| Manifest 完整性 | PASS/FAIL | N refs checked |

**总体结果**: PASS / FAIL

### 后续操作建议
- 如果全部 PASS：可在 Chrome 中加载测试
  1. 打开 chrome://extensions/
  2. 开启「开发者模式」
  3. 点击「加载已解压的扩展程序」
  4. 选择 `chrome-extension/dist` 目录
- 如果有 FAIL：根据上方具体错误修复后重新验证
```

---

## 快速执行（一键构建+验证）

如果只需快速验证，在 `chrome-extension/` 目录下执行：

```bash
npm run build 2>&1
```

构建成功后再执行 Step 4 和 Step 5 的产物校验即可。
