import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import useCanvasStore from '../canvas/store/canvasStore';
import { setYjsDocument } from '../canvas/hooks/yjsBridge';

describe('multiplayerEdgeCases.test.js - Multiplayer Race Conditions & CRDT Recovery', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      shapes: [],
      selectedIds: [],
      past: [],
      future: [],
    });
  });

  it('converges deterministically when two clients concurrently edit the identical shape', () => {
    // Client A and Client B share two Yjs documents
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const mapA = docA.getMap('shapes');
    const mapB = docB.getMap('shapes');

    // Initial synchronized state
    mapA.set('shape_1', {
      id: 'shape_1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 80,
      height: 80,
      fill: '#3B82F6',
    });

    // Sync initial state from A to B
    const initialUpdate = Y.encodeStateAsUpdate(docA);
    Y.applyUpdate(docB, initialUpdate);

    expect(mapB.get('shape_1').x).toBe(100);

    // Client A moves shape to x: 250
    mapA.set('shape_1', {
      ...mapA.get('shape_1'),
      x: 250,
    });

    // Client B concurrently changes color to '#10B981' and x: 300
    mapB.set('shape_1', {
      ...mapB.get('shape_1'),
      x: 300,
      fill: '#10B981',
    });

    // Exchange updates
    const updateFromA = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
    const updateFromB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));

    Y.applyUpdate(docB, updateFromA);
    Y.applyUpdate(docA, updateFromB);

    // Both documents must converge to the exact same value
    const finalShapeA = mapA.get('shape_1');
    const finalShapeB = mapB.get('shape_1');

    expect(finalShapeA).toEqual(finalShapeB);
    expect(finalShapeA.id).toBe('shape_1');
    expect(typeof finalShapeA.x).toBe('number');
  });

  it('handles concurrent edit and deletion without throwing or corrupted state', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const mapA = docA.getMap('shapes');
    const mapB = docB.getMap('shapes');

    // Initial shape
    mapA.set('node_del', { id: 'node_del', type: 'circle', x: 50, y: 50 });
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // User A edits the node
    mapA.set('node_del', { id: 'node_del', type: 'circle', x: 120, y: 120 });

    // User B simultaneously deletes the node
    mapB.delete('node_del');

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
    const updateB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));

    Y.applyUpdate(docB, updateA);
    Y.applyUpdate(docA, updateB);

    // Both documents must agree on the final state
    expect(mapA.has('node_del')).toBe(mapB.has('node_del'));
  });

  it('recovers all changes when a client disconnects mid-session and reconnects', () => {
    const serverDoc = new Y.Doc();
    const clientDoc = new Y.Doc();
    const serverMap = serverDoc.getMap('shapes');
    const clientMap = clientDoc.getMap('shapes');

    // 1. Online: Client adds shape 1 and syncs to server
    clientMap.set('s1', { id: 's1', type: 'rectangle', x: 10, y: 10 });
    Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(clientDoc));

    // 2. Client goes OFFLINE:
    // Client adds shape 2 while disconnected
    clientMap.set('s2', { id: 's2', type: 'text', text: 'Offline note' });

    // Other peers add shape 3 to server while client is offline
    serverMap.set('s3', { id: 's3', type: 'arrow', source: 's1', target: 's2' });

    // 3. Client RECONNECTS: bidirectional state reconciliation
    const clientStateVector = Y.encodeStateVector(clientDoc);
    const serverStateVector = Y.encodeStateVector(serverDoc);

    const missingOnServer = Y.encodeStateAsUpdate(clientDoc, serverStateVector);
    const missingOnClient = Y.encodeStateAsUpdate(serverDoc, clientStateVector);

    Y.applyUpdate(serverDoc, missingOnServer);
    Y.applyUpdate(clientDoc, missingOnClient);

    // Both client and server must contain s1, s2, and s3
    expect(clientMap.get('s1')).toBeDefined();
    expect(clientMap.get('s2')).toBeDefined();
    expect(clientMap.get('s3')).toBeDefined();

    expect(serverMap.get('s1')).toBeDefined();
    expect(serverMap.get('s2')).toBeDefined();
    expect(serverMap.get('s3')).toBeDefined();
    expect(clientMap.toJSON()).toEqual(serverMap.toJSON());
  });
});
