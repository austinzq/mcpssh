// Test script to verify MCP server starts correctly
const { spawn } = require('child_process');

console.log('Starting MCP SSH Server...');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Wait for response
setTimeout(() => {
  console.log('\nSending list tools request...');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Give some time for response then exit
  setTimeout(() => {
    console.log('\nTest completed. Shutting down server...');
    server.kill();
    process.exit(0);
  }, 2000);
}, 1000);