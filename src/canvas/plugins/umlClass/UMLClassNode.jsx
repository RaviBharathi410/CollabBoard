import React from 'react';
import { Group, Rect, Line, Text } from 'react-konva';

/**
 * Parses raw text or structured attributes into 3 UML compartments:
 * 1. Stereotype & Class Name (Header)
 * 2. Attributes / Fields
 * 3. Operations / Methods
 */
export function parseUmlClassContent(shape) {
  let stereotype = shape.stereotype || '';
  let name = shape.name || '';
  let attributes = Array.isArray(shape.attributes) ? [...shape.attributes] : [];
  let methods = Array.isArray(shape.methods) ? [...shape.methods] : [];

  // If attributes & methods are empty but label/text is multiline, parse intelligently
  const rawText = (shape.text || shape.label || '').trim();
  if (!name && !rawText.includes('\n')) {
    name = rawText;
  }

  if (attributes.length === 0 && methods.length === 0 && rawText.includes('\n')) {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const unassigned = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('<<') && line.endsWith('>>')) {
        stereotype = line;
      } else if (!name || name === 'Class' || name === 'Rectangle') {
        name = line;
      } else if (line.endsWith('()') || line.includes('(') || line.startsWith('+') || line.startsWith('-') || line.startsWith('#')) {
        if (line.includes('(')) {
          methods.push(line);
        } else {
          attributes.push(line);
        }
      } else {
        unassigned.push(line);
      }
    }

    if (!name && unassigned.length > 0) {
      name = unassigned.shift();
    }
    // If still unassigned lines, distribute to attributes
    if (unassigned.length > 0) {
      attributes.push(...unassigned);
    }
  }

  // Fallback defaults
  if (!name) name = 'ClassName';

  return {
    stereotype,
    name,
    attributes,
    methods,
  };
}

/**
 * Native Konva 3-Compartment UML Class Node Renderer.
 */
export function UMLClassNode({ shape, commonProps }) {
  const width = Math.max(120, shape.width || 160);
  const stroke = shape.stroke || '#6C63FF';
  const strokeWidth = shape.strokeWidth || 1.5;
  const fill = shape.fill || '#FFFFFF';
  const isInterface = shape.subtype === 'interface' || shape.stereotype === '<<interface>>';

  const { stereotype, name, attributes, methods } = parseUmlClassContent(shape);

  // Compute compartment heights
  const hasStereotype = Boolean(stereotype) || isInterface;
  const headerHeight = hasStereotype ? 42 : 30;
  const attrHeight = Math.max(22, (attributes.length || 1) * 16 + 6);
  const methHeight = Math.max(22, (methods.length || 1) * 16 + 6);
  const naturalHeight = headerHeight + attrHeight + methHeight;
  const height = Math.max(naturalHeight, shape.height || naturalHeight);

  // Divider lines
  const div1Y = headerHeight;
  const div2Y = headerHeight + attrHeight;

  return (
    <Group key={shape.id} width={width} height={height} {...commonProps(shape)}>
      {/* Outer Card */}
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={2}
        shadowColor="rgba(38, 36, 31, 0.08)"
        shadowBlur={4}
        shadowOffsetY={1}
      />

      {/* ── Compartment 1: Header (Stereotype & Class Name) ── */}
      {hasStereotype && (
        <Text
          text={stereotype || '<<interface>>'}
          x={4}
          y={5}
          width={width - 8}
          align="center"
          fontSize={10}
          fontFamily="IBM Plex Sans"
          fontStyle="italic"
          fill="#4A4754"
          listening={false}
          ellipsis
        />
      )}
      <Text
        text={name}
        x={4}
        y={hasStereotype ? 20 : 7}
        width={width - 8}
        align="center"
        fontSize={12}
        fontFamily="IBM Plex Sans"
        fontStyle="bold"
        fill="#1A1A2E"
        listening={false}
        ellipsis
      />

      {/* Divider 1 */}
      <Line
        points={[0, div1Y, width, div1Y]}
        stroke={stroke}
        strokeWidth={1}
        listening={false}
      />

      {/* ── Compartment 2: Attributes / Fields ── */}
      <Text
        text={attributes.length > 0 ? attributes.join('\n') : ' '}
        x={8}
        y={div1Y + 4}
        width={width - 16}
        fontSize={11}
        fontFamily="IBM Plex Mono"
        fill="#26241F"
        lineHeight={1.4}
        listening={false}
      />

      {/* Divider 2 */}
      <Line
        points={[0, div2Y, width, div2Y]}
        stroke={stroke}
        strokeWidth={1}
        listening={false}
      />

      {/* ── Compartment 3: Operations / Methods ── */}
      <Text
        text={methods.length > 0 ? methods.join('\n') : ' '}
        x={8}
        y={div2Y + 4}
        width={width - 16}
        fontSize={11}
        fontFamily="IBM Plex Mono"
        fill="#26241F"
        lineHeight={1.4}
        listening={false}
      />
    </Group>
  );
}

export default UMLClassNode;
