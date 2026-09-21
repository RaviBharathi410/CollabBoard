import React from 'react';
import { Group, Rect, Line, Circle, Text } from 'react-konva';

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
 * Standard UML 2.5 Actor Stick Figure Component
 */
export function ActorNode({ shape, commonProps }) {
  const width = shape.width || 80;
  const height = shape.height || 110;
  const stroke = shape.stroke || '#4F46E5';
  const name = shape.name || shape.text || 'Actor';
  const role = shape.role || shape.stereotype || '';

  const cx = width / 2;

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Invisible hit area for smooth selection and dragging */}
      <Rect width={width} height={height} fill="transparent" />

      {/* Head Circle */}
      <Circle
        x={cx}
        y={18}
        radius={12}
        stroke={stroke}
        strokeWidth={2}
        fill="#FFFFFF"
      />

      {/* Torso */}
      <Line
        points={[cx, 30, cx, 58]}
        stroke={stroke}
        strokeWidth={2}
        lineCap="round"
      />

      {/* Arms */}
      <Line
        points={[cx - 18, 40, cx + 18, 40]}
        stroke={stroke}
        strokeWidth={2}
        lineCap="round"
      />

      {/* Left Leg */}
      <Line
        points={[cx, 58, cx - 14, 82]}
        stroke={stroke}
        strokeWidth={2}
        lineCap="round"
      />

      {/* Right Leg */}
      <Line
        points={[cx, 58, cx + 14, 82]}
        stroke={stroke}
        strokeWidth={2}
        lineCap="round"
      />

      {/* Optional Stereotype */}
      {role && (
        <Text
          text={`«${role}»`}
          x={0}
          y={86}
          width={width}
          align="center"
          fontSize={9.5}
          fontFamily="IBM Plex Sans"
          fontStyle="italic"
          fill="#6B7280"
          listening={false}
        />
      )}

      {/* Actor Name */}
      <Text
        text={name}
        x={0}
        y={role ? 98 : 88}
        width={width}
        align="center"
        fontSize={12}
        fontFamily="Plus Jakarta Sans"
        fontStyle="600"
        fill="#1E1B4B"
        listening={false}
      />
    </Group>
  );
}

/**
 * Standard UML 2.5 Use Case Ellipse / Oval Component
 */
export function UseCaseOvalNode({ shape, commonProps }) {
  const width = shape.width || 160;
  const height = shape.height || 70;
  const fill = shape.fill || '#FFFFFF';
  const stroke = shape.stroke || '#4F46E5';
  const title = shape.name || shape.text || 'Use Case';
  const stereotype = shape.stereotype || '';

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Pill / Oval geometry via cornerRadius = height / 2 */}
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        cornerRadius={height / 2}
        shadowColor="rgba(0,0,0,0.05)"
        shadowBlur={4}
        shadowOffsetY={2}
      />

      {stereotype && (
        <Text
          text={`«${stereotype}»`}
          x={10}
          y={10}
          width={width - 20}
          align="center"
          fontSize={10}
          fontFamily="IBM Plex Sans"
          fontStyle="italic"
          fill="#6B7280"
          listening={false}
        />
      )}

      <Text
        text={title}
        x={12}
        y={stereotype ? 24 : (height - 28) / 2}
        width={width - 24}
        height={height - (stereotype ? 30 : 10)}
        align="center"
        verticalAlign="middle"
        fontSize={12}
        fontFamily="Plus Jakarta Sans"
        fontStyle="600"
        fill="#1E1B4B"
        listening={false}
      />
    </Group>
  );
}

/**
 * System Boundary Container Component
 */
export function SystemBoundaryNode({ shape, commonProps }) {
  const width = shape.width || 600;
  const height = shape.height || 400;
  const name = shape.name || shape.title || shape.text || 'System';

  const badgeW = Math.max(70, Math.min(200, name.length * 8 + 20));

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Container Box */}
      <Rect
        width={width}
        height={height}
        fill="rgba(248, 250, 252, 0.6)"
        stroke="#94A3B8"
        strokeWidth={1.5}
        dash={[6, 4]}
        cornerRadius={8}
      />

      {/* System Name Header Tag */}
      <Group x={14} y={12} listening={false}>
        <Rect
          width={badgeW}
          height={22}
          fill="#E2E8F0"
          cornerRadius={4}
        />
        <Text
          text={name}
          x={0}
          y={4}
          width={badgeW}
          align="center"
          fontSize={11.5}
          fontFamily="Plus Jakarta Sans"
          fontStyle="700"
          fill="#334155"
        />
      </Group>
    </Group>
  );
}

/**
 * Use Case Edge Component:
 * Handles:
 * - Association (solid line connecting actor to use case)
 * - Include (dashed line + open arrow + «include» tag pointing to included use case)
 * - Extend (dashed line + open arrow + «extend» tag pointing to base use case)
 * - Generalization (solid line + hollow white triangle)
 */
export function UseCaseEdge({ shape, commonProps }) {
  const points = shape.points || [0, 0, 100, 100];
  if (points.length < 4) return null;

  const stroke = shape.stroke || '#4B5563';
  const strokeWidth = shape.strokeWidth || 1.5;
  const subtype = (shape.subtype || shape.type || 'association').toLowerCase();

  const isInclude = subtype.includes('include');
  const isExtend = subtype.includes('extend');
  const isGeneralization = subtype.includes('general') || subtype.includes('inherit');
  const isDashed = isInclude || isExtend || shape.style === 'dashed';

  const n = points.length;
  const pStart = { x: points[0], y: points[1] };
  const pEnd = { x: points[n - 2], y: points[n - 1] };
  const prevToEnd = { x: points[n - 4], y: points[n - 3] };

  const endVec = getVector(prevToEnd.x, prevToEnd.y, pEnd.x, pEnd.y);
  const shaftPoints = [...points];

  let markerElement = null;

  if (isGeneralization) {
    // Hollow white-filled triangle at target
    const L = 12;
    const W = 7;
    const bx = pEnd.x - L * endVec.ux;
    const by = pEnd.y - L * endVec.uy;
    const c1x = bx + W * endVec.nx;
    const c1y = by + W * endVec.ny;
    const c2x = bx - W * endVec.nx;
    const c2y = by - W * endVec.ny;

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
  } else if (isInclude || isExtend || shape.directed) {
    // Open 'V' stick arrowhead
    const L = 9;
    const W = 5;
    const f1x = pEnd.x - L * endVec.ux + W * endVec.nx;
    const f1y = pEnd.y - L * endVec.uy + W * endVec.ny;
    const f2x = pEnd.x - L * endVec.ux - W * endVec.nx;
    const f2y = pEnd.y - L * endVec.uy - W * endVec.ny;

    markerElement = (
      <Line
        points={[f1x, f1y, pEnd.x, pEnd.y, f2x, f2y]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  }

  // Label text
  let labelText = shape.label || shape.text || '';
  if (isInclude && !labelText) labelText = '«include»';
  if (isExtend && !labelText) labelText = '«extend»';

  const midX = (pStart.x + pEnd.x) / 2;
  const midY = (pStart.y + pEnd.y) / 2 - 12;
  const badgeW = Math.max(64, labelText.length * 7 + 14);
  const badgeH = 18;

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Shaft Line */}
      <Line
        points={shaftPoints}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={isDashed ? [6, 4] : undefined}
        lineCap="round"
        lineJoin="round"
      />

      {/* Terminal Marker */}
      {markerElement}

      {/* Stereotype Label Badge */}
      {labelText && (
        <Group x={midX} y={midY} listening={false}>
          <Rect
            x={-badgeW / 2}
            y={-badgeH / 2}
            width={badgeW}
            height={badgeH}
            fill="#FFFFFF"
            stroke="#E5E7EB"
            strokeWidth={1}
            cornerRadius={3}
            shadowColor="rgba(0,0,0,0.04)"
            shadowBlur={2}
            shadowOffsetY={1}
          />
          <Text
            text={labelText}
            x={-badgeW / 2}
            y={-badgeH / 2 + 3}
            width={badgeW}
            align="center"
            fontSize={10.5}
            fontFamily="IBM Plex Sans"
            fontStyle="600"
            fill={isInclude ? '#4F46E5' : isExtend ? '#D97706' : '#374151'}
          />
        </Group>
      )}
    </Group>
  );
}

export default {
  ActorNode,
  UseCaseOvalNode,
  SystemBoundaryNode,
  UseCaseEdge,
};
