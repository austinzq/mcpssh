# 部署说明 - 针对你的环境

## 服务器信息
- **服务器IP**: 43.142.85.8
- **用户**: root
- **密码**: Mcp@20252025
- **AUTH_TOKEN**: MCPhahaha_2025

## 准备工作

### 1. 创建GitHub访问令牌（私有仓库必需）

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 设置Token名称：`MCP SSH Deployment`
4. 选择权限：`repo` (Full control of private repositories)
5. 点击 "Generate token"
6. 复制生成的令牌（形如：`ghp_xxxxxxxxxxxxxxxxxxxx`）

## 一键部署命令

在你的Ubuntu服务器（43.142.85.8）上执行：

```bash
# SSH连接到服务器
ssh root@43.142.85.8

# 设置GitHub访问令牌（替换为你的实际令牌）
export GITHUB_TOKEN="ghp_your_github_token_here"

# 设置认证令牌
export AUTH_TOKEN="MCPhahaha_2025"

# 一键部署
curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/deploy-ubuntu.sh | sudo -E bash
```

## 部署完成后的配置

### 1. 本地Claude Desktop配置

编辑你的Claude Desktop配置文件：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "mcp-ssh-remote": {
      "command": "node",
      "args": ["/path/to/local/mcpssh/dist/client-proxy.js"],
      "env": {
        "MCP_REMOTE_URL": "ws://43.142.85.8:3000",
        "MCP_AUTH_TOKEN": "MCPhahaha_2025"
      }
    }
  }
}
```

### 2. 本地代理设置

在你的本地机器上：

```bash
# 克隆仓库
git clone https://github.com/austinzq/mcpssh.git
cd mcpssh

# 安装依赖并构建
npm install
npm run build

# 记住这个路径，用于Claude Desktop配置
pwd
```

## 验证部署

### 1. 检查服务状态
```bash
# 在服务器上检查
sudo systemctl status mcp-ssh
sudo journalctl -u mcp-ssh -f
```

### 2. 测试连接
```bash
# 在本地测试WebSocket连接
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" -H "Authorization: Bearer MCPhahaha_2025" http://43.142.85.8:3000/
```

### 3. 测试Claude Desktop
重启Claude Desktop后，应该能在工具列表中看到SSH相关工具。

## 常用管理命令

在服务器上：

```bash
# 查看服务状态
sudo systemctl status mcp-ssh

# 重启服务
sudo systemctl restart mcp-ssh

# 查看日志
sudo journalctl -u mcp-ssh -f

# 更新服务
sudo update-mcp-ssh

# 查看配置
sudo cat /var/lib/mcpssh/app/.env
```

## 安全建议

### 1. 限制IP访问（推荐）
```bash
# 删除允许所有IP的规则
sudo ufw delete allow 3000/tcp

# 只允许你的IP访问（替换为你的实际IP）
sudo ufw allow from YOUR_HOME_IP to any port 3000 proto tcp
```

### 2. 查看当前防火墙状态
```bash
sudo ufw status verbose
```

## 故障排查

如果遇到问题：

1. **服务启动失败**:
```bash
sudo journalctl -u mcp-ssh -n 50
```

2. **连接被拒绝**:
```bash
# 检查端口是否监听
sudo netstat -tlnp | grep 3000

# 检查防火墙
sudo ufw status
```

3. **认证失败**:
```bash
# 检查.env文件
sudo cat /var/lib/mcpssh/app/.env
```

## 使用示例

部署完成后，在Claude中可以这样使用：

1. 连接到另一台服务器：
```
请使用ssh_connect连接到服务器192.168.1.100，用户名ubuntu，密码mypassword
```

2. 执行命令：
```
请在刚连接的服务器上执行 "df -h" 命令查看磁盘使用情况
```

3. 文件传输：
```
请将本地文件/tmp/test.txt上传到远程服务器的/home/ubuntu/目录
```

## 卸载

如需卸载服务：

```bash
sudo systemctl stop mcp-ssh
sudo systemctl disable mcp-ssh
sudo rm /etc/systemd/system/mcp-ssh.service
sudo userdel -r mcpssh
sudo rm /usr/local/bin/update-mcp-ssh
sudo rm /usr/local/bin/check-mcp-ssh
sudo ufw delete allow 3000/tcp
```