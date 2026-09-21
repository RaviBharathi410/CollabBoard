import React from 'react';
import { Group, Rect, Line, Text, Circle } from 'react-konva';

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
 * Parses raw column strings or objects into structured column metadata
 */
export function normalizeColumns(rawColumns = []) {
  return rawColumns.map((col) => {
    if (typeof col === 'object' && col !== null) {
      return {
        name: col.name || 'col',
        type: col.type || 'varchar',
        isPk: Boolean(col.pk || col.isPk || col.isPrimaryKey),
        isFk: Boolean(col.fk || col.isFk || col.isForeignKey),
        isUnique: Boolean(col.unique || col.isUnique),
      };
    }
    const str = String(col).trim();
    const isPk = str.includes('[PK]') || str.toUpperCase().startsWith('PK') || str.includes('pk');
    const isFk = str.includes('[FK]') || str.toUpperCase().startsWith('FK') || str.includes('fk');
    const isUnique = str.includes('[UQ]') || str.includes('unique');

    // Clean brackets from string
    const cleaned = str.replace(/\[PK\]/gi, '').replace(/\[FK\]/gi, '').replace(/\[UQ\]/gi, '').trim();
    const parts = cleaned.split(/[:\s]+/).filter(Boolean);
    const name = parts[0] || 'column';
    const type = parts.slice(1).join(' ') || 'text';

    return { name, type, isPk, isFk, isUnique };
  });
}

/**
 * ERD Table / Entity Node:
 * Multi-compartment table layout with PK / FK badges and clear type formatting.
 */
export function ERDTableNode({ shape, commonProps }) {
  const width = shape.width || 220;
  const headerHeight = 36;
  const rowHeight = 24;

  const rawColumns = shape.columns || shape.attributes || [];
  const columns = normalizeColumns(rawColumns);

  // Auto-compute height based on column rows
  const computedHeight = Math.max(shape.height || 100, headerHeight + columns.length * rowHeight + 12);
  const stroke = shape.stroke || '#2563EB';
  const tableName = shape.name || shape.title || shape.text || 'entity';

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Outer Card Container */}
      <Rect
        width={width}
        height={computedHeight}
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth={1.5}
        cornerRadius={6}
        shadowColor="rgba(0,0,0,0.06)"
        shadowBlur={4}
        shadowOffsetY={2}
      />

      {/* Header Compartment Background */}
      <Rect
        width={width}
        height={headerHeight}
        fill="#EFF6FF"
        cornerRadius={[6, 6, 0, 0]}
      />

      {/* Header Divider */}
      <Line
        points={[0, headerHeight, width, headerHeight]}
        stroke="#DBEAFE"
        strokeWidth={1}
      />

      {/* Table Name */}
      <Text
        text={tableName}
        x={12}
        y={10}
        width={width - 24}
        fontSize={13}
        fontFamily="Plus Jakarta Sans"
        fontStyle="700"
        fill="#1E3A8A"
        listening={false}
      />

      {/* Column Rows */}
      {columns.map((col, idx) => {
        const rowY = headerHeight + 6 + idx * rowHeight;
        let badgeWidth = 0;

        return (
          <Group key={`col-${idx}`} y={rowY}>
            {/* PK Badge */}
            {col.isPk && (
              <Group x={10} y={1}>
                <Rect
                  width={22}
                  height={15}
                  fill="#FEF3C7"
                  stroke="#F59E0B"
                  strokeWidth={0.8}
                  cornerRadius={2}
                />
                <Text
                  text="PK"
                  x={0}
                  y={2.5}
                  width={22}
                  align="center"
                  fontSize={8.5}
                  fontFamily="IBM Plex Mono"
                  fontStyle="bold"
                  fill="#92400E"
                />
              </Group>
            )}

            {/* FK Badge */}
            {col.isFk && (
              <Group x={col.isPk ? 36 : 10} y={1}>
                <Rect
                  width={22}
                  height={15}
                  fill="#EDE9FE"
                  stroke="#8B5CF6"
                  strokeWidth={0.8}
                  cornerRadius={2}
                />
                <Text
                  text="FK"
                  x={0}
                  y={2.5}
                  width={22}
                  align="center"
                  fontSize={8.5}
                  fontFamily="IBM Plex Mono"
                  fontStyle="bold"
                  fill="#5B21B6"
                />
              </Group>
            )}

            {/* Column Name */}
            {(() => {
              const textStartX = (col.isPk ? 36 : 0) + (col.isFk ? 28 : 0) + 12;
              return (
                <Text
                  text={col.name}
                  x={textStartX}
                  y={2}
                  fontSize={11}
                  fontFamily="Plus Jakarta Sans"
                  fontStyle="600"
                  fill="#1E293B"
                  listening={false}
                />
              );
            })()}

            {/* Column Data Type (right aligned) */}
            <Text
              text={col.type}
              x={width - 110}
              y={3}
              width={100}
              align="right"
              fontSize={10}
              fontFamily="IBM Plex Mono"
              fill="#64748B"
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}

/**
 * ERD Relationship Edge with Crow's Foot & Cardinality Notation:
 * - One-to-Many (1 : N): Crossbar at source, Crow's foot (3-prong branch) at target
 * - Multiplicity badges at endpoints
 */
export function ERDRelationshipEdge({ shape, commonProps }) {
  const points = shape.points || [0, 0, 100, 100];
  if (points.length < 4) return null;

  const stroke = shape.stroke || '#2563EB';
  const strokeWidth = shape.strokeWidth || 1.5;
  const isDashed = shape.style === 'dashed' || shape.identifying === false;

  const n = points.length;
  const pStart = { x: points[0], y: points[1] };
  const pEnd = { x: points[n - 2], y: points[n - 1] };
  const prevToEnd = { x: points[n - 4], y: points[n - 3] };
  const nextFromStart = { x: points[2], y: points[3] };

  const endVec = getVector(prevToEnd.x, prevToEnd.y, pEnd.x, pEnd.y);
  const startVec = getVector(pStart.x, pStart.y, nextFromStart.x, nextFromStart.y);

  // 1. Crow's Foot marker at target end
  const crowLength = 12;
  const crowSpread = 8;

  // Base of crow's foot
  const crowBaseX = pEnd.x - crowLength * endVec.ux;
  const crowBaseY = pEnd.y - crowLength * endVec.uy;

  // Top prong tip
  const pTopX = crowBaseX + crowSpread * endVec.nx;
  const pTopY = crowBaseY + crowSpread * endVec.ny;

  // Bottom prong tip
  const pBottomX = crowBaseX - crowSpread * endVec.nx;
  const pBottomY = crowBaseY - crowSpread * endVec.ny;

  // Crossbar bar near base
  const barDist = crowLength + 4;
  const barBaseX = pEnd.x - barDist * endVec.ux;
  const barBaseY = pEnd.y - barDist * endVec.uy;
  const barTopX = barBaseX + crowSpread * endVec.nx;
  const barTopY = barBaseY + crowSpread * endVec.ny;
  const barBottomX = barBaseX - crowSpread * endVec.nx;
  const barBottomY = barBaseY - crowSpread * endVec.ny;

  // 2. Crossbar at source end (Mandatory One: || or |)
  const srcBarDist = 8;
  const srcBaseX = pStart.x + srcBarDist * startVec.ux;
  const srcBaseY = pStart.y + srcBarDist * startVec.uy;
  const srcBarTopX = srcBaseX + crowSpread * startVec.nx;
  const srcBarTopY = srcBaseY + crowSpread * startVec.ny;
  const srcBarBottomX = srcBaseX - crowSpread * startVec.nx;
  const srcBarBottomY = srcBaseY - crowSpread * startVec.ny;

  // Label text
  const labelText = shape.label || shape.text || '';
  const midX = (pStart.x + pEnd.x) / 2;
  const midY = (pStart.y + pEnd.y) / 2 - 12;
  const badgeW = Math.max(54, labelText.length * 7 + 14);

  const multSource = shape.sourceMultiplicity || shape.multiplicitySource || '1';
  const multTarget = shape.targetMultiplicity || shape.multiplicityTarget || '0..*';

  return (
    <Group key={shape.id} {...commonProps(shape)}>
      {/* Main Shaft Line */}
      <Line
        points={points}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={isDashed ? [6, 4] : undefined}
        lineCap="round"
        lineJoin="round"
      />

      {/* Target Crow's Foot Prongs */}
      <Line
        points={[pTopX, pTopY, pEnd.x, pEnd.y, pBottomX, pBottomY]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
      {/* Target Crossbar */}
      <Line
        points={[barTopX, barTopY, barBottomX, barBottomY]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        listening={false}
      />

      {/* Source Crossbar (Single/Mandatory 1) */}
      <Line
        points={[srcBarTopX, srcBarTopY, srcBarBottomX, srcBarBottomY]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        listening={false}
      />

      {/* Relationship Label Badge */}
      {labelText && (
        <Group x={midX} y={midY} listening={false}>
          <Rect
            x={-badgeW / 2}
            y={-9}
            width={badgeW}
            height={18}
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth={1}
            cornerRadius={3}
          />
          <Text
            text={labelText}
            x={-badgeW / 2}
            y={-6}
            width={badgeW}
            align="center"
            fontSize={10.5}
            fontFamily="IBM Plex Sans"
            fontStyle="600"
            fill="#1E40AF"
          />
        </Group>
      )}

      {/* Multiplicity annotations */}
      {multSource && (
        <Text
          text={multSource}
          x={pStart.x + 12 * startVec.ux + 8 * startVec.nx}
          y={pStart.y + 12 * startVec.uy + 8 * startVec.ny - 6}
          fontSize={10.5}
          fontFamily="IBM Plex Mono"
          fontStyle="bold"
          fill="#1E3A8A"
          listening={false}
        />
      )}
      {multTarget && (
        <Text
          text={multTarget}
          x={pEnd.x - 28 * endVec.ux + 8 * endVec.nx}
          y={pEnd.y - 28 * endVec.uy + 8 * endVec.ny - 6}
          fontSize={10.5}
          fontFamily="IBM Plex Mono"
          fontStyle="bold"
          fill="#1E3A8A"
          listening={false}
        />
      )}
    </Group>
  );
}

export default {
  ERDTableNode,
  ERDRelationshipEdge,
  normalizeColumns,
};
