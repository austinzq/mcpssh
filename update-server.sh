#!/bin/bash

# MCP SSH Server 一键更新脚本
# 使用方法：curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/update-server.sh | bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
APP_USER="mcpssh"
APP_DIR="/var/lib/mcpssh/app"

# 函数
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 检查是否以root运行
if [[ $EUID -ne 0 ]]; then
   print_error "此脚本必须以root权限运行 (使用 sudo)"
fi

echo "=================================="
echo "MCP SSH Server 一键更新脚本"
echo "=================================="
echo ""

# 检查应用目录是否存在
if [ ! -d "$APP_DIR" ]; then
    print_error "应用目录不存在: $APP_DIR"
fi

# 停止服务
print_status "停止MCP SSH服务..."
systemctl stop mcp-ssh

# 切换到应用目录
cd $APP_DIR

# 检查git状态
print_status "检查git状态..."
if [ ! -d ".git" ]; then
    print_error "这不是一个git仓库"
fi

# 保存本地更改
print_status "保存本地更改..."
sudo -u $APP_USER git stash >/dev/null 2>&1 || true

# 拉取最新代码
print_status "拉取最新代码..."
if [ -n "$GITHUB_TOKEN" ]; then
    sudo -u $APP_USER git pull https://$GITHUB_TOKEN@github.com/austinzq/mcpssh.git main >/dev/null 2>&1
else
    sudo -u $APP_USER git pull >/dev/null 2>&1
fi

# 安装依赖
print_status "安装依赖..."
sudo -u $APP_USER npm install >/dev/null 2>&1

# 构建项目
print_status "构建项目..."
sudo -u $APP_USER npm run build >/dev/null 2>&1

# 启动服务
print_status "启动MCP SSH服务..."
systemctl start mcp-ssh

# 等待服务启动
sleep 3

# 检查服务状态
if systemctl is-active --quiet mcp-ssh; then
    print_status "MCP SSH服务运行正常"
else
    print_error "服务启动失败。查看日志: journalctl -u mcp-ssh"
fi

# 获取服务器IP
SERVER_IP=$(ip route get 1 | awk '{print $7;exit}')

# 测试健康端点
print_status "测试健康端点..."
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    print_status "健康检查通过"
else
    print_warning "健康检查失败，但服务可能仍在启动中"
fi

# 获取认证token
if [ -f ".env" ]; then
    AUTH_TOKEN=$(grep "MCP_AUTH_TOKEN" .env | cut -d'=' -f2)
    
    # 测试MCP端点
    print_status "测试MCP端点..."
    if curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
           -X POST \
           -H "Content-Type: application/json" \
           -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
           http://localhost:3000/mcp >/dev/null 2>&1; then
        print_status "MCP端点测试通过"
    else
        print_warning "MCP端点测试失败"
    fi
fi

echo ""
echo "=================================="
echo -e "${GREEN}更新完成！${NC}"
echo "=================================="
echo ""
echo "服务信息："
echo "  - 服务器IP: $SERVER_IP"
echo "  - 健康检查: http://$SERVER_IP:3000/health"
echo "  - 服务状态: $(systemctl is-active mcp-ssh)"
echo ""
echo "有用的命令："
echo "  - 查看日志: journalctl -u mcp-ssh -f"
echo "  - 检查状态: systemctl status mcp-ssh"
echo "  - 重启服务: systemctl restart mcp-ssh"
echo ""