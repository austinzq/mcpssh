#!/bin/bash

# 测试MCP服务器连接
echo "测试MCP服务器连接..."

# 使用curl测试
curl -H "Authorization: Bearer 735ae0a6b61c632a1dfe675b6c34b800b1e7a5a4fa47f0fd08b9d8f7f157713b" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{}' \
     http://3.107.193.229:3000/mcp/tools/list

echo -e "\n\n正确的Claude命令应该是："
echo 'claude mcp add --transport http mcp-ssh http://3.107.193.229:3000/mcp --header "Authorization: Bearer 735ae0a6b61c632a1dfe675b6c34b800b1e7a5a4fa47f0fd08b9d8f7f157713b"'