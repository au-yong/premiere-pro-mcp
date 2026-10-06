import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerEffectsTools(server) {
  server.tool(
    'list_clip_effects',
    'List all applied components and effects on a timeline clip with current parameter values',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().default(0).describe('Track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('list_clip_effects', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'adjust_effect_parameter',
    'Adjust a specific effect parameter on a clip (e.g. Gaussian Blur Blurriness, Crop Left)',
    {
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().default(0).describe('Track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)'),
      effectName: z.string().describe('Name of the applied effect/component (e.g. "Gaussian Blur", "Crop")'),
      parameterName: z.string().describe('Parameter name to modify (e.g. "Blurriness", "Left")'),
      value: z.any().describe('New value to set')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('adjust_effect_parameter', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'apply_lumetri_grade',
    'Adjust Lumetri Color grading parameters on a video clip (Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Saturation, Temperature, Tint)',
    {
      trackIndex: z.number().default(0).describe('Video track index (0-based)'),
      clipIndex: z.number().default(0).describe('Clip index on track (0-based)'),
      exposure: z.number().optional().describe('Exposure adjustment (-5.0 to 5.0)'),
      contrast: z.number().optional().describe('Contrast adjustment (-100 to 100)'),
      highlights: z.number().optional().describe('Highlights adjustment (-100 to 100)'),
      shadows: z.number().optional().describe('Shadows adjustment (-100 to 100)'),
      whites: z.number().optional().describe('Whites adjustment (-100 to 100)'),
      blacks: z.number().optional().describe('Blacks adjustment (-100 to 100)'),
      saturation: z.number().optional().describe('Saturation percentage (0 to 200, 100 is default)'),
      temperature: z.number().optional().describe('White Balance Temperature (-100 to 100)'),
      tint: z.number().optional().describe('White Balance Tint (-100 to 100)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('apply_lumetri_grade', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
