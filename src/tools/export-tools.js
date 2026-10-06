import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerExportTools(server) {
  server.tool(
    'export_sequence_direct',
    'Render and export the active sequence directly to a file using an Adobe Media Encoder preset (.epr)',
    {
      outputPath: z.string().describe('Absolute destination file path (e.g. "/path/to/output.mp4")'),
      presetPath: z.string().optional().describe('Absolute path to .epr preset file; uses default if omitted'),
      workAreaType: z.number().default(0).describe('0 = Entire Sequence, 1 = In to Out Mark points')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('export_sequence_direct', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'queue_to_media_encoder',
    'Queue the active sequence to Adobe Media Encoder (AME) for background batch rendering',
    {
      outputPath: z.string().describe('Absolute destination file path for rendered output'),
      presetPath: z.string().optional().describe('Optional path to .epr preset file')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('queue_to_media_encoder', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
