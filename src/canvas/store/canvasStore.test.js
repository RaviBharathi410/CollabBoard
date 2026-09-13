/**
 * canvasStore.test.js
 * Unit tests for core Zustand canvas state machine (shapes, selection, tools, undo/redo stack).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import useCanvasStore, { MAX_HISTORY } from './canvasStore.js';

describe('canvasStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useCanvasStore.setState({
      shapes: [],
      selectedIds: [],
      activeTool: 'select',
      undoStack: [],
      redoStack: [],
      undoManager: null,
    });
  });

  describe('Initial State & Selection', () => {
    it('has correct initial default state', () => {
      const state = useCanvasStore.getState();
      expect(state.shapes).toEqual([]);
      expect(state.selectedIds).toEqual([]);
      expect(state.activeTool).toBe('select');
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
      expect(state.undoManager).toBeNull();
    });

    it('sets active tool and clears selected shapes', () => {
      const { setActiveTool, setSelectedIds } = useCanvasStore.getState();

      setSelectedIds(['node-1', 'node-2']);
      expect(useCanvasStore.getState().selectedIds).toHaveLength(2);

      setActiveTool('rectangle');
      expect(useCanvasStore.getState().activeTool).toBe('rectangle');
      expect(useCanvasStore.getState().selectedIds).toEqual([]);
    });

    it('allows clearing selection explicitly', () => {
      const { setSelectedIds, clearSelection } = useCanvasStore.getState();
      setSelectedIds(['node-1']);
      expect(useCanvasStore.getState().selectedIds).toEqual(['node-1']);

      clearSelection();
      expect(useCanvasStore.getState().selectedIds).toEqual([]);
    });
  });

  describe('Shape CRUD Operations', () => {
    it('adds shapes and generates unique IDs', () => {
      const { addShape } = useCanvasStore.getState();

      const id1 = addShape({ type: 'rectangle', x: 100, y: 100, width: 80, height: 60, label: 'Service A' });
      const id2 = addShape({ type: 'database', x: 300, y: 100, width: 80, height: 60, label: 'DB' });

      const shapes = useCanvasStore.getState().shapes;
      expect(shapes).toHaveLength(2);
      expect(shapes[0].id).toBe(id1);
      expect(shapes[0].label).toBe('Service A');
      expect(shapes[1].id).toBe(id2);
      expect(shapes[1].label).toBe('DB');
      expect(id1).not.toBe(id2);
    });

    it('updates an existing shape without mutating others', () => {
      const { addShape, updateShape } = useCanvasStore.getState();

      const id1 = addShape({ type: 'rectangle', x: 10, y: 20, label: 'Old' });
      const id2 = addShape({ type: 'circle', x: 50, y: 50, label: 'Keep' });

      updateShape(id1, { label: 'New Label', x: 15 });

      const shapes = useCanvasStore.getState().shapes;
      const updated = shapes.find((s) => s.id === id1);
      const untouched = shapes.find((s) => s.id === id2);

      expect(updated.label).toBe('New Label');
      expect(updated.x).toBe(15);
      expect(updated.y).toBe(20);
      expect(untouched.label).toBe('Keep');
    });

    it('ignores updateShape for non-existent IDs', () => {
      const { addShape, updateShape } = useCanvasStore.getState();

      addShape({ type: 'rectangle', x: 10, y: 20, label: 'Original' });
      updateShape('ghost-id', { label: 'Ghost' });

      const shapes = useCanvasStore.getState().shapes;
      expect(shapes).toHaveLength(1);
      expect(shapes[0].label).toBe('Original');
    });

    it('updates shapes silently during drag without modifying undo stack', () => {
      const { addShape, updateShapeSilent } = useCanvasStore.getState();

      const id = addShape({ type: 'rectangle', x: 0, y: 0 });
      const undoCountBefore = useCanvasStore.getState().undoStack.length;

      updateShapeSilent(id, { x: 120, y: 80 });

      const shape = useCanvasStore.getState().shapes.find((s) => s.id === id);
      expect(shape.x).toBe(120);
      expect(shape.y).toBe(80);
      expect(useCanvasStore.getState().undoStack.length).toBe(undoCountBefore);
    });

    it('deletes shapes by ID and clears selection', () => {
      const { addShape, setSelectedIds, deleteShapes } = useCanvasStore.getState();

      const id1 = addShape({ type: 'rectangle', label: 'A' });
      const id2 = addShape({ type: 'rectangle', label: 'B' });
      const id3 = addShape({ type: 'rectangle', label: 'C' });

      setSelectedIds([id1, id2]);
      deleteShapes([id1, id2]);

      const remaining = useCanvasStore.getState().shapes;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(id3);
      expect(useCanvasStore.getState().selectedIds).toEqual([]);
    });
  });

  describe('Undo / Redo Stack Behavior', () => {
    it('pushes snapshots onto undoStack on shape additions', () => {
      const { addShape } = useCanvasStore.getState();

      expect(useCanvasStore.getState().undoStack).toHaveLength(0);
      addShape({ type: 'rectangle', label: 'Shape 1' });
      expect(useCanvasStore.getState().undoStack).toHaveLength(1);
      expect(useCanvasStore.getState().undoStack[0]).toEqual([]);

      addShape({ type: 'circle', label: 'Shape 2' });
      expect(useCanvasStore.getState().undoStack).toHaveLength(2);
      expect(useCanvasStore.getState().undoStack[1]).toHaveLength(1);
    });

    it('undo reverts state and redo restores state', () => {
      const { addShape, undo, redo } = useCanvasStore.getState();

      addShape({ type: 'rectangle', label: 'First' });
      addShape({ type: 'circle', label: 'Second' });
      expect(useCanvasStore.getState().shapes).toHaveLength(2);

      // Undo Second
      undo();
      expect(useCanvasStore.getState().shapes).toHaveLength(1);
      expect(useCanvasStore.getState().shapes[0].label).toBe('First');
      expect(useCanvasStore.getState().redoStack).toHaveLength(1);

      // Undo First
      undo();
      expect(useCanvasStore.getState().shapes).toHaveLength(0);
      expect(useCanvasStore.getState().redoStack).toHaveLength(2);

      // Redo First
      redo();
      expect(useCanvasStore.getState().shapes).toHaveLength(1);
      expect(useCanvasStore.getState().shapes[0].label).toBe('First');

      // Redo Second
      redo();
      expect(useCanvasStore.getState().shapes).toHaveLength(2);
      expect(useCanvasStore.getState().shapes[1].label).toBe('Second');
    });

    it('clears redo stack when a new action is performed after undo', () => {
      const { addShape, undo } = useCanvasStore.getState();

      addShape({ type: 'rectangle', label: 'A' });
      addShape({ type: 'rectangle', label: 'B' });

      // Undo 'B'
      undo();
      expect(useCanvasStore.getState().shapes).toHaveLength(1);
      expect(useCanvasStore.getState().redoStack).toHaveLength(1);

      // Add new shape 'C' -> MUST clear redo stack
      addShape({ type: 'rectangle', label: 'C' });
      expect(useCanvasStore.getState().shapes).toHaveLength(2);
      expect(useCanvasStore.getState().shapes.map((s) => s.label)).toEqual(['A', 'C']);
      expect(useCanvasStore.getState().redoStack).toHaveLength(0);

      // Trying redo should do nothing
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().shapes.map((s) => s.label)).toEqual(['A', 'C']);
    });

    it('clears redo stack on updateShape or deleteShapes after undo', () => {
      const { addShape, updateShape, undo } = useCanvasStore.getState();

      const id = addShape({ type: 'rectangle', label: 'Original' });
      addShape({ type: 'circle', label: 'Temp' });

      undo(); // Undo temp circle
      expect(useCanvasStore.getState().redoStack).toHaveLength(1);

      updateShape(id, { label: 'Modified' });
      expect(useCanvasStore.getState().redoStack).toHaveLength(0);
    });

    it('bounds undo stack to MAX_HISTORY', () => {
      const { addShape } = useCanvasStore.getState();

      for (let i = 0; i < MAX_HISTORY + 10; i++) {
        addShape({ type: 'rectangle', label: `Shape ${i}` });
      }

      expect(useCanvasStore.getState().undoStack.length).toBe(MAX_HISTORY);
    });

    it('delegates to undoManager when configured', () => {
      const mockUndoManager = {
        undo: vi.fn(),
        redo: vi.fn(),
      };

      const { setUndoManager, undo, redo } = useCanvasStore.getState();

      setUndoManager(mockUndoManager);
      undo();
      expect(mockUndoManager.undo).toHaveBeenCalledTimes(1);

      redo();
      expect(mockUndoManager.redo).toHaveBeenCalledTimes(1);
    });
  });
});
