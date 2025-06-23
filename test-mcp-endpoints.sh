#!/bin/bash

# MCP Server Test Script
# Tests all MCP endpoints for Claude Code compatibility

SERVER_URL="http://43.142.85.8:3000"
AUTH_TOKEN="MCPhahaha_2025"

echo "=== MCP Server Endpoint Tests ==="
echo "Server: $SERVER_URL"
echo "Token: $AUTH_TOKEN"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$SERVER_URL/health" | jq .
echo ""

# Test base /mcp endpoint (Claude Code compatibility)
echo "2. Testing /mcp base endpoint (Claude Code compatibility)..."
curl -s -X POST "$SERVER_URL/mcp" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# Test /mcp/initialize endpoint
echo "3. Testing /mcp/initialize endpoint..."
curl -s -X POST "$SERVER_URL/mcp/initialize" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }' | jq .
echo ""

# Test /mcp/tools/list endpoint
echo "4. Testing /mcp/tools/list endpoint..."
curl -s -X POST "$SERVER_URL/mcp/tools/list" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# Test /mcp/resources/list endpoint
echo "5. Testing /mcp/resources/list endpoint..."
curl -s -X POST "$SERVER_URL/mcp/resources/list" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# Test /mcp/prompts/list endpoint
echo "6. Testing /mcp/prompts/list endpoint..."
curl -s -X POST "$SERVER_URL/mcp/prompts/list" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# Test authentication failure
echo "7. Testing authentication failure..."
curl -s -X POST "$SERVER_URL/mcp/tools/list" \
  -H "Authorization: Bearer wrong_token" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

echo "=== Test Complete ==="