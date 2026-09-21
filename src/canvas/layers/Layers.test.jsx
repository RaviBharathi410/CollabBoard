/**
 * Layers.test.jsx
 * Comprehensive unit tests for GridLayer & ShapesLayer:
 * - Empty vs populated shape lists
 * - Zoom/viewport transform calculations
 * - Shape dimension transform math
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import GridLayer, { calculateGridBounds, GRID_SIZE } from './GridLayer.jsx';
import ShapesLayer, { computeTransformedDimensions, transformBoundBox } from './ShapesLayer.jsx';
import useCanvasStore from '../store/canvasStore.js';

// Mock react-konva components to test rendering without Canvas 2D context
vi.mock('react-konva', () => ({
  Layer: ({ children, listening }) => (
    <div data-testid="konva-layer" data-listening={String(listening)}>
      {children}
    </div>
  ),
  Line: ({ points, stroke, opacity, id, onDragMove, onDragEnd, ...props }) => (
    <div
      data-testid="konva-line"
      data-shape-id={id}
      data-points={points?.join(',')}
      data-stroke={stroke}
      data-opacity={opacity}
      onMouseDown={onDragMove}
      onMouseUp={onDragEnd}
      {...props}
    />
  ),
  Rect: (props) => <div data-testid="konva-rect" data-id={props.id} />,
  Ellipse: (props) => <div data-testid="konva-ellipse" data-id={props.id} />,
  Arrow: ({ id, onDragMove, onDragEnd, ...props }) => (
    <div data-testid="konva-arrow" data-shape-id={id} onMouseDown={onDragMove} onMouseUp={onDragEnd} {...props} />
  ),
  Text: (props) => <div data-testid="konva-text" data-text={props.text}>{props.text}</div>,
  Group: ({ children, id, onClick, onDragMove, onDragEnd, ...props }) => (
    <div
      data-testid="konva-group"
      data-shape-id={id}
      onClick={onClick}
      onMouseDown={onDragMove}
      onMouseUp={onDragEnd}
      {...props}
    >
      {children}
    </div>
  ),
  Transformer: () => <div data-testid="konva-transformer" />,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Layers & Transform Math', () => {
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

  describe('GridLayer: Viewport Bounds & Transform Math', () => {
    it('calculates world coordinate bounds at scale 1 with origin at (0, 0)', () => {
      const bounds = calculateGridBounds({
        width: 1200,
        height: 800,
        scale: 1,
        position: { x: 0, y: 0 },
        gridSize: GRID_SIZE,
      });

      expect(bounds.startX).toBe(0);
      expect(bounds.endX).toBe(1200); // 1200 is 50 * 24
      expect(bounds.startY).toBe(0);
      expect(bounds.endY).toBe(792);  // floor(800 / 24) * 24 = 792
    });

    it('calculates world bounds when zoomed in (scale = 2)', () => {
      const bounds = calculateGridBounds({
        width: 1200,
        height: 800,
        scale: 2,
        position: { x: 0, y: 0 },
        gridSize: 24,
      });

      // At 2x zoom, 1200 screen pixels cover only 600 world units (25 * 24)
      // 800 screen pixels cover 400 world units, snapped to 16 * 24 = 384
      expect(bounds.startX).toBe(0);
      expect(bounds.endX).toBe(600);
      expect(bounds.startY).toBe(0);
      expect(bounds.endY).toBe(384);
    });

    it('calculates world bounds when panned (position offset)', () => {
      const bounds = calculateGridBounds({
        width: 960,
        height: 480,
        scale: 1,
        position: { x: -240, y: -120 },
        gridSize: 24,
      });

      // Panning right/down moves the visible window into positive world coordinates
      expect(bounds.startX).toBe(240);
      expect(bounds.endX).toBe(1200);
      expect(bounds.startY).toBe(120);
      expect(bounds.endY).toBe(600);
    });

    it('returns empty layer with no lines when scale < 0.25 (deep zoom-out optimization)', async () => {
      await act(async () => {
        root.render(
          <GridLayer width={1000} height={1000} scale={0.2} position={{ x: 0, y: 0 }} />
        );
      });

      const lines = container.querySelectorAll('[data-testid="konva-line"]');
      expect(lines.length).toBe(0);
    });

    it('renders horizontal and vertical grid lines when scale >= 0.25', async () => {
      await act(async () => {
        root.render(
          <GridLayer width={240} height={240} scale={1} position={{ x: 0, y: 0 }} />
        );
      });

      const lines = container.querySelectorAll('[data-testid="konva-line"]');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('ShapesLayer: Shape Rendering & Dimensions Math', () => {
    it('renders with an empty shape list without crashing', async () => {
      useCanvasStore.setState({ shapes: [] });

      await act(async () => {
        root.render(<ShapesLayer selectedIds={[]} onSelect={vi.fn()} />);
      });

      const rects = container.querySelectorAll('[data-testid="konva-rect"]');
      const groups = container.querySelectorAll('[data-testid="konva-group"]');
      expect(rects.length).toBe(0);
      expect(groups.length).toBe(0);
    });

    it('renders populated shape list with rectangle, circle, and text', async () => {
      useCanvasStore.setState({
        shapes: [
          { id: 's1', type: 'rectangle', x: 10, y: 10, width: 100, height: 60, label: 'Node 1' },
          { id: 's2', type: 'circle', x: 200, y: 200, radiusX: 40, radiusY: 40 },
          { id: 's3', type: 'text', x: 300, y: 100, text: 'Sample Text' },
        ],
      });

      await act(async () => {
        root.render(<ShapesLayer selectedIds={['s1']} onSelect={vi.fn()} />);
      });

      const layer = container.querySelector('[data-testid="konva-layer"]');
      expect(layer).not.toBeNull();

      // Check rendered shape groups
      const s1 = container.querySelector('[data-shape-id="s1"]');
      const s2 = container.querySelector('[data-shape-id="s2"]');
      expect(s1).not.toBeNull();
      expect(s2).not.toBeNull();
    });

    it('computes transformed dimensions for rectangle and enforces minimum bounds', () => {
      const rectShape = { type: 'rectangle', width: 100, height: 80 };

      // Scale 1.5
      const scaled = computeTransformedDimensions(rectShape, {
        scaleX: 1.5,
        scaleY: 2.0,
        x: 50,
        y: 60,
      });
      expect(scaled.width).toBe(150);
      expect(scaled.height).toBe(160);
      expect(scaled.x).toBe(50);
      expect(scaled.y).toBe(60);

      // Extreme shrink: clamps to minimum 5px
      const shrunk = computeTransformedDimensions(rectShape, {
        scaleX: 0.01,
        scaleY: 0.01,
        x: 10,
        y: 10,
      });
      expect(shrunk.width).toBe(5);
      expect(shrunk.height).toBe(5);

      // Node width = 0 fallback (prevents group collapse)
      const zeroNodeFallback = computeTransformedDimensions(rectShape, {
        scaleX: 1.2,
        scaleY: 1.2,
        width: 0,
        height: 0,
        x: 50,
        y: 60,
      });
      expect(zeroNodeFallback.width).toBe(120);
      expect(zeroNodeFallback.height).toBe(96);

      // Negative scale factor (flipped handle drag)
      const flipped = computeTransformedDimensions(rectShape, {
        scaleX: -1.5,
        scaleY: -1.2,
        x: 50,
        y: 60,
      });
      expect(flipped.width).toBe(150);
      expect(flipped.height).toBe(96);
    });

    it('computes transformed dimensions for circle radius', () => {
      const circleShape = { type: 'circle', radiusX: 30, radiusY: 20 };

      const scaled = computeTransformedDimensions(circleShape, {
        scaleX: 2.0,
        scaleY: 1.5,
        x: 100,
        y: 100,
      });
      expect(scaled.radiusX).toBe(60);
      expect(scaled.radiusY).toBe(30);

      // Clamped to minimum 5px
      const shrunk = computeTransformedDimensions(circleShape, {
        scaleX: 0.05,
        scaleY: 0.05,
        x: 0,
        y: 0,
      });
      expect(shrunk.radiusX).toBe(5);
      expect(shrunk.radiusY).toBe(5);
    });

    it('computes transformed font size for text elements', () => {
      const textShape = { type: 'text', fontSize: 16, width: 80 };

      const scaled = computeTransformedDimensions(textShape, {
        scaleX: 1.5,
        scaleY: 1.5,
        x: 20,
        y: 20,
      });
      expect(scaled.fontSize).toBe(24);
      expect(scaled.width).toBe(120);

      // Clamped to minimum font size of 10px
      const tiny = computeTransformedDimensions(textShape, {
        scaleX: 0.2,
        scaleY: 0.2,
        x: 0,
        y: 0,
      });
      expect(tiny.fontSize).toBe(10);
    });

    it('enforces bounding box minimum dimensions via transformBoundBox', () => {
      const oldBox = { x: 10, y: 10, width: 50, height: 50 };

      // Valid new box
      const validBox = { x: 10, y: 10, width: 30, height: 40 };
      expect(transformBoundBox(oldBox, validBox)).toBe(validBox);

      // Reject too narrow (< 5px)
      const narrowBox = { x: 10, y: 10, width: 4, height: 40 };
      expect(transformBoundBox(oldBox, narrowBox)).toBe(oldBox);

      // Reject too short (< 5px)
      const shortBox = { x: 10, y: 10, width: 30, height: 3 };
      expect(transformBoundBox(oldBox, shortBox)).toBe(oldBox);
    });

    it('renders arrow, pencil, and AI badges on AI-generated shapes', async () => {
      useCanvasStore.setState({
        shapes: [
          { id: 'arr-1', type: 'arrow', points: [0, 0, 100, 100] },
          { id: 'pen-1', type: 'pencil', points: [10, 10, 20, 20, 30, 30] },
          { id: 'ai-rect', type: 'rectangle', width: 100, height: 50, aiGenerated: true },
        ],
      });

      await act(async () => {
        root.render(<ShapesLayer selectedIds={[]} onSelect={vi.fn()} />);
      });

      const arrow = container.querySelector('[data-shape-id="arr-1"]');
      const pencil = container.querySelector('[data-shape-id="pen-1"]');
      const aiShape = container.querySelector('[data-shape-id="ai-rect"]');

      expect(arrow).not.toBeNull();
      expect(pencil).not.toBeNull();
      expect(aiShape).not.toBeNull();
      expect(aiShape.textContent).toContain('✦ AI');
    });

    it('computes transformed dimensions for diamond shape', () => {
      const diamondShape = { type: 'diamond', width: 120, height: 80 };

      const scaled = computeTransformedDimensions(diamondShape, {
        scaleX: 1.5,
        scaleY: 1.5,
        x: 40,
        y: 60,
      });
      expect(scaled.width).toBe(180);
      expect(scaled.height).toBe(120);
      expect(scaled.x).toBe(40);
      expect(scaled.y).toBe(60);
    });

    it('renders diamond shape with group and line polygon', async () => {
      useCanvasStore.setState({
        shapes: [
          { id: 'dia-1', type: 'diamond', x: 50, y: 50, width: 120, height: 80, fill: '#FFFFFF', stroke: '#26241F' },
        ],
      });

      await act(async () => {
        root.render(<ShapesLayer selectedIds={[]} onSelect={vi.fn()} />);
      });

      const diamond = container.querySelector('[data-shape-id="dia-1"]');
      expect(diamond).not.toBeNull();
    });
  });
});
