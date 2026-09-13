/**
 * Mermaid Flowchart and Graph Parser
 * 
 * Deterministically parses Mermaid flowchart/graph syntax into CollabBoard nodes and edges.
 * Supports:
 * - Direction detection (TD/TB: top-bottom, LR: left-right, RL: right-left, BT: bottom-top)
 * - Shape delimiters:
 *   - [text] -> rectangle
 *   - (text) -> rounded / service
 *   - ([text]) -> stadium / service
 *   - [(text)] -> database
 *   - ((text)) -> circle
 *   - {text} -> diamond
 *   - {{text}} -> service
 *   - [/text/] -> service
 * - Edge connectors:
 *   - --> (solid arrow)
 *   - --- (solid line)
 *   - -.-> (dashed arrow)
 *   - ==> (thick arrow)
 *   - Inline labels: |text| or -- text -->
 * - Multi-node chains: A --> B --> C
 * - Comments (%%) and subgraphs
 * 
 * Every extracted element carries source: 'parsed' and confidence: 1.0.
 */

// Delimiter patterns ordered by specificity
const SHAPE_PATTERNS = [
  { regex: /^\(\[([\s\S]+?)\]\)$/, type: 'service' }, // Stadium ([...])
  { regex: /^\(\(([\s\S]+?)\)\)$/, type: 'circle' },   // Double circle ((...))
  { regex: /^\[\(([\s\S]+?)\)\]$/, type: 'database' }, // Cylinder [(...)]
  { regex: /^\{\{([\s\S]+?)\}\}$/, type: 'service' },  // Hexagon {{...}}
  { regex: /^\[\/([\s\S]+?)\/\]$/, type: 'service' },  // Parallelogram [/ ... /]
  { regex: /^\[([\s\S]+?)\]$/, type: 'rectangle' },    // Rectangle [...]
  { regex: /^\(([\s\S]+?)\)$/, type: 'service' },      // Rounded (...)
  { regex: /^\{([\s\S]+?)\}$/, type: 'diamond' },      // Diamond {...}
];

function extractNodeShapeAndLabel(rawText) {
  const trimmed = rawText.trim();
  for (const { regex, type } of SHAPE_PATTERNS) {
    const match = trimmed.match(regex);
    if (match) {
      // Clean quotes if present: ["My Label"] -> My Label
      const cleanLabel = match[1].trim().replace(/^["']|["']$/g, '');
      return { type, label: cleanLabel };
    }
  }
  return { type: 'rectangle', label: trimmed.replace(/^["']|["']$/g, '') };
}

/**
 * Parses a single token that may define a node and its label:
 * e.g., "A[Frontend App]" or "db1[(PostgreSQL)]" or simply "A"
 */
function parseNodeToken(token) {
  const match = token.match(/^([a-zA-Z0-9_\-]+)([\(\[\{][\s\S]+[\)\]\}])?$/);
  if (!match) {
    return { id: token.trim(), type: 'rectangle', label: token.trim() };
  }

  const id = match[1];
  const shapeToken = match[2];

  if (!shapeToken) {
    return { id, type: 'rectangle', label: id };
  }

  const { type, label } = extractNodeShapeAndLabel(shapeToken);
  return { id, type, label };
}

/**
 * Parses a Mermaid graph / flowchart diagram string.
 * 
 * @param {string} mermaidContent 
 * @returns {{
 *   type: 'flowchart' | 'architecture',
 *   sourceType: 'mermaid',
 *   confidence: 1.0,
 *   nodes: Array<{
 *     id: string,
 *     type: string,
 *     label: string,
 *     source: 'parsed',
 *     confidence: 1.0
 *   }>,
 *   edges: Array<{
 *     id: string,
 *     source: string,
 *     target: string,
 *     label: string,
 *     style: 'solid' | 'dashed' | 'dotted',
 *     source: 'parsed',
 *     confidence: 1.0
 *   }>,
 *   layoutHint: 'hierarchical-tb' | 'hierarchical-lr'
 * }}
 */
export function parseMermaidDiagram(mermaidContent) {
  if (!mermaidContent || typeof mermaidContent !== 'string') {
    throw new Error('Invalid Mermaid content: must be a non-empty string');
  }

  const lines = mermaidContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%'));

  let direction = 'TD';
  const nodesMap = new Map();
  const edges = [];
  let edgeCounter = 1;

  // Regex to match edge connectors with optional labels:
  // Examples:
  // -->|label|
  // --> |label|
  // -- label -->
  // -.->|label|
  // -.->
  // ==>|label|
  // ==>
  // ---
  const EDGE_REGEX = /(==>\s*\|[\s\S]*?\||==>|--\s*\|[\s\S]*?\|\s*->|-->\s*\|[\s\S]*?\||--\s*[\w\s\-]+?\s*-->|-->|-\.->\s*\|[\s\S]*?\||-\.->|-\.\s*[\w\s\-]+?\s*\.->|---|--\s*[\w\s\-]+?\s*---)/;

  for (const line of lines) {
    // Check direction header
    const headerMatch = line.match(/^(?:graph|flowchart)\s+(TD|TB|BT|RL|LR)/i);
    if (headerMatch) {
      direction = headerMatch[1].toUpperCase();
      continue;
    }

    // Skip subgraph/end lines
    if (/^subgraph\b/i.test(line) || /^end\b/i.test(line)) {
      continue;
    }

    // Skip styling commands
    if (/^(classDef|class|style|click)\b/i.test(line)) {
      continue;
    }

    // Check if line contains an edge
    if (EDGE_REGEX.test(line)) {
      // Split line by connectors while capturing connector patterns
      // A --> B --> C
      const parts = line.split(new RegExp(EDGE_REGEX.source, 'g'));

      for (let i = 0; i < parts.length - 2; i += 2) {
        const rawSource = parts[i].trim();
        const connector = parts[i + 1].trim();
        const rawTarget = parts[i + 2].trim();

        if (!rawSource || !rawTarget) continue;

        const sourceNode = parseNodeToken(rawSource);
        const targetNode = parseNodeToken(rawTarget);

        // Store or update nodes
        if (!nodesMap.has(sourceNode.id) || nodesMap.get(sourceNode.id).label === sourceNode.id) {
          nodesMap.set(sourceNode.id, sourceNode);
        }
        if (!nodesMap.has(targetNode.id) || nodesMap.get(targetNode.id).label === targetNode.id) {
          nodesMap.set(targetNode.id, targetNode);
        }

        // Determine edge label and style
        let label = '';
        let style = 'solid';

        if (connector.includes('-.->') || connector.includes('.-')) {
          style = 'dashed';
        }

        // Extract label from |label| or -- label -->
        const pipeMatch = connector.match(/\|([\s\S]*?)\|/);
        if (pipeMatch) {
          label = pipeMatch[1].trim();
        } else {
          const dashLabelMatch = connector.match(/--\s*([\w\s\-]+?)\s*-->/);
          if (dashLabelMatch) {
            label = dashLabelMatch[1].trim();
          }
        }

        edges.push({
          id: `e${edgeCounter++}`,
          source: sourceNode.id,
          target: targetNode.id,
          label,
          style,
          sourceTag: 'parsed',
          confidence: 1.0,
        });
      }
    } else {
      // Single node declaration, e.g.: A[Start Process]
      const node = parseNodeToken(line);
      if (node && node.id) {
        if (!nodesMap.has(node.id) || nodesMap.get(node.id).label === node.id) {
          nodesMap.set(node.id, node);
        }
      }
    }
  }

  const nodes = Array.from(nodesMap.values()).map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    source: 'parsed',
    confidence: 1.0,
  }));

  const layoutHint = direction === 'LR' || direction === 'RL' ? 'hierarchical-lr' : 'hierarchical-tb';

  return {
    type: 'flowchart',
    sourceType: 'mermaid',
    confidence: 1.0,
    nodes,
    edges,
    layoutHint,
  };
}
