import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerEditingTools(server) {
  server.tool(
    'list_timeline_clips',
    'List all clips on video (V1, V2...) and audio (A1, A2...) tracks of active sequence with start/end timestamps and media paths',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('list_timeline_clips', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'insert_clip',
    'Insert a project item onto timeline at a specific timestamp (ripple edit, shifts subsequent clips forward)',
    {
      clipName: z.string().optional().describe('Name of the clip in the project'),
      nodeId: z.string().optional().describe('Node ID of the clip in the project'),
      trackType: z.enum(['video', 'audio']).default('video').describe('Track type ("video" or "audio")'),
      trackIndex: z.number().default(0).describe('0-indexed track number (e.g. 0 for V1 or A1)'),
      timeSeconds: z.number().optional().describe('Insertion time in seconds; defaults to current playhead')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('insert_clip', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'overwrite_clip',
    'Place a project item onto timeline overwriting existing content at timestamp',
    {
      clipName: z.string().optional().describe('Name of the clip in the project'),
      nodeId: z.string().optional().describe('Node ID of the clip in the project'),
      trackType: z.enum(['video', 'audio']).default('video').describe('Track type ("video" or "audio")'),
      trackIndex: z.number().default(0).describe('0-indexed track number (0 for V1, 1 for V2)'),
      timeSeconds: z.number().optional().describe('Placement time in seconds; defaults to current playhead')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('overwrite_clip', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'razor_clip',
    'Split (cut/razor) a clip on a track at a specific timestamp using Premiere QE DOM',
    {
      timeSeconds: z.number().describe('Timestamp in seconds where the razor cut should happen'),
      trackType: z.enum(['video', 'audio']).default('video').describe('Track type ("video" or "audio")'),
      trackIndex: z.number().default(0).describe('0-indexed track number (e.g. 0 for V1)'),
      timeCode: z.string().optional().describe('Optional explicit timecode string (e.g. "00:01:23:12")')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('razor_clip', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'trim_clip',
    'Trim clip boundaries (start, end, inPoint, outPoint) on the timeline',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().describe('Track index (0-based)'),
      clipIndex: z.number().describe('Clip index on the track (0-based)'),
      startSeconds: z.number().optional().describe('New timeline start timestamp in seconds'),
      endSeconds: z.number().optional().describe('New timeline end timestamp in seconds'),
      inSeconds: z.number().optional().describe('New source In point in seconds'),
      outSeconds: z.number().optional().describe('New source Out point in seconds')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('trim_clip', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'delete_clip',
    'Delete a clip from the timeline (optionally ripple delete to close the gap)',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().describe('Track index (0-based)'),
      clipIndex: z.number().describe('Clip index on track (0-based)'),
      rippleDelete: z.boolean().default(false).describe('Set to true to ripple delete and pull forward subsequent footage')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('delete_clip', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'enable_disable_clip',
    'Enable or disable (mute/hide) a clip on the active sequence timeline',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().describe('Track index (0-based)'),
      clipIndex: z.number().describe('Clip index on track (0-based)'),
      enabled: z.boolean().optional().describe('true to enable, false to disable; toggles if omitted')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('enable_disable_clip', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'track_management',
    'Control timeline tracks (mute/solo audio tracks, lock/unlock tracks)',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().describe('Track index (0-based)'),
      locked: z.boolean().optional().describe('Lock (true) or unlock (false) track'),
      muted: z.boolean().optional().describe('Mute (true) or unmute (false) audio track'),
      solo: z.boolean().optional().describe('Solo (true) audio track')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('track_management', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
