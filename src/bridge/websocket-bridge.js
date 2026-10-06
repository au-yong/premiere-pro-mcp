import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config.js';

export class WebSocketBridge extends EventEmitter {
  constructor(port = config.PORT, host = config.HOST) {
    super();
    this.port = port;
    this.host = host;
    this.wss = null;
    this.clients = new Set();
    this.pendingRequests = new Map(); // id -> { resolve, reject, timer }
    this.requestCounter = 0;
  }

  /**
   * Starts the WebSocket server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port, host: this.host }, () => {
          console.error(`[PremiereBridge] WebSocket server listening on ws://${this.host}:${this.port}`);
          resolve();
        });

        this.wss.on('connection', (ws, req) => {
          const clientIp = req.socket.remoteAddress;
          console.error(`[PremiereBridge] Client connected from ${clientIp}`);
          this.clients.add(ws);
          this.emit('clientConnected', { ip: clientIp });

          ws.isAlive = true;
          ws.on('pong', () => {
            ws.isAlive = true;
          });

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString());
              this.handleIncomingMessage(msg, ws);
            } catch (err) {
              console.error('[PremiereBridge] Failed to parse client message:', err.message);
            }
          });

          ws.on('close', () => {
            console.error('[PremiereBridge] Client disconnected');
            this.clients.delete(ws);
            this.emit('clientDisconnected');
          });

          ws.on('error', (err) => {
            console.error('[PremiereBridge] Client socket error:', err.message);
          });
        });

        this.wss.on('error', (err) => {
          console.error('[PremiereBridge] WebSocket Server error:', err.message);
          reject(err);
        });

        // Periodic heartbeat ping to prune stale connections
        this.heartbeatTimer = setInterval(() => {
          for (const ws of this.clients) {
            if (ws.isAlive === false) {
              ws.terminate();
              this.clients.delete(ws);
              continue;
            }
            ws.isAlive = false;
            ws.ping();
          }
        }, 15000);

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handles messages returned from Premiere Pro CEP panel
   */
  handleIncomingMessage(msg, ws) {
    const { id, status, result, error, type, info } = msg;

    if (type === 'handshake') {
      console.error(`[PremiereBridge] Handshake received: ${JSON.stringify(info || {})}`);
      ws.clientInfo = info;
      this.emit('handshake', info);
      return;
    }

    if (!id || !this.pendingRequests.has(id)) {
      return;
    }

    const { resolve, reject, timer } = this.pendingRequests.get(id);
    clearTimeout(timer);
    this.pendingRequests.delete(id);

    if (status === 'success' || !error) {
      resolve(result);
    } else {
      reject(new Error(error || 'ExtendScript execution failed'));
    }
  }

  /**
   * Checks if Premiere Pro plugin is connected
   */
  isConnected() {
    return this.clients.size > 0;
  }

  /**
   * Returns details of connected Premiere Pro clients
   */
  getClientInfo() {
    const clients = [];
    for (const ws of this.clients) {
      clients.push(ws.clientInfo || { connected: true });
    }
    return clients;
  }

  /**
   * Executes an action with structured parameters via the connected CEP panel
   * @param {string} action - action name matching hostscript function
   * @param {object} params - arguments
   * @param {number} timeoutMs - execution timeout
   */
  async executeAction(action, params = {}, timeoutMs = config.EXEC_TIMEOUT_MS) {
    if (!this.isConnected()) {
      throw new Error('No Premiere Pro CEP/UXP client connected to WebSocket bridge.');
    }

    const id = `req_${Date.now()}_${++this.requestCounter}`;
    const payload = JSON.stringify({
      id,
      type: 'action',
      action,
      params
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Execution timed out after ${timeoutMs}ms for action: ${action}`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      // Send to the first active client
      const client = this.clients.values().next().value;
      if (client && client.readyState === 1) { // 1 = OPEN
        client.send(payload);
      } else {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new Error('WebSocket client is not in OPEN state.'));
      }
    });
  }

  /**
   * Executes raw ExtendScript string on the connected CEP panel
   * @param {string} jsxCode 
   * @param {number} timeoutMs 
   */
  async executeRaw(jsxCode, timeoutMs = config.EXEC_TIMEOUT_MS) {
    if (!this.isConnected()) {
      throw new Error('No Premiere Pro CEP/UXP client connected to WebSocket bridge.');
    }

    const id = `req_${Date.now()}_${++this.requestCounter}`;
    const payload = JSON.stringify({
      id,
      type: 'raw',
      jsx: jsxCode
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Raw ExtendScript execution timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const client = this.clients.values().next().value;
      if (client && client.readyState === 1) {
        client.send(payload);
      } else {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new Error('WebSocket client is not in OPEN state.'));
      }
    });
  }

  /**
   * Closes the server and terminates client connections
   */
  async close() {
    clearInterval(this.heartbeatTimer);
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
      req.reject(new Error('Bridge server shutting down'));
    }
    this.pendingRequests.clear();

    for (const ws of this.clients) {
      ws.terminate();
    }
    this.clients.clear();

    if (this.wss) {
      return new Promise((resolve) => {
        this.wss.close(() => resolve());
      });
    }
  }
}

export const wsBridge = new WebSocketBridge();
export default wsBridge;
