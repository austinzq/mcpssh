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

### Starting the MCP Server

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

### Configuring Claude Desktop

Add the following to your Claude Desktop configuration file:

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

Replace `/path/to/mcpssh` with the actual path to your project directory.

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

## Development

- `npm run dev`: Run in development mode with hot reload
- `npm run build`: Build the TypeScript project
- `npm start`: Run the built project

## License

ISC