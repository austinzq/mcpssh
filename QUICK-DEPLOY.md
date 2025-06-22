# 快速部署指南 - 一键部署MCP SSH服务器

## 方法1：直接运行（推荐）

在你的Ubuntu服务器（43.142.85.8）上执行以下命令：

```bash
# 设置GitHub访问令牌（私有仓库必需）
export GITHUB_TOKEN="your_github_token_here"

# 使用指定的AUTH_TOKEN
export AUTH_TOKEN="MCPhahaha_2025"

# 下载并执行部署脚本
curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/deploy-ubuntu.sh | sudo -E bash
```

**注意**: 因为仓库是私有的，需要先创建GitHub访问令牌：
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择 "repo" 权限
4. 复制生成的令牌

## 方法2：下载后运行

```bash
# 下载脚本
wget https://raw.githubusercontent.com/austinzq/mcpssh/main/deploy-ubuntu.sh

# 查看脚本内容（可选）
cat deploy-ubuntu.sh

# 设置GitHub访问令牌
export GITHUB_TOKEN="your_github_token_here"

# 设置认证令牌
export AUTH_TOKEN="MCPhahaha_2025"

# 执行脚本
sudo -E bash deploy-ubuntu.sh
```

## 方法3：手动执行

如果你已经克隆了仓库：

```bash
# 进入项目目录
cd mcpssh

# 设置认证令牌
export AUTH_TOKEN="MCPhahaha_2025"

# 执行部署脚本
sudo -E ./deploy-ubuntu.sh
```

## 脚本功能

这个一键部署脚本会自动完成：

1. ✅ 更新系统
2. ✅ 安装 Node.js 18
3. ✅ 安装 Git 和 PM2
4. ✅ 创建专用用户
5. ✅ 克隆代码仓库
6. ✅ 安装依赖并构建
7. ✅ 生成安全认证令牌
8. ✅ 创建 systemd 服务
9. ✅ 配置防火墙规则
10. ✅ 启动服务并设置开机自启
11. ✅ 创建更新脚本
12. ✅ 设置健康检查（每5分钟）

## 部署后配置

部署完成后，脚本会显示：

- 🔑 **认证令牌**（AUTH_TOKEN）- 请妥善保存
- 📋 **Claude Desktop 配置** - 复制到本地配置文件
- 🛠️ **常用命令** - 管理服务的命令

## 自定义选项

在运行脚本前，可以设置以下环境变量：

```bash
# 设置认证令牌（默认生成随机令牌）
export AUTH_TOKEN="MCPhahaha_2025"

# 设置自定义端口（默认3000）
export MCP_PORT=8080

# 然后运行脚本
sudo -E bash deploy-ubuntu.sh
```

## 安全建议

部署后建议执行：

### 1. 限制IP访问（推荐）
```bash
# 删除允许所有IP的规则
sudo ufw delete allow 3000/tcp

# 只允许特定IP访问
sudo ufw allow from YOUR_HOME_IP to any port 3000 proto tcp
```

### 2. 配置SSL（生产环境必需）
参考 `DEPLOY-REMOTE-UBUNTU.md` 中的 Nginx + SSL 配置部分。

## 故障排查

如果部署失败：

```bash
# 查看服务状态
sudo systemctl status mcp-ssh

# 查看日志
sudo journalctl -u mcp-ssh -n 50

# 手动测试
sudo -u mcpssh node /var/lib/mcpssh/app/dist/remote-server.js
```

## 更新服务

部署脚本已创建更新命令：

```bash
# 更新到最新版本
sudo update-mcp-ssh
```

## 卸载服务

如需完全卸载：

```bash
# 停止并禁用服务
sudo systemctl stop mcp-ssh
sudo systemctl disable mcp-ssh

# 删除服务文件
sudo rm /etc/systemd/system/mcp-ssh.service

# 删除应用和用户
sudo userdel -r mcpssh

# 删除脚本
sudo rm /usr/local/bin/update-mcp-ssh
sudo rm /usr/local/bin/check-mcp-ssh

# 移除防火墙规则
sudo ufw delete allow 3000/tcp
```

---

就是这么简单！一行命令完成所有部署。