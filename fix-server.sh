#!/bin/bash

# 修复服务器以支持 Claude Code
echo "=== 修复 MCP 服务器以支持 Claude Code ==="

# 检查是否在正确目录
if [ ! -f "src/mcp-http-server.ts" ]; then
    echo "错误：请在 mcpssh 项目根目录运行此脚本"
    exit 1
fi

echo "1. 备份原文件..."
cp src/mcp-http-server.ts src/mcp-http-server.ts.backup

echo "2. 添加根路径处理器..."

# 创建临时文件，在指定位置插入新代码
awk '
/^\/\/ Apply authentication to all MCP endpoints/ {
    print $0
    print "app.use(\"/mcp\", authenticate);"
    print ""
    print "// MCP HTTP Transport Endpoints"
    print ""
    print "// Handle root / POST requests (for Claude Code compatibility)"
    print "app.post(\"/\", authenticate, (_req, res) => {"
    print "  // Claude Code sends initial POST to / to check connectivity"
    print "  res.json({"
    print "    protocolVersion: \"2024-11-05\","
    print "    capabilities: {"
    print "      tools: {},"
    print "      resources: {},"
    print "      prompts: {}"
    print "    },"
    print "    serverInfo: {"
    print "      name: \"mcp-ssh-server\","
    print "      version: \"1.0.0\""
    print "    }"
    print "  });"
    print "});"
    print ""
    next
}
/^app\.use\(.*\/mcp.*authenticate\);/ { next }
/^\/\/ MCP HTTP Transport Endpoints/ { next }
{ print }
' src/mcp-http-server.ts.backup > src/mcp-http-server.ts

echo "3. 构建项目..."
npm run build

echo "4. 重启服务..."
sudo systemctl restart mcp-ssh

echo "5. 检查服务状态..."
sudo systemctl status mcp-ssh --no-pager

echo ""
echo "6. 测试修复..."
sleep 2
echo "根路径测试："
curl -s -X POST http://localhost:3000 \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

echo ""
echo "MCP 路径测试："
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

echo ""
echo "=== 修复完成 ==="