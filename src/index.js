#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { bridge } from './bridge/bridge-manager.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { config } from './config.js';

async function main() {
  console.error('[PremiereProMCP] Initializing Premiere Pro MCP Server...');

  // 1. Initialize WebSocket Bridge Server
  try {
    await bridge.start();
    console.error(`[PremiereProMCP] Bridge ready on ws://${config.HOST}:${config.PORT}`);
  } catch (err) {
    console.error('[PremiereProMCP] Warning: Failed to start WebSocket bridge:', err.message);
  }

  // 2. Create MCP Server
  const server = new McpServer({
    name: 'premiere-pro-mcp',
    version: '1.0.0'
  });

  // 3. Register Tools and Resources
  registerAllTools(server);
  registerAllResources(server);
  console.error('[PremiereProMCP] Registered all Premiere Pro tools and resources');

  // 4. Connect Transport (stdio)
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PremiereProMCP] Connected to stdio transport. Listening for AI assistant requests...');

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[PremiereProMCP] Shutting down...');
    await bridge.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[PremiereProMCP] Fatal error:', err);
  process.exit(1);
});
