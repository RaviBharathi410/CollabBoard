/**
 * useCanvasStore.test.js
 * Unit tests for core Zustand canvas state machine (shapes, selection, tools, undo/redo).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import useCanvasStore from './useCanvasStore.js';

describe('useCanvasStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useCanvasStore.setState({
      shapes: [],
      selectedIds: [],
      activeTool: 'select',
      undoManager: null,
    });
  });

  it('has correct initial default state', () => {
    const state = useCanvasStore.getState();
    expect(state.shapes).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.activeTool).toBe('select');
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

  it('updates shapes silently during drag', () => {
    const { addShape, updateShapeSilent } = useCanvasStore.getState();

    const id = addShape({ type: 'rectangle', x: 0, y: 0 });
    updateShapeSilent(id, { x: 120, y: 80 });

    const shape = useCanvasStore.getState().shapes.find((s) => s.id === id);
    expect(shape.x).toBe(120);
    expect(shape.y).toBe(80);
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

  it('delegates undo and redo to undoManager if configured', () => {
    const mockUndoManager = {
      undo: vi.fn(),
      redo: vi.fn(),
    };

    const { setUndoManager, undo, redo } = useCanvasStore.getState();

    // Before setting manager — should not throw
    undo();
    redo();

    setUndoManager(mockUndoManager);
    undo();
    expect(mockUndoManager.undo).toHaveBeenCalledTimes(1);

    redo();
    expect(mockUndoManager.redo).toHaveBeenCalledTimes(1);
  });
});
