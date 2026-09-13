/**
 * Toolbar.test.jsx
 * Unit tests for Toolbar component and keyboard shortcuts (V, H, R, C, A, P, T, unrecognized keys).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Toolbar from './Toolbar.jsx';
import useCanvasStore from '../store/canvasStore.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Toolbar Component & Keyboard Shortcuts', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useCanvasStore.setState({
      shapes: [],
      selectedIds: [],
      activeTool: 'select',
      undoStack: [],
      redoStack: [],
      undoManager: null,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all toolbar buttons with accessible labels', async () => {
    await act(async () => {
      root.render(<Toolbar />);
    });

    const toolbarNav = container.querySelector('nav.drafting-floating-toolbar');
    expect(toolbarNav).not.toBeNull();

    const buttons = container.querySelectorAll('button.tool-btn');
    expect(buttons.length).toBeGreaterThanOrEqual(8);
  });

  it('updates active tool on button click', async () => {
    await act(async () => {
      root.render(<Toolbar />);
    });

    const rectBtn = container.querySelector('button[title*="Rectangle"]');
    expect(rectBtn).not.toBeNull();

    await act(async () => {
      rectBtn.click();
    });

    expect(useCanvasStore.getState().activeTool).toBe('rectangle');
  });

  describe('Keyboard Shortcuts (V, H, R, C, A, P, T)', () => {
    const fireKey = (key, target = window) => {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
    };

    it('switches tool to select on "V"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      useCanvasStore.setState({ activeTool: 'rectangle' });

      await act(async () => {
        fireKey('v');
      });
      expect(useCanvasStore.getState().activeTool).toBe('select');

      // Also capital V
      useCanvasStore.setState({ activeTool: 'pencil' });
      await act(async () => {
        fireKey('V');
      });
      expect(useCanvasStore.getState().activeTool).toBe('select');
    });

    it('switches tool to hand on "H"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      await act(async () => {
        fireKey('h');
      });
      expect(useCanvasStore.getState().activeTool).toBe('hand');
    });

    it('switches tool to rectangle on "R"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      await act(async () => {
        fireKey('r');
      });
      expect(useCanvasStore.getState().activeTool).toBe('rectangle');
    });

    it('switches tool to circle on "C"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      await act(async () => {
        fireKey('c');
      });
      expect(useCanvasStore.getState().activeTool).toBe('circle');
    });

    it('switches tool to arrow on "A"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      await act(async () => {
        fireKey('a');
      });
      expect(useCanvasStore.getState().activeTool).toBe('arrow');
    });

    it('switches tool to pencil on "P"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      await act(async () => {
        fireKey('p');
      });
      expect(useCanvasStore.getState().activeTool).toBe('pencil');
    });

    it('switches tool to text on "T"', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      await act(async () => {
        fireKey('t');
      });
      expect(useCanvasStore.getState().activeTool).toBe('text');
    });

    it('leaves active tool unchanged on unrecognized keys', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      useCanvasStore.setState({ activeTool: 'rectangle' });

      // Unrecognized keys
      const unrecognized = ['x', 'z', 'q', '1', 'Escape', 'Enter', 'Shift', 'F1'];
      for (const key of unrecognized) {
        await act(async () => {
          fireKey(key);
        });
        expect(useCanvasStore.getState().activeTool).toBe('rectangle');
      }
    });

    it('ignores shortcuts when user is typing in an input field', async () => {
      await act(async () => {
        root.render(<Toolbar />);
      });

      useCanvasStore.setState({ activeTool: 'select' });

      const input = document.createElement('input');
      document.body.appendChild(input);

      await act(async () => {
        const event = new KeyboardEvent('keydown', {
          key: 'r',
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(event);
      });

      // Tool should remain 'select', not 'rectangle'
      expect(useCanvasStore.getState().activeTool).toBe('select');
      input.remove();
    });
  });

  describe('Undo / Redo Buttons', () => {
    it('triggers undo and redo actions when clicked', async () => {
      const undoSpy = vi.spyOn(useCanvasStore.getState(), 'undo');
      const redoSpy = vi.spyOn(useCanvasStore.getState(), 'redo');

      // Mock an undoManager with items so buttons are enabled
      const mockUndoManager = {
        undoStack: [{ id: 'mock-1' }],
        redoStack: [{ id: 'mock-2' }],
        on: vi.fn(),
        off: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
      };
      useCanvasStore.setState({ undoManager: mockUndoManager });

      await act(async () => {
        root.render(<Toolbar />);
      });

      const undoBtn = container.querySelector('button[aria-label="Undo"]');
      const redoBtn = container.querySelector('button[aria-label="Redo"]');

      expect(undoBtn.disabled).toBe(false);
      expect(redoBtn.disabled).toBe(false);

      await act(async () => {
        undoBtn.click();
      });
      expect(undoSpy).toHaveBeenCalled();

      await act(async () => {
        redoBtn.click();
      });
      expect(redoSpy).toHaveBeenCalled();
    });
  });
});
