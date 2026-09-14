import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import useCanvasStore from './useCanvasStore';
import { setYjsDocument } from './yjsBridge';

// We assign a random color for the user's cursor
const cursorColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
const myColor = cursorColors[Math.floor(Math.random() * cursorColors.length)];
const myName = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank'][Math.floor(Math.random() * 6)];

export default function useMultiplayer(documentName) {
  const [provider, setProvider] = useState(null);
  const [awareness, setAwareness] = useState(null);
  const [others, setOthers] = useState([]);
  const [undoManager, setUndoManager] = useState(null);
  const mountGen = useRef(0);
  const syncTimer = useRef(null);

  useEffect(() => {
    const gen = ++mountGen.current;
    const ydoc = new Y.Doc();
    const yshapes = ydoc.getMap('shapes');
    setYjsDocument(ydoc);

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';
    const newProvider = new HocuspocusProvider({
      url: wsUrl,
      name: documentName || 'default-room',
      document: ydoc,
      onStatus: ({ status }) => {
        if (status === 'disconnected') {
          useCanvasStore.getState().setSyncStatus('offline');
        } else if (status === 'connected') {
          useCanvasStore.getState().setSyncStatus('saved');
        }
      },
    });

    const newAwareness = newProvider.awareness;
    newAwareness.setLocalStateField('user', { name: myName, color: myColor });
    
    // Create Yjs UndoManager tracking the shapes map
    const newUndoManager = new Y.UndoManager(yshapes);
    useCanvasStore.getState().setUndoManager(newUndoManager);

    setProvider(newProvider);
    setAwareness(newAwareness);

    // ── 1. Sync Yjs to Zustand (Incoming Changes) ──
    yshapes.observe((event) => {
      // We need to bypass the Zustand undo stack to prevent infinite loops
      const currentShapes = useCanvasStore.getState().shapes;
      const nextShapes = [...currentShapes];
      let hasChanges = false;

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const incomingShape = yshapes.get(key);
          const index = nextShapes.findIndex(s => s.id === key);
          if (index === -1) {
             nextShapes.push(incomingShape);
          } else {
             nextShapes[index] = incomingShape;
          }
          hasChanges = true;
        } else if (change.action === 'delete') {
          const index = nextShapes.findIndex(s => s.id === key);
          if (index !== -1) {
            nextShapes.splice(index, 1);
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        useCanvasStore.setState({ shapes: nextShapes });
      }
    });

    // ── 2. Sync Zustand to Yjs (Outgoing Changes) ──
    const unsubscribeZustand = useCanvasStore.subscribe((state, prevState) => {
      // Only sync if the shapes array actually changed
      if (state.shapes === prevState.shapes) return;

      useCanvasStore.getState().setSyncStatus('syncing');
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        useCanvasStore.getState().setSyncStatus('saved');
      }, 3000);

      ydoc.transact(() => {
        // Find adds and updates
        state.shapes.forEach((shape) => {
          const yShape = yshapes.get(shape.id);
          // Simple deep compare check could go here, but for now we just overwrite
          // if it exists, or set if new.
          if (JSON.stringify(yShape) !== JSON.stringify(shape)) {
            yshapes.set(shape.id, shape);
          }
        });

        // Find deletes
        const currentIds = state.shapes.map(s => s.id);
        const yKeys = Array.from(yshapes.keys());
        yKeys.forEach((key) => {
          if (!currentIds.includes(key)) {
            yshapes.delete(key);
          }
        });
      });
    });

    // ── 3. Handle Awareness (Cursors) ──
    newAwareness.on('change', () => {
      const states = Array.from(newAwareness.getStates().entries());
      const otherUsers = states
        .filter(([clientId]) => clientId !== newProvider.document.clientID)
        .map(([clientId, state]) => ({
          id: clientId,
          ...state.user,
          x: state.cursor?.x || -100,
          y: state.cursor?.y || -100,
        }));
      setOthers(otherUsers);
    });

    return () => {
      const g = gen;
      const cleanup = () => {
        if (g !== mountGen.current) return;
        clearTimeout(syncTimer.current);
        unsubscribeZustand();
        newUndoManager.destroy();
        useCanvasStore.getState().setUndoManager(null);
        try {
          newProvider.destroy();
        } catch {
          /* already disconnected */
        }
        setYjsDocument(null);
        ydoc.destroy();
      };
      // Defer so React Strict Mode remount can bump mountGen before we destroy
      setTimeout(cleanup, 0);
    };
  }, [documentName]);

  // Expose function to update cursor
  const updateCursor = (x, y) => {
    if (awareness) {
      awareness.setLocalStateField('cursor', { x, y });
    }
  };

  return { provider, others, updateCursor, undoManager };
}
