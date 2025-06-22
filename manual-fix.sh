#!/bin/bash

# Manual fix script for when Git operations fail
# This script downloads the latest code via curl instead of git

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Configuration
APP_USER="mcpssh"
APP_DIR="/var/lib/mcpssh/app"
AUTH_TOKEN="${AUTH_TOKEN:-MCPhahaha_2025}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
fi

echo "=================================="
echo "MCP SSH Manual Fix Script"
echo "=================================="
echo ""

# Step 1: Stop existing service
print_status "Stopping existing service..."
systemctl stop mcp-ssh >/dev/null 2>&1 || true

# Step 2: Create user if needed
if ! id "$APP_USER" &>/dev/null; then
    print_status "Creating application user..."
    useradd -r -s /bin/bash -m -d /var/lib/mcpssh $APP_USER
fi

# Step 3: Download latest code via curl
print_status "Downloading latest code from GitHub..."
TEMP_DIR="/tmp/mcpssh-download"
rm -rf $TEMP_DIR

# Download the main branch as zip
curl -L -o /tmp/mcpssh.zip https://github.com/austinzq/mcpssh/archive/refs/heads/main.zip

# Extract
cd /tmp
unzip -q mcpssh.zip
mv mcpssh-main $TEMP_DIR

# Replace app directory
if [ -d "$APP_DIR" ]; then
    print_status "Backing up existing directory..."
    mv $APP_DIR $APP_DIR.backup.$(date +%s)
fi

print_status "Installing new code..."
mv $TEMP_DIR $APP_DIR
chown -R $APP_USER:$APP_USER $APP_DIR

# Step 4: Install dependencies and build
print_status "Installing dependencies..."
cd $APP_DIR
sudo -u $APP_USER npm install >/dev/null 2>&1

print_status "Building application..."
sudo -u $APP_USER npm run build >/dev/null 2>&1

# Step 5: Create environment file
print_status "Creating environment configuration..."
cat > $APP_DIR/.env << EOF
MCP_PORT=3000
MCP_AUTH_TOKEN=$AUTH_TOKEN
EOF
chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Step 6: Update systemd service
print_status "Updating systemd service..."
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
ExecStart=/usr/bin/node /var/lib/mcpssh/app/dist/mcp-http-server.js
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

# Step 7: Start service
print_status "Starting MCP SSH service..."
systemctl daemon-reload
systemctl enable mcp-ssh >/dev/null 2>&1
systemctl start mcp-ssh

# Wait for service to start
sleep 3

# Check if service is running
if systemctl is-active --quiet mcp-ssh; then
    print_status "MCP SSH service is running successfully"
else
    print_error "Failed to start MCP SSH service. Check logs: journalctl -u mcp-ssh"
fi

# Get server IP
SERVER_IP=$(ip route get 1 | awk '{print $7;exit}')

# Cleanup
rm -f /tmp/mcpssh.zip
rm -rf /tmp/mcpssh-*

echo ""
echo "=================================="
echo -e "${GREEN}Manual Fix Completed Successfully!${NC}"
echo "=================================="
echo ""
echo "Server IP: $SERVER_IP"
echo "MCP Port: 3000"
echo "Service Status: $(systemctl is-active mcp-ssh)"
echo ""
echo "Claude Code Configuration:"
echo "claude mcp add --transport http mcp-ssh https://$SERVER_IP:3000/mcp --header \"Authorization: Bearer $AUTH_TOKEN\""
echo ""
echo "Test the service:"
echo "curl -H \"Authorization: Bearer $AUTH_TOKEN\" https://$SERVER_IP:3000/health"
echo ""