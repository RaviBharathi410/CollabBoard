import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export const MAX_HISTORY = 50;

/**
 * Core Zustand canvas store with shape state, active tool, selection,
 * and built-in undo/redo history stack (with Yjs UndoManager delegation when active).
 */
export const useCanvasStore = create((set, get) => ({
  // ── Shapes State ──
  shapes: [],
  selectedIds: [],
  clipboard: [],
  activeTool: 'select', // select | hand | marquee | rectangle | circle | diamond | arrow | pencil | text

  // ── Undo / Redo Stacks ──
  undoStack: [], // Array of previous shapes arrays
  redoStack: [], // Array of undone shapes arrays
  undoManager: null, // Optional Yjs UndoManager

  // ── Sync & Diagram Domain State ──
  syncStatus: 'saved', // 'saved' | 'syncing' | 'offline'
  setSyncStatus: (status) => set({ syncStatus: status }),
  diagramType: 'flowchart', // 'flowchart' | 'uml-class' | string
  setDiagramType: (type) => set({ diagramType: type }),

  // ── Tool Actions ──
  setActiveTool: (tool) => set({ activeTool: tool, selectedIds: [] }),

  // ── Selection ──
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
  selectAll: () => {
    const { shapes } = get();
    set({ selectedIds: shapes.map((s) => s.id) });
  },

  // ── Clipboard (Copy / Cut / Paste / Duplicate) ──
  copy: () => {
    const { shapes, selectedIds } = get();
    if (selectedIds.length === 0) return;
    const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
    if (selectedShapes.length === 0) return;
    // Deep clone to isolate clipboard from future canvas mutations
    const cloned = JSON.parse(JSON.stringify(selectedShapes));
    set({ clipboard: cloned });
  },

  cut: () => {
    const { copy, deleteShapes, selectedIds } = get();
    if (selectedIds.length === 0) return;
    copy();
    deleteShapes(selectedIds);
  },

  paste: (offset = { x: 24, y: 24 }) => {
    const { clipboard, shapes, _pushHistory } = get();
    if (!clipboard || clipboard.length === 0) return [];

    const newShapes = clipboard.map((shape) => {
      const newId = uuidv4();
      const cloned = { ...shape, id: newId };
      if (typeof cloned.x === 'number') cloned.x += offset.x;
      if (typeof cloned.y === 'number') cloned.y += offset.y;
      if (Array.isArray(cloned.points)) {
        cloned.points = cloned.points.map((pt, idx) =>
          idx % 2 === 0 ? pt + offset.x : pt + offset.y
        );
      }
      return cloned;
    });

    const history = _pushHistory(shapes);
    const newSelectedIds = newShapes.map((s) => s.id);

    set({
      shapes: [...shapes, ...newShapes],
      selectedIds: newSelectedIds,
      // Shift clipboard offset for subsequent pastes so they cascade cleanly
      clipboard: clipboard.map((s) => ({
        ...s,
        x: typeof s.x === 'number' ? s.x + offset.x : s.x,
        y: typeof s.y === 'number' ? s.y + offset.y : s.y,
        points: Array.isArray(s.points)
          ? s.points.map((pt, idx) => (idx % 2 === 0 ? pt + offset.x : pt + offset.y))
          : s.points,
      })),
      ...history,
    });

    return newSelectedIds;
  },

  duplicate: (offset = { x: 24, y: 24 }) => {
    const { copy, paste } = get();
    copy();
    return paste(offset);
  },

  // ── History Helper (internal) ──
  _pushHistory: (prevShapes) => {
    const { undoStack } = get();
    const nextUndo = [...undoStack, prevShapes].slice(-MAX_HISTORY);
    return {
      undoStack: nextUndo,
      redoStack: [], // Clear redo stack on any new mutation
    };
  },

  // ── CRUD ──
  addShape: (shapeData) => {
    const id = uuidv4();
    const shape = { id, ...shapeData };
    const prev = get().shapes;
    const history = get()._pushHistory(prev);
    set({
      shapes: [...prev, shape],
      ...history,
    });
    return id;
  },

  // Atomic batch addition — pushes a single history entry for atomic undo
  addShapes: (shapesDataArray) => {
    if (!Array.isArray(shapesDataArray) || shapesDataArray.length === 0) return [];
    const prev = get().shapes;
    const history = get()._pushHistory(prev);
    const newShapes = shapesDataArray.map((data) => ({
      id: data.id || uuidv4(),
      ...data,
    }));
    set({
      shapes: [...prev, ...newShapes],
      selectedIds: newShapes.map((s) => s.id),
      ...history,
    });
    return newShapes.map((s) => s.id);
  },

  updateShape: (id, updates) => {
    const prev = get().shapes;
    const old = prev.find((s) => s.id === id);
    if (!old) return;
    const history = get()._pushHistory(prev);
    const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    set({
      shapes: next,
      ...history,
    });
  },

  // Batch update — no history push (used during drag)
  updateShapeSilent: (id, updates) => {
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteShapes: (ids) => {
    const prev = get().shapes;
    const history = get()._pushHistory(prev);
    set({
      shapes: prev.filter((s) => !ids.includes(s.id)),
      selectedIds: [],
      ...history,
    });
  },

  // ── Undo / Redo ──
  setUndoManager: (um) => set({ undoManager: um }),

  undo: () => {
    const { undoManager, undoStack, redoStack, shapes } = get();
    if (undoManager && (typeof undoManager.canUndo !== 'function' || undoManager.canUndo())) {
      try {
        undoManager.undo();
        return;
      } catch (e) {
        console.warn('[canvasStore] Yjs undo failed, falling back to local stack:', e);
      }
    }
    if (undoStack.length === 0) return;

    const previousShapes = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, shapes];

    set({
      shapes: previousShapes,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      selectedIds: [],
    });
  },

  redo: () => {
    const { undoManager, undoStack, redoStack, shapes } = get();
    if (undoManager && (typeof undoManager.canRedo !== 'function' || undoManager.canRedo())) {
      try {
        undoManager.redo();
        return;
      } catch (e) {
        console.warn('[canvasStore] Yjs redo failed, falling back to local stack:', e);
      }
    }
    if (redoStack.length === 0) return;

    const nextShapes = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, shapes];

    set({
      shapes: nextShapes,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      selectedIds: [],
    });
  },
}));

if (typeof window !== 'undefined') {
  window.__CANVAS_STORE__ = useCanvasStore;
}

export default useCanvasStore;
