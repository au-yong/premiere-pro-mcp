import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';
import { wrapExtendScript } from './extendscript-helpers.js';

const execFileAsync = promisify(execFile);

export class AppleScriptBridge {
  constructor(appName = config.PREMIERE_APP_NAME) {
    this.appName = appName;
    this.resolvedAppName = null;
  }

  /**
   * Discovers the running Adobe Premiere Pro application name on macOS
   */
  async getRunningAppName() {
    if (this.resolvedAppName) {
      return this.resolvedAppName;
    }

    if (process.platform !== 'darwin') {
      return null;
    }

    // Try user specified name first
    try {
      const script = `
tell application "System Events"
  set procNames to name of every process whose name contains "Premiere Pro"
  if (count of procNames) > 0 then
    return item 1 of procNames
  else
    return ""
  end if
end tell`;
      const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 3000 });
      const name = stdout.trim();
      if (name) {
        this.resolvedAppName = name;
        return name;
      }
    } catch {
      // System Events permissions might not be granted, fall back to configured name
    }

    this.resolvedAppName = this.appName;
    return this.appName;
  }

  /**
   * Executes ExtendScript inside Premiere Pro via AppleScript `do script`
   * @param {string} jsxCode 
   * @param {number} timeoutMs 
   */
  async execute(jsxCode, timeoutMs = config.EXEC_TIMEOUT_MS) {
    if (process.platform !== 'darwin') {
      throw new Error('AppleScript bridge is only supported on macOS');
    }

    const targetApp = await this.getRunningAppName();
    const wrappedJsx = wrapExtendScript(jsxCode);

    // Escape for AppleScript string literals
    const escapedJsx = wrappedJsx
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    const appleScript = `tell application "${targetApp}" to do script "${escapedJsx}"`;

    try {
      const { stdout, stderr } = await execFileAsync('osascript', ['-e', appleScript], {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stderr && stderr.trim().length > 0) {
        console.error(`[AppleScriptBridge] Stderr: ${stderr}`);
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        return { status: 'success', data: null };
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.status === 'error') {
          throw new Error(parsed.error || 'ExtendScript execution failed');
        }
        return parsed.result !== undefined ? parsed.result : parsed;
      } catch (parseErr) {
        // If not JSON, return as raw string
        if (trimmed.startsWith('Error:')) {
          throw new Error(trimmed);
        }
        return trimmed;
      }
    } catch (err) {
      if (err.killed || err.signal === 'SIGTERM') {
        throw new Error(`ExtendScript execution timed out after ${timeoutMs}ms via AppleScript`);
      }
      throw new Error(`AppleScript execution error: ${err.message}`);
    }
  }
}

export const appleScriptBridge = new AppleScriptBridge();
export default appleScriptBridge;
