#!/usr/bin/env node
/**
 * HTTP MCP Server for SSH operations
 * Implements the Model Context Protocol (MCP) over HTTP
 * Compatible with Claude Code
 */

import express from 'express';
import cors from 'cors';
import { SSHManager } from './ssh-manager.js';

const app = express();
const sshManager = new SSHManager();

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3000;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

if (!AUTH_TOKEN) {
  console.error('ERROR: MCP_AUTH_TOKEN environment variable must be set');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
    return;
  }
  
  const token = authHeader.substring(7);
  if (token !== AUTH_TOKEN) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
    return;
  }
  
  next();
};

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Apply authentication to all MCP endpoints
app.use('/mcp', authenticate);

// MCP HTTP Transport Endpoints

// JSON-RPC 2.0 helper function
const createJsonRpcResponse = (id: any, result?: any, error?: any) => {
  const response: any = {
    jsonrpc: '2.0',
    id: id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  return response;
};

// Handle base /mcp POST requests (for Claude Code compatibility)
app.post('/mcp', (req, res) => {
  const { id, method, params } = req.body;
  
  // Handle different MCP methods
  switch (method) {
    case 'initialize':
      res.json(createJsonRpcResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: 'mcp-ssh-server',
          version: '1.0.0'
        }
      }));
      break;
      
    case 'tools/list':
      res.json(createJsonRpcResponse(id, {
        tools: [
          {
            name: 'ssh_connect',
            description: 'Connect to a remote server via SSH',
            inputSchema: {
              type: 'object',
              properties: {
                host: { 
                  type: 'string', 
                  description: 'SSH server hostname or IP address' 
                },
                port: { 
                  type: 'number', 
                  description: 'SSH server port (default: 22)', 
                  default: 22 
                },
                username: { 
                  type: 'string', 
                  description: 'SSH username' 
                },
                password: { 
                  type: 'string', 
                  description: 'SSH password' 
                },
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
                connectionId: { 
                  type: 'string', 
                  description: 'Connection ID from ssh_connect' 
                },
                command: { 
                  type: 'string', 
                  description: 'Command to execute' 
                },
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
                connectionId: { 
                  type: 'string', 
                  description: 'Connection ID from ssh_connect' 
                },
                localPath: { 
                  type: 'string', 
                  description: 'Local file path' 
                },
                remotePath: { 
                  type: 'string', 
                  description: 'Remote file path' 
                },
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
                connectionId: { 
                  type: 'string', 
                  description: 'Connection ID from ssh_connect' 
                },
                remotePath: { 
                  type: 'string', 
                  description: 'Remote file path' 
                },
                localPath: { 
                  type: 'string', 
                  description: 'Local file path' 
                },
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
                connectionId: { 
                  type: 'string', 
                  description: 'Connection ID to disconnect' 
                },
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
        ]
      }));
      break;
      
    case 'tools/call': {
      handleToolCall(req, res, id);
      return;
    }
      
    default:
      // Default initialize response for empty requests
      res.json(createJsonRpcResponse(id || 1, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: 'mcp-ssh-server',
          version: '1.0.0'
        }
      }));
  }
});

// Handle tool calls with JSON-RPC 2.0 support
async function handleToolCall(req: express.Request, res: express.Response, id: any): Promise<void> {
  const { params } = req.body;
  const { name, arguments: args } = params || {};

  if (!name) {
    res.json(createJsonRpcResponse(id, null, {
      code: -32602,
      message: 'Invalid params',
      data: 'Tool name is required'
    }));
    return;
  }

  try {
    let content: any[] = [];

    switch (name) {
      case 'ssh_connect': {
        const { host, port = 22, username, password } = args || {};
        if (!host || !username || !password) {
          res.json(createJsonRpcResponse(id, null, {
            code: -32602,
            message: 'Invalid params',
            data: 'Host, username, and password are required'
          }));
          return;
        }
        
        const connectionId = await sshManager.connect({ host, port, username, password });
        content = [
          {
            type: 'text',
            text: `Successfully connected to ${host}:${port}. Connection ID: ${connectionId}`,
          },
        ];
        break;
      }

      case 'ssh_execute': {
        const { connectionId, command } = args || {};
        if (!connectionId || !command) {
          res.json(createJsonRpcResponse(id, null, {
            code: -32602,
            message: 'Invalid params',
            data: 'Connection ID and command are required'
          }));
          return;
        }
        
        const output = await sshManager.execute(connectionId, command);
        content = [
          {
            type: 'text',
            text: output,
          },
        ];
        break;
      }

      case 'ssh_upload': {
        const { connectionId, localPath, remotePath } = args || {};
        if (!connectionId || !localPath || !remotePath) {
          res.json(createJsonRpcResponse(id, null, {
            code: -32602,
            message: 'Invalid params',
            data: 'Connection ID, local path, and remote path are required'
          }));
          return;
        }
        
        await sshManager.upload(connectionId, localPath, remotePath);
        content = [
          {
            type: 'text',
            text: `Successfully uploaded ${localPath} to ${remotePath}`,
          },
        ];
        break;
      }

      case 'ssh_download': {
        const { connectionId, remotePath, localPath } = args || {};
        if (!connectionId || !remotePath || !localPath) {
          res.json(createJsonRpcResponse(id, null, {
            code: -32602,
            message: 'Invalid params',
            data: 'Connection ID, remote path, and local path are required'
          }));
          return;
        }
        
        await sshManager.download(connectionId, remotePath, localPath);
        content = [
          {
            type: 'text',
            text: `Successfully downloaded ${remotePath} to ${localPath}`,
          },
        ];
        break;
      }

      case 'ssh_disconnect': {
        const { connectionId } = args || {};
        if (!connectionId) {
          res.json(createJsonRpcResponse(id, null, {
            code: -32602,
            message: 'Invalid params',
            data: 'Connection ID is required'
          }));
          return;
        }
        
        await sshManager.disconnect(connectionId);
        content = [
          {
            type: 'text',
            text: `Disconnected from connection ${connectionId}`,
          },
        ];
        break;
      }

      case 'ssh_list_connections': {
        const connections = sshManager.listConnections();
        content = [
          {
            type: 'text',
            text: connections.length > 0
              ? `Active connections:\n${connections.map(c => `- ${c.id}: ${c.host}:${c.port} (${c.username})`).join('\n')}`
              : 'No active connections',
          },
        ];
        break;
      }

      default:
        res.json(createJsonRpcResponse(id, null, {
          code: -32601,
          message: 'Method not found',
          data: `Unknown tool: ${name}`
        }));
        return;
    }

    res.json(createJsonRpcResponse(id, { content }));

  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    res.json(createJsonRpcResponse(id, null, {
      code: -32603,
      message: 'Internal error',
      data: error instanceof Error ? error.message : String(error)
    }));
  }
}

// Initialize the MCP connection
app.post('/mcp/initialize', (req, res) => {
  const { protocolVersion, capabilities, clientInfo } = req.body;
  
  res.json({
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
    serverInfo: {
      name: 'mcp-ssh-server',
      version: '1.0.0'
    }
  });
});

// List available tools
app.post('/mcp/tools/list', (req, res) => {
  res.json({
    tools: [
      {
        name: 'ssh_connect',
        description: 'Connect to a remote server via SSH',
        inputSchema: {
          type: 'object',
          properties: {
            host: { 
              type: 'string', 
              description: 'SSH server hostname or IP address' 
            },
            port: { 
              type: 'number', 
              description: 'SSH server port (default: 22)', 
              default: 22 
            },
            username: { 
              type: 'string', 
              description: 'SSH username' 
            },
            password: { 
              type: 'string', 
              description: 'SSH password' 
            },
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
            connectionId: { 
              type: 'string', 
              description: 'Connection ID from ssh_connect' 
            },
            command: { 
              type: 'string', 
              description: 'Command to execute' 
            },
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
            connectionId: { 
              type: 'string', 
              description: 'Connection ID from ssh_connect' 
            },
            localPath: { 
              type: 'string', 
              description: 'Local file path' 
            },
            remotePath: { 
              type: 'string', 
              description: 'Remote file path' 
            },
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
            connectionId: { 
              type: 'string', 
              description: 'Connection ID from ssh_connect' 
            },
            remotePath: { 
              type: 'string', 
              description: 'Remote file path' 
            },
            localPath: { 
              type: 'string', 
              description: 'Local file path' 
            },
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
            connectionId: { 
              type: 'string', 
              description: 'Connection ID to disconnect' 
            },
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
  });
});

// Call a tool
app.post('/mcp/tools/call', async (req: express.Request, res: express.Response): Promise<void> => {
  const { name, arguments: args } = req.body;

  if (!name) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Tool name is required'
    });
    return;
  }

  try {
    let content: any[] = [];

    switch (name) {
      case 'ssh_connect': {
        const { host, port = 22, username, password } = args || {};
        if (!host || !username || !password) {
          res.status(400).json({
            error: 'Invalid parameters',
            message: 'Host, username, and password are required'
          });
          return;
        }
        
        const connectionId = await sshManager.connect({ host, port, username, password });
        content = [
          {
            type: 'text',
            text: `Successfully connected to ${host}:${port}. Connection ID: ${connectionId}`,
          },
        ];
        break;
      }

      case 'ssh_execute': {
        const { connectionId, command } = args || {};
        if (!connectionId || !command) {
          res.status(400).json({
            error: 'Invalid parameters',
            message: 'Connection ID and command are required'
          });
          return;
        }
        
        const output = await sshManager.execute(connectionId, command);
        content = [
          {
            type: 'text',
            text: output,
          },
        ];
        break;
      }

      case 'ssh_upload': {
        const { connectionId, localPath, remotePath } = args || {};
        if (!connectionId || !localPath || !remotePath) {
          res.status(400).json({
            error: 'Invalid parameters',
            message: 'Connection ID, local path, and remote path are required'
          });
          return;
        }
        
        await sshManager.upload(connectionId, localPath, remotePath);
        content = [
          {
            type: 'text',
            text: `Successfully uploaded ${localPath} to ${remotePath}`,
          },
        ];
        break;
      }

      case 'ssh_download': {
        const { connectionId, remotePath, localPath } = args || {};
        if (!connectionId || !remotePath || !localPath) {
          res.status(400).json({
            error: 'Invalid parameters',
            message: 'Connection ID, remote path, and local path are required'
          });
          return;
        }
        
        await sshManager.download(connectionId, remotePath, localPath);
        content = [
          {
            type: 'text',
            text: `Successfully downloaded ${remotePath} to ${localPath}`,
          },
        ];
        break;
      }

      case 'ssh_disconnect': {
        const { connectionId } = args || {};
        if (!connectionId) {
          res.status(400).json({
            error: 'Invalid parameters',
            message: 'Connection ID is required'
          });
          return;
        }
        
        await sshManager.disconnect(connectionId);
        content = [
          {
            type: 'text',
            text: `Disconnected from connection ${connectionId}`,
          },
        ];
        break;
      }

      case 'ssh_list_connections': {
        const connections = sshManager.listConnections();
        content = [
          {
            type: 'text',
            text: connections.length > 0
              ? `Active connections:\n${connections.map(c => `- ${c.id}: ${c.host}:${c.port} (${c.username})`).join('\n')}`
              : 'No active connections',
          },
        ];
        break;
      }

      default:
        res.status(400).json({
          error: 'Tool not found',
          message: `Unknown tool: ${name}`
        });
        return;
    }

    res.json({ content });

  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    res.status(500).json({
      error: 'Execution error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// List resources (empty for this server)
app.post('/mcp/resources/list', (req, res) => {
  res.json({
    resources: []
  });
});

// List prompts (empty for this server)
app.post('/mcp/prompts/list', (req, res) => {
  res.json({
    prompts: []
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint not found: ${req.method} ${req.path}`
  });
});

app.listen(PORT, () => {
  console.log(`MCP SSH HTTP Server listening on port ${PORT}`);
  console.log(`Health check: GET /health`);
  console.log(`MCP endpoints: POST /mcp/*`);
  console.log(`Authentication: Bearer ${AUTH_TOKEN}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down MCP SSH HTTP Server...');
  await sshManager.disconnectAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down MCP SSH HTTP Server...');
  await sshManager.disconnectAll();
  process.exit(0);
});