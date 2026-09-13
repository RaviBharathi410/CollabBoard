import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/**
 * CollabBoard Phase 3b: k6 WebSocket Concurrent Room Script
 *
 * NOTE: Reference load-testing specification. Requires external k6 binary (not executed in local dev).
 *
 * Target:
 *   - ws://localhost:1234  (Hocuspocus Yjs WebSocket server)
 *
 * Execution (requires k6 installed):
 *   k6 run tests/load/k6_websocket.js
 */

const wsConnectDuration = new Trend('ws_connect_duration', true);
const wsMessagesReceived = new Counter('ws_messages_received');
const wsErrors = new Rate('ws_errors');

export const options = {
  stages: [
    { duration: '10s', target: 25 }, // Ramp up to 25 VUs
    { duration: '20s', target: 50 }, // Sustain 50 concurrent VUs
    { duration: '10s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    'ws_connect_duration': ['p(95)<150', 'p(99)<300'], // Handshake within 150ms p95
    'ws_errors': ['rate<0.01'],                        // < 1% error rate
  },
};

const WS_URL = __ENV.WS_URL || 'ws://localhost:1234';

export default function () {
  const roomIndex = __VU % 5;
  const roomName = `load-test-room-${roomIndex}`;
  const url = `${WS_URL}/${roomName}`;

  const startTime = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      wsConnectDuration.add(Date.now() - startTime);

      // Ping periodically to maintain heartbeat
      socket.setInterval(() => {
        socket.ping();
      }, 5000);
    });

    socket.on('message', (data) => {
      wsMessagesReceived.add(1);
    });

    socket.on('error', (e) => {
      wsErrors.add(1);
    });

    socket.on('close', () => {
      // Clean disconnect
    });

    // Keep session active for 5 seconds of collaborative presence
    socket.setTimeout(() => {
      socket.close();
    }, 5000);
  });

  check(res, {
    'websocket connected successfully': (r) => r && r.status === 101,
  });

  sleep(1);
}
