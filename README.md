# MCP SSH Server

A Model Context Protocol (MCP) HTTP server that enables Claude Code to control remote servers via SSH for automated deployment, testing, and operations.

## Features

- **SSH Connection Management**: Connect to multiple SSH servers simultaneously
- **Command Execution**: Execute commands on remote servers
- **File Transfer**: Upload and download files via SFTP
- **MCP HTTP Protocol**: Full compatibility with Claude Code
- **Bearer Token Authentication**: Secure API access
- **Auto-restart**: Systemd service with automatic recovery

## Quick Start

### 1. Deploy on Remote Server

```bash
# SSH to your server
ssh root@your-server-ip

# Set environment variables
export GITHUB_TOKEN="your_github_token_here"
export AUTH_TOKEN="your_secure_token_here"

# One-click deployment
curl -sSL https://raw.githubusercontent.com/austinzq/mcpssh/main/deploy-ubuntu.sh | sudo -E bash
```

### 2. Configure Claude Code

```bash
# Add the MCP server
claude mcp add --transport http mcp-ssh https://your-server-ip:3000/mcp --header "Authorization: Bearer your_secure_token_here"

# Verify connection
claude mcp list
```

### 3. Use SSH Tools in Claude Code

```
Connect to server 192.168.1.100 with username ubuntu and password mypass, then check disk usage
```

## Installation

### Prerequisites

- Ubuntu 18.04+ server
- Node.js 18+
- Root or sudo access

### Manual Installation

1. **Install Node.js 18**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

2. **Clone and build**:
```bash
git clone https://github.com/austinzq/mcpssh.git
cd mcpssh
npm install
npm run build
```

3. **Configure environment**:
```bash
cat > .env << EOF
MCP_PORT=3000
MCP_AUTH_TOKEN=your_secure_token_here
EOF
```

4. **Start server**:
```bash
npm run start:mcp
```

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `ssh_connect` | Connect to SSH server | host, username, password, port? |
| `ssh_execute` | Execute command | connectionId, command |
| `ssh_upload` | Upload file to server | connectionId, localPath, remotePath |
| `ssh_download` | Download file from server | connectionId, remotePath, localPath |
| `ssh_disconnect` | Disconnect from server | connectionId |
| `ssh_list_connections` | List active connections | - |

## API Endpoints

### Health Check
```http
GET /health
```

### MCP Protocol Endpoints
```http
POST /mcp/initialize
POST /mcp/tools/list
POST /mcp/tools/call
POST /mcp/resources/list
POST /mcp/prompts/list
```

All MCP endpoints require `Authorization: Bearer <token>` header.

## Configuration

### Environment Variables

- `MCP_PORT`: Server port (default: 3000)
- `MCP_AUTH_TOKEN`: Authentication token (required)

### Systemd Service

The deployment script creates a systemd service at `/etc/systemd/system/mcp-ssh.service`:

```bash
# Service management
sudo systemctl status mcp-ssh
sudo systemctl restart mcp-ssh
sudo journalctl -u mcp-ssh -f
```

## Security

### Firewall Configuration

```bash
# Allow MCP port
sudo ufw allow 3000/tcp

# Or restrict to specific IP
sudo ufw allow from YOUR_IP to any port 3000 proto tcp
```

### SSL/HTTPS (Recommended)

Use nginx as reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    location /mcp {
        proxy_pass http://localhost:3000/mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Authorization $http_authorization;
    }
}
```

Then configure Claude Code:
```bash
claude mcp add --transport http mcp-ssh https://your-domain.com/mcp --header "Authorization: Bearer your_token"
```

## Usage Examples

### Basic SSH Operations

```
# Connect to a server
Use ssh_connect to connect to server 192.168.1.100 with username ubuntu and password mypass

# Check system status
Execute "top -n 1" command on the connected server to see current processes

# Upload a deployment script
Upload local file "./deploy.sh" to remote path "/tmp/deploy.sh" on the connected server

# Run the deployment
Execute "chmod +x /tmp/deploy.sh && /tmp/deploy.sh" on the server

# Download logs
Download "/var/log/app.log" from server to local "./logs/app.log"

# Disconnect
Disconnect from the server
```

### Advanced Automation

```
# Multi-server deployment
Connect to multiple servers (web1, web2, db1) and deploy the latest application version, then verify all services are running properly

# System monitoring
Check disk usage, memory, and CPU on all connected servers and create a summary report

# Log analysis
Download and analyze error logs from the last 24 hours across all production servers
```

## Development

```bash
# Development mode
npm run dev:mcp

# Build project
npm run build

# Production mode
npm run start:mcp
```

## Troubleshooting

### Service Issues

```bash
# Check service status
sudo systemctl status mcp-ssh

# View logs
sudo journalctl -u mcp-ssh -n 50

# Test manually
sudo -u mcpssh MCP_PORT=3000 MCP_AUTH_TOKEN=test node dist/mcp-http-server.js
```

### Connection Issues

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test with authentication
curl -H "Authorization: Bearer your_token" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{}' \
     http://localhost:3000/mcp/tools/list

# Check firewall
sudo ufw status
```

### Claude Code Issues

```bash
# Remove and re-add server
claude mcp remove mcp-ssh
claude mcp add --transport http mcp-ssh https://your-server:3000/mcp --header "Authorization: Bearer your_token"

# Check MCP status
claude mcp
```

## Updates

```bash
# Update server (created by deployment script)
sudo update-mcp-ssh
```

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request