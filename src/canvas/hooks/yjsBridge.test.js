import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  setYjsDocument,
  getYjsShapesMap,
  getYjsDocument,
  markShapeAiGenerated,
} from './yjsBridge';

describe('yjsBridge.js', () => {
  let ydoc;

  beforeEach(() => {
    ydoc = new Y.Doc();
    setYjsDocument(ydoc);
  });

  it('correctly sets and retrieves Yjs document and shapes map', () => {
    expect(getYjsDocument()).toBe(ydoc);
    const shapesMap = getYjsShapesMap();
    expect(shapesMap).toBeDefined();
    expect(shapesMap instanceof Y.Map).toBe(true);
  });

  it('marks shape as AI generated with model and timestamp', () => {
    const shapesMap = getYjsShapesMap();
    shapesMap.set('shape-1', { id: 'shape-1', type: 'rectangle', x: 100, y: 100 });

    const now = Date.now();
    markShapeAiGenerated('shape-1', { aiModel: 'flan-t5-fine-tuned', aiTimestamp: now });

    const updated = shapesMap.get('shape-1');
    expect(updated.aiGenerated).toBe(true);
    expect(updated.aiModel).toBe('flan-t5-fine-tuned');
    expect(updated.aiTimestamp).toBe(now);
    expect(updated.x).toBe(100);
  });

  it('handles markShapeAiGenerated gracefully when shape does not exist yet', () => {
    markShapeAiGenerated('new-shape', { aiModel: 'yolov8-onnx' });
    const shapesMap = getYjsShapesMap();
    const updated = shapesMap.get('new-shape');
    expect(updated).toBeDefined();
    expect(updated.aiGenerated).toBe(true);
    expect(updated.aiModel).toBe('yolov8-onnx');
  });

  it('clears references when null document is passed', () => {
    setYjsDocument(null);
    expect(getYjsDocument()).toBeNull();
    expect(getYjsShapesMap()).toBeNull();
  });
});
