import React from 'react';
import { Group, Line, Text, Rect } from 'react-konva';

/**
 * Geometric helper: computes unit vectors and marker geometry
 * for precision UML connectors.
 */
function getVector(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  return { len, ux, uy, nx, ny };
}

/**
 * Native Konva UML Connector with high-precision arrowheads:
 * - Inheritance (Generalization): Closed, hollow white-filled triangle
 * - Composition: Closed, solid-filled diamond
 * - Aggregation: Closed, hollow white-filled diamond
 * - Dependency: Dashed line with open 'V' arrowhead
 * - Association: Solid line with optional open directional arrow
 * - Multiplicity labels at endpoints ('1', '0..*', '1..*')
 */
export function UMLConnector({ shape, commonProps }) {
  const points = shape.points || [0, 0, 100, 100];
  if (points.length < 4) return null;

  const stroke = shape.stroke || '#6C63FF';
  const strokeWidth = shape.strokeWidth || 1.5;
  const subtype = (shape.subtype || shape.label || '').toLowerCase();

  const isInheritance = subtype.includes('inherit') || subtype.includes('general') || subtype.includes('realiz');
  const isComposition = subtype.includes('comp');
  const isAggregation = subtype.includes('aggr');
  const isDependency = subtype.includes('depend') || shape.style === 'dashed';
  const isDirectedAssoc = subtype.includes('assoc') && shape.directed;

  // Segment endpoints
  const n = points.length;
  const pStart = { x: points[0], y: points[1] };
  const pEnd = { x: points[n - 2], y: points[n - 1] };
  const prevToEnd = { x: points[n - 4], y: points[n - 3] };
  const nextFromStart = { x: points[2], y: points[3] };

  // Vectors
  const endVec = getVector(prevToEnd.x, prevToEnd.y, pEnd.x, pEnd.y);
  const startVec = getVector(pStart.x, pStart.y, nextFromStart.x, nextFromStart.y);

  // Shaft adjustments so markers sit cleanly without shaft lines bleeding through hollow shapes
  const shaftPoints = [...points];
  let markerElement = null;

  if (isInheritance) {
    // Hollow white-filled triangle at target
    const L = 14;
    const W = 8;
    const bx = pEnd.x - L * endVec.ux;
    const by = pEnd.y - L * endVec.uy;
    const c1x = bx + W * endVec.nx;
    const c1y = by + W * endVec.ny;
    const c2x = bx - W * endVec.nx;
    const c2y = by - W * endVec.ny;

    // Shorten shaft to base of triangle
    shaftPoints[n - 2] = bx;
    shaftPoints[n - 1] = by;

    markerElement = (
      <Line
        points={[pEnd.x, pEnd.y, c1x, c1y, c2x, c2y]}
        closed
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  } else if (isComposition || isAggregation) {
    // Diamond at source end (UML standard: container class gets diamond)
    const L = 8; // half length
    const W = 6; // half width
    const cx = pStart.x + L * startVec.ux;
    const cy = pStart.y + L * startVec.uy;
    const fx = pStart.x + 2 * L * startVec.ux;
    const fy = pStart.y + 2 * L * startVec.uy;

    const s1x = cx + W * startVec.nx;
    const s1y = cy + W * startVec.ny;
    const s2x = cx - W * startVec.nx;
    const s2y = cy - W * startVec.ny;

    // Shorten shaft from far tip of diamond
    shaftPoints[0] = fx;
    shaftPoints[1] = fy;

    markerElement = (
      <Line
        points={[pStart.x, pStart.y, s1x, s1y, fx, fy, s2x, s2y]}
        closed
        fill={isComposition ? stroke : '#FFFFFF'}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  } else if (isDependency) {
    // Open 'V' arrowhead at target
    const L = 10;
    const W = 6;
    const f1x = pEnd.x - L * endVec.ux + W * endVec.nx;
    const f1y = pEnd.y - L * endVec.uy + W * endVec.ny;
    const f2x = pEnd.x - L * endVec.ux - W * endVec.nx;
    const f2y = pEnd.y - L * endVec.uy - W * endVec.ny;

    markerElement = (
      <Line
        points={[f1x, f1y, pEnd.x, pEnd.y, f2x, f2y]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  } else if (isDirectedAssoc) {
    // Open 'V' arrowhead at target
    const L = 10;
    const W = 6;
    const f1x = pEnd.x - L * endVec.ux + W * endVec.nx;
    const f1y = pEnd.y - L * endVec.uy + W * endVec.ny;
    const f2x = pEnd.x - L * endVec.ux - W * endVec.nx;
    const f2y = pEnd.y - L * endVec.uy - W * endVec.ny;

    markerElement = (
      <Line
        points={[f1x, f1y, pEnd.x, pEnd.y, f2x, f2y]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  }

  // Multiplicity labels
  const multSource = shape.multiplicitySource || shape.sourceMultiplicity || '';
  const multTarget = shape.multiplicityTarget || shape.targetMultiplicity || '';

  // Edge text label
  const edgeLabel = shape.label && !isInheritance && !isComposition && !isAggregation && !isDependency
    ? shape.label
    : '';

  // Find midpoint along the longest segment of the orthogonal path
  let labelX = (pStart.x + pEnd.x) / 2;
  let labelY = (pStart.y + pEnd.y) / 2;
  let maxSegLen = 0;

  for (let i = 0; i < points.length - 2; i += 2) {
    const sx = points[i];
    const sy = points[i + 1];
    const ex = points[i + 2];
    const ey = points[i + 3];
    const segLen = Math.hypot(ex - sx, ey - sy);
    if (segLen > maxSegLen) {
      maxSegLen = segLen;
      labelX = (sx + ex) / 2;
      labelY = (sy + ey) / 2;
    }
  }

  const badgeW = Math.max(64, Math.min(130, (edgeLabel || '').length * 7.5 + 16));
  const badgeH = 20;

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Shaft line */}
      <Line
        points={shaftPoints}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={isDependency ? [6, 4] : shape.dash}
        lineCap="round"
        lineJoin="round"
      />

      {/* Terminal marker */}
      {markerElement}

      {/* Edge relationship label with crisp pill background */}
      {edgeLabel && (
        <Group x={labelX} y={labelY} listening={false}>
          <Rect
            x={-badgeW / 2}
            y={-badgeH / 2}
            width={badgeW}
            height={badgeH}
            fill="#FFFFFF"
            stroke="#DCDAD5"
            strokeWidth={1}
            cornerRadius={4}
            shadowColor="rgba(0,0,0,0.06)"
            shadowBlur={2}
            shadowOffsetY={1}
          />
          <Text
            text={edgeLabel}
            x={-badgeW / 2}
            y={-badgeH / 2 + 4}
            width={badgeW}
            align="center"
            fontSize={10.5}
            fontFamily="IBM Plex Sans"
            fontStyle="600"
            fill="#4A4754"
          />
        </Group>
      )}

      {/* Source Multiplicity */}
      {multSource && (
        <Text
          text={multSource}
          x={pStart.x + 10 * startVec.ux + 8 * startVec.nx}
          y={pStart.y + 10 * startVec.uy + 8 * startVec.ny - 6}
          fontSize={11}
          fontFamily="IBM Plex Mono"
          fill="#1A1A2E"
          listening={false}
        />
      )}

      {/* Target Multiplicity */}
      {multTarget && (
        <Text
          text={multTarget}
          x={pEnd.x - 24 * endVec.ux + 8 * endVec.nx}
          y={pEnd.y - 24 * endVec.uy + 8 * endVec.ny - 6}
          fontSize={11}
          fontFamily="IBM Plex Mono"
          fill="#1A1A2E"
          listening={false}
        />
      )}
    </Group>
  );
}

export default UMLConnector;
