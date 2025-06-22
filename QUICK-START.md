# 🚀 Quick Start Guide

Get your MCP SSH server running in 3 steps!

## Step 1: Deploy Server

SSH to your remote server and run:

### Method 1: Automatic Deployment (Recommended)
```bash
export GITHUB_TOKEN="your_github_token_here"
export AUTH_TOKEN="MCPhahaha_2025"
curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/deploy-ubuntu.sh | sudo -E bash
```

### Method 2: Local Clone (If Git fails)
If you can clone the repository yourself:

```bash
# Clone the repository
git clone https://github.com/austinzq/mcpssh.git
cd mcpssh

# Set environment and deploy
export AUTH_TOKEN="MCPhahaha_2025"
sudo -E ./local-deploy.sh
```

### Method 3: Manual Fix (Backup method)
If you encounter Git connection errors like "TLS connection was non-properly terminated":

```bash
export AUTH_TOKEN="MCPhahaha_2025"
curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/manual-fix.sh | sudo -E bash
```

This method downloads the code via HTTPS instead of Git.

## Step 2: Configure Claude Code

```bash
claude mcp add --transport http mcp-ssh https://43.142.85.8:3000/mcp --header "Authorization: Bearer MCPhahaha_2025"
```

## Step 3: Test

```bash
claude mcp list
```

You should see:
```
✅ mcp-ssh: Connected
   Tools: ssh_connect, ssh_execute, ssh_upload, ssh_download, ssh_disconnect, ssh_list_connections
```

## Usage

Now ask Claude Code:
```
Connect to server 192.168.1.100 with username ubuntu and password mypass, then show me the current disk usage
```

## Troubleshooting

### Server not responding?
```bash
# On server
sudo systemctl status mcp-ssh
sudo journalctl -u mcp-ssh -f
```

### Connection refused?
```bash
# Check firewall
sudo ufw status
sudo ufw allow 3000/tcp
```

### Authentication failed?
Check that the `AUTH_TOKEN` matches in both:
1. Server: `sudo cat /var/lib/mcpssh/app/.env`
2. Claude Code: The `--header` parameter

## Done! 🎉

Your MCP SSH server is now ready for automated deployment, testing, and operations!