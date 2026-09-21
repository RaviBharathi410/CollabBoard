import React from 'react';
import { Layer, Rect, Ellipse, Arrow, Line, Text, Transformer, Group } from 'react-konva';
import useCanvasStore from '../hooks/useCanvasStore';
import { getDiagramPlugin } from '../plugins';
import { getBestConnectionPoints, findConnectedNodeAt } from '../utils/connectionGeometry';

export function computeTransformedDimensions(shape, { scaleX = 1, scaleY = 1, x, y, width, height, radiusX, radiusY }) {
  const updates = {
    x: x !== undefined ? Math.round(x) : shape.x,
    y: y !== undefined ? Math.round(y) : shape.y,
  };

  const absScaleX = Math.abs(scaleX) || 1;
  const absScaleY = Math.abs(scaleY) || 1;

  if (shape.type === 'rectangle' || shape.type === 'uml_class' || shape.type === 'diamond' || shape.type === 'decision') {
    const origW = (width !== undefined && width > 0) ? width : (shape.width || (shape.type === 'diamond' || shape.type === 'decision' ? 120 : 140));
    const origH = (height !== undefined && height > 0) ? height : (shape.height || (shape.type === 'diamond' || shape.type === 'decision' ? 80 : 70));
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
  const updateShapes = useCanvasStore((state) => state.updateShapes);
  const updateShapesSilent = useCanvasStore((state) => state.updateShapesSilent);
  
  const trRef = React.useRef();
  const layerRef = React.useRef();
  const dragRafRef = React.useRef(null);

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

  /**
   * Recomputes points for all arrows attached to shapeId when moved to (curX, curY).
   */
  const getConnectedArrowsAndPoints = (shapeId, curX, curY) => {
    const currentShapes = useCanvasStore.getState().shapes;
    const movedShape = currentShapes.find((s) => s.id === shapeId);
    if (!movedShape) return [];

    const simulatedMovedShape = { ...movedShape, x: curX, y: curY };
    const shapesMap = new Map(currentShapes.map((s) => [s.id, s]));
    shapesMap.set(shapeId, simulatedMovedShape);

    const updates = [];

    for (const arrow of currentShapes) {
      if (arrow.type !== 'arrow' && arrow.type !== 'connector') continue;

      const isConnected = arrow.source === shapeId || arrow.target === shapeId;

      let effectiveSource = arrow.source;
      let effectiveTarget = arrow.target;

      // Outer snap boundary re-evaluation
      if (!arrow.source && Array.isArray(arrow.points) && arrow.points.length >= 2) {
        const startX = arrow.points[0];
        const startY = arrow.points[1];
        const hitSource = findConnectedNodeAt(Array.from(shapesMap.values()), startX, startY, [arrow.id]);
        if (hitSource) effectiveSource = hitSource.id;
      }

      if (!arrow.target && Array.isArray(arrow.points) && arrow.points.length >= 4) {
        const endX = arrow.points[arrow.points.length - 2];
        const endY = arrow.points[arrow.points.length - 1];
        const hitTarget = findConnectedNodeAt(Array.from(shapesMap.values()), endX, endY, [arrow.id]);
        if (hitTarget) effectiveTarget = hitTarget.id;
      }

      if (isConnected) {
        const sNode = effectiveSource ? shapesMap.get(effectiveSource) : null;
        const tNode = effectiveTarget ? shapesMap.get(effectiveTarget) : null;
        const newPoints = getBestConnectionPoints(sNode, tNode, arrow.points);

        updates.push({
          id: arrow.id,
          source: effectiveSource || arrow.source,
          target: effectiveTarget || arrow.target,
          points: newPoints,
        });
      }
    }

    return updates;
  };

  const handleDragMove = (e, shape) => {
    // If an arrow itself is being dragged, let Konva handle it natively
    if (shape.type === 'arrow') return;

    const curX = Math.round(e.target.x());
    const curY = Math.round(e.target.y());

    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
    }

    dragRafRef.current = requestAnimationFrame(() => {
      const arrowUpdates = getConnectedArrowsAndPoints(shape.id, curX, curY);
      if (arrowUpdates.length > 0) {
        // Silently update both the dragged shape and connected arrows at 60fps
        updateShapesSilent([
          { id: shape.id, x: curX, y: curY },
          ...arrowUpdates,
        ]);
      }
    });
  };

  const handleDragEnd = (e, shape) => {
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
    }

    if (shape.type === 'arrow') {
      const dx = Math.round(e.target.x());
      const dy = Math.round(e.target.y());
      e.target.x(0);
      e.target.y(0);
      if (Array.isArray(shape.points) && (dx !== 0 || dy !== 0)) {
        const newPoints = shape.points.map((pt, i) => (i % 2 === 0 ? pt + dx : pt + dy));
        updateShape(shape.id, { points: newPoints, source: undefined, target: undefined });
      }
      return;
    }

    const curX = Math.round(e.target.x());
    const curY = Math.round(e.target.y());
    const arrowUpdates = getConnectedArrowsAndPoints(shape.id, curX, curY);

    if (arrowUpdates.length > 0) {
      updateShapes([
        { id: shape.id, x: curX, y: curY },
        ...arrowUpdates,
      ]);
    } else {
      updateShape(shape.id, {
        x: curX,
        y: curY,
      });
    }
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
        // 1. Check if shape explicitly delegates to a diagram plugin
        const pluginId =
          shape.pluginType ||
          (shape.type === 'uml_class' ? 'uml-class' : null) ||
          (shape.type === 'sequence_lifeline' || shape.type === 'sequence_activation' || shape.type === 'sequence_message' ? 'sequence' : null) ||
          (shape.type === 'usecase_actor' || shape.type === 'usecase_oval' || shape.type === 'usecase_boundary' || shape.subtype === 'actor' || shape.subtype === 'use_case' || shape.subtype === 'system_boundary' ? 'use-case' : null) ||
          (shape.type === 'erd_table' || shape.subtype === 'table' || shape.subtype === 'erd_table' ? 'erd' : null) ||
          (shape.type === 'flowchart_node' || shape.pluginType === 'flowchart' ? 'flowchart' : null);
        const plugin = getDiagramPlugin(pluginId);
        if (plugin) {
          if (shape.type === 'arrow' || shape.type === 'connector' || shape.type === 'sequence_message' || shape.type === 'usecase_edge' || shape.type === 'erd_edge') {
            const customEdge = plugin.renderEdge(shape, { commonProps });
            if (customEdge) return React.isValidElement(customEdge) ? React.cloneElement(customEdge, { key: shape.id }) : customEdge;
          } else {
            const customNode = plugin.renderNode(shape, { commonProps });
            if (customNode) return React.isValidElement(customNode) ? React.cloneElement(customNode, { key: shape.id }) : customNode;
          }
        }

        // 2. Direct UML class fallback
        if (shape.type === 'uml_class' || shape.subtype === 'class' || shape.subtype === 'interface') {
          const umlPlugin = getDiagramPlugin('uml-class');
          if (umlPlugin) {
            const customNode = umlPlugin.renderNode(shape, { commonProps });
            if (customNode) return React.isValidElement(customNode) ? React.cloneElement(customNode, { key: shape.id }) : customNode;
          }
        }

        // 3. Direct UML connector fallback if edge has relationship or multiplicity metadata
        if (shape.type === 'arrow' && (shape.subtype || shape.multiplicitySource || shape.multiplicityTarget)) {
          const umlPlugin = getDiagramPlugin('uml-class');
          if (umlPlugin) {
            const customEdge = umlPlugin.renderEdge(shape, { commonProps });
            if (customEdge) return React.isValidElement(customEdge) ? React.cloneElement(customEdge, { key: shape.id }) : customEdge;
          }
        }

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
              {shape.text ? (
                <Text
                  text={shape.text}
                  width={shape.width}
                  height={shape.height}
                  align="center"
                  verticalAlign="middle"
                  fontSize={shape.fontSize || 13}
                  fontFamily="IBM Plex Sans"
                  fill={shape.textFill || shape.stroke || '#26241F'}
                  listening={false}
                />
              ) : null}
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
              {shape.text ? (
                <Text
                  x={-rx}
                  y={-ry}
                  text={shape.text}
                  width={rx * 2}
                  height={ry * 2}
                  align="center"
                  verticalAlign="middle"
                  fontSize={shape.fontSize || 13}
                  fontFamily="IBM Plex Sans"
                  fill={shape.textFill || shape.stroke || '#26241F'}
                  listening={false}
                />
              ) : null}
              <AiBadge shape={shape} width={rx * 2} height={ry * 2} />
            </Group>
          );
        }
        if (shape.type === 'diamond' || shape.type === 'decision') {
          const w = shape.width || 120;
          const h = shape.height || 80;
          return (
            <Group
              key={shape.id}
              width={w}
              height={h}
              {...commonProps(shape)}
            >
              <Line
                points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
                closed
                fill={shape.fill || '#FFFFFF'}
                stroke={shape.stroke || '#26241F'}
                strokeWidth={shape.strokeWidth || 1.5}
                shadowColor="rgba(38, 36, 31, 0.05)"
                shadowBlur={3}
                shadowOffsetY={1}
              />
              {shape.text ? (
                <Text
                  text={shape.text}
                  width={w}
                  height={h}
                  align="center"
                  verticalAlign="middle"
                  fontSize={shape.fontSize || 13}
                  fontFamily="IBM Plex Sans"
                  fill={shape.textFill || shape.stroke || '#26241F'}
                  listening={false}
                />
              ) : null}
              <AiBadge shape={shape} width={w} height={h} />
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
