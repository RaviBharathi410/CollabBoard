/**
 * sequenceLayout.js
 * Deterministic layout engine for UML Sequence Diagrams.
 * Enforces:
 * 1. Horizontal Lifeline ordering: Lifelines are parallel and ordered along the X-axis (X_0 < X_1 < ... < X_n).
 * 2. Chronological Time Flow: Messages descend top-to-bottom along the Y-axis (Y_0 < Y_1 < ... < Y_m).
 * 3. Uniform Lifeline Extension: All lifelines extend to a consistent bottom baseline below the final message.
 */

export function sequenceLayout({ nodes = [], edges = [], options = {} }) {
  const {
    startX = 120,
    startY = 80,
    lifelineSpacing = 220,
    headerWidth = 140,
    headerHeight = 50,
    messageStartY = 180,
    messageSpacing = 65,
    paddingBottom = 80,
    activationWidth = 14,
  } = options;

  // Clone nodes and edges to avoid mutating inputs
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const edgeList = edges.map((e) => ({ ...e }));

  // Separate lifelines vs activations vs other nodes
  const lifelines = [];
  const activations = [];
  const otherNodes = [];

  for (const node of nodeMap.values()) {
    const isLifeline =
      node.subtype === 'lifeline' ||
      node.type === 'sequence_lifeline' ||
      (!node.subtype && node.type !== 'sequence_activation' && !node.lifelineId);

    const isActivation =
      node.subtype === 'activation' ||
      node.type === 'sequence_activation' ||
      Boolean(node.lifelineId);

    if (isLifeline) {
      lifelines.push(node);
    } else if (isActivation) {
      activations.push(node);
    } else {
      otherNodes.push(node);
    }
  }

  // 1. Order lifelines horizontally
  // Honor explicit node.order if provided, otherwise preserve left-to-right author intent by initial x
  lifelines.sort((a, b) => {
    if (typeof a.order === 'number' && typeof b.order === 'number') {
      return a.order - b.order;
    }
    return (a.x ?? 0) - (b.x ?? 0);
  });

  const lifelineCenterMap = new Map();

  lifelines.forEach((ll, idx) => {
    const w = ll.width || headerWidth;
    const h = ll.height || headerHeight;
    const x = startX + idx * lifelineSpacing;
    const y = startY;

    ll.x = x;
    ll.y = y;
    ll.width = w;
    ll.height = h;
    ll.order = idx;
    ll.pluginType = 'sequence';
    ll.subtype = 'lifeline';

    const centerX = x + w / 2;
    lifelineCenterMap.set(ll.id, centerX);
  });

  // 2. Order messages chronologically
  // Order messages by explicit order or current vertical coordinate
  edgeList.sort((a, b) => {
    if (typeof a.order === 'number' && typeof b.order === 'number') {
      return a.order - b.order;
    }
    const aY = a.points?.[1] ?? (a.y ?? 0);
    const bY = b.points?.[1] ?? (b.y ?? 0);
    return aY - bY;
  });

  // Position messages horizontally between lifelines
  let currentMsgY = messageStartY;
  edgeList.forEach((edge, idx) => {
    edge.order = idx + 1;
    edge.pluginType = 'sequence';

    const sourceCenter = lifelineCenterMap.get(edge.source);
    const targetCenter = lifelineCenterMap.get(edge.target);

    const y = currentMsgY;
    if (sourceCenter !== undefined && targetCenter !== undefined) {
      // Self message (call to self)
      if (edge.source === edge.target) {
        const loopWidth = 40;
        const loopHeight = 26;
        edge.points = [
          sourceCenter, y,
          sourceCenter + loopWidth, y,
          sourceCenter + loopWidth, y + loopHeight,
          sourceCenter, y + loopHeight,
        ];
        edge.isSelfMessage = true;
        currentMsgY += messageSpacing + 10;
      } else {
        // Directed message between two distinct lifelines
        edge.points = [sourceCenter, y, targetCenter, y];
        edge.isSelfMessage = false;
        currentMsgY += messageSpacing;
      }
    } else {
      currentMsgY += messageSpacing;
    }
  });

  // 3. Extend all lifelines to uniform floor line
  const finalFloorY = Math.max(currentMsgY + paddingBottom, startY + 300);
  lifelines.forEach((ll) => {
    ll.lineHeight = finalFloorY - (ll.y + ll.height);
  });

  // 4. Position activations on lifeline centerlines
  activations.forEach((act) => {
    const parentLifeline = nodeMap.get(act.lifelineId);
    if (parentLifeline && lifelineCenterMap.has(parentLifeline.id)) {
      const centerX = lifelineCenterMap.get(parentLifeline.id);
      const w = act.width || activationWidth;
      act.x = centerX - w / 2;
      act.width = w;
      act.pluginType = 'sequence';
      act.subtype = 'activation';
    }
  });

  return {
    nodes: [...lifelines, ...activations, ...otherNodes],
    edges: edgeList,
    meta: {
      totalWidth: startX + Math.max(1, lifelines.length) * lifelineSpacing + 100,
      totalHeight: finalFloorY + 50,
    },
  };
}

export default sequenceLayout;
