import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import useCanvasStore from './useCanvasStore';

// We assign a random color for the user's cursor
const cursorColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
const myColor = cursorColors[Math.floor(Math.random() * cursorColors.length)];
const myName = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank'][Math.floor(Math.random() * 6)];

export default function useMultiplayer(documentName) {
  const [provider, setProvider] = useState(null);
  const [awareness, setAwareness] = useState(null);
  const [others, setOthers] = useState([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const yshapes = ydoc.getMap('shapes');

    const newProvider = new HocuspocusProvider({
      url: 'ws://localhost:1234',
      name: documentName || 'default-room',
      document: ydoc,
    });

    const newAwareness = newProvider.awareness;
    newAwareness.setLocalStateField('user', { name: myName, color: myColor });
    
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
      unsubscribeZustand();
      newProvider.destroy();
      ydoc.destroy();
    };
  }, [documentName]);

  // Expose function to update cursor
  const updateCursor = (x, y) => {
    if (awareness) {
      awareness.setLocalStateField('cursor', { x, y });
    }
  };

  return { provider, others, updateCursor };
}
