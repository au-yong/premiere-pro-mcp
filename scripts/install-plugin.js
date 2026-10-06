import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_NAME = 'com.premierepromcp.bridge';
const SOURCE_DIR = path.resolve(__dirname, '../premiere-plugin');

function getExtensionDir() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library/Application Support/Adobe/CEP/extensions', EXTENSION_NAME);
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData/Roaming');
    return path.join(appData, 'Adobe/CEP/extensions', EXTENSION_NAME);
  } else {
    throw new Error('Unsupported platform for Adobe Premiere CEP extension installation');
  }
}

function enablePlayerDebugMode() {
  console.log('Enabling Adobe CEP PlayerDebugMode...');
  if (process.platform === 'darwin') {
    const versions = [9, 10, 11, 12, 13, 14, 15, 16];
    for (const v of versions) {
      try {
        execSync(`defaults write com.adobe.CSXS.${v} PlayerDebugMode 1`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore individual failures
      }
    }
    console.log('✅ Enabled PlayerDebugMode on macOS');
  } else if (process.platform === 'win32') {
    const versions = [9, 10, 11, 12, 13, 14, 15, 16];
    for (const v of versions) {
      try {
        execSync(`reg add "HKCU\\Software\\Adobe\\CSXS.${v}" /v PlayerDebugMode /t REG_SZ /d "1" /f`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore individual failures
      }
    }
    console.log('✅ Enabled PlayerDebugMode on Windows');
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function install() {
  console.log('=== Installing Premiere Pro MCP Bridge Extension ===');
  const targetDir = getExtensionDir();

  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Target: ${targetDir}`);

  // Create parent dir
  const parentDir = path.dirname(targetDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Remove existing if present
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  // Copy files
  copyRecursive(SOURCE_DIR, targetDir);
  console.log('✅ Copied extension files to Adobe CEP directory');

  // Enable debug mode
  enablePlayerDebugMode();

  console.log('\n🎉 Installation Complete!');
  console.log('Next steps:');
  console.log('1. Launch or restart Adobe Premiere Pro.');
  console.log('2. In the top menu, go to: Window > Extensions > Premiere Pro MCP Bridge');
  console.log('3. Ensure the panel displays "Connected" to ws://127.0.0.1:9098');
}

try {
  install();
} catch (err) {
  console.error('❌ Installation failed:', err.message);
  process.exit(1);
}
