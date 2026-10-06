import { wsBridge } from './websocket-bridge.js';
import { appleScriptBridge } from './applescript-bridge.js';
import { buildExtendScript } from './extendscript-templates.js';
import { config } from '../config.js';

export class BridgeManager {
  constructor() {
    this.wsBridge = wsBridge;
    this.appleScriptBridge = appleScriptBridge;
  }

  /**
   * Initializes the bridge servers
   */
  async start() {
    await this.wsBridge.start();
  }

  /**
   * Checks current connection status and strategy
   */
  async getConnectionStatus() {
    if (this.wsBridge.isConnected()) {
      return {
        connected: true,
        mode: 'websocket',
        clients: this.wsBridge.getClientInfo()
      };
    }

    if (config.ENABLE_APPLESCRIPT_FALLBACK && process.platform === 'darwin') {
      try {
        const appName = await this.appleScriptBridge.getRunningAppName();
        return {
          connected: true,
          mode: 'applescript',
          targetApplication: appName,
          note: 'Direct macOS AppleScript execution (zero plugin required)'
        };
      } catch (err) {
        return {
          connected: false,
          mode: 'none',
          error: err.message
        };
      }
    }

    return {
      connected: false,
      mode: 'none',
      instructions: `Please open Adobe Premiere Pro and launch the 'Premiere Pro MCP Bridge' CEP panel (Window > Extensions > Premiere Pro MCP Bridge), or ensure the bridge is listening on ws://${config.HOST}:${config.PORT}.`
    };
  }

  /**
   * Executes an action via the best available bridge
   * @param {string} action 
   * @param {object} params 
   */
  async executeAction(action, params = {}) {
    // 1. Try WebSocket connection first (Fastest & two-way)
    if (this.wsBridge.isConnected()) {
      return await this.wsBridge.executeAction(action, params);
    }

    // 2. Try macOS AppleScript fallback if enabled
    if (config.ENABLE_APPLESCRIPT_FALLBACK && process.platform === 'darwin') {
      const jsxCode = buildExtendScript(action, params);
      return await this.appleScriptBridge.execute(jsxCode);
    }

    // 3. Neither available
    throw new Error(
      `Premiere Pro is not connected.\n\n` +
      `To connect:\n` +
      `1. Open Adobe Premiere Pro.\n` +
      `2. Open the 'Premiere Pro MCP Bridge' extension from Window > Extensions > Premiere Pro MCP Bridge.\n` +
      `3. Verify it connects to ws://${config.HOST}:${config.PORT}.\n\n` +
      `Tip: On macOS, you can also enable AppleScript fallback by setting ENABLE_APPLESCRIPT_FALLBACK=true in .env.`
    );
  }

  /**
   * Executes raw ExtendScript code
   * @param {string} jsxCode 
   */
  async executeRaw(jsxCode) {
    if (this.wsBridge.isConnected()) {
      return await this.wsBridge.executeRaw(jsxCode);
    }

    if (config.ENABLE_APPLESCRIPT_FALLBACK && process.platform === 'darwin') {
      return await this.appleScriptBridge.execute(jsxCode);
    }

    throw new Error('Premiere Pro is not connected to execute ExtendScript.');
  }

  /**
   * Closes the bridge
   */
  async close() {
    await this.wsBridge.close();
  }
}

export const bridge = new BridgeManager();
export default bridge;
