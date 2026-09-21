import React from 'react';
import { Group, Rect, Line, Text } from 'react-konva';

/**
 * Helper to compute unit vector for arrowhead orientation
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
 * Lifeline Node Component:
 * Renders the top participant header box and the vertical dashed centerline.
 */
export function SequenceLifelineNode({ shape, commonProps }) {
  const width = shape.width || 140;
  const height = shape.height || 50;
  const lineHeight = shape.lineHeight || 400;
  const stroke = shape.stroke || '#4F46E5';
  const fill = shape.fill || '#EEF2FF';
  const name = shape.name || shape.text || 'Participant';
  const role = shape.role || shape.stereotype || '';

  const cx = width / 2;

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Vertical Dashed Centerline (UML Lifeline) */}
      <Line
        points={[cx, height, cx, height + lineHeight]}
        stroke={stroke}
        strokeWidth={1.5}
        dash={[6, 4]}
        listening={false}
      />

      {/* Lifeline Header Box */}
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.06)"
        shadowBlur={4}
        shadowOffsetY={2}
      />

      {/* Optional Stereotype / Role e.g. <<actor>> or <<service>> */}
      {role && (
        <Text
          text={`«${role}»`}
          x={4}
          y={6}
          width={width - 8}
          align="center"
          fontSize={10}
          fontFamily="IBM Plex Sans"
          fontStyle="italic"
          fill="#6B7280"
          listening={false}
        />
      )}

      {/* Participant Name e.g. 'User : Client' or ':AuthService' */}
      <Text
        text={name}
        x={6}
        y={role ? 22 : (height - 16) / 2}
        width={width - 12}
        align="center"
        fontSize={12.5}
        fontFamily="Plus Jakarta Sans"
        fontStyle="600"
        fill="#1E1B4B"
        listening={false}
      />
    </Group>
  );
}

/**
 * Activation Bar Node (Execution Specification):
 * Slender vertical bar indicating active execution/processing on a lifeline.
 */
export function SequenceActivationNode({ shape, commonProps }) {
  const width = shape.width || 14;
  const height = shape.height || 80;
  const fill = shape.fill || '#FFFFFF';
  const stroke = shape.stroke || '#4F46E5';
  const strokeWidth = shape.strokeWidth || 1.5;

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={2}
        shadowColor="rgba(0,0,0,0.05)"
        shadowBlur={3}
        shadowOffsetY={1}
      />
    </Group>
  );
}

/**
 * Sequence Message Connector:
 * Standard UML 2.5 Message Notation:
 * - Synchronous Call: Solid horizontal line with filled solid arrowhead (caller waits for reply)
 * - Asynchronous Call: Solid horizontal line with open stick arrowhead (non-blocking)
 * - Reply / Return: Dashed horizontal line with open stick arrowhead
 * - Self Message: Rectangular loop back to the same lifeline
 */
export function SequenceMessageEdge({ shape, commonProps }) {
  const points = shape.points || [0, 0, 100, 0];
  if (points.length < 4) return null;

  const stroke = shape.stroke || '#374151';
  const strokeWidth = shape.strokeWidth || 1.5;
  const subtype = (shape.subtype || shape.type || 'sync_message').toLowerCase();

  const isReturn =
    subtype.includes('return') ||
    subtype.includes('reply') ||
    shape.style === 'dashed';

  const isAsync =
    subtype.includes('async') ||
    subtype.includes('signal');

  const isCreate = subtype.includes('create');

  // If sync_message, standard OMG UML is filled triangle. If async or return, open 'V' stick arrow.
  const isSync = !isReturn && !isAsync && !isCreate;

  const n = points.length;
  const pStart = { x: points[0], y: points[1] };
  const pEnd = { x: points[n - 2], y: points[n - 1] };
  const prevToEnd = { x: points[n - 4], y: points[n - 3] };

  const endVec = getVector(prevToEnd.x, prevToEnd.y, pEnd.x, pEnd.y);
  const shaftPoints = [...points];

  let markerElement = null;

  if (isSync) {
    // Solid filled arrowhead at target
    const L = 10;
    const W = 5;
    const bx = pEnd.x - L * endVec.ux;
    const by = pEnd.y - L * endVec.uy;
    const c1x = bx + W * endVec.nx;
    const c1y = by + W * endVec.ny;
    const c2x = bx - W * endVec.nx;
    const c2y = by - W * endVec.ny;

    // Shorten shaft to arrowhead base
    shaftPoints[n - 2] = bx;
    shaftPoints[n - 1] = by;

    markerElement = (
      <Line
        points={[pEnd.x, pEnd.y, c1x, c1y, c2x, c2y]}
        closed
        fill={stroke}
        stroke={stroke}
        strokeWidth={1}
        listening={false}
      />
    );
  } else {
    // Open 'V' stick arrowhead at target
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

  // Label text calculation
  const labelText = shape.label || shape.text || '';
  const seqNum = typeof shape.order === 'number' ? `${shape.order}: ` : '';
  const displayLabel = labelText.startsWith(`${shape.order}:`) ? labelText : `${seqNum}${labelText}`;

  // Position label above midpoint of the message line
  const midX = (pStart.x + pEnd.x) / 2;
  const labelY = (pStart.y + pEnd.y) / 2 - 14;
  const badgeW = Math.max(60, Math.min(220, displayLabel.length * 7 + 14));
  const badgeH = 18;

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Shaft Line */}
      <Line
        points={shaftPoints}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={isReturn || isCreate ? [6, 4] : undefined}
        lineCap="round"
        lineJoin="round"
      />

      {/* Terminal Arrowhead Marker */}
      {markerElement}

      {/* Message Label with crisp pill badge */}
      {displayLabel && (
        <Group x={midX} y={labelY} listening={false}>
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
            text={displayLabel}
            x={-badgeW / 2}
            y={-badgeH / 2 + 3}
            width={badgeW}
            align="center"
            fontSize={10.5}
            fontFamily="IBM Plex Mono"
            fontStyle="500"
            fill="#1F2937"
          />
        </Group>
      )}
    </Group>
  );
}

export default {
  SequenceLifelineNode,
  SequenceActivationNode,
  SequenceMessageEdge,
};
