#!/usr/bin/env node
import WebSocket from 'ws';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import * as readline from 'readline';

const REMOTE_URL = process.env.MCP_REMOTE_URL || 'ws://localhost:3000';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

if (!AUTH_TOKEN) {
  console.error('ERROR: MCP_AUTH_TOKEN environment variable must be set');
  process.exit(1);
}

// Setup stdin/stdout for communication with Claude Desktop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// Connect to remote MCP server
const ws = new WebSocket(REMOTE_URL, {
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

ws.on('open', () => {
  console.error(`Connected to remote MCP server at ${REMOTE_URL}`);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.error(`WebSocket closed: ${code} ${reason}`);
  process.exit(0);
});

// Forward messages from remote server to Claude Desktop (stdout)
ws.on('message', (data: Buffer) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(JSON.stringify(message));
  } catch (error) {
    console.error('Failed to parse message from server:', error);
  }
});

// Forward messages from Claude Desktop (stdin) to remote server
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line) as JSONRPCMessage;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not open, cannot send message');
    }
  } catch (error) {
    console.error('Failed to parse message from stdin:', error);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ws.close();
  process.exit(0);
});