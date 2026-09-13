import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';
import useImportDiagram from './useImportDiagram';
import useCanvasStore from '../store/canvasStore';

describe('useImportDiagram Hook', () => {
  let container;
  let root;
  let mockStageRef;

  beforeEach(() => {
    useCanvasStore.setState({ shapes: [], selectedIds: [] });
    mockStageRef = {
      current: {
        scaleX: () => 1,
        x: () => 0,
        y: () => 0,
        width: () => 1200,
        height: () => 800,
      },
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function setupHook() {
    let hookRef = null;
    function Consumer() {
      const hook = useImportDiagram(mockStageRef);
      useEffect(() => {
        hookRef = hook;
      });
      hookRef = hook;
      return null;
    }

    return {
      render: async () => {
        await act(async () => {
          root.render(React.createElement(Consumer));
        });
      },
      getHook: () => hookRef,
    };
  }

  it('initializes with default idle state', async () => {
    const { render, getHook } = setupHook();
    await render();

    const hook = getHook();
    expect(hook.isImporting).toBe(false);
    expect(hook.error).toBeNull();
    expect(hook.previewDiagram).toBeNull();
    expect(hook.importMeta).toBeNull();
    expect(hook.highPrecision).toBe(false);
  });

  it('updates an element in preview and dispatches active learning feedback', async () => {
    const sampleDiagram = {
      type: 'architecture',
      sourceType: 'drawio',
      nodes: [
        { id: 'node-1', type: 'rectangle', label: 'Old Label', confidence: 0.75, source: 'detected' },
      ],
      edges: [],
      confidenceReport: {
        overall: 0.75,
        lowConfidenceCount: 1,
        lowConfidenceElements: [{ id: 'node-1', label: 'Old Label', confidence: 0.75 }],
      },
    };

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        format: 'drawio',
        diagram: sampleDiagram,
      }),
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const { render, getHook } = setupHook();
    await render();

    await act(async () => {
      await getHook().importText('<xml>...</xml>', 'drawio');
    });

    expect(getHook().previewDiagram).not.toBeNull();
    expect(getHook().previewDiagram.nodes[0].label).toBe('Old Label');

    // Perform correction
    await act(async () => {
      await getHook().updateElement('node-1', { label: 'Corrected Service', type: 'service' });
    });

    // Check preview updated
    expect(getHook().previewDiagram.nodes[0].label).toBe('Corrected Service');
    expect(getHook().previewDiagram.nodes[0].confidence).toBe(1.0);
    expect(getHook().previewDiagram.confidenceReport.lowConfidenceCount).toBe(0);

    // Verify feedback was dispatched
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/feedback'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"correction"'),
      })
    );
  });

  it('commits preview nodes and edges to canvasStore', async () => {
    const { render, getHook } = setupHook();
    await render();

    const sampleDiagram = {
      type: 'architecture',
      sourceType: 'drawio',
      nodes: [
        { id: 'gw', type: 'rectangle', label: 'Gateway', x: 100, y: 100, width: 140, height: 60, confidence: 1.0 },
        { id: 'auth', type: 'circle', label: 'Auth', x: 300, y: 100, width: 80, height: 80, confidence: 1.0 },
      ],
      edges: [
        { id: 'e1', source: 'gw', target: 'auth', style: 'solid', points: [[240, 130], [300, 140]] },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        format: 'drawio',
        diagram: sampleDiagram,
      }),
    });

    await act(async () => {
      await getHook().importText('<xml>...</xml>', 'drawio');
    });

    await act(async () => {
      await getHook().commitToCanvas();
    });

    const shapes = useCanvasStore.getState().shapes;
    expect(shapes.length).toBeGreaterThan(0);

    const rectShape = shapes.find((s) => s.type === 'rectangle');
    expect(rectShape).toBeDefined();

    const circleShape = shapes.find((s) => s.type === 'circle');
    expect(circleShape).toBeDefined();

    const arrowShape = shapes.find((s) => s.type === 'arrow');
    expect(arrowShape).toBeDefined();

    const textLabels = shapes.filter((s) => s.type === 'text');
    expect(textLabels.map((t) => t.text)).toContain('Gateway');
    expect(textLabels.map((t) => t.text)).toContain('Auth');

    expect(getHook().previewDiagram).toBeNull();
  });
});
