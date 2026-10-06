import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerAudioTools(server) {
  server.tool(
    'set_clip_volume',
    'Set Volume audio level for a clip on an audio track',
    {
      trackIndex: z.number().default(0).describe('Audio track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)'),
      volumeLevel: z.number().describe('Volume level value (e.g. 1.0 for unity/0dB, 0.5 for -6dB, 0.0 for mute)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('set_clip_volume', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
