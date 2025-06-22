#!/usr/bin/env node

/**
 * Test script for MCP SSH Server
 * Tests all MCP HTTP endpoints according to the protocol
 */

const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || 'MCPhahaha_2025';
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${SERVER_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  // Add auth header for MCP endpoints
  if (endpoint.startsWith('/mcp')) {
    options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function test(description, testFn) {
  process.stdout.write(`${description}... `);
  try {
    const result = await testFn();
    if (result) {
      console.log('✅ PASS');
      return true;
    } else {
      console.log('❌ FAIL');
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing MCP SSH Server\n');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Auth: Bearer ${AUTH_TOKEN.substring(0, 8)}...\n`);

  let passed = 0;
  let total = 0;

  // Test 1: Health check
  total++;
  if (await test('Health check endpoint', async () => {
    const result = await makeRequest('/health');
    return result.ok && result.data.status === 'healthy';
  })) passed++;

  // Test 2: MCP Initialize
  total++;
  if (await test('MCP initialize endpoint', async () => {
    const result = await makeRequest('/mcp/initialize', 'POST', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });
    return result.ok && result.data.protocolVersion && result.data.serverInfo;
  })) passed++;

  // Test 3: List tools
  total++;
  if (await test('MCP tools list endpoint', async () => {
    const result = await makeRequest('/mcp/tools/list', 'POST', {});
    return result.ok && Array.isArray(result.data.tools) && result.data.tools.length > 0;
  })) passed++;

  // Test 4: List resources
  total++;
  if (await test('MCP resources list endpoint', async () => {
    const result = await makeRequest('/mcp/resources/list', 'POST', {});
    return result.ok && Array.isArray(result.data.resources);
  })) passed++;

  // Test 5: List prompts
  total++;
  if (await test('MCP prompts list endpoint', async () => {
    const result = await makeRequest('/mcp/prompts/list', 'POST', {});
    return result.ok && Array.isArray(result.data.prompts);
  })) passed++;

  // Test 6: Tool call - list connections
  total++;
  if (await test('SSH list connections tool', async () => {
    const result = await makeRequest('/mcp/tools/call', 'POST', {
      name: 'ssh_list_connections',
      arguments: {}
    });
    return result.ok && Array.isArray(result.data.content);
  })) passed++;

  // Test 7: Tool call - invalid tool
  total++;
  if (await test('Invalid tool rejection', async () => {
    const result = await makeRequest('/mcp/tools/call', 'POST', {
      name: 'invalid_tool',
      arguments: {}
    });
    return !result.ok && result.status === 400;
  })) passed++;

  // Test 8: Authentication rejection
  total++;
  if (await test('Authentication rejection', async () => {
    const url = `${SERVER_URL}/mcp/tools/list`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return response.status === 401;
  })) passed++;

  // Test 9: Invalid endpoint
  total++;
  if (await test('404 for invalid endpoints', async () => {
    const result = await makeRequest('/invalid/endpoint');
    return result.status === 404;
  })) passed++;

  // Test 10: Check tool schemas
  total++;
  if (await test('Tool schemas validation', async () => {
    const result = await makeRequest('/mcp/tools/list', 'POST', {});
    if (!result.ok) return false;
    
    const tools = result.data.tools;
    const requiredTools = ['ssh_connect', 'ssh_execute', 'ssh_upload', 'ssh_download', 'ssh_disconnect', 'ssh_list_connections'];
    
    for (const toolName of requiredTools) {
      const tool = tools.find(t => t.name === toolName);
      if (!tool || !tool.inputSchema || !tool.description) {
        return false;
      }
    }
    return true;
  })) passed++;

  console.log('\n📊 Test Results');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! MCP server is working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the server configuration.');
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This test requires Node.js 18+ with built-in fetch support');
  process.exit(1);
}

runTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error.message);
  process.exit(1);
});