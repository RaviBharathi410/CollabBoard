import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasStage from './CanvasStage';
import useCanvasStore from './store/canvasStore';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-board-uuid-123' }),
}));

// Mock useMultiplayer
vi.mock('./hooks/useMultiplayer', () => ({
  default: () => ({
    others: [],
    updateCursor: vi.fn(),
  }),
}));

// Mock useAIEngine
vi.mock('./hooks/useAIEngine', () => ({
  default: () => ({
    state: { isEnhancing: false, askResponse: null },
    enhanceDiagram: vi.fn(),
    answerClarification: vi.fn(),
    retryEnhance: vi.fn(),
    dismissError: vi.fn(),
    applySuggestion: vi.fn(),
  }),
}));

// Mock react-konva Stage to support testing mouse down events
vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown, ...props }) => (
    <div
      data-testid="konva-stage"
      onClick={() => {
        const fakeStage = {
          x: () => 0,
          y: () => 0,
          scaleX: () => 1,
          scaleY: () => 1,
          getPointerPosition: () => ({ x: 100, y: 100 }),
        };
        onMouseDown?.({
          target: {
            getStage: () => fakeStage,
            name: () => 'grid',
          },
        });
      }}
      {...props}
    >
      {children}
    </div>
  ),
  Layer: ({ children }) => <div data-testid="konva-layer">{children}</div>,
}));

vi.mock('./layers/GridLayer', () => ({
  default: () => <div data-testid="mock-grid-layer" />,
}));

vi.mock('./layers/ShapesLayer', () => ({
  default: () => <div data-testid="mock-shapes-layer" />,
}));

vi.mock('./layers/CursorLayer', () => ({
  default: () => <div data-testid="mock-cursor-layer" />,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CanvasStage Component Interactions & Shortcuts', () => {
  let container;
  let root;

  beforeEach(() => {
    useCanvasStore.setState({
      shapes: [
        { id: 'shape-1', type: 'rectangle', x: 100, y: 100, width: 80, height: 80 },
        { id: 'shape-2', type: 'circle', x: 200, y: 200, radiusX: 40, radiusY: 40 },
      ],
      selectedIds: [],
      activeTool: 'select',
      past: [],
      future: [],
      undoStack: [],
      redoStack: [],
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders CanvasStage with toolbar and Konva stage container', async () => {
    await act(async () => {
      root.render(<CanvasStage />);
    });

    expect(container.querySelector('.canvas-container-root')).not.toBeNull();
    expect(container.querySelector('[data-testid="konva-stage"]')).not.toBeNull();
  });

  it('switches tools via single-letter keyboard shortcuts', async () => {
    await act(async () => {
      root.render(<CanvasStage />);
    });

    // Press 'r' for rectangle
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    });
    expect(useCanvasStore.getState().activeTool).toBe('rectangle');

    // Press 'c' for circle
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    });
    expect(useCanvasStore.getState().activeTool).toBe('circle');

    // Press 'a' for arrow
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(useCanvasStore.getState().activeTool).toBe('arrow');

    // Press 'p' for pencil
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });
    expect(useCanvasStore.getState().activeTool).toBe('pencil');

    // Press 'v' for select
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    });
    expect(useCanvasStore.getState().activeTool).toBe('select');
  });

  it('ignores keyboard shortcuts when an INPUT or TEXTAREA element is focused', async () => {
    await act(async () => {
      root.render(<CanvasStage />);
    });

    const input = document.createElement('input');
    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(input);

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
      });

      // Active tool should remain 'select', not 'rectangle'
      expect(useCanvasStore.getState().activeTool).toBe('select');
    } finally {
      spy.mockRestore();
    }
  });

  it('deletes selected shapes when Delete or Backspace key is pressed', async () => {
    await act(async () => {
      root.render(<CanvasStage />);
    });

    act(() => {
      useCanvasStore.setState({ selectedIds: ['shape-1'] });
    });

    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });

    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    expect(useCanvasStore.getState().shapes[0].id).toBe('shape-2');
  });

  it('handles undo and redo shortcuts (Ctrl+Z, Ctrl+Y)', async () => {
    const s1 = { id: 's1', type: 'rect' };
    const s2 = { id: 's2', type: 'circle' };

    act(() => {
      useCanvasStore.setState({
        shapes: [s1, s2],
        undoStack: [[s1]],
        redoStack: [],
      });
    });

    await act(async () => {
      root.render(<CanvasStage />);
    });

    // Trigger Ctrl+Z (Undo)
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(useCanvasStore.getState().shapes).toHaveLength(1);

    // Trigger Ctrl+Y (Redo)
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    });
    expect(useCanvasStore.getState().shapes).toHaveLength(2);
  });

  it('clears selection when clicking on empty stage space', async () => {
    await act(async () => {
      root.render(<CanvasStage />);
    });

    act(() => {
      useCanvasStore.setState({ selectedIds: ['shape-1', 'shape-2'] });
    });
    expect(useCanvasStore.getState().selectedIds).toHaveLength(2);

    const stageEl = container.querySelector('[data-testid="konva-stage"]');
    await act(async () => {
      stageEl.click();
    });

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0);
  });
});
