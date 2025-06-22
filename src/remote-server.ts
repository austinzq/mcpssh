#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebSocketTransport } from './websocket-transport.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SSHManager } from './ssh-manager.js';
import { WebSocket, WebSocketServer } from 'ws';
import { createHash } from 'crypto';

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3000;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

if (!AUTH_TOKEN) {
  console.error('ERROR: MCP_AUTH_TOKEN environment variable must be set');
  process.exit(1);
}

const wss = new WebSocketServer({ port: PORT });
console.log(`MCP SSH Server (WebSocket) listening on port ${PORT}`);

wss.on('connection', async (ws: WebSocket, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);
  
  // Authenticate client
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or invalid authorization header');
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  const providedToken = authHeader.substring(7);
  if (providedToken !== AUTH_TOKEN) {
    console.error('Invalid auth token');
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  console.log('Client authenticated successfully');
  
  // Create MCP server for this connection
  const server = new Server(
    {
      name: 'mcp-ssh-remote',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const sshManager = new SSHManager();

  // Set up request handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'ssh_connect',
        description: 'Connect to a remote server via SSH',
        inputSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'SSH server hostname or IP address' },
            port: { type: 'number', description: 'SSH server port (default: 22)', default: 22 },
            username: { type: 'string', description: 'SSH username' },
            password: { type: 'string', description: 'SSH password' },
          },
          required: ['host', 'username', 'password'],
        },
      },
      {
        name: 'ssh_execute',
        description: 'Execute a command on the connected SSH server',
        inputSchema: {
          type: 'object',
          properties: {
            connectionId: { type: 'string', description: 'Connection ID from ssh_connect' },
            command: { type: 'string', description: 'Command to execute' },
          },
          required: ['connectionId', 'command'],
        },
      },
      {
        name: 'ssh_upload',
        description: 'Upload a file to the remote server',
        inputSchema: {
          type: 'object',
          properties: {
            connectionId: { type: 'string', description: 'Connection ID from ssh_connect' },
            localPath: { type: 'string', description: 'Local file path' },
            remotePath: { type: 'string', description: 'Remote file path' },
          },
          required: ['connectionId', 'localPath', 'remotePath'],
        },
      },
      {
        name: 'ssh_download',
        description: 'Download a file from the remote server',
        inputSchema: {
          type: 'object',
          properties: {
            connectionId: { type: 'string', description: 'Connection ID from ssh_connect' },
            remotePath: { type: 'string', description: 'Remote file path' },
            localPath: { type: 'string', description: 'Local file path' },
          },
          required: ['connectionId', 'remotePath', 'localPath'],
        },
      },
      {
        name: 'ssh_disconnect',
        description: 'Disconnect from the SSH server',
        inputSchema: {
          type: 'object',
          properties: {
            connectionId: { type: 'string', description: 'Connection ID to disconnect' },
          },
          required: ['connectionId'],
        },
      },
      {
        name: 'ssh_list_connections',
        description: 'List all active SSH connections',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'ssh_connect': {
          const { host, port = 22, username, password } = args as any;
          const connectionId = await sshManager.connect({ host, port, username, password });
          return {
            content: [
              {
                type: 'text',
                text: `Successfully connected to ${host}:${port}. Connection ID: ${connectionId}`,
              },
            ],
          };
        }

        case 'ssh_execute': {
          const { connectionId, command } = args as any;
          const result = await sshManager.execute(connectionId, command);
          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        }

        case 'ssh_upload': {
          const { connectionId, localPath, remotePath } = args as any;
          await sshManager.upload(connectionId, localPath, remotePath);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully uploaded ${localPath} to ${remotePath}`,
              },
            ],
          };
        }

        case 'ssh_download': {
          const { connectionId, remotePath, localPath } = args as any;
          await sshManager.download(connectionId, remotePath, localPath);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully downloaded ${remotePath} to ${localPath}`,
              },
            ],
          };
        }

        case 'ssh_disconnect': {
          const { connectionId } = args as any;
          await sshManager.disconnect(connectionId);
          return {
            content: [
              {
                type: 'text',
                text: `Disconnected from connection ${connectionId}`,
              },
            ],
          };
        }

        case 'ssh_list_connections': {
          const connections = sshManager.listConnections();
          return {
            content: [
              {
                type: 'text',
                text: connections.length > 0
                  ? `Active connections:\n${connections.map(c => `- ${c.id}: ${c.host}:${c.port} (${c.username})`).join('\n')}`
                  : 'No active connections',
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Connect server to WebSocket transport
  const transport = new WebSocketTransport(ws);
  await server.connect(transport);
  
  // Clean up SSH connections when client disconnects
  ws.on('close', async () => {
    console.log('Client disconnected, cleaning up SSH connections');
    await sshManager.disconnectAll();
  });
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down MCP SSH Server...');
  wss.close(() => {
    process.exit(0);
  });
});