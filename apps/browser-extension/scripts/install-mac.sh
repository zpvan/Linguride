#!/bin/bash

# ============================================================
# Lingride Chrome 扩展 macOS 安装脚本
# ============================================================
#
# 功能：
# 1. 构建扩展（生成 dist 目录）
# 2. 打开 Chrome 扩展管理页面
# 3. 显示安装指引
#
# 使用方式：
#   npm run install:mac
#   或
#   bash scripts/install-mac.sh
#
# 作者：Lingride Team
# 版本：1.0.0
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到项目目录
cd "$PROJECT_DIR"

echo ""
echo "============================================================"
echo "  🌐 Lingride Chrome 扩展安装程序"
echo "============================================================"
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    print_warning "未检测到 node_modules，正在安装依赖..."
    
    # 尝试使用 bun，如果失败则用 npm
    if command -v bun &> /dev/null; then
        bun install
    else
        npm install
    fi
    
    print_success "依赖安装完成"
fi

# 构建扩展
print_info "正在构建扩展..."

# 尝试使用 bun，如果失败则用 npm
if command -v bun &> /dev/null; then
    bun run build
else
    npm run build
fi

# 检查构建结果
if [ ! -d "dist" ]; then
    print_error "构建失败：未找到 dist 目录"
    exit 1
fi

print_success "构建完成！输出目录：$PROJECT_DIR/dist"

echo ""
echo "============================================================"
echo "  📦 扩展已构建，请按以下步骤安装："
echo "============================================================"
echo ""
echo "  1. Chrome 扩展管理页面即将打开"
echo "  2. 开启右上角的「开发者模式」"
echo "  3. 点击「加载已解压的扩展程序」"
echo "  4. 选择以下目录："
echo ""
echo "     ${GREEN}$PROJECT_DIR/dist${NC}"
echo ""
echo "============================================================"
echo ""

# 打开 Chrome 扩展管理页面
print_info "正在打开 Chrome 扩展管理页面..."

# 使用 AppleScript 打开 Chrome 扩展页面
osascript <<EOF
tell application "Google Chrome"
    activate
    open location "chrome://extensions/"
end tell
EOF

print_success "Chrome 扩展页面已打开"
echo ""

# 复制路径到剪贴板（可选）
echo "$PROJECT_DIR/dist" | pbcopy
print_info "dist 目录路径已复制到剪贴板，可直接粘贴"

echo ""
print_success "安装脚本执行完成！"
echo ""
