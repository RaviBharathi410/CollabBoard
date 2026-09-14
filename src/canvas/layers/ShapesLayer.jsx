import React from 'react';
import { Layer, Rect, Ellipse, Arrow, Line, Text, Transformer, Group } from 'react-konva';
import useCanvasStore from '../hooks/useCanvasStore';

export function computeTransformedDimensions(shape, { scaleX = 1, scaleY = 1, x, y, width, height, radiusX, radiusY }) {
  const updates = {
    x: x !== undefined ? Math.round(x) : shape.x,
    y: y !== undefined ? Math.round(y) : shape.y,
  };

  const absScaleX = Math.abs(scaleX) || 1;
  const absScaleY = Math.abs(scaleY) || 1;

  if (shape.type === 'rectangle') {
    const origW = (width !== undefined && width > 0) ? width : (shape.width || 0);
    const origH = (height !== undefined && height > 0) ? height : (shape.height || 0);
    updates.width = Math.round(Math.max(5, origW * absScaleX));
    updates.height = Math.round(Math.max(5, origH * absScaleY));
  } else if (shape.type === 'circle') {
    const origRx = (radiusX !== undefined && radiusX > 0) ? radiusX : (shape.radiusX || 40);
    const origRy = (radiusY !== undefined && radiusY > 0) ? radiusY : (shape.radiusY || 40);
    updates.radiusX = Math.round(Math.max(5, origRx * absScaleX));
    updates.radiusY = Math.round(Math.max(5, origRy * absScaleY));
  } else if (shape.type === 'text') {
    updates.fontSize = Math.round(Math.max(10, (shape.fontSize || 15) * absScaleX));
    const origW = (width !== undefined && width > 0) ? width : (shape.width || 0);
    updates.width = Math.round(Math.max(20, origW * absScaleX));
  }

  return updates;
}

export function transformBoundBox(oldBox, newBox) {
  if (newBox.width < 5 || newBox.height < 5) return oldBox;
  return newBox;
}

export default function ShapesLayer({ selectedIds, onSelect }) {
  const shapes = useCanvasStore((state) => state.shapes);
  const updateShape = useCanvasStore((state) => state.updateShape);
  
  const trRef = React.useRef();
  const layerRef = React.useRef();

  // Attach transformer to selected nodes without rebuilding on every shape update
  React.useEffect(() => {
    if (!trRef.current || !layerRef.current) return;

    if (selectedIds.length > 0) {
      const nodes = selectedIds
        .map((id) => layerRef.current.findOne(`#${id}`))
        .filter(Boolean);

      const currentNodes = trRef.current.nodes() || [];
      const isSame =
        nodes.length === currentNodes.length &&
        nodes.every((n, i) => n === currentNodes[i]);

      if (!isSame) {
        trRef.current.nodes(nodes);
        trRef.current.getLayer()?.batchDraw();
      }
    } else if ((trRef.current.nodes() || []).length > 0) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIds, shapes.length]);

  const handleTransformEnd = (e, shape) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Reset scale to 1 on the Konva node
    node.scaleX(1);
    node.scaleY(1);

    if (shape.type === 'arrow' || shape.type === 'pencil') {
      const updates = {
        x: Math.round(node.x()),
        y: Math.round(node.y()),
      };
      if (Array.isArray(shape.points)) {
        updates.points = shape.points.map((pt, idx) =>
          Math.round(idx % 2 === 0 ? pt * Math.abs(scaleX) : pt * Math.abs(scaleY))
        );
      }
      updateShape(shape.id, updates);
      return;
    }

    const updates = computeTransformedDimensions(shape, {
      scaleX,
      scaleY,
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: shape.width,
      height: shape.height,
      radiusX: shape.radiusX,
      radiusY: shape.radiusY,
    });
    
    updateShape(shape.id, updates);
  };

  const handleDragMove = () => {
    // Native Konva dragging maintains 60/120fps; omit store state thrashing per pixel
  };

  const handleDragEnd = (e, shape) => {
    updateShape(shape.id, {
      x: Math.round(e.target.x()),
      y: Math.round(e.target.y()),
    });
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
    onDragMove: handleDragMove,
    onDragEnd: (e) => handleDragEnd(e, shape),
    onTransformEnd: (e) => handleTransformEnd(e, shape),
  });

  return (
    <Layer ref={layerRef}>
      {shapes.map((shape) => {
        if (shape.type === 'rectangle') {
          return (
            <Group
              key={shape.id}
              width={shape.width}
              height={shape.height}
              {...commonProps(shape)}
            >
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
            <Group
              key={shape.id}
              width={rx * 2}
              height={ry * 2}
              {...commonProps(shape)}
            >
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
        rotateEnabled={false}
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
