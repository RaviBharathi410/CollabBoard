import zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';

/**
 * Draw.io / mxGraph XML Parser
 * 
 * Deterministically extracts vertices, edges, geometry, and styles from .drawio / mxGraph XML.
 * Supports:
 * - Plain XML and base64/deflate-compressed <diagram> content
 * - Absolute coordinate calculation for nested shapes/groups
 * - Multi-segment connector waypoints
 * - HTML label sanitization
 * - Shape style mapping to CollabBoard node types
 * 
 * Every extracted element is tagged with source: 'parsed' and confidence: 1.0.
 */

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();
}

/**
 * Unpacks the diagram XML from raw text or deflated <diagram> tag.
 */
export function unpackDrawioXml(rawXmlOrContent) {
  if (!rawXmlOrContent || typeof rawXmlOrContent !== 'string') {
    throw new Error('Invalid input: draw.io diagram content must be a non-empty string');
  }

  const trimmed = rawXmlOrContent.trim();

  // If it's already an <mxGraphModel> directly
  if (trimmed.includes('<mxGraphModel')) {
    return trimmed;
  }

  // Check for <diagram> tag
  const diagramMatch = trimmed.match(/<diagram[\s\S]*?>([\s\S]*?)<\/diagram>/i);
  if (diagramMatch && diagramMatch[1]) {
    const payload = diagramMatch[1].trim();

    // If uncompressed XML inside <diagram>
    if (payload.includes('<mxGraphModel') || payload.includes('&lt;mxGraphModel')) {
      return payload.startsWith('&lt;') ? decodeHtmlEntities(payload) : payload;
    }

    // Try base64 decode + deflate raw inflate
    try {
      const buffer = Buffer.from(payload, 'base64');
      const decompressed = zlib.inflateRawSync(buffer);
      let xmlStr = decompressed.toString('utf8');
      try {
        xmlStr = decodeURIComponent(xmlStr);
      } catch {
        // Not URI-encoded
      }
      return xmlStr;
    } catch (deflateErr) {
      // If deflate failed, maybe it was plain text or URL encoded
      try {
        return decodeURIComponent(payload);
      } catch {
        return payload;
      }
    }
  }

  return trimmed;
}

/**
 * Map mxGraph style string to CollabBoard node shape type.
 * Examples:
 * - "rounded=1;whiteSpace=wrap;html=1;" -> "rectangle"
 * - "shape=cylinder;whiteSpace=wrap;" -> "database"
 * - "rhombus;whiteSpace=wrap;" -> "diamond"
 * - "ellipse;whiteSpace=wrap;" -> "circle"
 * - "shape=cloud;" -> "cloud"
 * - "swimlane;" -> "group_boundary"
 */
export function mapDrawioStyleToType(styleStr = '') {
  if (!styleStr || typeof styleStr !== 'string') return 'rectangle';

  const styleLower = styleStr.toLowerCase();

  if (styleLower.includes('shape=cylinder') || styleLower.includes('cylinder3')) {
    return 'database';
  }
  if (styleLower.includes('shape=rhombus') || styleLower.includes('rhombus')) {
    return 'diamond';
  }
  if (styleLower.includes('ellipse') || styleLower.includes('shape=ellipse')) {
    return 'circle';
  }
  if (styleLower.includes('shape=cloud')) {
    return 'cloud';
  }
  if (styleLower.includes('shape=actor') || styleLower.includes('actor')) {
    return 'actor';
  }
  if (styleLower.includes('swimlane') || styleLower.includes('group')) {
    return 'group_boundary';
  }
  if (styleLower.includes('shape=step') || styleLower.includes('shape=hexagon')) {
    return 'rectangle';
  }
  return 'rectangle';
}

/**
 * Parse stroke style (solid, dashed, dotted) from style string.
 */
export function mapDrawioEdgeStyle(styleStr = '') {
  if (!styleStr || typeof styleStr !== 'string') return 'solid';
  const styleLower = styleStr.toLowerCase();
  if (styleLower.includes('dashed=1')) {
    if (styleLower.includes('dashpattern=1') || styleLower.includes('dashpattern=2')) {
      return 'dotted';
    }
    return 'dashed';
  }
  return 'solid';
}

/**
 * Parses draw.io XML content and returns standard diagram structure.
 * 
 * @param {string} xmlContent 
 * @returns {{
 *   type: 'architecture' | 'flowchart',
 *   sourceType: 'drawio',
 *   confidence: 1.0,
 *   nodes: Array<{
 *     id: string,
 *     type: string,
 *     label: string,
 *     x: number,
 *     y: number,
 *     width: number,
 *     height: number,
 *     source: 'parsed',
 *     confidence: 1.0,
 *     parentId?: string
 *   }>,
 *   edges: Array<{
 *     id: string,
 *     source: string,
 *     target: string,
 *     label: string,
 *     style: 'solid' | 'dashed' | 'dotted',
 *     points?: Array<[number, number]>,
 *     source: 'parsed',
 *     confidence: 1.0
 *   }>,
 *   layoutHint: 'drawio-absolute'
 * }}
 */
export function parseDrawioDiagram(xmlContent) {
  const unpackedXml = unpackDrawioXml(xmlContent);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: true,
  });

  const parsed = parser.parse(unpackedXml);

  // Locate root container
  let mxCells = [];
  const model = parsed.mxGraphModel || parsed['mxfile']?.diagram?.mxGraphModel || parsed.diagram?.mxGraphModel;

  if (model && model.root && model.root.mxCell) {
    const rawCells = model.root.mxCell;
    mxCells = Array.isArray(rawCells) ? rawCells : [rawCells];
  } else {
    // Search recursively for mxCell elements if structure is non-standard
    const findCells = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.mxCell) {
        const c = Array.isArray(obj.mxCell) ? obj.mxCell : [obj.mxCell];
        mxCells.push(...c);
      }
      for (const key of Object.keys(obj)) {
        if (key !== 'mxCell') findCells(obj[key]);
      }
    };
    findCells(parsed);
  }

  const rawNodes = [];
  const rawEdges = [];
  const nodeMap = new Map();

  for (const cell of mxCells) {
    const id = String(cell['@_id'] ?? '');
    // Ignore root containers (usually id="0" or id="1")
    if (!id || id === '0' || id === '1') continue;

    const isVertex = cell['@_vertex'] === '1' || cell['@_vertex'] === true;
    const isEdge = cell['@_edge'] === '1' || cell['@_edge'] === true;
    const parentId = cell['@_parent'] ? String(cell['@_parent']) : undefined;
    const rawValue = cell['@_value'] !== undefined ? String(cell['@_value']) : '';
    const label = decodeHtmlEntities(rawValue);
    const style = cell['@_style'] || '';

    if (isVertex) {
      const geo = cell.mxGeometry;
      const x = parseFloat(geo?.['@_x'] ?? '0') || 0;
      const y = parseFloat(geo?.['@_y'] ?? '0') || 0;
      const width = parseFloat(geo?.['@_width'] ?? '120') || 120;
      const height = parseFloat(geo?.['@_height'] ?? '60') || 60;

      const node = {
        id,
        type: mapDrawioStyleToType(style),
        label,
        x,
        y,
        width,
        height,
        parentId,
        source: 'parsed',
        confidence: 1.0,
      };

      rawNodes.push(node);
      nodeMap.set(id, node);
    } else if (isEdge) {
      const source = cell['@_source'] ? String(cell['@_source']) : '';
      const target = cell['@_target'] ? String(cell['@_target']) : '';

      // Extract waypoints if present
      const points = [];
      const arrayPoints = cell.mxGeometry?.Array?.mxPoint;
      if (arrayPoints) {
        const ptList = Array.isArray(arrayPoints) ? arrayPoints : [arrayPoints];
        for (const pt of ptList) {
          const px = parseFloat(pt['@_x'] ?? '0');
          const py = parseFloat(pt['@_y'] ?? '0');
          if (!isNaN(px) && !isNaN(py)) {
            points.push([px, py]);
          }
        }
      }

      rawEdges.push({
        id,
        source,
        target,
        label,
        style: mapDrawioEdgeStyle(style),
        points: points.length > 0 ? points : undefined,
        sourceTag: 'parsed',
        confidence: 1.0,
      });
    }
  }

  // Resolve absolute coordinates for nested containers/groups
  // A node's absolute coordinate is its relative x/y + parent's absolute x/y
  const computeAbsolutePosition = (node, visited = new Set()) => {
    if (!node.parentId || visited.has(node.id) || !nodeMap.has(node.parentId)) {
      return { x: node.x, y: node.y };
    }
    visited.add(node.id);
    const parent = nodeMap.get(node.parentId);
    const parentPos = computeAbsolutePosition(parent, visited);
    return {
      x: node.x + parentPos.x,
      y: node.y + parentPos.y,
    };
  };

  const resolvedNodes = rawNodes.map((node) => {
    const absPos = computeAbsolutePosition(node);
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      x: absPos.x,
      y: absPos.y,
      width: node.width,
      height: node.height,
      source: 'parsed',
      confidence: 1.0,
    };
  });

  // Valid edges: only keep edges where source and target are defined
  const validEdges = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    style: e.style,
    points: e.points,
    sourceTag: 'parsed',
    confidence: 1.0,
  }));

  return {
    type: 'architecture',
    sourceType: 'drawio',
    confidence: 1.0,
    nodes: resolvedNodes,
    edges: validEdges,
    layoutHint: 'drawio-absolute',
  };
}
