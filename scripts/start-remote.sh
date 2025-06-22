#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if required environment variables are set
if [ -z "$MCP_AUTH_TOKEN" ]; then
    echo "ERROR: MCP_AUTH_TOKEN is not set"
    echo "Please create a .env file with:"
    echo "  MCP_PORT=3000"
    echo "  MCP_AUTH_TOKEN=your-secure-token"
    exit 1
fi

# Default port if not set
if [ -z "$MCP_PORT" ]; then
    export MCP_PORT=3000
fi

echo "Starting MCP SSH Server on port $MCP_PORT..."
node dist/remote-server.js