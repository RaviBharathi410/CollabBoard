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
 * Simulates word-wrapping to accurately predict how many rendered lines
 * Konva's canvas text layout will generate for a list of strings.
 */
export function estimateWrappedLines(lines, charsPerLine) {
  if (!Array.isArray(lines) || lines.length === 0) return 1;
  const maxChars = Math.max(8, charsPerLine);
  let totalLines = 0;

  for (const raw of lines) {
    const text = String(raw || '').trim();
    if (!text) continue;
    if (text.length <= maxChars) {
      totalLines += 1;
      continue;
    }

    const words = text.split(/\s+/);
    let currentLineLength = 0;
    let lineCount = 1;

    for (const word of words) {
      if (currentLineLength === 0) {
        currentLineLength = word.length;
      } else if (currentLineLength + 1 + word.length <= maxChars) {
        currentLineLength += 1 + word.length;
      } else {
        lineCount += Math.max(1, Math.ceil(word.length / maxChars));
        currentLineLength = word.length % maxChars;
      }
    }
    totalLines += lineCount;
  }

  return Math.max(1, totalLines);
}

/**
 * Native Konva 3-Compartment UML Class Node Renderer.
 */
export function UMLClassNode({ shape, commonProps }) {
  const stroke = shape.stroke || '#6C63FF';
  const strokeWidth = shape.strokeWidth || 1.5;
  const fill = shape.fill || '#FFFFFF';
  const isInterface = shape.subtype === 'interface' || shape.stereotype === '<<interface>>';

  const { stereotype, name, attributes, methods } = parseUmlClassContent(shape);

  // 1. Calculate minimum required width to comfortably contain the longest line
  const allLines = [
    stereotype,
    name,
    ...attributes,
    ...methods,
  ].filter(Boolean);
  const maxLineLen = Math.max(...allLines.map((l) => l.length), 10);
  const minRequiredWidth = Math.max(180, Math.round(maxLineLen * 7.5 + 32));
  const width = Math.max(minRequiredWidth, shape.width || minRequiredWidth);

  // 2. Measure actual wrapped line counts per compartment
  const contentWidth = width - 16;
  const charsPerLine = Math.max(10, Math.floor(contentWidth / 6.8));

  const attrLineCount = estimateWrappedLines(attributes, charsPerLine);
  const methLineCount = estimateWrappedLines(methods, charsPerLine);

  // 3. Dynamic compartment heights with ample safety padding ensuring zero leakage
  const hasStereotype = Boolean(stereotype) || isInterface;
  const headerHeight = hasStereotype ? 44 : 32;
  const attrHeight = Math.max(28, Math.round(attrLineCount * 18 + 14));
  const methHeight = Math.max(34, Math.round(methLineCount * 18 + 24)); // Extra 24px bottom buffer
  const naturalHeight = headerHeight + attrHeight + methHeight;
  const height = Math.max(naturalHeight, shape.height || naturalHeight);

  // Divider lines
  const div1Y = headerHeight;
  const div2Y = headerHeight + attrHeight;

  return (
    <Group
      key={shape.id}
      width={width}
      height={height}
      clipX={0}
      clipY={0}
      clipWidth={width}
      clipHeight={height}
      {...commonProps(shape)}
    >
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
        y={hasStereotype ? 20 : 8}
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
        y={div1Y + 5}
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
        y={div2Y + 5}
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
