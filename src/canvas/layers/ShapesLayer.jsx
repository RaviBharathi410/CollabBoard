import React from 'react';
import { Layer, Rect, Ellipse, Arrow, Line, Text, Transformer, Group } from 'react-konva';
import useCanvasStore from '../hooks/useCanvasStore';

export function computeTransformedDimensions(shape, { scaleX = 1, scaleY = 1, x, y, width, height, radiusX, radiusY }) {
  const updates = { x, y };

  if (shape.type === 'rectangle') {
    const origW = width !== undefined ? width : (shape.width || 0);
    const origH = height !== undefined ? height : (shape.height || 0);
    updates.width = Math.max(5, origW * scaleX);
    updates.height = Math.max(5, origH * scaleY);
  } else if (shape.type === 'circle') {
    const origRx = radiusX !== undefined ? radiusX : (shape.radiusX || 0);
    const origRy = radiusY !== undefined ? radiusY : (shape.radiusY || 0);
    updates.radiusX = Math.max(5, origRx * scaleX);
    updates.radiusY = Math.max(5, origRy * scaleY);
  } else if (shape.type === 'text') {
    updates.fontSize = Math.max(10, (shape.fontSize || 15) * scaleX);
    updates.width = (width !== undefined ? width : (shape.width || 0)) * scaleX;
  }

  return updates;
}

export function transformBoundBox(oldBox, newBox) {
  if (newBox.width < 5 || newBox.height < 5) return oldBox;
  return newBox;
}

export default function ShapesLayer({ selectedIds, onSelect }) {
  const shapes = useCanvasStore((state) => state.shapes);
  const updateShapeSilent = useCanvasStore((state) => state.updateShapeSilent);
  const updateShape = useCanvasStore((state) => state.updateShape);
  
  const trRef = React.useRef();
  const layerRef = React.useRef();

  // Attach transformer to selected nodes
  React.useEffect(() => {
    if (selectedIds.length > 0 && trRef.current && layerRef.current) {
      const nodes = selectedIds
        .map((id) => layerRef.current.findOne(`#${id}`))
        .filter(Boolean);
      trRef.current.nodes(nodes);
      trRef.current.getLayer().batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedIds, shapes]);

  const handleTransformEnd = (e, shape) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Reset scale to 1 on the Konva node
    node.scaleX(1);
    node.scaleY(1);

    const updates = computeTransformedDimensions(shape, {
      scaleX,
      scaleY,
      x: node.x(),
      y: node.y(),
      width: node.width?.(),
      height: node.height?.(),
      radiusX: node.radiusX?.(),
      radiusY: node.radiusY?.(),
    });
    
    updateShape(shape.id, updates);
  };

  const handleDragMove = (e, shape) => {
    updateShapeSilent(shape.id, { x: e.target.x(), y: e.target.y() });
  };

  const handleDragEnd = (e, shape) => {
    updateShape(shape.id, { x: e.target.x(), y: e.target.y() });
  };

  // Tactile ochre AI Badge
  const AiBadge = ({ shape, width = 80 }) => {
    if (!shape.aiGenerated) return null;
    const bx = (shape.width ?? width) - 4;
    const by = 4;
    return (
      <Group x={bx} y={by} listening={false}>
        <Rect x={-32} y={0} width={32} height={15} fill="#9E5826" cornerRadius={2} />
        <Text x={-30} y={3} text="✦ AI" fontSize={9} fill="#FFFFFF" fontFamily="IBM Plex Mono" fontStyle="bold" />
      </Group>
    );
  };

  const commonProps = (shape) => ({
    id: shape.id,
    x: shape.x,
    y: shape.y,
    draggable: true,
    opacity: shape.opacity ?? 1,
    onClick: () => onSelect(shape.id),
    onTap: () => onSelect(shape.id),
    onDragMove: (e) => handleDragMove(e, shape),
    onDragEnd: (e) => handleDragEnd(e, shape),
    onTransformEnd: (e) => handleTransformEnd(e, shape),
  });

  return (
    <Layer ref={layerRef}>
      {shapes.map((shape) => {
        if (shape.type === 'rectangle') {
          return (
            <Group key={shape.id} {...commonProps(shape)}>
              <Rect
                width={shape.width}
                height={shape.height}
                fill={shape.fill || '#FFFFFF'}
                stroke={shape.stroke || '#26241F'}
                strokeWidth={shape.strokeWidth || 1.5}
                cornerRadius={3}
                shadowColor="rgba(38, 36, 31, 0.05)"
                shadowBlur={3}
                shadowOffsetY={1}
              />
              <AiBadge shape={shape} width={shape.width} height={shape.height} />
            </Group>
          );
        }
        if (shape.type === 'circle') {
          const rx = shape.radiusX || 40;
          const ry = shape.radiusY || 40;
          return (
            <Group key={shape.id} {...commonProps(shape)}>
              <Ellipse
                radiusX={rx}
                radiusY={ry}
                fill={shape.fill || '#FFFFFF'}
                stroke={shape.stroke || '#26241F'}
                strokeWidth={shape.strokeWidth || 1.5}
                shadowColor="rgba(38, 36, 31, 0.05)"
                shadowBlur={3}
                shadowOffsetY={1}
              />
              <AiBadge shape={shape} width={rx * 2} height={ry * 2} />
            </Group>
          );
        }
        if (shape.type === 'arrow') {
          return (
            <Arrow
              key={shape.id}
              {...commonProps(shape)}
              points={shape.points}
              stroke={shape.stroke || '#26241F'}
              strokeWidth={shape.strokeWidth || 1.5}
              fill={shape.stroke || '#26241F'}
              dash={shape.dash}
              pointerLength={8}
              pointerWidth={8}
            />
          );
        }
        if (shape.type === 'pencil') {
          return (
            <Line
              key={shape.id}
              {...commonProps(shape)}
              points={shape.points}
              stroke={shape.stroke || '#26241F'}
              strokeWidth={shape.strokeWidth || 2}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
            />
          );
        }
        if (shape.type === 'text') {
          return (
            <Text
              key={shape.id}
              {...commonProps(shape)}
              text={(shape.text || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')}
              fontSize={shape.fontSize || 14}
              fontFamily="IBM Plex Sans"
              fill={shape.fill || '#26241F'}
              width={shape.width}
              lineHeight={shape.lineHeight || 1.3}
            />
          );
        }
        return null;
      })}
      <Transformer
        ref={trRef}
        borderStroke="#2B5C8F"
        borderStrokeWidth={1.5}
        anchorStroke="#2B5C8F"
        anchorFill="#FFFFFF"
        anchorSize={8}
        anchorCornerRadius={1}
        boundBoxFunc={transformBoundBox}
      />
    </Layer>
  );
}
