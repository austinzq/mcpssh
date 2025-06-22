#!/bin/bash

# Fix Node.js version and redeploy MCP SSH Server

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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
fi

echo "=================================="
echo "Node.js Upgrade and MCP SSH Fix"
echo "=================================="
echo ""

# Check current Node.js version
current_version=$(node --version 2>/dev/null || echo "not installed")
print_warning "Current Node.js version: $current_version"

# Step 1: Remove old Node.js
print_status "Removing old Node.js version..."
apt remove nodejs npm -y >/dev/null 2>&1 || true

# Step 2: Install Node.js 18
print_status "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1
apt install -y nodejs >/dev/null 2>&1

# Verify new version
new_version=$(node --version)
print_status "New Node.js version: $new_version"

if [[ ! $new_version =~ ^v18 ]]; then
    print_error "Failed to install Node.js 18. Current version: $new_version"
fi

# Step 3: Check if MCP app exists
if [ ! -d "/var/lib/mcpssh/app" ]; then
    print_error "MCP SSH app directory not found. Please run the full deployment script first."
fi

# Step 4: Rebuild the application
print_status "Rebuilding MCP SSH application..."
cd /var/lib/mcpssh/app

# Clean previous installation
sudo -u mcpssh rm -rf node_modules package-lock.json >/dev/null 2>&1 || true

# Install dependencies
print_status "Installing dependencies..."
sudo -u mcpssh npm install >/dev/null 2>&1

# Build project
print_status "Building project..."
sudo -u mcpssh npm run build >/dev/null 2>&1

# Step 5: Ensure .env file exists
if [ ! -f "/var/lib/mcpssh/app/.env" ]; then
    print_status "Creating environment configuration..."
    sudo -u mcpssh tee /var/lib/mcpssh/app/.env << EOF
MCP_PORT=3000
MCP_AUTH_TOKEN=MCPhahaha_2025
EOF
    chmod 600 /var/lib/mcpssh/app/.env
fi

# Step 6: Create/update systemd service
print_status "Creating systemd service..."
tee /etc/systemd/system/mcp-ssh.service << 'EOF'
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

# Step 8: Configure firewall
print_status "Configuring firewall..."
ufw allow 3000/tcp >/dev/null 2>&1

# Get server IP
SERVER_IP=$(ip route get 1 | awk '{print $7;exit}')

echo ""
echo "=================================="
echo -e "${GREEN}Node.js Upgrade and Deployment Completed!${NC}"
echo "=================================="
echo ""
echo "Node.js Version: $(node --version)"
echo "Service Status: $(systemctl is-active mcp-ssh)"
echo "Server IP: $SERVER_IP"
echo "MCP Port: 3000"
echo ""
echo "Client Configuration:"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"mcp-ssh-remote\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"/path/to/local/mcpssh/dist/client-proxy.js\"],"
echo "      \"env\": {"
echo "        \"MCP_REMOTE_URL\": \"ws://$SERVER_IP:3000\","
echo "        \"MCP_AUTH_TOKEN\": \"MCPhahaha_2025\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo ""