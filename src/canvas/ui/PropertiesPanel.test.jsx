import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PropertiesPanel from './PropertiesPanel';
import useCanvasStore from '../hooks/useCanvasStore';

describe('PropertiesPanel Component', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useCanvasStore.setState({
      shapes: [
        { id: 'shape-1', type: 'rectangle', x: 100, y: 100, width: 100, height: 50, fill: '#FFFFFF', stroke: '#26241F' },
        { id: 'shape-2', type: 'uml_class', x: 250, y: 100, width: 160, height: 90, name: 'User', fill: '#FFFFFF', stroke: '#6C63FF' },
      ],
      selectedIds: [],
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders nothing when no shape is selected', async () => {
    await act(async () => {
      root.render(<PropertiesPanel />);
    });
    expect(container.querySelector('.properties-panel')).toBeNull();
  });

  it('renders nothing when multiple shapes are selected', async () => {
    useCanvasStore.setState({ selectedIds: ['shape-1', 'shape-2'] });
    await act(async () => {
      root.render(<PropertiesPanel />);
    });
    expect(container.querySelector('.properties-panel')).toBeNull();
  });

  it('renders panel with title and formatted type when 1 shape is selected', async () => {
    useCanvasStore.setState({ selectedIds: ['shape-2'] });
    await act(async () => {
      root.render(<PropertiesPanel />);
    });

    const panel = container.querySelector('.properties-panel');
    expect(panel).not.toBeNull();
    expect(panel.querySelector('.panel-title').textContent).toBe('Properties');
    expect(panel.querySelector('.panel-subtitle').textContent).toBe('UML Class');
  });

  it('deselects shape and closes when close button is clicked', async () => {
    useCanvasStore.setState({ selectedIds: ['shape-1'] });
    await act(async () => {
      root.render(<PropertiesPanel />);
    });

    const closeBtn = container.querySelector('.close-panel-btn');
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });

    expect(useCanvasStore.getState().selectedIds).toEqual([]);
  });

  it('runs tidy auto-arrange layout when Tidy Diagram Layout is clicked', async () => {
    useCanvasStore.setState({ selectedIds: ['shape-1'] });
    await act(async () => {
      root.render(<PropertiesPanel />);
    });

    const tidyBtn = container.querySelector('.tidy-btn');
    expect(tidyBtn).not.toBeNull();

    await act(async () => {
      tidyBtn.click();
    });

    const shapes = useCanvasStore.getState().shapes;
    expect(shapes.length).toBe(2);
  });
});
