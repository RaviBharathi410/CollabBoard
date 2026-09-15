import React from 'react';
import { Group, Rect, Line, Text } from 'react-konva';

/**
 * Native Konva renderers for Flowchart node subtypes:
 * - process: standard operation rectangle
 * - decision: branching diamond
 * - terminal: start/end pill
 * - io: input/output parallelogram
 * - database: storage container
 */

export function FlowchartNodeTemplate({ shape, commonProps }) {
  const subtype = shape.subtype || 'process';
  const width = shape.width || 140;
  const height = shape.height || 60;
  const fill = shape.fill || '#FFFFFF';
  const stroke = shape.stroke || '#26241F';
  const strokeWidth = shape.strokeWidth || 1.5;
  const label = shape.label || shape.text || '';

  const labelElement = label ? (
    <Text
      text={label}
      x={10}
      y={Math.max(4, (height - 18) / 2)}
      width={width - 20}
      align="center"
      fontSize={12}
      fontFamily="IBM Plex Sans"
      fill="#1A1A2E"
      listening={false}
      ellipsis
    />
  ) : null;

  if (subtype === 'decision') {
    // Diamond polygon points: top, right, bottom, left
    const points = [width / 2, 0, width, height / 2, width / 2, height, 0, height / 2];
    return (
      <Group key={shape.id} width={width} height={height} {...commonProps(shape)}>
        <Line
          points={points}
          closed
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          shadowColor="rgba(38, 36, 31, 0.05)"
          shadowBlur={3}
          shadowOffsetY={1}
        />
        {labelElement}
      </Group>
    );
  }

  if (subtype === 'terminal') {
    // Fully rounded pill / capsule
    const radius = Math.min(height / 2, 24);
    return (
      <Group key={shape.id} width={width} height={height} {...commonProps(shape)}>
        <Rect
          width={width}
          height={height}
          cornerRadius={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          shadowColor="rgba(38, 36, 31, 0.05)"
          shadowBlur={3}
          shadowOffsetY={1}
        />
        {labelElement}
      </Group>
    );
  }

  if (subtype === 'io') {
    // Parallelogram: slanted left and right edges
    const slant = Math.min(18, width * 0.15);
    const points = [slant, 0, width, 0, width - slant, height, 0, height];
    return (
      <Group key={shape.id} width={width} height={height} {...commonProps(shape)}>
        <Line
          points={points}
          closed
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          shadowColor="rgba(38, 36, 31, 0.05)"
          shadowBlur={3}
          shadowOffsetY={1}
        />
        {labelElement}
      </Group>
    );
  }

  // Default: Process rectangle
  return (
    <Group key={shape.id} width={width} height={height} {...commonProps(shape)}>
      <Rect
        width={width}
        height={height}
        cornerRadius={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        shadowColor="rgba(38, 36, 31, 0.05)"
        shadowBlur={3}
        shadowOffsetY={1}
      />
      {labelElement}
    </Group>
  );
}

export default FlowchartNodeTemplate;
