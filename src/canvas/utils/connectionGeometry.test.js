/**
 * connectionGeometry.test.js
 * Unit tests for geometric anchor computation and dynamic connector routing.
 */

import { describe, it, expect } from 'vitest';
import {
  getNodeBounds,
  getNodeAnchors,
  getClosestAnchor,
  getBestConnectionPoints,
  findConnectedNodeAt,
} from './connectionGeometry.js';

describe('connectionGeometry', () => {
  describe('getNodeBounds', () => {
    it('returns correct bounds for rectangular/UML class node', () => {
      const node = { type: 'uml_class', x: 100, y: 150, width: 200, height: 120 };
      const bounds = getNodeBounds(node);
      expect(bounds).toEqual({
        x: 100,
        y: 150,
        width: 200,
        height: 120,
        centerX: 200,
        centerY: 210,
      });
    });

    it('returns correct bounds for circle centered at (x,y)', () => {
      const circle = { type: 'circle', x: 300, y: 200, radiusX: 50, radiusY: 50 };
      const bounds = getNodeBounds(circle);
      expect(bounds).toEqual({
        x: 250,
        y: 150,
        width: 100,
        height: 100,
        centerX: 300,
        centerY: 200,
      });
    });

    it('returns null for null node', () => {
      expect(getNodeBounds(null)).toBeNull();
    });
  });

  describe('getNodeAnchors', () => {
    it('calculates 4 cardinal anchors correctly', () => {
      const node = { type: 'rectangle', x: 100, y: 100, width: 100, height: 80 };
      const anchors = getNodeAnchors(node);
      expect(anchors).toEqual([
        { x: 150, y: 100, side: 'top' },
        { x: 150, y: 180, side: 'bottom' },
        { x: 100, y: 140, side: 'left' },
        { x: 200, y: 140, side: 'right' },
      ]);
    });
  });

  describe('getClosestAnchor', () => {
    it('finds the nearest cardinal anchor to target point', () => {
      const node = { type: 'rectangle', x: 100, y: 100, width: 100, height: 100 };
      // Target is far to the right (x=500, y=150)
      const anchor = getClosestAnchor(node, { x: 500, y: 150 });
      expect(anchor.side).toBe('right');
      expect(anchor.x).toBe(200);
      expect(anchor.y).toBe(150);
    });
  });

  describe('getBestConnectionPoints', () => {
    it('connects horizontally adjacent nodes via right and left anchors', () => {
      const nodeA = { type: 'uml_class', x: 100, y: 100, width: 150, height: 100 };
      const nodeB = { type: 'uml_class', x: 400, y: 100, width: 150, height: 100 };

      const points = getBestConnectionPoints(nodeA, nodeB);
      // nodeA right anchor is (250, 150), nodeB left anchor is (400, 150)
      expect(points).toEqual([250, 150, 400, 150]);
    });

    it('connects vertically adjacent nodes via bottom and top anchors', () => {
      const nodeA = { type: 'uml_class', x: 100, y: 50, width: 100, height: 100 };
      const nodeB = { type: 'uml_class', x: 100, y: 300, width: 100, height: 100 };

      const points = getBestConnectionPoints(nodeA, nodeB);
      // nodeA bottom anchor is (150, 150), nodeB top anchor is (150, 300)
      expect(points).toEqual([150, 150, 150, 300]);
    });

    it('preserves intermediate bend points for multi-segment arrows', () => {
      const nodeA = { type: 'rectangle', x: 100, y: 100, width: 100, height: 100 };
      const nodeB = { type: 'rectangle', x: 400, y: 300, width: 100, height: 100 };
      const multiPoints = [200, 150, 300, 150, 300, 350, 400, 350];

      const points = getBestConnectionPoints(nodeA, nodeB, multiPoints);
      expect(points).toHaveLength(8);
      // Inner bend points (300, 150) and (300, 350) preserved
      expect(points.slice(2, -2)).toEqual([300, 150, 300, 350]);
    });

    it('adjusts start point cleanly when only source node exists', () => {
      const nodeA = { type: 'rectangle', x: 100, y: 100, width: 100, height: 100 };
      const points = getBestConnectionPoints(nodeA, null, [200, 150, 500, 150]);
      expect(points).toEqual([200, 150, 500, 150]);
    });
  });

  describe('findConnectedNodeAt', () => {
    it('finds node when point is near anchor within threshold', () => {
      const shapes = [
        { id: 'node-1', type: 'uml_class', x: 100, y: 100, width: 100, height: 100 },
        { id: 'node-2', type: 'rectangle', x: 400, y: 400, width: 100, height: 100 },
      ];
      // Point (205, 152) is 5px away from node-1's right anchor (200, 150)
      const found = findConnectedNodeAt(205, 152, shapes);
      expect(found).not.toBeNull();
      expect(found.id).toBe('node-1');
    });

    it('returns null if point is far from any shape', () => {
      const shapes = [
        { id: 'node-1', type: 'rectangle', x: 100, y: 100, width: 100, height: 100 },
      ];
      expect(findConnectedNodeAt(800, 800, shapes)).toBeNull();
    });
  });
});
