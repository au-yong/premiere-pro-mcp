import { registerSystemTools } from './system-tools.js';
import { registerProjectTools } from './project-tools.js';
import { registerSequenceTools } from './sequence-tools.js';
import { registerEditingTools } from './editing-tools.js';
import { registerInspectorTools } from './inspector-tools.js';
import { registerEffectsTools } from './effects-tools.js';
import { registerAudioTools } from './audio-tools.js';
import { registerGraphicsTools } from './graphics-tools.js';
import { registerMarkerTools } from './marker-tools.js';
import { registerExportTools } from './export-tools.js';
import { registerCompoundTools } from './compound-tools.js';

export function registerAllTools(server) {
  registerSystemTools(server);
  registerProjectTools(server);
  registerSequenceTools(server);
  registerEditingTools(server);
  registerInspectorTools(server);
  registerEffectsTools(server);
  registerAudioTools(server);
  registerGraphicsTools(server);
  registerMarkerTools(server);
  registerExportTools(server);
  registerCompoundTools(server);
}

export default registerAllTools;
