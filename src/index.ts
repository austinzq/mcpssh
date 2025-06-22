#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SSHManager } from './ssh-manager.js';

const server = new Server(
  {
    name: 'mcp-ssh',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const sshManager = new SSHManager();

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP SSH Server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});