import React from 'react';
import { Layer, Rect, Ellipse, Arrow, Line, Text, Transformer, Group } from 'react-konva';
import useCanvasStore from '../hooks/useCanvasStore';

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

    const updates = { x: node.x(), y: node.y() };

    if (shape.type === 'rectangle') {
      updates.width = Math.max(5, node.width() * scaleX);
      updates.height = Math.max(5, node.height() * scaleY);
    } else if (shape.type === 'circle') {
      updates.radiusX = Math.max(5, node.radiusX() * scaleX);
      updates.radiusY = Math.max(5, node.radiusY() * scaleY);
    } else if (shape.type === 'text') {
       // Only apply scale to font size
       updates.fontSize = Math.max(10, (shape.fontSize || 16) * scaleX);
       updates.width = node.width() * scaleX;
    }
    
    updateShape(shape.id, updates);
  };

  const handleDragMove = (e, shape) => {
    updateShapeSilent(shape.id, { x: e.target.x(), y: e.target.y() });
  };

  const handleDragEnd = (e, shape) => {
    updateShape(shape.id, { x: e.target.x(), y: e.target.y() });
  };

  const AiBadge = ({ shape, width = 80, height = 40 }) => {
    if (!shape.aiGenerated) return null;
    const bx = (shape.width ?? width) - 4;
    const by = 4;
    return (
      <Group x={bx} y={by} listening={false}>
        <Rect x={-28} y={0} width={28} height={14} fill="#6C63FF" cornerRadius={3} />
        <Text x={-26} y={2} text="✦ AI" fontSize={9} fill="#fff" fontFamily="Plus Jakarta Sans" />
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
                fill={shape.fill || '#EEEDfe'}
                stroke={shape.stroke || '#6C63FF'}
                strokeWidth={shape.strokeWidth || 2}
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
                fill={shape.fill || '#EEEDfe'}
                stroke={shape.stroke || '#6C63FF'}
                strokeWidth={shape.strokeWidth || 2}
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
              stroke={shape.stroke || '#1A1A2E'}
              strokeWidth={shape.strokeWidth || 2}
              fill={shape.stroke || '#1A1A2E'}
              dash={shape.dash}
              pointerLength={10}
              pointerWidth={10}
            />
          );
        }
        if (shape.type === 'pencil') {
          return (
            <Line
              key={shape.id}
              {...commonProps(shape)}
              points={shape.points}
              stroke={shape.stroke || '#1A1A2E'}
              strokeWidth={shape.strokeWidth || 3}
              tension={0.5}
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
              text={shape.text}
              fontSize={shape.fontSize || 16}
              fontFamily="Plus Jakarta Sans"
              fill={shape.fill || '#1A1A2E'}
              width={shape.width}
            />
          );
        }
        return null;
      })}
      <Transformer
        ref={trRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 5 || newBox.height < 5) return oldBox;
          return newBox;
        }}
      />
    </Layer>
  );
}
