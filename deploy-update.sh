#!/bin/bash

# Deploy updated MCP server to remote
# This script should be run from the project root

echo "=== Deploying MCP Server Update ==="

# Server details
SERVER_IP="43.142.85.8"
SERVER_USER="root"

echo "1. Building project locally..."
npm run build

echo ""
echo "2. Creating deployment package..."
tar czf mcp-update.tar.gz dist/ src/ package.json package-lock.json

echo ""
echo "3. Instructions for manual deployment:"
echo ""
echo "Copy and run these commands:"
echo ""
echo "# On your local machine:"
echo "scp mcp-update.tar.gz $SERVER_USER@$SERVER_IP:/tmp/"
echo ""
echo "# SSH to server and run:"
echo "ssh $SERVER_USER@$SERVER_IP"
echo ""
echo "# On the server:"
cat << 'EOF'
cd /opt/mcpssh
sudo systemctl stop mcp-ssh
tar xzf /tmp/mcp-update.tar.gz
npm install --production
sudo systemctl start mcp-ssh
sudo systemctl status mcp-ssh
rm /tmp/mcp-update.tar.gz
EOF

echo ""
echo "4. After deployment, test with:"
echo "curl http://$SERVER_IP:3000/health"
echo ""
echo "=== Deployment package ready: mcp-update.tar.gz ==="