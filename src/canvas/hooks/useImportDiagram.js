import { useState, useCallback } from 'react';
import useCanvasStore from '../store/canvasStore';
import { getAuthHeaders } from './useAIEngine';

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

let _elkInstance = null;
async function getElk() {
  if (_elkInstance) return _elkInstance;
  const mod = await import('elkjs/lib/elk.bundled.js');
  const ELK = mod.default || mod;
  _elkInstance = new ELK();
  return _elkInstance;
}

export default function useImportDiagram(stageRef) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [previewDiagram, setPreviewDiagram] = useState(null);
  const [importMeta, setImportMeta] = useState(null);
  const [highPrecision, setHighPrecision] = useState(false);

  /**
   * Imports a diagram from a File object (.drawio, .svg, .mmd, .png, .jpg, etc.)
   */
  const importFile = useCallback(
    async (file) => {
      if (!file) return;
      setIsImporting(true);
      setError(null);

      try {
        const isBinaryImage = /\.(png|jpe?g|webp)$/i.test(file.name);

        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read file'));
          if (isBinaryImage) {
            reader.onload = () => resolve(reader.result); // Data URL
            reader.readAsDataURL(file);
          } else {
            reader.onload = () => resolve(reader.result); // UTF-8 Text
            reader.readAsText(file);
          }
        });

        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/import/file`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filename: file.name,
            content,
            enableHighPrecision: highPrecision,
            enablePreprocessing: true,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Import failed with status ${res.status}`);
        }

        const data = await res.json();
        setPreviewDiagram(data.diagram);
        setImportMeta({
          filename: file.name,
          format: data.format,
          isStructured: data.isStructured,
          preprocessing: data.preprocessing,
        });
      } catch (err) {
        console.error('[useImportDiagram] Error importing file:', err);
        setError(err.message || 'Failed to import diagram');
      } finally {
        setIsImporting(false);
      }
    },
    [highPrecision]
  );

  /**
   * Imports raw diagram text (e.g. Mermaid or mxGraph XML)
   */
  const importText = useCallback(async (text, formatHint = 'mermaid') => {
    if (!text?.trim()) return;
    setIsImporting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/import/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, formatHint }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Import failed with status ${res.status}`);
      }

      const data = await res.json();
      setPreviewDiagram(data.diagram);
      setImportMeta({
        filename: `diagram.${formatHint}`,
        format: data.format,
        isStructured: true,
      });
    } catch (err) {
      console.error('[useImportDiagram] Error importing text:', err);
      setError(err.message || 'Failed to import diagram text');
    } finally {
      setIsImporting(false);
    }
  }, []);

  /**
   * Updates an element in the preview diagram and dispatches a correction
   * to /api/feedback for active learning.
   */
  const updateElement = useCallback(
    async (nodeId, updates) => {
      if (!previewDiagram) return;

      const nextNodes = previewDiagram.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates, confidence: 1.0, source: 'inferred' } : n
      );

      const nextConfidenceElements = (previewDiagram.confidenceReport?.lowConfidenceElements || []).filter(
        (el) => el.id !== nodeId
      );

      setPreviewDiagram({
        ...previewDiagram,
        nodes: nextNodes,
        confidenceReport: {
          ...previewDiagram.confidenceReport,
          lowConfidenceCount: nextConfidenceElements.length,
          lowConfidenceElements: nextConfidenceElements,
        },
      });

      // Dispatch correction to active learning feedback pipeline
      try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE}/api/feedback`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'correction',
            sessionId: `import-${Date.now()}`,
            nodeId,
            correctedLabel: updates.label,
            correctedType: updates.type,
          }),
        });
      } catch (fbErr) {
        console.warn('[useImportDiagram] Failed to log active learning feedback:', fbErr);
      }
    },
    [previewDiagram]
  );

  /**
   * Commits the preview diagram to real editable shapes on the canvas stage.
   */
  const commitToCanvas = useCallback(async () => {
    if (!previewDiagram || !previewDiagram.nodes?.length) return [];

    const store = useCanvasStore.getState();
    const stage = stageRef?.current;
    const scale = (typeof stage?.scaleX === 'function' ? stage.scaleX() : 1) || 1;
    const stagePos = {
      x: typeof stage?.x === 'function' ? stage.x() : 0,
      y: typeof stage?.y === 'function' ? stage.y() : 0,
    };

    const stageW = typeof stage?.width === 'function' ? stage.width() : 1200;
    const stageH = typeof stage?.height === 'function' ? stage.height() : 800;
    const viewCenterX = -stagePos.x / scale + stageW / scale / 2;
    const viewCenterY = -stagePos.y / scale + stageH / scale / 2;

    const hasPositions = previewDiagram.nodes.every((n) => typeof n.x === 'number' && typeof n.y === 'number');

    let laidNodes = [];
    let laidEdges = [];
    let offsetX = 0;
    let offsetY = 0;

    if (hasPositions) {
      // Use existing parsed / detected positions and center them in viewport
      const minX = Math.min(...previewDiagram.nodes.map((n) => n.x));
      const maxX = Math.max(...previewDiagram.nodes.map((n) => n.x + (n.width || 120)));
      const minY = Math.min(...previewDiagram.nodes.map((n) => n.y));
      const maxY = Math.max(...previewDiagram.nodes.map((n) => n.y + (n.height || 60)));

      const diagW = maxX - minX;
      const diagH = maxY - minY;
      const diagCenterX = minX + diagW / 2;
      const diagCenterY = minY + diagH / 2;

      offsetX = viewCenterX - diagCenterX;
      offsetY = viewCenterY - diagCenterY;

      laidNodes = previewDiagram.nodes.map((n) => ({
        ...n,
        absX: n.x + offsetX,
        absY: n.y + offsetY,
        w: n.width || 120,
        h: n.height || 60,
      }));

      // Edges with waypoints or connecting centers
      laidEdges = (previewDiagram.edges || []).map((e) => {
        let points = [];
        if (e.points && e.points.length > 0) {
          points = e.points.flatMap(([px, py]) => [px + offsetX, py + offsetY]);
        } else {
          const sNode = laidNodes.find((n) => n.id === e.source);
          const tNode = laidNodes.find((n) => n.id === e.target);
          if (sNode && tNode) {
            points = [
              sNode.absX + sNode.w,
              sNode.absY + sNode.h / 2,
              tNode.absX,
              tNode.absY + tNode.h / 2,
            ];
          }
        }
        return { ...e, points };
      });
    } else {
      // Need ELK Layout (e.g. Mermaid without explicit coordinates)
      const elk = await getElk();
      const isLR = previewDiagram.layoutHint === 'hierarchical-lr';

      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': isLR ? 'RIGHT' : 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        },
        children: previewDiagram.nodes.map((n) => ({
          id: n.id,
          width: 140,
          height: 60,
          labels: [{ text: n.label }],
          data: n,
        })),
        edges: (previewDiagram.edges || []).map((e, i) => ({
          id: e.id || `e${i}`,
          sources: [e.source],
          targets: [e.target],
          data: e,
        })),
      };

      const laid = await elk.layout(graph);
      const minX = Math.min(...(laid.children || []).map((n) => n.x));
      const maxX = Math.max(...(laid.children || []).map((n) => n.x + n.width));
      const minY = Math.min(...(laid.children || []).map((n) => n.y));
      const maxY = Math.max(...(laid.children || []).map((n) => n.y + n.height));

      offsetX = viewCenterX - (minX + maxX) / 2;
      offsetY = viewCenterY - (minY + maxY) / 2;

      laidNodes = (laid.children || []).map((cn) => {
        const orig = previewDiagram.nodes.find((n) => n.id === cn.id);
        return {
          ...orig,
          absX: cn.x + offsetX,
          absY: cn.y + offsetY,
          w: cn.width,
          h: cn.height,
        };
      });

      laidEdges = (laid.edges || []).map((le) => {
        const orig = previewDiagram.edges.find((e) => e.source === le.sources?.[0] && e.target === le.targets?.[0]);
        const points = [];
        if (le.sections?.length) {
          const sec = le.sections[0];
          if (sec.startPoint) points.push(sec.startPoint.x + offsetX, sec.startPoint.y + offsetY);
          sec.bendPoints?.forEach((bp) => points.push(bp.x + offsetX, bp.y + offsetY));
          if (sec.endPoint) points.push(sec.endPoint.x + offsetX, sec.endPoint.y + offsetY);
        }
        return { ...(orig || {}), points };
      });
    }

    const addedIds = [];
    const nodeIdToShapeId = new Map();

    // 1. Commit Nodes to canvasStore
    for (const node of laidNodes) {
      let shapeId;
      if (node.type === 'circle') {
        shapeId = store.addShape({
          type: 'circle',
          x: node.absX + node.w / 2,
          y: node.absY + node.h / 2,
          radiusX: node.w / 2,
          radiusY: node.h / 2,
          fill: '#EEEDFE',
          stroke: '#6C63FF',
          strokeWidth: 2,
        });
      } else if (node.type === 'diamond') {
        shapeId = store.addShape({
          type: 'diamond',
          x: node.absX,
          y: node.absY,
          width: node.w,
          height: node.h,
          fill: '#FEF3D6',
          stroke: '#F59E0B',
          strokeWidth: 2,
        });
      } else {
        // Rectangle or database
        shapeId = store.addShape({
          type: 'rectangle',
          x: node.absX,
          y: node.absY,
          width: node.w,
          height: node.h,
          fill: node.type === 'database' ? '#E6F4EA' : '#EEEDFE',
          stroke: node.type === 'database' ? '#1E8E3E' : '#6C63FF',
          strokeWidth: 2,
        });
      }

      addedIds.push(shapeId);
      nodeIdToShapeId.set(node.id, shapeId);

      // Label text shape
      if (node.label) {
        const textId = store.addShape({
          type: 'text',
          text: node.label,
          x: node.absX + 8,
          y: node.absY + node.h / 2 - 8,
          width: Math.max(node.w - 16, 40),
          fontSize: 13,
          fontFamily: 'Plus Jakarta Sans',
          fill: '#1A1A2E',
        });
        addedIds.push(textId);
      }
    }

    // 2. Commit Edges (arrows)
    for (const edge of laidEdges) {
      if (edge.points && edge.points.length >= 4) {
        const arrowId = store.addShape({
          type: 'arrow',
          points: edge.points,
          stroke: '#6C63FF',
          strokeWidth: 1.5,
          dash: edge.style === 'dashed' ? [6, 3] : undefined,
        });
        addedIds.push(arrowId);
      }
    }

    // Clear preview state & select all imported shapes
    setPreviewDiagram(null);
    setImportMeta(null);
    if (addedIds.length > 0) {
      store.setSelectedIds(addedIds);
    }

    return addedIds;
  }, [previewDiagram, stageRef]);

  const clearPreview = useCallback(() => {
    setPreviewDiagram(null);
    setImportMeta(null);
    setError(null);
  }, []);

  return {
    isImporting,
    error,
    previewDiagram,
    importMeta,
    highPrecision,
    setHighPrecision,
    importFile,
    importText,
    updateElement,
    commitToCanvas,
    clearPreview,
  };
}
