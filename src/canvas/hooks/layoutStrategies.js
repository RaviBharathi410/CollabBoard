export const LAYOUT_STRATEGIES = {
  architecture: {
    algorithm: 'layered',
    direction: 'DOWN',
    nodeSpacing: 60,
    layerSpacing: 80,
    edgeRouting: 'ORTHOGONAL',
  },
  flowchart: {
    algorithm: 'layered',
    direction: 'DOWN',
    nodeSpacing: 40,
    layerSpacing: 60,
    edgeRouting: 'ORTHOGONAL',
  },
  erd: {
    algorithm: 'layered',
    direction: 'RIGHT',
    nodeSpacing: 80,
    layerSpacing: 100,
    edgeRouting: 'ORTHOGONAL',
  },
  sequence: {
    algorithm: 'layered',
    direction: 'RIGHT',
    nodeSpacing: 120,
    layerSpacing: 80,
    edgeRouting: 'POLYLINE',
  },
  mindmap: {
    algorithm: 'mrtree',
    direction: 'RIGHT',
    nodeSpacing: 40,
    layerSpacing: 60,
    edgeRouting: 'POLYLINE',
  },
  unknown: {
    algorithm: 'layered',
    direction: 'DOWN',
    nodeSpacing: 60,
    layerSpacing: 60,
    edgeRouting: 'ORTHOGONAL',
  },
};

export function getNodeDimensions(type) {
  switch (type) {
    case 'database':
    case 'cylinder':
      return { width: 140, height: 50 };
    case 'diamond':
      return { width: 120, height: 80 };
    case 'circle':
      return { width: 160, height: 100 };
    default:
      return { width: 160, height: 60 };
  }
}

export function mapNodeShapeType(aiType) {
  if (aiType === 'circle') return 'circle';
  return 'rectangle';
}
