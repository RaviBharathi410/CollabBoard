import React from 'react';
import { Layer, Line } from 'react-konva';

export const GRID_SIZE = 24;

export function calculateGridBounds({ width, height, scale, position, gridSize = GRID_SIZE }) {
  const startX = (Math.floor(-position.x / scale / gridSize) * gridSize) || 0;
  const endX = (Math.floor((width - position.x) / scale / gridSize) * gridSize) || 0;
  const startY = (Math.floor(-position.y / scale / gridSize) * gridSize) || 0;
  const endY = (Math.floor((height - position.y) / scale / gridSize) * gridSize) || 0;
  return { startX, endX, startY, endY };
}

export default function GridLayer({ width, height, scale, position }) {
  // Calculate viewport bounds in world coordinates
  const { startX, endX, startY, endY } = calculateGridBounds({ width, height, scale, position, gridSize: GRID_SIZE });

  // Don't render excessive lines at deep zoom-out
  if (scale < 0.25) return <Layer listening={false} />;

  const lines = [];

  // Vertical lines
  for (let x = startX; x <= endX; x += GRID_SIZE) {
    const isMajor = Math.round(x) % (GRID_SIZE * 5) === 0;
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, startY, x, endY]}
        stroke="#DAD6CC"
        strokeWidth={(isMajor ? 1.0 : 0.6) / scale}
        opacity={isMajor ? 0.65 : 0.35}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += GRID_SIZE) {
    const isMajor = Math.round(y) % (GRID_SIZE * 5) === 0;
    lines.push(
      <Line
        key={`h-${y}`}
        points={[startX, y, endX, y]}
        stroke="#DAD6CC"
        strokeWidth={(isMajor ? 1.0 : 0.6) / scale}
        opacity={isMajor ? 0.65 : 0.35}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  return <Layer listening={false}>{lines}</Layer>;
}
