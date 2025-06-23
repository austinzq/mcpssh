#!/bin/bash

# 快速更新脚本 - 在服务器上运行

echo "=== MCP SSH Server 快速更新 ==="

# 检查是否在正确目录
if [ ! -f "package.json" ]; then
    echo "错误：请在 /opt/mcpssh 目录下运行此脚本"
    exit 1
fi

echo "1. 停止服务..."
sudo systemctl stop mcp-ssh

echo "2. 构建项目..."
npm run build

echo "3. 启动服务..."
sudo systemctl start mcp-ssh

echo "4. 检查服务状态..."
sudo systemctl status mcp-ssh --no-pager

echo ""
echo "5. 测试服务..."
echo "健康检查："
curl -s http://localhost:3000/health | jq .

echo ""
echo "MCP 端点测试："
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

echo ""
echo "=== 更新完成 ==="