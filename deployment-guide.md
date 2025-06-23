# MCP SSH Server 部署指南

## 前提条件
- Ubuntu 18.04+ 服务器
- Root 或 sudo 权限
- Node.js 18+

## 部署步骤

### 1. 在服务器上安装依赖

```bash
# SSH 到您的服务器
ssh root@43.142.85.8

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 创建工作目录
mkdir -p /opt/mcpssh
cd /opt/mcpssh
```

### 2. 获取代码
您需要自行 clone 仓库到服务器上。

### 3. 构建和配置

```bash
cd /opt/mcpssh

# 安装依赖
npm install

# 构建项目
npm run build

# 创建环境配置
cat > .env << EOF
MCP_PORT=3000
MCP_AUTH_TOKEN=MCPhahaha_2025
EOF
```

### 4. 创建 systemd 服务

```bash
sudo cat > /etc/systemd/system/mcp-ssh.service << EOF
[Unit]
Description=MCP SSH HTTP Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mcpssh
Environment="NODE_ENV=production"
EnvironmentFile=/opt/mcpssh/.env
ExecStart=/usr/bin/node dist/mcp-http-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable mcp-ssh
sudo systemctl start mcp-ssh

# 检查服务状态
sudo systemctl status mcp-ssh
```

### 5. 配置防火墙

```bash
# 开放 3000 端口
sudo ufw allow 3000/tcp
sudo ufw reload
```

### 6. 验证部署

```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试 MCP 端点
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer MCPhahaha_2025" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 更新部署

当需要更新代码时：

```bash
cd /opt/mcpssh

# 拉取最新代码（您自行处理）
# git pull origin main

# 重新构建
npm install
npm run build

# 重启服务
sudo systemctl restart mcp-ssh
sudo systemctl status mcp-ssh
```

## Claude Code 配置

在客户端配置 Claude Code：

```bash
# 使用 HTTP（注意不是 HTTPS）
claude mcp add --transport http mcp-ssh http://43.142.85.8:3000 --header "Authorization: Bearer MCPhahaha_2025"

# 验证连接
claude mcp list
```

## 故障排查

### 查看日志
```bash
sudo journalctl -u mcp-ssh -f
```

### 测试连接
```bash
# 从客户端测试
curl http://43.142.85.8:3000/health
```

### 常见问题

1. **连接失败**
   - 检查防火墙规则
   - 确认服务正在运行
   - 验证认证令牌

2. **Claude Code 无法连接**
   - 确保使用 HTTP 而非 HTTPS
   - 检查服务器日志
   - 重启 Claude Code

## 安全建议

1. 考虑使用 nginx 反向代理添加 HTTPS
2. 定期更新认证令牌
3. 限制防火墙规则只允许特定 IP