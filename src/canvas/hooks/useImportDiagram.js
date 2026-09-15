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
  const [engine, setEngine] = useState('cloud'); // 'cloud' (GPT-4o/Gemini) | 'local' (FastAPI CV)

  /**
   * Imports a diagram from a File object (.drawio, .svg, .mmd, .png, .jpg, etc.)
   */
  const importFile = useCallback(
    async (file, engineOverride) => {
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

        const activeEngine = engineOverride || engine;
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/import/file`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filename: file.name,
            content,
            enableHighPrecision: highPrecision,
            enablePreprocessing: true,
            engine: activeEngine,
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
          modelUsed: data.modelUsed,
          fallbackReason: data.fallbackReason,
        });
      } catch (err) {
        console.error('[useImportDiagram] Error importing file:', err);
        setError(err.message || 'Failed to import diagram');
      } finally {
        setIsImporting(false);
      }
    },
    [highPrecision, engine]
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

    const formatNodeLabel = (n) => {
      let label = (n.label || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
      if (n.properties && (n.properties.attributes?.length || n.properties.operations?.length)) {
        const parts = [label];
        if (n.properties.attributes?.length) {
          parts.push('────────────────');
          parts.push(...n.properties.attributes);
        }
        if (n.properties.operations?.length) {
          parts.push('────────────────');
          parts.push(...n.properties.operations);
        }
        label = parts.join('\n');
      }
      return label;
    };

    const computeDynamicDimensions = (label, defaultW = 160, defaultH = 65) => {
      const lines = (label || '').split('\n');
      const maxLineLen = Math.max(...lines.map((l) => l.length), 8);
      const w = Math.max(defaultW, Math.min(360, Math.round(maxLineLen * 8.2 + 32)));
      const h = Math.max(defaultH, Math.round(lines.length * 19 + 26));
      return { w, h, lines };
    };

    const hasPositions = previewDiagram.nodes.every((n) => typeof n.x === 'number' && typeof n.y === 'number');

    let laidNodes = [];
    let laidEdges = [];
    let offsetX = 0;
    let offsetY = 0;
    let scaleFactor = 1.0;

    if (hasPositions) {
      const rawMinX = Math.min(...previewDiagram.nodes.map((n) => n.x));
      const rawMaxX = Math.max(...previewDiagram.nodes.map((n) => n.x + (n.width || 100)));
      const rawMinY = Math.min(...previewDiagram.nodes.map((n) => n.y));
      const rawMaxY = Math.max(...previewDiagram.nodes.map((n) => n.y + (n.height || 50)));
      const rawW = Math.max(rawMaxX - rawMinX, 100);
      const rawH = Math.max(rawMaxY - rawMinY, 100);

      // Uniform scaling: scale diagram proportionally to fit canvas viewport comfortably,
      // preserving authentic 2D alignments, columns, rows, and relative spacing exactly as detected.
      const targetW = Math.min(stageW * 0.88, 1250);
      const targetH = Math.min(stageH * 0.88, 850);
      scaleFactor = Math.min(1.4, Math.max(1.0, Math.min(targetW / rawW, targetH / rawH)));

      const diagW = rawW * scaleFactor;
      const diagH = rawH * scaleFactor;
      offsetX = viewCenterX - diagW / 2;
      offsetY = viewCenterY - diagH / 2;

      laidNodes = previewDiagram.nodes.map((n) => {
        const cleanLabel = formatNodeLabel(n);
        const w = (n.width || 110) * scaleFactor;
        const h = (n.height || 55) * scaleFactor;
        const absX = (n.x - rawMinX) * scaleFactor + offsetX;
        const absY = (n.y - rawMinY) * scaleFactor + offsetY;
        return {
          ...n,
          formattedLabel: cleanLabel,
          absX,
          absY,
          w,
          h,
        };
      });

      // Smart closest-anchor routing: connects top/bottom/left/right anchors naturally
      const getBestConnectionPoints = (sNode, tNode) => {
        const sAnchors = [
          { x: sNode.absX + sNode.w / 2, y: sNode.absY }, // top
          { x: sNode.absX + sNode.w / 2, y: sNode.absY + sNode.h }, // bottom
          { x: sNode.absX, y: sNode.absY + sNode.h / 2 }, // left
          { x: sNode.absX + sNode.w, y: sNode.absY + sNode.h / 2 }, // right
        ];
        const tAnchors = [
          { x: tNode.absX + tNode.w / 2, y: tNode.absY }, // top
          { x: tNode.absX + tNode.w / 2, y: tNode.absY + tNode.h }, // bottom
          { x: tNode.absX, y: tNode.absY + tNode.h / 2 }, // left
          { x: tNode.absX + tNode.w, y: tNode.absY + tNode.h / 2 }, // right
        ];

        let bestPair = [sAnchors[3], tAnchors[2]];
        let minDist = Infinity;

        for (const sa of sAnchors) {
          for (const ta of tAnchors) {
            const dist = Math.hypot(sa.x - ta.x, sa.y - ta.y);
            if (dist < minDist) {
              minDist = dist;
              bestPair = [sa, ta];
            }
          }
        }
        return [bestPair[0].x, bestPair[0].y, bestPair[1].x, bestPair[1].y];
      };

      // Edges: ALWAYS route cleanly between source and target box boundary anchors!
      // This prevents arrows from penetrating into boxes or drawing floating disconnected fragments.
      laidEdges = (previewDiagram.edges || [])
        .map((e) => {
          const sNode = laidNodes.find((n) => n.id === e.source);
          const tNode = laidNodes.find((n) => n.id === e.target);
          if (sNode && tNode && sNode !== tNode) {
            const points = getBestConnectionPoints(sNode, tNode);
            return { ...e, points };
          }
          if (e.points && e.points.length >= 2) {
            const points = e.points.flatMap(([px, py]) => [
              (px - rawMinX) * scaleFactor + offsetX,
              (py - rawMinY) * scaleFactor + offsetY,
            ]);
            return { ...e, points };
          }
          return null;
        })
        .filter(Boolean);
    } else {
      // Need ELK Layout (e.g. Mermaid or Cloud AI Vision without explicit coordinates)
      const elk = await getElk();
      const isLR = previewDiagram.layoutHint === 'hierarchical-lr';

      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': isLR ? 'RIGHT' : 'DOWN',
          'elk.spacing.nodeNode': '80',
          'elk.layered.spacing.nodeNodeBetweenLayers': '110',
          'elk.layered.spacing.edgeNodeBetweenLayers': '50',
          'elk.edgeRouting': 'ORTHOGONAL',
        },
        children: previewDiagram.nodes.map((n) => {
          const cleanLabel = formatNodeLabel(n);
          const { w, h } = computeDynamicDimensions(cleanLabel, 160, 65);
          return {
            id: n.id,
            width: w,
            height: h,
            labels: [{ text: cleanLabel }],
            data: { ...n, formattedLabel: cleanLabel },
          };
        }),
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
        const cleanLabel = cn.data?.formattedLabel || formatNodeLabel(orig);
        return {
          ...orig,
          formattedLabel: cleanLabel,
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

    const shapesToCommit = [];

    const isUML =
      previewDiagram.type === 'uml-class' ||
      previewDiagram.type === 'class_diagram' ||
      previewDiagram.type === 'class';

    // 1. Prepare Nodes and formatted Text shapes
    for (const node of laidNodes) {
      const cleanLabel = node.formattedLabel || formatNodeLabel(node);

      if (isUML && (node.type === 'class' || node.type === 'interface' || node.type === 'rectangle' || !node.type)) {
        shapesToCommit.push({
          type: 'uml_class',
          pluginType: 'uml-class',
          subtype: node.type === 'interface' ? 'interface' : 'class',
          x: node.absX,
          y: node.absY,
          width: node.w,
          height: node.h,
          label: cleanLabel,
          text: cleanLabel,
          stereotype: node.stereotype,
          attributes: node.properties?.attributes || node.fields,
          methods: node.properties?.operations || node.methods,
          fill: '#FFFFFF',
          stroke: '#6C63FF',
          strokeWidth: 2,
        });
        continue;
      }

      const isCircle = node.type === 'circle';
      const isDiamond = node.type === 'diamond';
      const isDb = node.type === 'database';

      if (isCircle) {
        shapesToCommit.push({
          type: 'circle',
          x: node.absX + node.w / 2,
          y: node.absY + node.h / 2,
          radiusX: node.w / 2,
          radiusY: node.h / 2,
          fill: '#EEEDFE',
          stroke: '#6C63FF',
          strokeWidth: 2,
        });
      } else if (isDiamond) {
        shapesToCommit.push({
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
        shapesToCommit.push({
          type: 'rectangle',
          x: node.absX,
          y: node.absY,
          width: node.w,
          height: node.h,
          fill: isDb ? '#E6F4EA' : '#EEEDFE',
          stroke: isDb ? '#1E8E3E' : '#6C63FF',
          strokeWidth: 2,
        });
      }

      // Format multiline label inside the box
      if (cleanLabel) {
        const lines = cleanLabel.split('\n');
        const isMultiLine = lines.length > 1;
        const textY = isMultiLine
          ? node.absY + 12
          : node.absY + Math.max(8, (node.h - 18) / 2);

        shapesToCommit.push({
          type: 'text',
          text: cleanLabel,
          x: node.absX + 12,
          y: textY,
          width: Math.max(node.w - 24, 60),
          fontSize: 12,
          fontFamily: 'Plus Jakarta Sans',
          fill: '#1A1A2E',
          lineHeight: 1.35,
        });
      }
    }

    // 2. Prepare Edges (arrows)
    for (const edge of laidEdges) {
      if (edge.points && edge.points.length >= 4) {
        const isDep = (edge.subtype || edge.label || '').toLowerCase().includes('depend') || edge.style === 'dashed';
        shapesToCommit.push({
          type: 'arrow',
          subtype: edge.subtype || edge.label || 'association',
          label: edge.label || '',
          sourceMultiplicity: edge.multiplicitySource || edge.sourceMultiplicity || '',
          targetMultiplicity: edge.multiplicityTarget || edge.targetMultiplicity || '',
          pluginType: isUML ? 'uml-class' : undefined,
          points: edge.points,
          stroke: '#6C63FF',
          strokeWidth: 1.5,
          dash: isDep ? [6, 3] : undefined,
        });
      }
    }

    // Update active diagram domain type on canvas store
    if (typeof store.setDiagramType === 'function') {
      store.setDiagramType(isUML ? 'uml-class' : (previewDiagram.type || 'flowchart'));
    }

    // 3. Atomic commit: single history entry in canvasStore allows single-keystroke undo (Ctrl+Z)
    const addedIds = typeof store.addShapes === 'function'
      ? store.addShapes(shapesToCommit)
      : shapesToCommit.map((s) => store.addShape(s));

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
    engine,
    setEngine,
    importFile,
    importText,
    updateElement,
    commitToCanvas,
    clearPreview,
  };
}
