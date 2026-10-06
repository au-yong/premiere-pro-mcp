import { z } from 'zod';
import { bridge } from '../bridge/bridge-manager.js';
import { formatSuccess, formatError } from './utils.js';

export function registerCompoundTools(server) {
  server.tool(
    'generate_youtube_chapters',
    'Batch generate timeline markers matching YouTube chapters (e.g. from an AI transcript summary)',
    {
      chapters: z.array(
        z.object({
          timestampSeconds: z.number().describe('Timestamp in seconds for the chapter start'),
          title: z.string().describe('Chapter title'),
          description: z.string().optional().describe('Optional chapter notes or description')
        })
      ).describe('List of chapters with timestamps and titles')
    },
    async ({ chapters }) => {
      try {
        const results = [];
        for (const chap of chapters) {
          const res = await bridge.executeAction('add_marker', {
            timeSeconds: chap.timestampSeconds,
            name: chap.title,
            comments: chap.description || `Chapter: ${chap.title}`,
            colorIndex: 1 // Green
          });
          results.push(res);
        }
        return formatSuccess({
          success: true,
          chaptersCreated: results.length,
          chapters: results
        });
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'batch_razor_cuts',
    'Perform multiple razor cuts across timeline at specified silence or cut timestamps (auto-silence / jump-cutter helper)',
    {
      timestampsSeconds: z.array(z.number()).describe('List of timestamps in seconds where cuts should be made'),
      trackType: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().default(0)
    },
    async ({ timestampsSeconds, trackType, trackIndex }) => {
      try {
        const sorted = [...timestampsSeconds].sort((a, b) => a - b);
        const cutsMade = [];
        for (const t of sorted) {
          const res = await bridge.executeAction('razor_clip', {
            timeSeconds: t,
            trackType,
            trackIndex
          });
          cutsMade.push({ timeSeconds: t, status: 'cut', result: res });
        }
        return formatSuccess({
          success: true,
          cutsCount: cutsMade.length,
          cuts: cutsMade
        });
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    'reformat_aspect_ratio',
    'Duplicate active sequence and create a reformatted version (e.g. 9:16 vertical for Shorts/TikTok/Reels or 1:1 square)',
    {
      aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16').describe('Target aspect ratio'),
      nameSuffix: z.string().optional().describe('Suffix for the new sequence name (e.g. "Vertical_Reel")')
    },
    async ({ aspectRatio, nameSuffix }) => {
      try {
        const suffix = nameSuffix || `_${aspectRatio.replace(':', 'x')}`;
        // 1. Get active sequence info
        const seqInfo = await bridge.executeAction('get_sequence_details', {});
        const newName = `${seqInfo.name || 'Sequence'}${suffix}`;

        // 2. Clone active sequence non-destructively
        const dupRes = await bridge.executeAction('duplicate_sequence', {
          newName
        });

        return formatSuccess({
          success: true,
          originalSequence: seqInfo.name,
          newSequence: newName,
          targetAspectRatio: aspectRatio,
          details: dupRes,
          recommendation: `Sequence successfully cloned to "${newName}". You can now apply transform scale (e.g. scale: 178) or Auto-Reframe.`
        });
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
