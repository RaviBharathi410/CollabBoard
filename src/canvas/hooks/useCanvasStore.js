import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const useCanvasStore = create((set, get) => ({
  // ── Shapes State ──
  shapes: [],
  selectedIds: [],
  activeTool: 'select', // select | rectangle | circle | diamond | arrow | pencil | text

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
    // Push to undo history
    get()._pushHistory({ type: 'add', shape });
    return id;
  },

  updateShape: (id, updates) => {
    const prev = get().shapes;
    const old = prev.find((s) => s.id === id);
    if (!old) return;
    const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    set({ shapes: next });
    get()._pushHistory({ type: 'update', id, prev: old, next: { ...old, ...updates } });
  },

  // Batch update — no history push (used during drag)
  updateShapeSilent: (id, updates) => {
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteShapes: (ids) => {
    const prev = get().shapes;
    const removed = prev.filter((s) => ids.includes(s.id));
    set({
      shapes: prev.filter((s) => !ids.includes(s.id)),
      selectedIds: [],
    });
    get()._pushHistory({ type: 'delete', shapes: removed });
  },

  // ── Undo / Redo ──
  _history: [],
  _historyIndex: -1,

  _pushHistory: (action) => {
    const { _history, _historyIndex } = get();
    // Truncate any future actions if we've undone
    const trimmed = _history.slice(0, _historyIndex + 1);
    set({ _history: [...trimmed, action], _historyIndex: trimmed.length });
  },

  undo: () => {
    const { _history, _historyIndex, shapes } = get();
    if (_historyIndex < 0) return;
    const action = _history[_historyIndex];

    let next = shapes;
    if (action.type === 'add') {
      next = shapes.filter((s) => s.id !== action.shape.id);
    } else if (action.type === 'delete') {
      next = [...shapes, ...action.shapes];
    } else if (action.type === 'update') {
      next = shapes.map((s) => (s.id === action.id ? action.prev : s));
    }
    set({ shapes: next, _historyIndex: _historyIndex - 1, selectedIds: [] });
  },

  redo: () => {
    const { _history, _historyIndex, shapes } = get();
    if (_historyIndex >= _history.length - 1) return;
    const action = _history[_historyIndex + 1];

    let next = shapes;
    if (action.type === 'add') {
      next = [...shapes, action.shape];
    } else if (action.type === 'delete') {
      const ids = action.shapes.map((s) => s.id);
      next = shapes.filter((s) => !ids.includes(s.id));
    } else if (action.type === 'update') {
      next = shapes.map((s) => (s.id === action.id ? action.next : s));
    }
    set({ shapes: next, _historyIndex: _historyIndex + 1, selectedIds: [] });
  },
}));

export default useCanvasStore;
