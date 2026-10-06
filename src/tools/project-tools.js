import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerProjectTools(server) {
  server.tool(
    'get_project_info',
    'Get active Adobe Premiere Pro project information, path, sequences count, and active sequence summary',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('get_project_info', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'save_project',
    'Save the currently active Adobe Premiere Pro project',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('save_project', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'save_as_project',
    'Save the project to a new file path (e.g. For version backups before major automated edits)',
    {
      filePath: z.string().describe('Absolute file path for the new project file (.prproj)')
    },
    async ({ filePath }) => {
      try {
        const result = await bridge.executeAction('save_as_project', { filePath });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'list_bins',
    'Get full tree of bins, folders, and media items in the Premiere Pro Project Panel',
    {},
    async () => {
      try {
        const result = await bridge.executeAction('list_bins', {});
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'create_bin',
    'Create a new organizational bin (folder) in the Project Panel',
    {
      name: z.string().describe('Name of the new bin to create'),
      parentPath: z.string().optional().describe('Optional parent bin path (e.g. "Footage/B-Roll"), defaults to root')
    },
    async ({ name, parentPath }) => {
      try {
        const result = await bridge.executeAction('create_bin', { name, parentPath });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'delete_bin',
    'Delete a bin or project item from the Project Panel by name or nodeId',
    {
      name: z.string().optional().describe('Name of the bin or item to delete'),
      nodeId: z.string().optional().describe('Node ID of the item to delete')
    },
    async ({ name, nodeId }) => {
      try {
        const result = await bridge.executeAction('delete_bin', { name, nodeId });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'import_media',
    'Import video, audio, image files, or folder contents into a specific bin in Premiere Pro',
    {
      filePaths: z.array(z.string()).describe('List of absolute file paths to import'),
      targetBinPath: z.string().optional().describe('Optional target bin path to place items in (e.g. "Raw Footage")')
    },
    async ({ filePaths, targetBinPath }) => {
      try {
        const result = await bridge.executeAction('import_media', { filePaths, targetBinPath });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'relink_media',
    'Relink offline media or swap footage placeholder with a new media file',
    {
      clipName: z.string().optional().describe('Name of the clip in the project'),
      nodeId: z.string().optional().describe('Node ID of the project item'),
      newMediaPath: z.string().describe('Absolute file path of the replacement media file')
    },
    async ({ clipName, nodeId, newMediaPath }) => {
      try {
        const result = await bridge.executeAction('relink_media', { clipName, nodeId, newMediaPath });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'get_clip_metadata',
    'Get metadata, media file path, color label, and XMP metadata for a clip in the project',
    {
      clipName: z.string().optional().describe('Name of the clip'),
      nodeId: z.string().optional().describe('Node ID of the clip')
    },
    async ({ clipName, nodeId }) => {
      try {
        const result = await bridge.executeAction('get_clip_metadata', { clipName, nodeId });
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'set_clip_metadata',
    'Update clip name, color label index, or XMP metadata',
    {
      clipName: z.string().optional().describe('Name of the clip to update'),
      nodeId: z.string().optional().describe('Node ID of the clip'),
      name: z.string().optional().describe('New name for the clip'),
      colorLabel: z.number().optional().describe('Color label index (0 to 15) in Premiere Pro'),
      xmpMetadata: z.string().optional().describe('Updated XMP metadata string')
    },
    async (params) => {
      try {
        const result = await bridge.executeAction('set_clip_metadata', params);
        return formatSuccess(result);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
