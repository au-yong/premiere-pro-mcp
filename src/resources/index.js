import { bridge } from '../bridge/bridge-manager.js';

export function registerAllResources(server) {
  server.resource(
    'project-info',
    'premiere://project/info',
    async (uri) => {
      try {
        const info = await bridge.executeAction('get_project_info', {});
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(info, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: `Unavailable: ${err.message}`
            }
          ]
        };
      }
    }
  );

  server.resource(
    'active-sequence',
    'premiere://sequence/active',
    async (uri) => {
      try {
        const seq = await bridge.executeAction('get_sequence_details', {});
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(seq, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: `Unavailable: ${err.message}`
            }
          ]
        };
      }
    }
  );

  server.resource(
    'timeline-clips',
    'premiere://timeline/clips',
    async (uri) => {
      try {
        const clips = await bridge.executeAction('list_timeline_clips', {});
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(clips, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: `Unavailable: ${err.message}`
            }
          ]
        };
      }
    }
  );

  server.resource(
    'sequence-markers',
    'premiere://markers',
    async (uri) => {
      try {
        const markers = await bridge.executeAction('list_markers', {});
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(markers, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: `Unavailable: ${err.message}`
            }
          ]
        };
      }
    }
  );
}

export default registerAllResources;
