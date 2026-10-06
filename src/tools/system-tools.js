import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerSystemTools(server) {
  server.tool(
    'verify_connection',
    'Verify connection between MCP Server and Adobe Premiere Pro (checks WebSocket CEP bridge and macOS AppleScript fallback)',
    {},
    async () => {
      try {
        const status = await bridge.getConnectionStatus();
        return formatSuccess(status);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'execute_extendscript',
    'Execute raw arbitrary ExtendScript (.jsx) snippet directly inside Adobe Premiere Pro and return result',
    {
      jsxCode: z.string().describe('The ExtendScript code snippet to execute inside Premiere Pro DOM')
    },
    async ({ jsxCode }) => {
      try {
        const result = await bridge.executeRaw(jsxCode);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
