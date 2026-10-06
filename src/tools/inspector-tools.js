import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerInspectorTools(server) {
  server.tool(
    'set_clip_transform',
    'Set Motion transform properties (Position, Scale, Scale Width, Rotation, Anchor Point) for a video clip',
    {
      trackIndex: z.number().default(0).describe('Video track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)'),
      position: z.array(z.number()).length(2).optional().describe('Position [X, Y] in pixels (e.g. [960, 540])'),
      scale: z.number().optional().describe('Scale percentage (e.g. 100 or 120 for zoom)'),
      scaleWidth: z.number().optional().describe('Scale width percentage if uniform scale is unchecked'),
      rotation: z.number().optional().describe('Rotation in degrees'),
      anchorPoint: z.array(z.number()).length(2).optional().describe('Anchor point [X, Y]')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('set_clip_transform', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'set_clip_opacity',
    'Set Opacity percentage for a video clip on the timeline',
    {
      trackIndex: z.number().default(0).describe('Video track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)'),
      opacity: z.number().min(0).max(100).describe('Opacity value (0 to 100)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('set_clip_opacity', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'add_keyframe',
    'Add an animated keyframe at a specific timestamp for a component parameter (e.g. Motion Position or Scale)',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().default(0).describe('Track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)'),
      componentName: z.string().describe('Name of the component (e.g. "Motion", "Opacity", "Volume")'),
      propertyName: z.string().describe('Property name (e.g. "Position", "Scale", "Rotation", "Level")'),
      timeSeconds: z.number().optional().describe('Timestamp in seconds; defaults to current playhead'),
      value: z.any().describe('Keyframe value (number, array for position, or boolean)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('add_keyframe', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
