import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  PORT: parseInt(process.env.PORT || '9098', 10),
  HOST: process.env.HOST || '127.0.0.1',
  PREMIERE_APP_NAME: process.env.PREMIERE_APP_NAME || 'Adobe Premiere Pro 2025',
  ENABLE_APPLESCRIPT_FALLBACK: process.env.ENABLE_APPLESCRIPT_FALLBACK !== 'false' && process.platform === 'darwin',
  EXEC_TIMEOUT_MS: parseInt(process.env.EXEC_TIMEOUT_MS || '25000', 10),
  TICKS_PER_SECOND: 254016000000,
  DEBUG: process.env.DEBUG === 'true'
};

export default config;
