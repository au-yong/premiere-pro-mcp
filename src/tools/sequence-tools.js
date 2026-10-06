import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerSequenceTools(server) {
  server.tool(
    'list_sequences',
    'List all sequences in the project with IDs, duration, frame rates, and track counts',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('list_sequences', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'get_sequence_details',
    'Get active sequence properties (resolution width/height, frame rate, timebase, duration, in/out points, playhead)',
    {
      sequenceName: z.string().optional().describe('Optional name of sequence; defaults to currently active sequence')
    },
    async ({ sequenceName }) => {
      try {
        const result = await bridge.executeAction('get_sequence_details', { sequenceName });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'create_sequence',
    'Create a new sequence in Premiere Pro with a specified name',
    {
      name: z.string().describe('Name of the new sequence'),
      sequenceID: z.string().optional().describe('Optional unique sequence ID string')
    },
    async ({ name, sequenceID }) => {
      try {
        const result = await bridge.executeAction('create_sequence', { name, sequenceID });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'duplicate_sequence',
    'Duplicate (clone) active sequence to make a non-destructive safety backup before AI edits',
    {
      sequenceName: z.string().optional().describe('Sequence to duplicate; defaults to active sequence'),
      newName: z.string().optional().describe('Optional new name for the cloned sequence')
    },
    async ({ sequenceName, newName }) => {
      try {
        const result = await bridge.executeAction('duplicate_sequence', { sequenceName, newName });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'set_playhead_position',
    'Move the CTI (playhead) to a specific timestamp in seconds in the active sequence',
    {
      seconds: z.number().describe('Target timestamp in seconds (e.g. 12.5)')
    },
    async ({ seconds }) => {
      try {
        const result = await bridge.executeAction('set_playhead_position', { seconds });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'get_playhead_position',
    'Get current CTI (playhead) position in seconds and ticks from the active sequence',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('get_playhead_position', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'set_in_out_points',
    'Set In point and/or Out point on the active sequence for 3-point editing or exporting',
    {
      inSeconds: z.number().optional().describe('In point timestamp in seconds'),
      outSeconds: z.number().optional().describe('Out point timestamp in seconds')
    },
    async ({ inSeconds, outSeconds }) => {
      try {
        const result = await bridge.executeAction('set_in_out_points', { inSeconds, outSeconds });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'clear_in_out_points',
    'Clear Mark In and Mark Out boundaries on the active sequence',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('clear_in_out_points', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
