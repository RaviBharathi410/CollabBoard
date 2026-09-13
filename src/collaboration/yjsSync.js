import * as Y from 'yjs';

/**
 * Binds a Yjs document's 'shapes' map to a Zustand canvas store.
 * Returns an unbind function that unsubscribes both listeners.
 */
export function bindYjsToStore(ydoc, store) {
  const yshapes = ydoc.getMap('shapes');

  // 1. Inbound: Remote Yjs -> Local Zustand Store
  const observer = (event) => {
    const currentShapes = store.getState().shapes;
    const nextShapes = [...currentShapes];
    let hasChanges = false;

    event.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const incomingShape = yshapes.get(key);
        const index = nextShapes.findIndex((s) => s.id === key);
        if (index === -1) {
          nextShapes.push(incomingShape);
        } else {
          nextShapes[index] = incomingShape;
        }
        hasChanges = true;
      } else if (change.action === 'delete') {
        const index = nextShapes.findIndex((s) => s.id === key);
        if (index !== -1) {
          nextShapes.splice(index, 1);
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      store.setState({ shapes: nextShapes });
    }
  };

  yshapes.observe(observer);

  // 2. Outbound: Local Zustand Store -> Yjs Map
  const unsubscribeStore = store.subscribe((state, prevState) => {
    if (state.shapes === prevState.shapes) return;

    ydoc.transact(() => {
      // Upsert local shapes to Yjs
      state.shapes.forEach((shape) => {
        const yShape = yshapes.get(shape.id);
        if (JSON.stringify(yShape) !== JSON.stringify(shape)) {
          yshapes.set(shape.id, shape);
        }
      });

      // Remove deleted shapes from Yjs
      const currentIds = state.shapes.map((s) => s.id);
      Array.from(yshapes.keys()).forEach((key) => {
        if (!currentIds.includes(key)) {
          yshapes.delete(key);
        }
      });
    });
  });

  return () => {
    yshapes.unobserve(observer);
    unsubscribeStore();
  };
}

/**
 * Formats awareness presence states into other active participants.
 */
export function formatPeerAwareness(awareness, localClientId) {
  const states = Array.from(awareness.getStates().entries());
  return states
    .filter(([clientId]) => clientId !== localClientId)
    .map(([clientId, state]) => ({
      id: clientId,
      ...(state.user || {}),
      x: state.cursor?.x ?? -100,
      y: state.cursor?.y ?? -100,
    }));
}
