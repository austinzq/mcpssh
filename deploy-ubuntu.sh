#!/bin/bash

# MCP SSH Server - Ubuntu One-Click Deployment Script
# Usage: curl -sSL https://raw.githubusercontent.com/your-repo/mcpssh/main/deploy-ubuntu.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="${REPO_URL:-https://github.com/austinzq/mcpssh.git}"
APP_USER="mcpssh"
APP_DIR="/var/lib/mcpssh/app"
NODE_VERSION="18"
MCP_PORT="${MCP_PORT:-3000}"
CUSTOM_AUTH_TOKEN="${AUTH_TOKEN:-}"  # Allow custom token via environment variable

# Functions
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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
fi

echo "=================================="
echo "MCP SSH Server Deployment Script"
echo "=================================="
echo ""

# Step 1: Update system
print_status "Updating system packages..."
apt update && apt upgrade -y >/dev/null 2>&1

# Step 2: Install Node.js
print_status "Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
    apt install -y nodejs >/dev/null 2>&1
fi
print_status "Node.js $(node --version) installed"

# Step 3: Install required packages
print_status "Installing required packages..."
apt install -y git ufw >/dev/null 2>&1
npm install -g pm2 >/dev/null 2>&1

# Step 4: Create application user
print_status "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/bash -m -d /var/lib/mcpssh $APP_USER
fi

# Step 5: Clone repository
print_status "Cloning repository..."
if [ -d "$APP_DIR" ]; then
    print_warning "Application directory already exists, pulling latest changes..."
    sudo -u $APP_USER git -C $APP_DIR pull
else
    sudo -u $APP_USER git clone $REPO_URL $APP_DIR
fi

# Step 6: Install dependencies and build
print_status "Installing dependencies and building..."
cd $APP_DIR
sudo -u $APP_USER npm install >/dev/null 2>&1
sudo -u $APP_USER npm run build >/dev/null 2>&1

# Step 7: Set authentication token
print_status "Setting authentication token..."
if [ -n "$CUSTOM_AUTH_TOKEN" ]; then
    AUTH_TOKEN="$CUSTOM_AUTH_TOKEN"
    print_status "Using provided AUTH_TOKEN"
else
    AUTH_TOKEN=$(openssl rand -hex 32)
    print_status "Generated new AUTH_TOKEN"
fi

# Create .env file
cat > $APP_DIR/.env << EOF
MCP_PORT=$MCP_PORT
MCP_AUTH_TOKEN=$AUTH_TOKEN
EOF

chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Step 8: Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/mcp-ssh.service << 'EOF'
[Unit]
Description=MCP SSH Server
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
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/mcpssh/app
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mcp-ssh

[Install]
WantedBy=multi-user.target
EOF

# Step 9: Configure firewall
print_status "Configuring firewall..."
ufw allow 22/tcp >/dev/null 2>&1  # SSH
ufw allow $MCP_PORT/tcp >/dev/null 2>&1  # MCP Server
echo "y" | ufw enable >/dev/null 2>&1

# Step 10: Enable and start service
print_status "Starting MCP SSH service..."
systemctl daemon-reload
systemctl enable mcp-ssh >/dev/null 2>&1
systemctl start mcp-ssh

# Wait for service to start
sleep 3

# Check if service is running
if systemctl is-active --quiet mcp-ssh; then
    print_status "MCP SSH service is running"
else
    print_error "Failed to start MCP SSH service. Check logs: journalctl -u mcp-ssh"
fi

# Step 11: Create update script
print_status "Creating update script..."
cat > /usr/local/bin/update-mcp-ssh << 'EOF'
#!/bin/bash
cd /var/lib/mcpssh/app
sudo -u mcpssh git pull
sudo -u mcpssh npm install
sudo -u mcpssh npm run build
systemctl restart mcp-ssh
echo "MCP SSH updated successfully"
EOF
chmod +x /usr/local/bin/update-mcp-ssh

# Step 12: Create health check script
cat > /usr/local/bin/check-mcp-ssh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet mcp-ssh; then
    systemctl restart mcp-ssh
    echo "$(date): MCP SSH service was restarted" >> /var/log/mcp-ssh-health.log
fi
EOF
chmod +x /usr/local/bin/check-mcp-ssh

# Add health check to cron
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check-mcp-ssh") | crontab -

# Get server IP
SERVER_IP=$(ip route get 1 | awk '{print $7;exit}')

# Print summary
echo ""
echo "=================================="
echo -e "${GREEN}Deployment Completed Successfully!${NC}"
echo "=================================="
echo ""
echo "Server Details:"
echo "  - Server IP: $SERVER_IP"
echo "  - MCP Port: $MCP_PORT"
echo "  - Service Status: $(systemctl is-active mcp-ssh)"
echo ""
echo -e "${YELLOW}IMPORTANT - Save this information:${NC}"
echo ""
echo "Authentication Token:"
echo -e "${GREEN}$AUTH_TOKEN${NC}"
echo ""
echo "Client Configuration (add to claude_desktop_config.json):"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"mcp-ssh-remote\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"/path/to/local/mcpssh/dist/client-proxy.js\"],"
echo "      \"env\": {"
echo "        \"MCP_REMOTE_URL\": \"ws://$SERVER_IP:$MCP_PORT\","
echo "        \"MCP_AUTH_TOKEN\": \"$AUTH_TOKEN\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "Useful Commands:"
echo "  - View logs: journalctl -u mcp-ssh -f"
echo "  - Check status: systemctl status mcp-ssh"
echo "  - Restart service: systemctl restart mcp-ssh"
echo "  - Update application: update-mcp-ssh"
echo ""
echo "Security Notes:"
echo "  - Firewall is configured to allow port $MCP_PORT from any IP"
echo "  - To restrict access to specific IPs, run:"
echo "    ufw delete allow $MCP_PORT/tcp"
echo "    ufw allow from YOUR_IP to any port $MCP_PORT proto tcp"
echo ""