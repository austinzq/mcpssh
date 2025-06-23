我想做个MCP，让Claude code 通过MCP来SSH控制服务器，以实现自动化的项目部署，测试、运维

测试Ubuntu服务器地址 账号 密码
43.142.85.8
root


● 当然可以！直接在/root/mcpssh-main下部署更简单。让我们创建一个适合当前目录的部署方案：

  🚀 在当前目录部署

  1. 停止现有服务

  sudo systemctl stop mcp-ssh
  sudo systemctl disable mcp-ssh

  2. 在当前目录构建

  cd /root/mcpssh-main

  # 安装依赖
  npm install

  # 构建项目
  npm run build

  # 检查构建结果
  ls -la dist/

  3. 创建环境文件

  cat > .env << EOF
  MCP_PORT=3000
  MCP_AUTH_TOKEN=MCPhahaha_2025
  EOF

  4. 更新systemd服务指向当前目录

  sudo tee /etc/systemd/system/mcp-ssh.service << EOF
  [Unit]
  Description=MCP SSH Server
  After=network.target

  [Service]
  Type=simple
  User=root
  Group=root
  WorkingDirectory=/root/mcpssh-main
  Environment="NODE_ENV=production"
  EnvironmentFile=/root/mcpssh-main/.env
  Environment="PATH=/root/.nvm/versions/node/v22.16.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/us
  r/bin:/sbin:/bin"
  ExecStart=node /root/mcpssh-main/dist/mcp-http-server.js
  Restart=always
  RestartSec=10
  StandardOutput=journal
  StandardError=journal
  SyslogIdentifier=mcp-ssh

  [Install]
  WantedBy=multi-user.target
  EOF

  5. 启动服务

  sudo systemctl daemon-reload
  sudo systemctl enable mcp-ssh
  sudo systemctl start mcp-ssh
  sudo systemctl status mcp-ssh

  6. 测试

  curl http://localhost:3000/health

  这样就直接在你的clone目录下运行了，以root用户身份，避免了权限和路径问题！