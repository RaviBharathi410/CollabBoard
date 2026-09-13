/**
 * collaboration.test.js
 * Comprehensive unit and integration tests for Yjs/Hocuspocus synchronization:
 * - Local store changes update the Yjs document map
 * - Remote Yjs updates propagate into the local store
 * - Remote and local shape deletions synchronize cleanly
 * - Awareness/presence attaches user identity and tracks peer cursors without self-reflection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import useCanvasStore from '../canvas/store/canvasStore.js';
import { bindYjsToStore, formatPeerAwareness } from './yjsSync.js';

describe('Collaboration & Yjs Synchronization', () => {
  let ydocLocal;
  let ydocRemote;
  let unbind;

  beforeEach(() => {
    // Reset local canvas store
    useCanvasStore.setState({
      shapes: [],
      selectedIds: [],
      activeTool: 'select',
      undoStack: [],
      redoStack: [],
      undoManager: null,
    });

    ydocLocal = new Y.Doc();
    ydocRemote = new Y.Doc();

    // Bind local ydoc to local zustand store
    unbind = bindYjsToStore(ydocLocal, useCanvasStore);
  });

  afterEach(() => {
    if (unbind) unbind();
    ydocLocal.destroy();
    ydocRemote.destroy();
  });

  describe('Local to Remote Sync', () => {
    it('propagates local store shape creation to Yjs document', () => {
      const yshapes = ydocLocal.getMap('shapes');
      expect(yshapes.size).toBe(0);

      // Local user adds a shape
      const id = useCanvasStore.getState().addShape({
        type: 'rectangle',
        x: 100,
        y: 150,
        width: 120,
        height: 80,
        label: 'API Gateway',
      });

      // Shape must be present in the Yjs map
      expect(yshapes.has(id)).toBe(true);
      const syncedShape = yshapes.get(id);
      expect(syncedShape.label).toBe('API Gateway');
      expect(syncedShape.x).toBe(100);
      expect(syncedShape.y).toBe(150);
    });

    it('propagates local shape updates to Yjs document', () => {
      const yshapes = ydocLocal.getMap('shapes');
      const id = useCanvasStore.getState().addShape({
        type: 'circle',
        x: 50,
        y: 50,
        radiusX: 30,
        radiusY: 30,
      });

      // Update shape in local store
      useCanvasStore.getState().updateShape(id, { x: 200, radiusX: 45 });

      const updated = yshapes.get(id);
      expect(updated.x).toBe(200);
      expect(updated.radiusX).toBe(45);
      expect(updated.radiusY).toBe(30);
    });

    it('propagates local shape deletion to Yjs document', () => {
      const yshapes = ydocLocal.getMap('shapes');
      const id1 = useCanvasStore.getState().addShape({ type: 'rectangle', label: 'Box 1' });
      const id2 = useCanvasStore.getState().addShape({ type: 'rectangle', label: 'Box 2' });

      expect(yshapes.size).toBe(2);

      // Delete Box 1 locally
      useCanvasStore.getState().deleteShapes([id1]);

      expect(yshapes.has(id1)).toBe(false);
      expect(yshapes.has(id2)).toBe(true);
      expect(yshapes.size).toBe(1);
    });
  });

  describe('Remote to Local Sync', () => {
    it('reflects incoming remote Yjs additions in local state', () => {
      const yshapes = ydocLocal.getMap('shapes');

      // Simulate an incoming remote update (e.g. from Hocuspocus WebSocket peer)
      const remoteShape = {
        id: 'remote-node-101',
        type: 'database',
        x: 350,
        y: 220,
        label: 'PostgreSQL DB',
      };

      yshapes.set('remote-node-101', remoteShape);

      // Local store must reflect the remote shape
      const localShapes = useCanvasStore.getState().shapes;
      const found = localShapes.find((s) => s.id === 'remote-node-101');
      expect(found).toBeDefined();
      expect(found.label).toBe('PostgreSQL DB');
      expect(found.x).toBe(350);
    });

    it('reflects incoming remote Yjs property modifications in local state', () => {
      const yshapes = ydocLocal.getMap('shapes');
      const initialShape = {
        id: 'node-sync',
        type: 'rectangle',
        x: 10,
        y: 10,
        label: 'Original',
      };
      yshapes.set('node-sync', initialShape);

      // Remote update comes in
      const updatedShape = {
        id: 'node-sync',
        type: 'rectangle',
        x: 80,
        y: 90,
        label: 'Updated by Peer',
      };
      yshapes.set('node-sync', updatedShape);

      const localShapes = useCanvasStore.getState().shapes;
      const current = localShapes.find((s) => s.id === 'node-sync');
      expect(current.label).toBe('Updated by Peer');
      expect(current.x).toBe(80);
      expect(current.y).toBe(90);
    });

    it('reflects incoming remote Yjs deletions in local state', () => {
      const yshapes = ydocLocal.getMap('shapes');
      yshapes.set('temp-1', { id: 'temp-1', type: 'rectangle' });
      yshapes.set('temp-2', { id: 'temp-2', type: 'circle' });

      expect(useCanvasStore.getState().shapes).toHaveLength(2);

      // Remote peer deletes temp-1
      yshapes.delete('temp-1');

      const remaining = useCanvasStore.getState().shapes;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('temp-2');
    });
  });

  describe('Awareness & Presence Data', () => {
    it('attaches user identity to awareness and updates cursor coordinates', () => {
      const awareness = new Awareness(ydocLocal);

      // Set user presence
      awareness.setLocalStateField('user', {
        name: 'Ada Lovelace',
        color: '#3B82F6',
      });
      awareness.setLocalStateField('cursor', { x: 450, y: 300 });

      const localState = awareness.getLocalState();
      expect(localState.user.name).toBe('Ada Lovelace');
      expect(localState.user.color).toBe('#3B82F6');
      expect(localState.cursor.x).toBe(450);
      expect(localState.cursor.y).toBe(300);

      awareness.destroy();
    });

    it('formats peer awareness while filtering out local client ID', () => {
      const awareness = new Awareness(ydocLocal);

      // Simulate a peer joining on clientId 999
      const remoteStates = new Map();
      remoteStates.set(ydocLocal.clientID, {
        user: { name: 'Local Architect', color: '#10B981' },
        cursor: { x: 100, y: 100 },
      });
      remoteStates.set(999, {
        user: { name: 'Collaborator Bob', color: '#EF4444' },
        cursor: { x: 250, y: 180 },
      });

      // Mock getStates on awareness instance
      vi.spyOn(awareness, 'getStates').mockReturnValue(remoteStates);

      const peers = formatPeerAwareness(awareness, ydocLocal.clientID);

      // Must only return the remote peer, never self
      expect(peers).toHaveLength(1);
      expect(peers[0].id).toBe(999);
      expect(peers[0].name).toBe('Collaborator Bob');
      expect(peers[0].color).toBe('#EF4444');
      expect(peers[0].x).toBe(250);
      expect(peers[0].y).toBe(180);

      awareness.destroy();
    });
  });
});
