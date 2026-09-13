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
  activeTool: 'select', // select | hand | marquee | rectangle | circle | diamond | arrow | pencil | text

  // ── Undo / Redo Stacks ──
  undoStack: [], // Array of previous shapes arrays
  redoStack: [], // Array of undone shapes arrays
  undoManager: null, // Optional Yjs UndoManager

  // ── Tool Actions ──
  setActiveTool: (tool) => set({ activeTool: tool, selectedIds: [] }),

  // ── Selection ──
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

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
    if (undoManager) {
      undoManager.undo();
      return;
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
    if (undoManager) {
      undoManager.redo();
      return;
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
