import { useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import useCanvasStore from './useCanvasStore';

const elk = new ELK();

export default function useAIEngine(stageRef) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState(null);

  const enhanceDiagram = async () => {
    if (!stageRef.current) return;
    
    setIsProcessing(true);
    setAiError(null);

    try {
      // 1. Capture the canvas as an image
      const dataURL = stageRef.current.toDataURL({ pixelRatio: 1 });

      // 2. Send to AI Backend
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataURL })
      });

      if (!response.ok) throw new Error('AI analysis failed');
      const diagramData = await response.json();

      // 3. Setup ELK Graph for Auto-Layout
      const graph = {
        id: "root",
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '60',
          'elk.edgeRouting': 'ORTHOGONAL',
        },
        children: diagramData.nodes.map(n => ({
          id: n.id,
          width: n.type === 'database' ? 140 : 160,
          height: n.type === 'circle' ? 100 : 50,
          labels: [{ text: n.label }],
          // attach original data so we know how to render it later
          data: n
        })),
        edges: diagramData.edges.map((e, i) => ({
          id: `e${i}`,
          sources: [e.source],
          targets: [e.target],
        }))
      };

      // 4. Run Layout Engine
      const layoutedGraph = await elk.layout(graph);

      // 5. Apply to Canvas Store
      const store = useCanvasStore.getState();
      
      // Calculate viewport offset to place diagram centrally
      const stage = stageRef.current;
      const viewX = -stage.x() / stage.scaleX() + 100;
      const viewY = -stage.y() / stage.scaleY() + 100;

      // Group all adds into one history action by using silent adds, 
      // but Zustand is currently structured to add 1 by 1. 
      // For simplicity, we just add them.
      
      const newIds = [];
      
      // Add structured Nodes
      layoutedGraph.children.forEach(node => {
        const shapeType = node.data.type === 'circle' ? 'circle' : 'rectangle';
        
        const id = store.addShape({
          type: shapeType,
          x: viewX + node.x,
          y: viewY + node.y,
          width: node.width,
          height: node.height,
          radiusX: node.width / 2,
          radiusY: node.height / 2,
          fill: '#EEEDfe',
          stroke: '#6C63FF',
          strokeWidth: 2
        });
        newIds.push(id);

        // Add text label as a separate node overlapping the shape
        const textId = store.addShape({
          type: 'text',
          text: node.data.label,
          x: viewX + node.x + 10,
          y: viewY + node.y + (node.height / 2) - 8,
          width: node.width - 20,
          fontSize: 14,
          fill: '#1A1A2E'
        });
        newIds.push(textId);
      });

      // Add orthogonal Edges
      layoutedGraph.edges.forEach(edge => {
        const points = [];
        edge.sections[0].startPoint && points.push(viewX + edge.sections[0].startPoint.x, viewY + edge.sections[0].startPoint.y);
        
        edge.sections[0].bendPoints?.forEach(bp => {
           points.push(viewX + bp.x, viewY + bp.y);
        });

        edge.sections[0].endPoint && points.push(viewX + edge.sections[0].endPoint.x, viewY + edge.sections[0].endPoint.y);
        
        const id = store.addShape({
          type: 'arrow',
          points,
          stroke: '#9CA3AF',
          strokeWidth: 2
        });
        newIds.push(id);
      });

      // 6. Optional: Delete old pencil sketches
      const pencilIds = store.shapes.filter(s => s.type === 'pencil').map(s => s.id);
      if (pencilIds.length > 0) {
        store.deleteShapes(pencilIds);
      }

      store.setSelectedIds(newIds);

    } catch (err) {
      console.error(err);
      setAiError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return { enhanceDiagram, isProcessing, aiError };
}
