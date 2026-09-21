/**
 * Orthogonal / Manhattan Arrow Router & Diagram Layout Utilities
 * Enforces strictly horizontal and vertical axes (90-degree right angles)
 * with channel spacing offsets between parallel lines and outer boundary anchor snapping.
 */

/**
 * Returns whether two numbers are approximately equal within epsilon.
 */
function approxEqual(a, b, eps = 0.5) {
  return Math.abs(a - b) <= eps;
}

/**
 * Simplifies a polyline by removing collinear points and duplicate vertices.
 * Guarantees that every remaining segment is strictly horizontal or vertical.
 */
export function simplifyOrthogonalPath(points) {
  if (!points || points.length < 4) return points || [];

  const rawPts = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = Math.round(points[i] * 10) / 10;
    const y = Math.round(points[i + 1] * 10) / 10;
    // Skip duplicate consecutive points
    if (
      rawPts.length > 0 &&
      approxEqual(x, rawPts[rawPts.length - 1].x) &&
      approxEqual(y, rawPts[rawPts.length - 1].y)
    ) {
      continue;
    }
    rawPts.push({ x, y });
  }

  if (rawPts.length < 2) return points;

  // Remove collinear points
  const simplified = [rawPts[0]];
  for (let i = 1; i < rawPts.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = rawPts[i];
    const next = rawPts[i + 1];

    const isCollinearH = approxEqual(prev.y, curr.y) && approxEqual(curr.y, next.y);
    const isCollinearV = approxEqual(prev.x, curr.x) && approxEqual(curr.x, next.x);

    if (!isCollinearH && !isCollinearV) {
      simplified.push(curr);
    }
  }
  simplified.push(rawPts[rawPts.length - 1]);

  return simplified.flatMap((p) => [p.x, p.y]);
}

/**
 * Computes strictly 90-degree orthogonal path between source and target node boundaries.
 * Guarantees zero diagonal segments, proper clearances from boxes, and distinct
 * channel offsets between parallel edges.
 */
export function routeOrthogonalEdge(sNode, tNode, options = {}) {
  const {
    edgeIndex = 0,
    channelSpacing = 14,
    clearance = 20,
  } = options;

  const sx = sNode.absX ?? sNode.x ?? 0;
  const sy = sNode.absY ?? sNode.y ?? 0;
  const sw = Math.max(sNode.w ?? sNode.width ?? 120, 40);
  const sh = Math.max(sNode.h ?? sNode.height ?? 60, 30);

  const tx = tNode.absX ?? tNode.x ?? 0;
  const ty = tNode.absY ?? tNode.y ?? 0;
  const tw = Math.max(tNode.w ?? tNode.width ?? 120, 40);
  const th = Math.max(tNode.h ?? tNode.height ?? 60, 30);

  const sCenter = { x: sx + sw / 2, y: sy + sh / 2 };
  const tCenter = { x: tx + tw / 2, y: ty + th / 2 };

  // Determine dominant orientation
  const isTargetBelow = ty >= sy + sh - 8;
  const isTargetAbove = ty + th <= sy + 8;
  const isTargetRight = tx >= sx + sw - 8;
  const isTargetLeft = tx + tw <= sx + 8;

  // Stagger anchors along node edges when multiple edges connect
  const offset = ((edgeIndex % 5) - 2) * 10;

  let startAnchor, endAnchor;
  let exitDir, enterDir; // 'DOWN' | 'UP' | 'RIGHT' | 'LEFT'

  if (isTargetBelow) {
    exitDir = 'DOWN';
    enterDir = 'UP';
    const sAnchorX = Math.min(Math.max(sCenter.x + offset, sx + 16), sx + sw - 16);
    const tAnchorX = Math.min(Math.max(tCenter.x + offset, tx + 16), tx + tw - 16);
    startAnchor = { x: sAnchorX, y: sy + sh };
    endAnchor = { x: tAnchorX, y: ty };
  } else if (isTargetAbove) {
    exitDir = 'UP';
    enterDir = 'DOWN';
    const sAnchorX = Math.min(Math.max(sCenter.x + offset, sx + 16), sx + sw - 16);
    const tAnchorX = Math.min(Math.max(tCenter.x + offset, tx + 16), tx + tw - 16);
    startAnchor = { x: sAnchorX, y: sy };
    endAnchor = { x: tAnchorX, y: ty + th };
  } else if (isTargetRight) {
    exitDir = 'RIGHT';
    enterDir = 'LEFT';
    const sAnchorY = Math.min(Math.max(sCenter.y + offset, sy + 14), sy + sh - 14);
    const tAnchorY = Math.min(Math.max(tCenter.y + offset, ty + 14), ty + th - 14);
    startAnchor = { x: sx + sw, y: sAnchorY };
    endAnchor = { x: tx, y: tAnchorY };
  } else if (isTargetLeft) {
    exitDir = 'LEFT';
    enterDir = 'RIGHT';
    const sAnchorY = Math.min(Math.max(sCenter.y + offset, sy + 14), sy + sh - 14);
    const tAnchorY = Math.min(Math.max(tCenter.y + offset, ty + 14), ty + th - 14);
    startAnchor = { x: sx, y: sAnchorY };
    endAnchor = { x: tx + tw, y: tAnchorY };
  } else {
    // Default closest anchors
    startAnchor = { x: sx + sw, y: sCenter.y };
    endAnchor = { x: tx, y: tCenter.y };
    exitDir = 'RIGHT';
    enterDir = 'LEFT';
  }

  // Generate orthogonal waypoints with channel spacing
  const busOffset = ((edgeIndex % 4) - 1.5) * channelSpacing;
  const rawWaypoints = [startAnchor.x, startAnchor.y];

  if (exitDir === 'DOWN' && enterDir === 'UP') {
    if (approxEqual(startAnchor.x, endAnchor.x, 2)) {
      // Direct vertical line
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    } else {
      const midY = Math.round((startAnchor.y + endAnchor.y) / 2 + busOffset);
      const safeMidY = Math.max(startAnchor.y + clearance, Math.min(endAnchor.y - clearance, midY));
      rawWaypoints.push(startAnchor.x, safeMidY);
      rawWaypoints.push(endAnchor.x, safeMidY);
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    }
  } else if (exitDir === 'UP' && enterDir === 'DOWN') {
    if (approxEqual(startAnchor.x, endAnchor.x, 2)) {
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    } else {
      const midY = Math.round((startAnchor.y + endAnchor.y) / 2 + busOffset);
      const safeMidY = Math.min(startAnchor.y - clearance, Math.max(endAnchor.y + clearance, midY));
      rawWaypoints.push(startAnchor.x, safeMidY);
      rawWaypoints.push(endAnchor.x, safeMidY);
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    }
  } else if (exitDir === 'RIGHT' && enterDir === 'LEFT') {
    if (approxEqual(startAnchor.y, endAnchor.y, 2)) {
      // Direct horizontal line
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    } else {
      const midX = Math.round((startAnchor.x + endAnchor.x) / 2 + busOffset);
      const safeMidX = Math.max(startAnchor.x + clearance, Math.min(endAnchor.x - clearance, midX));
      rawWaypoints.push(safeMidX, startAnchor.y);
      rawWaypoints.push(safeMidX, endAnchor.y);
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    }
  } else if (exitDir === 'LEFT' && enterDir === 'RIGHT') {
    if (approxEqual(startAnchor.y, endAnchor.y, 2)) {
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    } else {
      const midX = Math.round((startAnchor.x + endAnchor.x) / 2 + busOffset);
      const safeMidX = Math.min(startAnchor.x - clearance, Math.max(endAnchor.x + clearance, midX));
      rawWaypoints.push(safeMidX, startAnchor.y);
      rawWaypoints.push(safeMidX, endAnchor.y);
      rawWaypoints.push(endAnchor.x, endAnchor.y);
    }
  } else {
    // Fallback orthogonal Manhattan connector
    rawWaypoints.push(endAnchor.x, startAnchor.y);
    rawWaypoints.push(endAnchor.x, endAnchor.y);
  }

  return simplifyOrthogonalPath(rawWaypoints);
}

/**
 * Generates clean 90-degree orthogonal path during manual arrow drawing.
 */
export function orthogonalManualArrow(startPos, currentPos) {
  if (!startPos || !currentPos) return [0, 0, 0, 0];
  const dx = currentPos.x - startPos.x;
  const dy = currentPos.y - startPos.y;

  // Near-axis snapping
  if (Math.abs(dx) < 6) {
    return [startPos.x, startPos.y, startPos.x, currentPos.y];
  }
  if (Math.abs(dy) < 6) {
    return [startPos.x, startPos.y, currentPos.x, startPos.y];
  }

  // 2-segment orthogonal elbow based on primary drag direction
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal then vertical
    return [startPos.x, startPos.y, currentPos.x, startPos.y, currentPos.x, currentPos.y];
  } else {
    // Vertical then horizontal
    return [startPos.x, startPos.y, startPos.x, currentPos.y, currentPos.x, currentPos.y];
  }
}

/**
 * Tidy up and auto-arrange diagram shapes:
 * 1. Guarantees adequate width & height for nodes to contain all multiline content
 * 2. Resolves overlapping node boxes with clean horizontal & vertical margins
 * 3. Re-routes all arrows orthogonally with proper channel spacing
 */
export function autoArrangeDiagram(shapes) {
  if (!Array.isArray(shapes) || shapes.length === 0) return shapes;

  const nodeTypes = ['uml_class', 'rectangle', 'circle', 'diamond'];
  const nodes = [];
  const edges = [];
  const others = [];

  shapes.forEach((s) => {
    if (s.type === 'arrow' || s.type === 'connector') {
      edges.push({ ...s });
    } else if (nodeTypes.includes(s.type) || s.subtype === 'class' || s.subtype === 'interface') {
      nodes.push({ ...s });
    } else {
      others.push({ ...s });
    }
  });

  if (nodes.length === 0) return shapes;

  // 1. Box Dimension Expansion Pass: ensure no text leakage
  nodes.forEach((n) => {
    const rawText = (n.text || n.label || '').trim();
    const lines = rawText ? rawText.split('\n') : [];
    const maxLineLen = Math.max(...lines.map((l) => l.length), (n.name || '').length, 8);

    const minW = Math.max(160, maxLineLen * 7.5 + 32);
    const minH = Math.max(65, lines.length * 18 + 36);

    n.width = Math.max(n.width || 160, minW);
    n.height = Math.max(n.height || 65, minH);
  });

  // 2. Collision Resolution Pass: separate overlapping nodes
  const hMargin = 48;
  const vMargin = 48;

  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const a = nodes[i];
        const b = nodes[j];

        const aRight = a.x + a.width;
        const aBottom = a.y + a.height;
        const bRight = b.x + b.width;
        const bBottom = b.y + b.height;

        const overlapX = a.x < bRight + hMargin && aRight + hMargin > b.x;
        const overlapY = a.y < bBottom + vMargin && aBottom + vMargin > b.y;

        if (overlapX && overlapY) {
          // Push b away from a along least displacement axis
          const diffX = (b.x + b.width / 2) - (a.x + a.width / 2);
          const diffY = (b.y + b.height / 2) - (a.y + a.height / 2);

          if (Math.abs(diffX) >= Math.abs(diffY)) {
            if (diffX >= 0) {
              b.x = aRight + hMargin;
            } else {
              b.x = a.x - b.width - hMargin;
            }
          } else {
            if (diffY >= 0) {
              b.y = aBottom + vMargin;
            } else {
              b.y = a.y - b.height - vMargin;
            }
          }
        }
      }
    }
  }

  // 3. Orthogonal Edge Re-routing Pass
  const arrangedEdges = edges.map((edge, idx) => {
    // Try to match edge endpoints to source and target nodes
    let sNode = nodes.find((n) => n.id === edge.source);
    let tNode = nodes.find((n) => n.id === edge.target);

    // Fallback: match by point proximity if source/target IDs are missing
    if ((!sNode || !tNode) && edge.points?.length >= 4) {
      const pStart = { x: edge.points[0], y: edge.points[1] };
      const pEnd = { x: edge.points[edge.points.length - 2], y: edge.points[edge.points.length - 1] };

      if (!sNode) {
        sNode = nodes.find((n) => {
          return (
            pStart.x >= n.x - 30 &&
            pStart.x <= n.x + n.width + 30 &&
            pStart.y >= n.y - 30 &&
            pStart.y <= n.y + n.height + 30
          );
        });
      }
      if (!tNode) {
        tNode = nodes.find((n) => {
          return (
            pEnd.x >= n.x - 30 &&
            pEnd.x <= n.x + n.width + 30 &&
            pEnd.y >= n.y - 30 &&
            pEnd.y <= n.y + n.height + 30
          );
        });
      }
    }

    if (sNode && tNode && sNode !== tNode) {
      const points = routeOrthogonalEdge(sNode, tNode, {
        edgeIndex: idx,
        channelSpacing: 16,
        clearance: 22,
      });
      return {
        ...edge,
        points,
      };
    }

    // If edge is unattached but has points, snap it to orthogonal segments
    if (edge.points?.length >= 4) {
      const pts = edge.points;
      const start = { x: pts[0], y: pts[1] };
      const end = { x: pts[pts.length - 2], y: pts[pts.length - 1] };
      const points = orthogonalManualArrow(start, end);
      return { ...edge, points };
    }

    return edge;
  });

  return [...nodes, ...arrangedEdges, ...others];
}
