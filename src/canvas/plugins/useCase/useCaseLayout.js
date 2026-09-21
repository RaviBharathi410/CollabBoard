/**
 * useCaseLayout.js
 * Deterministic layout engine for UML Use Case diagrams.
 * Enforces:
 * 1. Actor Placement: Primary human/system actors on the left column (X_left), secondary actors on the right column.
 * 2. System Boundary: Explicit bounding box containing all internal use cases.
 * 3. Use Case Grid: Internal use cases arranged neatly inside the boundary with comfortable vertical and horizontal spacing.
 */

export function useCaseLayout({ nodes = [], edges = [], options = {} }) {
  const {
    startX = 80,
    startY = 80,
    actorWidth = 80,
    actorHeight = 110,
    boundaryX = 260,
    boundaryWidth = 600,
    useCaseWidth = 160,
    useCaseHeight = 70,
    rowSpacing = 40,
  } = options;

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const edgeList = edges.map((e) => ({ ...e }));

  const primaryActors = [];
  const secondaryActors = [];
  const useCases = [];
  let systemBoundary = null;
  const otherNodes = [];

  for (const node of nodeMap.values()) {
    const isActor = node.subtype === 'actor' || node.type === 'usecase_actor';
    const isUseCase = node.subtype === 'use_case' || node.type === 'usecase_oval' || node.type === 'use_case';
    const isBoundary = node.subtype === 'system_boundary' || node.type === 'usecase_boundary';

    if (isActor) {
      if (node.isSecondary || node.position === 'right') {
        secondaryActors.push(node);
      } else {
        primaryActors.push(node);
      }
    } else if (isUseCase) {
      useCases.push(node);
    } else if (isBoundary) {
      systemBoundary = node;
    } else {
      otherNodes.push(node);
    }
  }

  // 1. Arrange Primary Actors vertically on the left
  let currentActorY = startY + 40;
  primaryActors.forEach((actor, idx) => {
    actor.x = startX;
    actor.y = currentActorY;
    actor.width = actorWidth;
    actor.height = actorHeight;
    actor.subtype = 'actor';
    actor.pluginType = 'use-case';
    currentActorY += actorHeight + rowSpacing;
  });

  // 2. Arrange Use Cases inside the System Boundary in a 2-column or 1-column layout
  const cols = useCases.length > 3 ? 2 : 1;
  const colWidth = (boundaryWidth - 80) / cols;
  const startInternalY = startY + 60;

  useCases.forEach((uc, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);

    const ucX = boundaryX + 40 + c * colWidth + (colWidth - useCaseWidth) / 2;
    const ucY = startInternalY + r * (useCaseHeight + rowSpacing);

    uc.x = ucX;
    uc.y = ucY;
    uc.width = useCaseWidth;
    uc.height = useCaseHeight;
    uc.subtype = 'use_case';
    uc.pluginType = 'use-case';
  });

  const totalRows = Math.ceil(useCases.length / cols);
  const boundaryHeight = Math.max(
    320,
    startInternalY + totalRows * (useCaseHeight + rowSpacing) - startY + 30
  );

  // 3. Position System Boundary
  if (!systemBoundary) {
    systemBoundary = {
      id: 'system-boundary',
      type: 'usecase_boundary',
      subtype: 'system_boundary',
      pluginType: 'use-case',
      name: 'System',
    };
  }
  systemBoundary.x = boundaryX;
  systemBoundary.y = startY;
  systemBoundary.width = boundaryWidth;
  systemBoundary.height = boundaryHeight;
  systemBoundary.subtype = 'system_boundary';
  systemBoundary.pluginType = 'use-case';

  // 4. Arrange Secondary Actors vertically on the right
  const rightActorX = boundaryX + boundaryWidth + 80;
  let currentSecActorY = startY + 40;
  secondaryActors.forEach((actor) => {
    actor.x = rightActorX;
    actor.y = currentSecActorY;
    actor.width = actorWidth;
    actor.height = actorHeight;
    actor.subtype = 'actor';
    actor.pluginType = 'use-case';
    currentSecActorY += actorHeight + rowSpacing;
  });

  // 5. Connect Edge points directly between node centers / perimeters
  const allNodes = [systemBoundary, ...primaryActors, ...secondaryActors, ...useCases, ...otherNodes];
  const updatedNodeMap = new Map(allNodes.map((n) => [n.id, n]));

  edgeList.forEach((edge) => {
    edge.pluginType = 'use-case';
    const sNode = updatedNodeMap.get(edge.source);
    const tNode = updatedNodeMap.get(edge.target);

    if (sNode && tNode) {
      const sx = sNode.x + sNode.width / 2;
      const sy = sNode.y + sNode.height / 2;
      const tx = tNode.x + tNode.width / 2;
      const ty = tNode.y + tNode.height / 2;
      edge.points = [sx, sy, tx, ty];
    }
  });

  return {
    nodes: allNodes,
    edges: edgeList,
    meta: {
      totalWidth: rightActorX + (secondaryActors.length > 0 ? actorWidth + 80 : 40),
      totalHeight: Math.max(currentActorY, boundaryHeight + startY + 60),
    },
  };
}

export default useCaseLayout;
