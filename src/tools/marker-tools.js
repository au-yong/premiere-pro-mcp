import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerMarkerTools(server) {
  server.tool(
    'list_markers',
    'List all markers in the active sequence with timestamps, names, comments, and color index',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('list_markers', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'add_marker',
    'Add a marker at a specific timestamp in the sequence (useful for AI cut notes, beat matching, chapter points)',
    {
      timeSeconds: z.number().optional().describe('Marker timestamp in seconds; defaults to current playhead'),
      name: z.string().optional().describe('Marker title / name'),
      comments: z.string().optional().describe('Marker comments or AI notes'),
      durationSeconds: z.number().optional().describe('Duration of marker span in seconds (0 for single frame point)'),
      colorIndex: z.number().optional().describe('Marker color index (0 to 7)')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('add_marker', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'delete_marker',
    'Delete a marker by name or near timestamp in the active sequence',
    {
      name: z.string().optional().describe('Name of marker to remove'),
      timeSeconds: z.number().optional().describe('Timestamp in seconds of marker to remove')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('delete_marker', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
