import { bridge } from '../src/bridge/bridge-manager.js';
import { WebSocket } from 'ws';
import { config } from '../src/config.js';

async function runTests() {
  console.log('--- 1. Testing Bridge Server Start ---');
  await bridge.start();
  console.log('Bridge started successfully on port', config.PORT);

  console.log('--- 2. Testing Connection Status Query ---');
  const statusBefore = await bridge.getConnectionStatus();
  console.log('Initial Status:', statusBefore);

  console.log('--- 3. Testing CEP Client WebSocket Connection ---');
  const testWs = new WebSocket(`ws://127.0.0.1:${config.PORT}`);

  await new Promise((resolve, reject) => {
    testWs.on('open', () => {
      console.log('Test client WebSocket connected!');
      // Send handshake
      testWs.send(JSON.stringify({
        type: 'handshake',
        info: {
          appId: 'PPRO',
          appVersion: '25.0',
          appName: 'Adobe Premiere Pro 2025'
        }
      }));
      resolve();
    });
    testWs.on('error', reject);
  });

  // Handle incoming commands on the mock client
  testWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Mock client received message from bridge:', msg);

    if (msg.type === 'action') {
      let mockResult = { success: true };
      if (msg.action === 'get_project_info') {
        mockResult = {
          name: 'Demo_Project.prproj',
          path: '/Users/test/Projects/Demo_Project.prproj',
          isDirty: false,
          sequencesCount: 1,
          activeSequence: {
            id: 1,
            name: 'Master Timeline',
            durationSeconds: 120.5,
            videoTracksCount: 3,
            audioTracksCount: 4
          }
        };
      }
      testWs.send(JSON.stringify({
        id: msg.id,
        status: 'success',
        result: mockResult
      }));
    }
  });

  console.log('--- 4. Testing Status with Active Client ---');
  const statusAfter = await bridge.getConnectionStatus();
  console.log('Status with Client:', statusAfter);

  console.log('--- 5. Testing Action Dispatch via Bridge ---');
  const projInfo = await bridge.executeAction('get_project_info', {});
  console.log('Action Response received:', projInfo);

  if (projInfo.name === 'Demo_Project.prproj') {
    console.log('✅ Action dispatch test passed successfully!');
  } else {
    throw new Error('Action response mismatch');
  }

  console.log('--- 6. Cleanup ---');
  testWs.close();
  await bridge.close();
  console.log('✅ All tests completed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
