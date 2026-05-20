import React from 'react';
import { Layer, Circle } from 'react-konva';

export default function GridLayer({ width, height, scale, position }) {
  // Constants for grid
  const DOT_RADIUS = 1;
  const GRID_SIZE = 20;
  
  // Calculate viewport bounds in world coordinates
  const startX = Math.floor(-position.x / scale / GRID_SIZE) * GRID_SIZE;
  const endX = Math.floor((width - position.x) / scale / GRID_SIZE) * GRID_SIZE;
  
  const startY = Math.floor(-position.y / scale / GRID_SIZE) * GRID_SIZE;
  const endY = Math.floor((height - position.y) / scale / GRID_SIZE) * GRID_SIZE;

  // Generate dot coordinates
  const dots = [];
  for (let x = startX; x <= endX; x += GRID_SIZE) {
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      dots.push({ x, y });
    }
  }

  // Optimize grid rendering at low zoom
  if (scale < 0.3) return <Layer listening={false} />;

  return (
    <Layer listening={false}>
      {dots.map((dot, i) => (
        <Circle
          key={i}
          x={dot.x}
          y={dot.y}
          radius={DOT_RADIUS / scale} // Keep dot size constant regardless of zoom
          fill="#D1D5DB"
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  );
}
