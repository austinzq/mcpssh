#!/bin/bash

# Local deployment script - assumes code is already cloned
# Run this from the mcpssh project directory

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
MCP_PORT="${MCP_PORT:-3000}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/mcp-http-server.ts" ]; then
    print_error "Please run this script from the mcpssh project directory"
fi

echo "=================================="
echo "MCP SSH Local Deployment Script"
echo "=================================="
echo ""

# Step 1: Install Node.js if needed
if ! command -v node &> /dev/null || ! node --version | grep -q "^v1[89]"; then
    print_status "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1
    apt install -y nodejs >/dev/null 2>&1
fi

# Step 2: Create user
print_status "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/bash -m -d /var/lib/mcpssh $APP_USER
fi

# Step 3: Copy files
print_status "Copying application files..."
mkdir -p $(dirname $APP_DIR)
if [ -d "$APP_DIR" ]; then
    rm -rf $APP_DIR
fi
cp -r $(pwd) $APP_DIR
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
MCP_PORT=$MCP_PORT
MCP_AUTH_TOKEN=$AUTH_TOKEN
EOF
chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Step 6: Create systemd service
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

# Step 7: Configure firewall
print_status "Configuring firewall..."
ufw allow $MCP_PORT/tcp >/dev/null 2>&1
echo "y" | ufw enable >/dev/null 2>&1 || true

# Step 8: Start service
print_status "Starting MCP SSH service..."
systemctl daemon-reload
systemctl enable mcp-ssh >/dev/null 2>&1
systemctl restart mcp-ssh

# Wait for service to start
sleep 3

# Check if service is running
if systemctl is-active --quiet mcp-ssh; then
    print_status "MCP SSH service is running successfully"
else
    print_error "Failed to start MCP SSH service. Check logs: journalctl -u mcp-ssh"
fi

# Step 9: Create management scripts
print_status "Creating management scripts..."
cat > /usr/local/bin/update-mcp-ssh << 'EOF'
#!/bin/bash
echo "To update MCP SSH server:"
echo "1. Clone latest code: git pull"
echo "2. Run: sudo ./local-deploy.sh"
echo "Or copy new files and run:"
echo "cd /var/lib/mcpssh/app && sudo -u mcpssh npm run build && sudo systemctl restart mcp-ssh"
EOF
chmod +x /usr/local/bin/update-mcp-ssh

# Get server IP
SERVER_IP=$(ip route get 1 | awk '{print $7;exit}')

echo ""
echo "=================================="
echo -e "${GREEN}Local Deployment Completed!${NC}"
echo "=================================="
echo ""
echo "Server Details:"
echo "  - Server IP: $SERVER_IP"
echo "  - MCP Port: $MCP_PORT"
echo "  - Service Status: $(systemctl is-active mcp-ssh)"
echo ""
echo "Claude Code Configuration:"
echo "claude mcp add --transport http mcp-ssh https://$SERVER_IP:$MCP_PORT/mcp --header \"Authorization: Bearer $AUTH_TOKEN\""
echo ""
echo "Test Commands:"
echo "  - Health: curl https://$SERVER_IP:$MCP_PORT/health"
echo "  - Status: sudo systemctl status mcp-ssh"
echo "  - Logs: sudo journalctl -u mcp-ssh -f"
echo ""