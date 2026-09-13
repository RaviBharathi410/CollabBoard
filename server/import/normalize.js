/**
 * Unified Diagram Schema Normalizer & Defensive Graph Healing
 * 
 * Takes raw diagram outputs from deterministic parsers or image vision pipelines
 * and normalizes them into the standard CollabBoard schema.
 * 
 * Every node carries: { id, type, label, x, y, width, height, source, confidence }
 * Every edge carries: { id, source, target, label, style, sourceTag, confidence, points? }
 * 
 * Also compiles a Precision Confidence Report:
 * {
 *   overall: number,
 *   bySource: { parsed: number, ocr: number, detected: number, inferred: number },
 *   lowConfidenceCount: number,
 *   lowConfidenceElements: Array<{ id, type, label, confidence, source }>
 * }
 * 
 * Runs defensive graph healing (prunes phantom edges, stitches orphan nodes).
 */

export function sanitizeAndHealGraph(diagram, stitchOrphans = false) {
  const nodes = diagram.nodes || [];
  const edges = diagram.edges || [];
  const nodeIds = nodes.map((n) => n.id);
  const nodeIdSet = new Set(nodeIds);

  const prunedEdges = [];
  const validEdges = [];

  // 1. Prune phantom edges referencing non-existent IDs
  for (const e of edges) {
    if (!e || typeof e !== 'object') continue;
    const src = e.source || e.from;
    const tgt = e.target || e.to;
    if (nodeIdSet.has(src) && nodeIdSet.has(tgt)) {
      validEdges.push(e);
    } else {
      prunedEdges.push(`${src}->${tgt}`);
    }
  }

  // 2. Check connectivity and stitch orphan nodes only when explicitly enabled (e.g. generative NLP prompts)
  const connectedNodes = new Set();
  for (const e of validEdges) {
    const s = e.source || e.from;
    const t = e.target || e.to;
    connectedNodes.add(s);
    connectedNodes.add(t);
  }

  const orphans = nodeIds.filter((nid) => !connectedNodes.has(nid));
  const healedEdges = [];

  if (stitchOrphans && orphans.length > 0 && nodeIds.length > 1) {
    for (const o of orphans) {
      const idx = nodeIds.indexOf(o);
      const anchor = idx > 0 ? nodeIds[idx - 1] : nodeIds[1];
      if (anchor && anchor !== o) {
        const eid = `healed-e${validEdges.length + healedEdges.length + 1}`;
        healedEdges.push({
          id: eid,
          source: anchor,
          target: o,
          label: '',
          style: 'solid',
          sourceTag: 'healed',
          confidence: 0.8,
        });
      }
    }
  }

  const allEdges = [...validEdges, ...healedEdges];
  const healingApplied = prunedEdges.length > 0 || healedEdges.length > 0;

  return {
    diagram: {
      ...diagram,
      edges: allEdges,
    },
    healingTelemetry: {
      healingApplied,
      prunedEdgeCount: prunedEdges.length,
      prunedEdges,
      stitchedNodeCount: orphans.length,
      stitchedEdges: healedEdges.map((e) => `${e.source}->${e.target}`),
    },
  };
}

/**
 * Normalizes diagram data from any source into the canonical CollabBoard schema.
 * 
 * @param {Object} rawDiagram - Parsed or reconstructed diagram object
 * @param {'drawio' | 'mermaid' | 'svg' | 'image'} sourceType 
 * @param {number} confidenceThreshold - Threshold below which elements are flagged for user review (default: 0.80)
 */
export function normalizeDiagram(rawDiagram, sourceType = 'unknown', confidenceThreshold = 0.80) {
  if (!rawDiagram || typeof rawDiagram !== 'object') {
    throw new Error('normalizeDiagram: input must be a valid diagram object');
  }

  const rawNodes = Array.isArray(rawDiagram.nodes) ? rawDiagram.nodes : [];
  const rawEdges = Array.isArray(rawDiagram.edges) ? rawDiagram.edges : [];

  const defaultSource = sourceType === 'image' ? 'detected' : 'parsed';
  const defaultConf = sourceType === 'image' ? 0.85 : 1.0;

  // 1. Normalize nodes
  const nodes = rawNodes.map((n, idx) => {
    const id = String(n.id || `node-${idx + 1}`);
    const type = String(n.type || 'rectangle').toLowerCase();
    const label = String(n.label || '').trim();
    const source = n.source || (sourceType === 'image' ? 'detected' : 'parsed');
    const confidence = typeof n.confidence === 'number' ? Math.max(0, Math.min(1, n.confidence)) : defaultConf;

    return {
      id,
      type,
      label,
      confidence: parseFloat(confidence.toFixed(3)),
      source,
      x: typeof n.x === 'number' ? n.x : undefined,
      y: typeof n.y === 'number' ? n.y : undefined,
      width: typeof n.width === 'number' ? n.width : undefined,
      height: typeof n.height === 'number' ? n.height : undefined,
    };
  });

  // 2. Normalize edges
  const edges = rawEdges.map((e, idx) => {
    const id = String(e.id || `edge-${idx + 1}`);
    const source = String(e.source || e.from || '');
    const target = String(e.target || e.to || '');
    const label = String(e.label || '').trim();
    const style = ['solid', 'dashed', 'dotted'].includes(e.style) ? e.style : 'solid';
    const sourceTag = e.sourceTag || (sourceType === 'image' ? 'detected' : 'parsed');
    const confidence = typeof e.confidence === 'number' ? Math.max(0, Math.min(1, e.confidence)) : defaultConf;

    return {
      id,
      source,
      target,
      label,
      style,
      points: Array.isArray(e.points) ? e.points : undefined,
      sourceTag,
      confidence: parseFloat(confidence.toFixed(3)),
    };
  });

  // 3. Apply defensive graph healing
  const unhealed = {
    type: rawDiagram.type || 'architecture',
    sourceType,
    nodes,
    edges,
    layoutHint: rawDiagram.layoutHint || (sourceType === 'mermaid' ? 'hierarchical-tb' : 'absolute'),
  };

  const { diagram: healedDiagram, healingTelemetry } = sanitizeAndHealGraph(unhealed);

  // 4. Compile Precision Confidence Report
  const bySource = { parsed: 0, ocr: 0, detected: 0, inferred: 0, healed: 0 };
  const lowConfidenceElements = [];

  for (const n of healedDiagram.nodes) {
    bySource[n.source] = (bySource[n.source] || 0) + 1;
    if (n.confidence < confidenceThreshold) {
      lowConfidenceElements.push({
        id: n.id,
        kind: 'node',
        type: n.type,
        label: n.label,
        confidence: n.confidence,
        source: n.source,
      });
    }
  }

  for (const e of healedDiagram.edges) {
    bySource[e.sourceTag] = (bySource[e.sourceTag] || 0) + 1;
    if (e.confidence < confidenceThreshold) {
      lowConfidenceElements.push({
        id: e.id,
        kind: 'edge',
        label: e.label || `${e.source} -> ${e.target}`,
        confidence: e.confidence,
        source: e.sourceTag,
      });
    }
  }

  const allConfidences = [
    ...healedDiagram.nodes.map((n) => n.confidence),
    ...healedDiagram.edges.map((e) => e.confidence),
  ];
  const overallConfidence =
    allConfidences.length > 0
      ? parseFloat((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length).toFixed(3))
      : 1.0;

  return {
    type: healedDiagram.type,
    sourceType,
    overallConfidence,
    nodes: healedDiagram.nodes,
    edges: healedDiagram.edges,
    layoutHint: healedDiagram.layoutHint,
    confidenceReport: {
      overall: overallConfidence,
      bySource,
      lowConfidenceCount: lowConfidenceElements.length,
      lowConfidenceElements,
    },
    healingTelemetry,
  };
}
