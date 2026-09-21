import { describe, it, expect } from 'vitest';
import {
  routeOrthogonalEdge,
  orthogonalManualArrow,
  simplifyOrthogonalPath,
  autoArrangeDiagram,
} from './orthogonalRouter';

describe('orthogonalRouter', () => {
  function isStrictlyOrthogonal(points) {
    if (!points || points.length < 4) return false;
    for (let i = 0; i < points.length - 2; i += 2) {
      const x1 = points[i];
      const y1 = points[i + 1];
      const x2 = points[i + 2];
      const y2 = points[i + 3];

      const isHorizontal = Math.abs(y1 - y2) < 0.001;
      const isVertical = Math.abs(x1 - x2) < 0.001;

      if (!isHorizontal && !isVertical) {
        return false;
      }
    }
    return true;
  }

  it('routes strictly orthogonal vertical hierarchical arrows (S above T)', () => {
    const sNode = { x: 100, y: 100, width: 160, height: 80 };
    const tNode = { x: 300, y: 300, width: 160, height: 80 };

    const points = routeOrthogonalEdge(sNode, tNode, { edgeIndex: 0 });
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(isStrictlyOrthogonal(points)).toBe(true);

    // First segment should exit bottom of sNode vertically
    expect(points[0]).toBe(points[2]); // x1 === x2 (vertical)
    // Last segment should enter top of tNode vertically
    expect(points[points.length - 4]).toBe(points[points.length - 2]); // vertical
  });

  it('routes strictly orthogonal horizontal arrows (S left of T)', () => {
    const sNode = { x: 50, y: 100, width: 150, height: 70 };
    const tNode = { x: 350, y: 150, width: 150, height: 70 };

    const points = routeOrthogonalEdge(sNode, tNode, { edgeIndex: 0 });
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(isStrictlyOrthogonal(points)).toBe(true);

    // First segment should exit right of sNode horizontally
    expect(points[1]).toBe(points[3]); // y1 === y2 (horizontal)
  });

  it('applies channel offsets between parallel edges to prevent overlapping', () => {
    const sNode = { x: 100, y: 100, width: 200, height: 80 };
    const tNode1 = { x: 100, y: 300, width: 140, height: 80 };
    const tNode2 = { x: 200, y: 300, width: 140, height: 80 };

    const edge1Points = routeOrthogonalEdge(sNode, tNode1, { edgeIndex: 0 });
    const edge2Points = routeOrthogonalEdge(sNode, tNode2, { edgeIndex: 1 });

    expect(isStrictlyOrthogonal(edge1Points)).toBe(true);
    expect(isStrictlyOrthogonal(edge2Points)).toBe(true);
    // Start anchor or intermediate bus should differ between the two edges
    expect(edge1Points[0] !== edge2Points[0] || edge1Points[3] !== edge2Points[3]).toBe(true);
  });

  it('generates strictly orthogonal lines for manual arrow drawing', () => {
    const start = { x: 50, y: 50 };
    const end = { x: 200, y: 120 };

    const points = orthogonalManualArrow(start, end);
    expect(isStrictlyOrthogonal(points)).toBe(true);
  });

  it('auto-arranges diagram shapes and eliminates box overlap and text leakage', () => {
    const shapes = [
      {
        id: 'c1',
        type: 'uml_class',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        text: 'Circle_\n────────────────\n-radius: float\n-center: unsigned int\n────────────────\n+area(): double\n+circum(): double\n+setRadius(): void',
      },
      {
        id: 'c2',
        type: 'uml_class',
        x: 120, // Overlapping c1
        y: 110,
        width: 120,
        height: 60,
        text: 'Shape\n────────────────\n+draw()\n+resize()',
      },
      {
        id: 'e1',
        type: 'arrow',
        source: 'c2',
        target: 'c1',
        points: [160, 140, 150, 125], // Raw diagonal points
      },
    ];

    const arranged = autoArrangeDiagram(shapes);
    const n1 = arranged.find((s) => s.id === 'c1');
    const n2 = arranged.find((s) => s.id === 'c2');
    const edge = arranged.find((s) => s.id === 'e1');

    // Width and height should expand for multiline content
    expect(n1.width).toBeGreaterThanOrEqual(160);
    expect(n1.height).toBeGreaterThanOrEqual(120);

    // Overlap should be resolved
    const overlapX = n1.x < n2.x + n2.width && n1.x + n1.width > n2.x;
    const overlapY = n1.y < n2.y + n2.height && n1.y + n1.height > n2.y;
    expect(overlapX && overlapY).toBe(false);

    // Edge points should be strictly orthogonal
    expect(isStrictlyOrthogonal(edge.points)).toBe(true);
  });
});
