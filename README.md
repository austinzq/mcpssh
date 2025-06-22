# MCP SSH Server

A Model Context Protocol (MCP) server that enables Claude to control servers via SSH for automated deployment, testing, and operations.

## Features

- **SSH Connection Management**: Connect to multiple SSH servers simultaneously
- **Command Execution**: Execute commands on remote servers
- **File Transfer**: Upload and download files via SFTP
- **Connection Management**: List and manage active connections
- **Secure**: Supports password authentication

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcpssh
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Option 1: Local MCP Server (Standard)

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

Configure Claude Desktop:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-ssh": {
      "command": "node",
      "args": ["/path/to/mcpssh/dist/index.js"],
      "env": {}
    }
  }
}
```

### Option 2: Remote MCP Server (Network)

This allows you to run the MCP server on a remote machine and connect to it from your local Claude Desktop.

#### On the Remote Server:

1. Deploy the code:
```bash
# On remote server (e.g., 43.142.85.8)
git clone <repository-url>
cd mcpssh
npm install
npm run build
```

2. Set environment variables:
```bash
export MCP_PORT=3000  # or any available port
export MCP_AUTH_TOKEN="your-secure-token-here"  # Generate a secure token
```

3. Start the remote server:
```bash
npm run start:remote
# Or use PM2 for production:
pm2 start dist/remote-server.js --name mcp-ssh-remote
```

4. Configure firewall:
```bash
# Allow the MCP port (e.g., 3000)
sudo ufw allow 3000/tcp
```

#### On Your Local Machine:

1. Clone and build the proxy:
```bash
git clone <repository-url>
cd mcpssh
npm install
npm run build
```

2. Configure Claude Desktop to use the proxy:

```json
{
  "mcpServers": {
    "mcp-ssh-remote": {
      "command": "node",
      "args": ["/path/to/mcpssh/dist/client-proxy.js"],
      "env": {
        "MCP_REMOTE_URL": "ws://43.142.85.8:3000",
        "MCP_AUTH_TOKEN": "your-secure-token-here"
      }
    }
  }
}
```

Replace:
- `/path/to/mcpssh` with your local project path
- `43.142.85.8:3000` with your remote server address and port
- `your-secure-token-here` with the same token used on the server

## Available Tools

### ssh_connect
Connect to a remote SSH server.

**Parameters:**
- `host` (required): SSH server hostname or IP address
- `port` (optional): SSH server port (default: 22)
- `username` (required): SSH username
- `password` (required): SSH password

**Returns:** Connection ID for use with other commands

### ssh_execute
Execute a command on a connected SSH server.

**Parameters:**
- `connectionId` (required): Connection ID from ssh_connect
- `command` (required): Command to execute

**Returns:** Command output

### ssh_upload
Upload a file to the remote server.

**Parameters:**
- `connectionId` (required): Connection ID from ssh_connect
- `localPath` (required): Local file path
- `remotePath` (required): Remote file path

### ssh_download
Download a file from the remote server.

**Parameters:**
- `connectionId` (required): Connection ID from ssh_connect
- `remotePath` (required): Remote file path
- `localPath` (required): Local file path

### ssh_disconnect
Disconnect from an SSH server.

**Parameters:**
- `connectionId` (required): Connection ID to disconnect

### ssh_list_connections
List all active SSH connections.

**Returns:** List of active connections with their details

## Example Usage in Claude

1. Connect to a server:
```
Use ssh_connect to connect to server 43.142.85.8 with username root and password Mcp@20252025
```

2. Execute commands:
```
Use ssh_execute to run "ls -la" on the connected server
```

3. Upload files:
```
Use ssh_upload to upload local file "./deploy.sh" to "/home/user/deploy.sh" on the server
```

4. Download files:
```
Use ssh_download to download "/var/log/app.log" from the server to "./logs/app.log" locally
```

5. Disconnect:
```
Use ssh_disconnect to close the connection
```

## Security Considerations

- Store credentials securely and never commit them to version control
- Consider using SSH keys instead of passwords for production use
- Limit access to the MCP server configuration
- Use secure networks when connecting to remote servers

### For Remote MCP Server:

- **Always use HTTPS/WSS in production**: Replace `ws://` with `wss://` and use a reverse proxy like nginx with SSL
- **Generate secure tokens**: Use this command to generate a secure token:
  ```bash
  openssl rand -hex 32
  ```
- **Restrict firewall**: Only allow connections from your IP:
  ```bash
  sudo ufw allow from YOUR_IP to any port 3000
  ```
- **Use environment files**: Never hardcode tokens in configuration files
  ```bash
  # Create .env file on remote server
  echo "MCP_PORT=3000" > .env
  echo "MCP_AUTH_TOKEN=$(openssl rand -hex 32)" >> .env
  ```

## Firewall Configuration

### For SSH Target Servers

The target servers you want to connect to need to have SSH port open:

**Ubuntu/Debian:**
```bash
# Allow SSH (port 22)
sudo ufw allow 22/tcp
sudo ufw enable

# Or allow from specific IP
sudo ufw allow from YOUR_IP to any port 22
```

**CentOS/RHEL:**
```bash
# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

**Note:** The MCP server itself doesn't need any inbound ports open as it communicates via stdio with Claude Desktop.

## Running as a Service

### Option 1: Using PM2 (Recommended)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Create ecosystem file:
```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'mcp-ssh',
    script: './dist/index.js',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
```

3. Start the service:
```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

### Option 2: Using systemd (Linux)

1. Create service file:
```bash
sudo nano /etc/systemd/system/mcp-ssh.service
```

2. Add the following content:
```ini
[Unit]
Description=MCP SSH Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/mcpssh
ExecStart=/usr/bin/node /path/to/mcpssh/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mcp-ssh
sudo systemctl start mcp-ssh
sudo systemctl status mcp-ssh
```

### Option 3: Using Docker

1. Create Dockerfile:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

2. Build and run:
```bash
docker build -t mcp-ssh .
docker run -d --name mcp-ssh --restart always mcp-ssh
```

## Development

- `npm run dev`: Run in development mode with hot reload
- `npm run build`: Build the TypeScript project
- `npm start`: Run the built project

## License

ISC