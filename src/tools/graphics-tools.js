import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerGraphicsTools(server) {
  server.tool(
    'import_mogrt',
    'Import a Motion Graphics Template (.mogrt) file onto the sequence timeline at a given timestamp',
    {
      mogrtPath: z.string().describe('Absolute file path to the .mogrt template file'),
      timeSeconds: z.number().optional().describe('Timeline timestamp in seconds; defaults to current playhead'),
      videoTrackIndex: z.number().default(1).describe('Target video track index (e.g. 1 for V2)'),
      audioTrackIndex: z.number().default(0).describe('Target audio track index (e.g. 0 for A1)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('import_mogrt', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'update_mogrt_text',
    'Programmatically inject AI-generated title text, speaker name, or lower-third into an Essential Graphics / MOGRT clip',
    {
      trackIndex: z.number().default(0).describe('Video track index where the MOGRT clip is placed'),
      clipIndex: z.number().default(0).describe('Clip index on track'),
      textValue: z.string().describe('New text content to display in the graphic'),
      propertyName: z.string().optional().describe('Specific text property name (e.g. "Title", "Subtitle", "Text")')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('update_mogrt_text', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
