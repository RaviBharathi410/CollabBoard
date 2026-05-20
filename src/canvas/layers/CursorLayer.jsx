import React from 'react';
import { Layer, Group, Path, Text, Rect } from 'react-konva';

export default function CursorLayer({ others }) {
  return (
    <Layer listening={false}>
      {others.map((cursor) => {
        // Don't render cursors that are off-screen
        if (cursor.x < -90) return null;

        return (
          <Group key={cursor.id} x={cursor.x} y={cursor.y}>
            {/* The SVG cursor pointer */}
            <Path
              d="M1,1 L1,14 L5,10 L9,16 L11,15 L7,9 L12,8 Z"
              fill={cursor.color}
              stroke="#fff"
              strokeWidth={1}
            />
            {/* The Name Tag */}
            <Group x={12} y={16}>
              <Rect
                fill={cursor.color}
                cornerRadius={4}
                height={18}
                width={cursor.name.length * 6 + 10}
              />
              <Text
                text={cursor.name}
                fill="#fff"
                fontSize={10}
                fontFamily="Plus Jakarta Sans"
                fontStyle="bold"
                padding={4}
                x={2}
                y={0}
              />
            </Group>
          </Group>
        );
      })}
    </Layer>
  );
}
