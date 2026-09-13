#!/usr/bin/env node

/**
 * CollabBoard Phase 3b: Native WebSocket & CRDT Concurrency Benchmark
 *
 * Runs 50 concurrent Hocuspocus/Yjs WebSocket clients against the local
 * server (ws://localhost:1234) without requiring external binaries like k6.
 *
 * Measures:
 *   - Concurrent connection success rate (Target: 100%)
 *   - Connection & initial document sync handshake latency (p50, p95, p99)
 *   - Cross-client CRDT propagation latency (round-trip shape broadcast)
 *   - Clean teardown without connection leaks
 */

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const TOTAL_CLIENTS = parseInt(process.env.TOTAL_CLIENTS || '50', 10);
const ROOMS_COUNT = parseInt(process.env.ROOMS_COUNT || '5', 10);
const CLIENTS_PER_ROOM = Math.max(1, Math.floor(TOTAL_CLIENTS / ROOMS_COUNT));
const WS_URL = process.env.WS_URL || 'ws://localhost:1234';

console.log('='.repeat(70));
console.log('🚀 Starting CollabBoard WebSocket Concurrency Benchmark');
console.log(`   Target:       ${WS_URL}`);
console.log(`   Concurrency:  ${TOTAL_CLIENTS} clients`);
console.log(`   Rooms:        ${ROOMS_COUNT} rooms (${CLIENTS_PER_ROOM} clients/room)`);
console.log('='.repeat(70));

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper === lower) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function runBenchmark() {
  const clients = [];
  const connectLatencies = [];
  const propagationLatencies = [];
  let connectionFailures = 0;

  // Pre-generate stable room names for grouping
  const benchId = Date.now();
  const roomNames = Array.from({ length: ROOMS_COUNT }, (_, i) => `bench-room-${i}-${benchId}`);

  console.log(`\n⏳ Phase 1: Establishing ${TOTAL_CLIENTS} concurrent WebSocket connections across ${ROOMS_COUNT} rooms...`);
  const phase1Start = Date.now();

  const connectPromises = [];

  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    const roomName = roomNames[i % ROOMS_COUNT];
    const doc = new Y.Doc();
    const startTime = Date.now();

    const client = {
      id: i,
      roomName,
      doc,
      provider: null,
      synced: false,
    };
    clients.push(client);

    const promise = new Promise((resolve) => {
      try {
        const provider = new HocuspocusProvider({
          url: WS_URL,
          name: roomName,
          document: doc,
          WebSocketPolyfill: globalThis.WebSocket,
          onSynced: () => {
            const elapsed = Date.now() - startTime;
            connectLatencies.push(elapsed);
            client.synced = true;
            resolve({ success: true, elapsed });
          },
          onClose: () => {},
          onDestroy: () => {},
        });
        client.provider = provider;
      } catch (err) {
        connectionFailures++;
        resolve({ success: false, error: err.message });
      }

      // Safety timeout after 10 seconds
      setTimeout(() => {
        if (!client.synced) {
          connectionFailures++;
          resolve({ success: false, timeout: true });
        }
      }, 10000);
    });

    connectPromises.push(promise);
  }

  await Promise.all(connectPromises);
  const phase1Duration = Date.now() - phase1Start;
  console.log(`✅ Phase 1 Complete in ${phase1Duration}ms. Connected & Synced: ${connectLatencies.length}/${TOTAL_CLIENTS}`);

  // Small delay to ensure all Yjs state vectors are initialized
  await new Promise((r) => setTimeout(r, 200));

  // Phase 2: CRDT Real-Time Sync Propagation across clients in same room
  console.log(`\n⏳ Phase 2: Measuring cross-client CRDT mutation propagation...`);

  const rooms = {};
  for (const c of clients) {
    if (!rooms[c.roomName]) rooms[c.roomName] = [];
    rooms[c.roomName].push(c);
  }

  const propPromises = [];

  for (const [roomName, roomClients] of Object.entries(rooms)) {
    if (roomClients.length < 2) continue;
    const sender = roomClients[0];
    const receivers = roomClients.slice(1);

    const testKey = `sync-shape-${roomName}`;
    const sentAt = Date.now();

    for (const receiver of receivers) {
      const p = new Promise((resolve) => {
        const observer = () => {
          const val = receiver.doc.getMap('shapes').get(testKey);
          if (val) {
            const rtt = Date.now() - sentAt;
            propagationLatencies.push(rtt);
            receiver.doc.getMap('shapes').unobserve(observer);
            resolve(rtt);
          }
        };

        receiver.doc.getMap('shapes').observe(observer);

        // Timeout fallback for propagation
        setTimeout(() => {
          receiver.doc.getMap('shapes').unobserve(observer);
          resolve(null);
        }, 5000);
      });

      propPromises.push(p);
    }

    // Sender writes the test shape mutation
    sender.doc.getMap('shapes').set(testKey, {
      id: testKey,
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 80,
      height: 80,
      fill: '#3B82F6',
      timestamp: sentAt,
    });
  }

  await Promise.all(propPromises);
  console.log(`✅ Phase 2 Complete. Measured ${propagationLatencies.length} propagation events.`);

  // Phase 3: Teardown
  console.log(`\n⏳ Phase 3: Graceful teardown of ${TOTAL_CLIENTS} providers...`);
  for (const client of clients) {
    try {
      if (client.provider) {
        client.provider.destroy();
      }
    } catch {
      // Ignored during cleanup
    }
  }
  console.log(`✅ Phase 3 Complete. All connections closed.`);

  // Compute Statistics
  const successCount = connectLatencies.length;
  const successRate = (successCount / TOTAL_CLIENTS) * 100;
  const p50Connect = Math.round(percentile(connectLatencies, 50));
  const p95Connect = Math.round(percentile(connectLatencies, 95));
  const p99Connect = Math.round(percentile(connectLatencies, 99));
  const maxConnect = Math.max(...connectLatencies, 0);

  const p50Prop = Math.round(percentile(propagationLatencies, 50));
  const p95Prop = Math.round(percentile(propagationLatencies, 95));

  // Print Formatted Report Table
  console.log('\n' + '='.repeat(70));
  console.log('📊 BENCHMARK RESULTS & SERVICE LEVEL OBJECTIVES (SLO)');
  console.log('='.repeat(70));

  const results = [
    {
      metric: 'Connection Success Rate',
      slo: '100.0%',
      actual: `${successRate.toFixed(1)}% (${successCount}/${TOTAL_CLIENTS})`,
      status: successRate === 100 ? '✅ PASS' : '❌ FAIL',
    },
    {
      metric: 'Sync Handshake (p50)',
      slo: '< 1000 ms',
      actual: `${p50Connect} ms`,
      status: p50Connect < 1000 ? '✅ PASS' : '❌ FAIL',
    },
    {
      metric: 'Sync Handshake (p95)',
      slo: '< 2000 ms',
      actual: `${p95Connect} ms`,
      status: p95Connect < 2000 ? '✅ PASS' : '❌ FAIL',
    },
    {
      metric: 'Sync Handshake (p99)',
      slo: '< 2500 ms',
      actual: `${p99Connect} ms`,
      status: p99Connect < 2500 ? '✅ PASS' : '❌ FAIL',
    },
    {
      metric: 'CRDT Propagation (p50)',
      slo: '< 50 ms',
      actual: `${p50Prop} ms`,
      status: p50Prop < 50 ? '✅ PASS' : '❌ FAIL',
    },
    {
      metric: 'CRDT Propagation (p95)',
      slo: '< 150 ms',
      actual: `${p95Prop} ms`,
      status: p95Prop < 150 ? '✅ PASS' : '❌ FAIL',
    },
  ];

  console.log(
    '| ' +
      'Metric'.padEnd(28) +
      ' | ' +
      'SLO Threshold'.padEnd(14) +
      ' | ' +
      'Actual'.padEnd(16) +
      ' | ' +
      'Status'.padEnd(8) +
      ' |'
  );
  console.log('|-' + '-'.repeat(28) + '-|-' + '-'.repeat(14) + '-|-' + '-'.repeat(16) + '-|-' + '-'.repeat(8) + '-|');

  for (const r of results) {
    console.log(
      `| ${r.metric.padEnd(28)} | ${r.slo.padEnd(14)} | ${r.actual.padEnd(16)} | ${r.status.padEnd(8)} |`
    );
  }
  console.log('='.repeat(70));

  const allPassed = results.every((r) => r.status.includes('PASS'));
  if (allPassed && propagationLatencies.length > 0) {
    console.log('\n🎉 ALL CONCURRENCY & LATENCY BENCHMARKS PASSED');
    process.exit(0);
  } else {
    console.error('\n⚠️ SOME BENCHMARK THRESHOLDS EXCEEDED OR PROPAGATION FAILED');
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
