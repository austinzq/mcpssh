# 私有仓库部署指南

因为你的GitHub仓库是私有的，需要额外的认证步骤。

## 第一步：创建GitHub Personal Access Token

1. 登录 GitHub，访问：https://github.com/settings/tokens

2. 点击 **"Generate new token"** → **"Generate new token (classic)"**

3. 填写token信息：
   - **Note**: `MCP SSH Server Deployment`
   - **Expiration**: 选择合适的过期时间（建议90天或No expiration）
   - **Select scopes**: 勾选 `repo` （这会给予完整的私有仓库访问权限）

4. 点击 **"Generate token"**

5. **重要**: 复制生成的token（格式类似：`ghp_xxxxxxxxxxxxxxxxxxxx`），这个token只会显示一次！

## 第二步：在服务器上部署

### 方法1：一行命令部署

```bash
# 连接到你的服务器
ssh root@43.142.85.8

# 替换下面的 your_github_token 为步骤1中生成的实际token
export GITHUB_TOKEN="ghp_your_actual_github_token_here"
export AUTH_TOKEN="MCPhahaha_2025"

# 一键部署
curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/deploy-ubuntu.sh | sudo -E bash
```

### 方法2：手动克隆然后部署

如果你更喜欢分步骤操作：

```bash
# 1. 先手动克隆仓库
git clone https://ghp_your_github_token@github.com/austinzq/mcpssh.git
cd mcpssh

# 2. 设置环境变量
export AUTH_TOKEN="MCPhahaha_2025"

# 3. 运行部署脚本
sudo -E ./deploy-ubuntu.sh
```

## 第三步：验证部署

部署完成后，检查服务状态：

```bash
# 检查服务是否运行
sudo systemctl status mcp-ssh

# 查看日志
sudo journalctl -u mcp-ssh -f

# 检查端口是否监听
sudo netstat -tlnp | grep 3000
```

## 重要安全提醒

1. **保护你的GitHub Token**:
   - 不要在脚本中硬编码token
   - 不要提交包含token的文件到版本控制
   - 定期轮换token

2. **最小权限原则**:
   - GitHub token只给了`repo`权限，这是访问私有仓库的最小必要权限

3. **Token管理**:
   - 如果token泄露，立即在GitHub设置中撤销
   - 考虑为部署专门创建一个机器用户账号

## 故障排查

### 如果遇到认证错误：

```bash
# 检查token是否有效
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# 如果返回用户信息，说明token有效
```

### 如果仍然无法克隆：

1. 确认GitHub用户有访问该仓库的权限
2. 确认token有`repo`权限
3. 检查token是否正确设置：`echo $GITHUB_TOKEN`

## 更新已部署的服务

如果仓库有更新，使用内置的更新脚本：

```bash
# 在服务器上运行
sudo update-mcp-ssh
```

这个脚本会自动拉取最新代码并重启服务。