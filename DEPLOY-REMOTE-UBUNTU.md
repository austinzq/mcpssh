# Ubuntu Remote Deployment Guide for MCP SSH Server

This guide provides detailed instructions for deploying the MCP SSH Server on a remote Ubuntu server (tested on Ubuntu 20.04/22.04).

## Prerequisites

- Ubuntu server with root or sudo access
- Node.js 18+ installed
- Git installed
- Domain name (optional, for SSL)

## Step 1: Install Required Software

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js (if not installed)
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.3 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 1.4 Install Git (if not installed)
```bash
sudo apt install -y git
```

## Step 2: Deploy the Application

### 2.1 Create Application User
```bash
# Create a dedicated user for the MCP service
sudo useradd -r -s /bin/bash -m -d /var/lib/mcpssh mcpssh
```

### 2.2 Clone and Setup the Repository
```bash
# Switch to the mcpssh user
sudo su - mcpssh

# Clone the repository
git clone <your-repository-url> /var/lib/mcpssh/app
cd /var/lib/mcpssh/app

# Install dependencies
npm install

# Build the project
npm run build
```

### 2.3 Configure Environment
```bash
# Generate a secure authentication token
AUTH_TOKEN=$(openssl rand -hex 32)
echo "Generated AUTH_TOKEN: $AUTH_TOKEN"

# Create .env file
cat > /var/lib/mcpssh/app/.env << EOF
MCP_PORT=3000
MCP_AUTH_TOKEN=$AUTH_TOKEN
EOF

# Secure the .env file
chmod 600 /var/lib/mcpssh/app/.env
```

**IMPORTANT**: Save the generated AUTH_TOKEN securely. You'll need it for client configuration.

## Step 3: Configure Firewall

### 3.1 Basic UFW Configuration
```bash
# Exit from mcpssh user back to your sudo user
exit

# Enable UFW if not already enabled
sudo ufw enable

# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Allow MCP server port
sudo ufw allow 3000/tcp

# Check status
sudo ufw status
```

### 3.2 Restrict Access (Recommended for Production)
```bash
# Only allow MCP port from specific IPs
sudo ufw delete allow 3000/tcp
sudo ufw allow from YOUR_HOME_IP to any port 3000 proto tcp
sudo ufw allow from YOUR_OFFICE_IP to any port 3000 proto tcp

# Example:
# sudo ufw allow from 203.0.113.25 to any port 3000 proto tcp
```

### 3.3 Advanced Firewall Rules (Optional)
```bash
# Rate limiting to prevent brute force
sudo ufw limit 3000/tcp

# Log connection attempts
sudo ufw logging on
```

## Step 4: Setup Systemd Service

### 4.1 Create Systemd Service File
```bash
sudo nano /etc/systemd/system/mcp-ssh.service
```

Add the following content:
```ini
[Unit]
Description=MCP SSH Server
Documentation=https://github.com/your-repo/mcpssh
After=network.target

[Service]
Type=simple
User=mcpssh
Group=mcpssh
WorkingDirectory=/var/lib/mcpssh/app
Environment="NODE_ENV=production"
EnvironmentFile=/var/lib/mcpssh/app/.env
ExecStart=/usr/bin/node /var/lib/mcpssh/app/dist/remote-server.js
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/mcpssh/app

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mcp-ssh

[Install]
WantedBy=multi-user.target
```

### 4.2 Enable and Start the Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable mcp-ssh

# Start the service
sudo systemctl start mcp-ssh

# Check status
sudo systemctl status mcp-ssh

# View logs
sudo journalctl -u mcp-ssh -f
```

## Step 5: Setup Nginx Reverse Proxy with SSL (Recommended)

### 5.1 Install Nginx and Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 5.2 Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/mcp-ssh
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name mcp.yourdomain.com;

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    # SSL configuration (will be managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;

    # WebSocket proxy configuration
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout
        proxy_read_timeout 86400;
    }
}
```

### 5.3 Enable Site and Get SSL Certificate
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/mcp-ssh /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d mcp.yourdomain.com

# Update firewall for HTTPS
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
```

## Step 6: Monitoring and Maintenance

### 6.1 Setup Log Rotation
```bash
sudo nano /etc/logrotate.d/mcp-ssh
```

Add:
```
/var/lib/mcpssh/app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 mcpssh mcpssh
    sharedscripts
    postrotate
        systemctl reload mcp-ssh > /dev/null 2>&1 || true
    endscript
}
```

### 6.2 Monitor Service Health
```bash
# Check service status
sudo systemctl status mcp-ssh

# View recent logs
sudo journalctl -u mcp-ssh --since "1 hour ago"

# Monitor resource usage
sudo systemctl status mcp-ssh --no-pager -l

# Check if port is listening
sudo netstat -tlnp | grep 3000
```

### 6.3 Setup Monitoring Script
```bash
sudo nano /usr/local/bin/check-mcp-ssh
```

Add:
```bash
#!/bin/bash
if ! systemctl is-active --quiet mcp-ssh; then
    echo "MCP SSH service is down, attempting restart..."
    systemctl restart mcp-ssh
    # Optional: Send notification
    # echo "MCP SSH service was restarted" | mail -s "MCP SSH Alert" admin@example.com
fi
```

Make it executable:
```bash
sudo chmod +x /usr/local/bin/check-mcp-ssh

# Add to crontab (check every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check-mcp-ssh") | crontab -
```

## Step 7: Client Configuration

### 7.1 Local Machine Setup

On your local machine where Claude Desktop is installed:

1. Clone the repository:
```bash
git clone <your-repository-url>
cd mcpssh
npm install
npm run build
```

2. Configure Claude Desktop:

Edit `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mcp-ssh-remote": {
      "command": "node",
      "args": ["/path/to/local/mcpssh/dist/client-proxy.js"],
      "env": {
        "MCP_REMOTE_URL": "wss://mcp.yourdomain.com",
        "MCP_AUTH_TOKEN": "your-auth-token-from-step-2.3"
      }
    }
  }
}
```

**Note**: Use `wss://` for SSL-secured connections, or `ws://your-server-ip:3000` for non-SSL.

## Step 8: Security Best Practices

### 8.1 Additional Security Measures
```bash
# Install fail2ban for brute force protection
sudo apt install -y fail2ban

# Create jail for MCP SSH
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[mcp-ssh]
enabled = true
port = 3000
filter = mcp-ssh
logpath = /var/log/syslog
maxretry = 5
bantime = 3600
```

### 8.2 Create fail2ban filter
```bash
sudo nano /etc/fail2ban/filter.d/mcp-ssh.conf
```

Add:
```ini
[Definition]
failregex = .*MCP SSH.*Unauthorized.*from <HOST>
ignoreregex =
```

Restart fail2ban:
```bash
sudo systemctl restart fail2ban
```

### 8.3 Regular Updates
```bash
# Create update script
sudo nano /usr/local/bin/update-mcp-ssh
```

Add:
```bash
#!/bin/bash
cd /var/lib/mcpssh/app
sudo -u mcpssh git pull
sudo -u mcpssh npm install
sudo -u mcpssh npm run build
sudo systemctl restart mcp-ssh
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/update-mcp-ssh
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -u mcp-ssh -n 50

# Check permissions
ls -la /var/lib/mcpssh/app/

# Verify Node.js path
which node

# Test manually
sudo -u mcpssh /usr/bin/node /var/lib/mcpssh/app/dist/remote-server.js
```

### Connection Issues
```bash
# Check if service is listening
sudo ss -tlnp | grep 3000

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:3000/

# Check firewall
sudo ufw status verbose

# Check Nginx (if using)
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Performance Issues
```bash
# Monitor CPU and memory
htop

# Check Node.js process
ps aux | grep node

# Increase Node.js memory limit if needed
# Edit the service file and add:
Environment="NODE_OPTIONS=--max-old-space-size=2048"
```

## Backup and Recovery

### Create Backup Script
```bash
sudo nano /usr/local/bin/backup-mcp-ssh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/backup/mcp-ssh"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /var/lib/mcpssh app

# Backup environment file
cp /var/lib/mcpssh/app/.env $BACKUP_DIR/env_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "env_*" -mtime +7 -delete
```

Make executable and schedule:
```bash
sudo chmod +x /usr/local/bin/backup-mcp-ssh
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-mcp-ssh") | crontab -
```

## Summary

Your MCP SSH Server is now:
- ✅ Running as a systemd service
- ✅ Auto-starting on boot
- ✅ Protected by firewall rules
- ✅ Monitored for failures
- ✅ Accessible via WebSocket
- ✅ Secured with authentication
- ✅ (Optional) Protected with SSL/TLS

Remember to:
- Keep the AUTH_TOKEN secure
- Regularly update the system and application
- Monitor logs for suspicious activity
- Backup configuration and data regularly