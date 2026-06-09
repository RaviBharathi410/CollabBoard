import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const useCanvasStore = create((set, get) => ({
  // ── Shapes State ──
  shapes: [],
  selectedIds: [],
  activeTool: 'select', // select | hand | marquee | rectangle | circle | diamond | arrow | pencil | text

  // ── Tool Actions ──
  setActiveTool: (tool) => set({ activeTool: tool, selectedIds: [] }),

  // ── Selection ──
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  // ── CRUD ──
  addShape: (shapeData) => {
    const id = uuidv4();
    const shape = { id, ...shapeData };
    const prev = get().shapes;
    set({ shapes: [...prev, shape] });
    return id;
  },

  updateShape: (id, updates) => {
    const prev = get().shapes;
    const old = prev.find((s) => s.id === id);
    if (!old) return;
    const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    set({ shapes: next });
  },

  // Batch update — no history push (used during drag)
  updateShapeSilent: (id, updates) => {
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteShapes: (ids) => {
    const prev = get().shapes;
    set({
      shapes: prev.filter((s) => !ids.includes(s.id)),
      selectedIds: [],
    });
  },

  // ── Undo / Redo ──
  undoManager: null,
  setUndoManager: (um) => set({ undoManager: um }),
  
  undo: () => {
    const { undoManager } = get();
    if (undoManager) undoManager.undo();
  },

  redo: () => {
    const { undoManager } = get();
    if (undoManager) undoManager.redo();
  },
}));

export default useCanvasStore;
