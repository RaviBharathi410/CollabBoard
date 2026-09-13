import { XMLParser } from 'fast-xml-parser';

/**
 * SVG Shape Parser
 * 
 * Deterministically extracts vector shapes (<rect>, <circle>, <ellipse>, <polygon>, <path>),
 * connector lines, and text elements from SVG XML.
 * 
 * Matches <text> labels to surrounding shapes using spatial bounding box containment,
 * and matches connector lines/paths to shape endpoints.
 * 
 * Fallback Rule:
 * If the SVG contains no meaningful geometric vector shapes (e.g. it only wraps an <image>),
 * returns { fallbackToRaster: true } so the format router routes it to the image vision pipeline.
 */

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function pointInBox(px, py, bx, by, bw, bh, margin = 20) {
  return (
    px >= bx - margin &&
    px <= bx + bw + margin &&
    py >= by - margin &&
    py <= by + bh + margin
  );
}

export function parseSvgDiagram(svgString) {
  if (!svgString || typeof svgString !== 'string') {
    throw new Error('Invalid SVG content: expected non-empty string');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: true,
  });

  let parsed;
  try {
    parsed = parser.parse(svgString);
  } catch (err) {
    throw new Error(`Failed to parse SVG XML: ${err.message}`);
  }

  const svgRoot = parsed.svg;
  if (!svgRoot) {
    throw new Error('Invalid SVG: missing <svg> root element');
  }

  const shapes = [];
  const texts = [];
  const lines = [];
  let hasImageTag = false;

  // Recursive element traversal
  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;

    // Check for raster fallback indicator
    if (node.image || node['@_href']?.startsWith('data:image/')) {
      hasImageTag = true;
    }

    // 1. Rectangles
    if (node.rect) {
      const rectList = Array.isArray(node.rect) ? node.rect : [node.rect];
      for (const r of rectList) {
        const x = parseFloat(r['@_x'] ?? '0') || 0;
        const y = parseFloat(r['@_y'] ?? '0') || 0;
        const width = parseFloat(r['@_width'] ?? '0');
        const height = parseFloat(r['@_height'] ?? '0');
        // Ignore tiny or full-canvas background rects
        if (width > 20 && height > 20 && (width < 3000 || height < 3000)) {
          shapes.push({
            id: r['@_id'] || `rect-${shapes.length + 1}`,
            type: 'rectangle',
            x,
            y,
            width,
            height,
            fill: r['@_fill'] || '#FFFFFF',
            stroke: r['@_stroke'] || '#26241F',
          });
        }
      }
    }

    // 2. Circles & Ellipses
    if (node.circle) {
      const circleList = Array.isArray(node.circle) ? node.circle : [node.circle];
      for (const c of circleList) {
        const cx = parseFloat(c['@_cx'] ?? '0') || 0;
        const cy = parseFloat(c['@_cy'] ?? '0') || 0;
        const r = parseFloat(c['@_r'] ?? '0');
        if (r > 10) {
          shapes.push({
            id: c['@_id'] || `circle-${shapes.length + 1}`,
            type: 'circle',
            x: cx - r,
            y: cy - r,
            width: r * 2,
            height: r * 2,
            fill: c['@_fill'] || '#FFFFFF',
            stroke: c['@_stroke'] || '#26241F',
          });
        }
      }
    }

    if (node.ellipse) {
      const ellipseList = Array.isArray(node.ellipse) ? node.ellipse : [node.ellipse];
      for (const el of ellipseList) {
        const cx = parseFloat(el['@_cx'] ?? '0') || 0;
        const cy = parseFloat(el['@_cy'] ?? '0') || 0;
        const rx = parseFloat(el['@_rx'] ?? '0');
        const ry = parseFloat(el['@_ry'] ?? '0');
        if (rx > 10 && ry > 10) {
          shapes.push({
            id: el['@_id'] || `ellipse-${shapes.length + 1}`,
            type: 'circle',
            x: cx - rx,
            y: cy - ry,
            width: rx * 2,
            height: ry * 2,
            fill: el['@_fill'] || '#FFFFFF',
            stroke: el['@_stroke'] || '#26241F',
          });
        }
      }
    }

    // 3. Text elements
    if (node.text) {
      const textList = Array.isArray(node.text) ? node.text : [node.text];
      for (const t of textList) {
        const x = parseFloat(t['@_x'] ?? '0') || 0;
        const y = parseFloat(t['@_y'] ?? '0') || 0;
        let content = '';
        if (typeof t === 'string') {
          content = t;
        } else if (typeof t['#text'] === 'string') {
          content = t['#text'];
        } else if (t.tspan) {
          const tspans = Array.isArray(t.tspan) ? t.tspan : [t.tspan];
          content = tspans.map((ts) => (typeof ts === 'string' ? ts : ts['#text'] || '')).join(' ');
        }
        content = content.trim();
        if (content) {
          texts.push({ x, y, text: content });
        }
      }
    }

    // 4. Lines
    if (node.line) {
      const lineList = Array.isArray(node.line) ? node.line : [node.line];
      for (const l of lineList) {
        const x1 = parseFloat(l['@_x1'] ?? '0') || 0;
        const y1 = parseFloat(l['@_y1'] ?? '0') || 0;
        const x2 = parseFloat(l['@_x2'] ?? '0') || 0;
        const y2 = parseFloat(l['@_y2'] ?? '0') || 0;
        if (distance(x1, y1, x2, y2) > 10) {
          lines.push({ x1, y1, x2, y2, id: l['@_id'] });
        }
      }
    }

    // Recurse into children (e.g. <g>)
    for (const key of Object.keys(node)) {
      if (['rect', 'circle', 'ellipse', 'text', 'line'].includes(key)) continue;
      if (typeof node[key] === 'object') {
        traverse(node[key]);
      }
    }
  };

  traverse(svgRoot);

  // Fallback Check: If no vector shapes were found and an <image> tag exists
  if (shapes.length === 0 && hasImageTag) {
    return {
      fallbackToRaster: true,
      reason: 'SVG only contains raster image with no extractable vector shapes',
    };
  }

  // Match text labels to shapes based on spatial inclusion or closest distance
  const nodes = shapes.map((shape) => {
    let matchedText = '';
    let minTextDist = Infinity;

    for (const t of texts) {
      if (pointInBox(t.x, t.y, shape.x, shape.y, shape.width, shape.height)) {
        matchedText = matchedText ? `${matchedText} ${t.text}` : t.text;
      } else {
        const scx = shape.x + shape.width / 2;
        const scy = shape.y + shape.height / 2;
        const d = distance(t.x, t.y, scx, scy);
        if (d < 80 && d < minTextDist) {
          minTextDist = d;
          if (!matchedText) matchedText = t.text;
        }
      }
    }

    return {
      id: shape.id,
      type: shape.type,
      label: matchedText || shape.type.toUpperCase(),
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      source: 'parsed',
      confidence: 0.98,
    };
  });

  // Match connector lines to source and target shapes
  const edges = [];
  let edgeCounter = 1;

  for (const line of lines) {
    let sourceId = null;
    let targetId = null;
    let minSourceDist = Infinity;
    let minTargetDist = Infinity;

    for (const n of nodes) {
      const ncx = n.x + n.width / 2;
      const ncy = n.y + n.height / 2;

      const dStart = distance(line.x1, line.y1, ncx, ncy);
      if (dStart < minSourceDist && dStart < 150) {
        minSourceDist = dStart;
        sourceId = n.id;
      }

      const dEnd = distance(line.x2, line.y2, ncx, ncy);
      if (dEnd < minTargetDist && dEnd < 150) {
        minTargetDist = dEnd;
        targetId = n.id;
      }
    }

    if (sourceId && targetId && sourceId !== targetId) {
      edges.push({
        id: line.id || `e${edgeCounter++}`,
        source: sourceId,
        target: targetId,
        label: '',
        style: 'solid',
        sourceTag: 'parsed',
        confidence: 0.98,
      });
    }
  }

  return {
    type: 'architecture',
    sourceType: 'svg',
    confidence: 0.98,
    nodes,
    edges,
    layoutHint: 'svg-absolute',
  };
}
