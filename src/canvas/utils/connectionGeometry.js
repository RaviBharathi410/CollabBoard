/**
 * connectionGeometry.js
 * Geometric anchor resolution and dynamic connection routing for canvas connectors.
 */

/**
 * Computes the 2D bounding box and center for any canvas shape.
 */
export function getNodeBounds(node) {
  if (!node) return null;

  if (node.type === 'circle') {
    const rx = node.radiusX || 40;
    const ry = node.radiusY || 40;
    return {
      x: node.x - rx,
      y: node.y - ry,
      width: rx * 2,
      height: ry * 2,
      centerX: node.x,
      centerY: node.y,
    };
  }

  const w = node.width || (node.type === 'uml_class' ? 180 : 120);
  const h = node.height || (node.type === 'uml_class' ? 120 : 60);
  return {
    x: node.x,
    y: node.y,
    width: w,
    height: h,
    centerX: node.x + w / 2,
    centerY: node.y + h / 2,
  };
}

/**
 * Computes cardinal anchors (top, bottom, left, right) for a node.
 */
export function getNodeAnchors(node) {
  const b = getNodeBounds(node);
  if (!b) return [];

  return [
    { x: Math.round(b.centerX), y: Math.round(b.y), side: 'top' },
    { x: Math.round(b.centerX), y: Math.round(b.y + b.height), side: 'bottom' },
    { x: Math.round(b.x), y: Math.round(b.centerY), side: 'left' },
    { x: Math.round(b.x + b.width), y: Math.round(b.centerY), side: 'right' },
  ];
}

/**
 * Finds the closest cardinal anchor on a node to a reference target point.
 */
export function getClosestAnchor(node, targetPoint) {
  const anchors = getNodeAnchors(node);
  if (!anchors.length) return targetPoint;

  let best = anchors[0];
  let minDist = Infinity;
  for (const a of anchors) {
    const d = Math.hypot(a.x - targetPoint.x, a.y - targetPoint.y);
    if (d < minDist) {
      minDist = d;
      best = a;
    }
  }
  return best;
}

/**
 * Computes the optimal connection points between source and target nodes.
 * Automatically chooses closest anchor pair for 4-point straight lines,
 * and maintains bend points for multi-segment lines.
 */
export function getBestConnectionPoints(sourceNode, targetNode, currentPoints = []) {
  const sAnchors = sourceNode ? getNodeAnchors(sourceNode) : [];
  const tAnchors = targetNode ? getNodeAnchors(targetNode) : [];

  // Case 1: Both source and target nodes exist
  if (sAnchors.length > 0 && tAnchors.length > 0) {
    // Multi-segment connector: preserve intermediate bend points
    if (currentPoints.length > 4) {
      const nextFromStart = { x: currentPoints[2], y: currentPoints[3] };
      const prevToEnd = { x: currentPoints[currentPoints.length - 4], y: currentPoints[currentPoints.length - 3] };
      const sAnchor = getClosestAnchor(sourceNode, nextFromStart);
      const tAnchor = getClosestAnchor(targetNode, prevToEnd);
      const middle = currentPoints.slice(2, -2);
      return [sAnchor.x, sAnchor.y, ...middle, tAnchor.x, tAnchor.y];
    }

    // Straight 4-point line: find best cardinal pair with minimum Euclidean distance
    let bestPair = [sAnchors[3], tAnchors[2]]; // default right -> left
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
  }

  // Case 2: Only sourceNode exists (free target point)
  if (sAnchors.length > 0) {
    const targetX = currentPoints[currentPoints.length - 2] ?? sAnchors[0].x + 100;
    const targetY = currentPoints[currentPoints.length - 1] ?? sAnchors[0].y;
    const sAnchor = getClosestAnchor(sourceNode, { x: targetX, y: targetY });
    if (currentPoints.length > 4) {
      return [sAnchor.x, sAnchor.y, ...currentPoints.slice(2)];
    }
    return [sAnchor.x, sAnchor.y, targetX, targetY];
  }

  // Case 3: Only targetNode exists (free source point)
  if (tAnchors.length > 0) {
    const sourceX = currentPoints[0] ?? tAnchors[0].x - 100;
    const sourceY = currentPoints[1] ?? tAnchors[0].y;
    const tAnchor = getClosestAnchor(targetNode, { x: sourceX, y: sourceY });
    if (currentPoints.length > 4) {
      return [...currentPoints.slice(0, -2), tAnchor.x, tAnchor.y];
    }
    return [sourceX, sourceY, tAnchor.x, tAnchor.y];
  }

  // Fallback: unmodified points
  return currentPoints;
}

/**
 * Searches canvas shapes for a node whose bounds or anchors touch the given point.
 */
export function findConnectedNodeAt(px, py, shapes, excludeId = null, threshold = 26) {
  for (const s of shapes) {
    if (s.id === excludeId || s.type === 'arrow' || s.type === 'pencil') continue;
    const b = getNodeBounds(s);
    if (!b) continue;

    // Check cardinal anchors
    const anchors = getNodeAnchors(s);
    for (const a of anchors) {
      if (Math.hypot(a.x - px, a.y - py) <= threshold) {
        return s;
      }
    }

    // Check bounding box with slight outer tolerance
    if (
      px >= b.x - threshold &&
      px <= b.x + b.width + threshold &&
      py >= b.y - threshold &&
      py <= b.y + b.height + threshold
    ) {
      return s;
    }
  }
  return null;
}
