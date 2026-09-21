import { describe, it, expect } from 'vitest';
import SequencePlugin from './SequencePlugin';
import { sequenceLayout } from './sequenceLayout';

describe('SequencePlugin & sequenceLayout', () => {
  const plugin = new SequencePlugin();

  it('correctly initializes plugin metadata and subtypes', () => {
    expect(plugin.id).toBe('sequence');
    expect(plugin.displayName).toBe('UML Sequence Diagram');
    expect(plugin.defaultLayoutAlgorithm).toBe('sequence');

    const nodeIds = plugin.nodeSubtypes.map((n) => n.id);
    expect(nodeIds).toContain('lifeline');
    expect(nodeIds).toContain('activation');

    const edgeIds = plugin.edgeSubtypes.map((e) => e.id);
    expect(edgeIds).toContain('sync_message');
    expect(edgeIds).toContain('async_message');
    expect(edgeIds).toContain('return_message');
    expect(edgeIds).toContain('create_message');
  });

  it('computes anchor points including vertical centerline timeline anchors', () => {
    const node = { id: 'll-1', x: 100, y: 50, width: 140, height: 50, lineHeight: 300 };
    const anchors = plugin.getAnchorPoints(node);

    expect(anchors.length).toBeGreaterThanOrEqual(4);
    // Top anchor should be centered on header
    const top = anchors.find((a) => a.id === 'top');
    expect(top).toBeDefined();
    expect(top.x).toBe(170); // 100 + 140/2
    expect(top.y).toBe(50);

    // Centerline anchors along timeline
    const centerAnchors = anchors.filter((a) => a.id.startsWith('center-'));
    expect(centerAnchors.length).toBeGreaterThan(0);
    expect(centerAnchors[0].x).toBe(170);
  });

  it('validates lifelines and activations correctly', () => {
    // Valid lifeline
    expect(plugin.validateNode({ id: 'l1', name: 'User : Client' }).valid).toBe(true);
    // Invalid lifeline without name
    const invalidLl = plugin.validateNode({ id: 'l1' });
    expect(invalidLl.valid).toBe(false);
    expect(invalidLl.errors[0]).toContain('requires a participant name');

    // Valid activation
    expect(plugin.validateNode({ id: 'a1', subtype: 'activation', lifelineId: 'l1' }).valid).toBe(true);
    // Invalid activation without lifelineId
    const invalidAct = plugin.validateNode({ id: 'a1', subtype: 'activation' });
    expect(invalidAct.valid).toBe(false);
    expect(invalidAct.errors[0]).toContain('lifelineId required');
  });

  it('validates message edges ensuring connected lifelines exist', () => {
    const nodes = [
      { id: 'l1', name: 'Client' },
      { id: 'l2', name: 'Server' },
    ];

    const validEdge = { id: 'e1', source: 'l1', target: 'l2' };
    expect(plugin.validateEdge(validEdge, nodes).valid).toBe(true);

    const invalidEdge = { id: 'e2', source: 'l1', target: 'l3' };
    const result = plugin.validateEdge(invalidEdge, nodes);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("target 'l3' does not exist");
  });

  describe('sequenceLayout Engine', () => {
    it('strictly enforces horizontal lifeline ordering and vertical time flow', () => {
      const nodes = [
        { id: 'auth', name: 'AuthService', x: 500, y: 100 },
        { id: 'client', name: 'ClientApp', x: 100, y: 100 },
        { id: 'db', name: 'Database', x: 900, y: 100 },
      ];

      const edges = [
        { id: 'm1', source: 'client', target: 'auth', label: 'login()', order: 1 },
        { id: 'm2', source: 'auth', target: 'db', label: 'queryUser()', order: 2 },
        { id: 'm3', source: 'db', target: 'auth', subtype: 'return_message', label: 'userRecord', order: 3 },
        { id: 'm4', source: 'auth', target: 'client', subtype: 'return_message', label: 'jwtToken', order: 4 },
      ];

      const layoutResult = sequenceLayout({
        nodes,
        edges,
        options: {
          startX: 100,
          startY: 60,
          lifelineSpacing: 250,
          messageStartY: 160,
          messageSpacing: 70,
        },
      });

      const layoutNodes = layoutResult.nodes;
      const layoutEdges = layoutResult.edges;

      // 1. Lifelines sorted left-to-right by original X
      const clientNode = layoutNodes.find((n) => n.id === 'client');
      const authNode = layoutNodes.find((n) => n.id === 'auth');
      const dbNode = layoutNodes.find((n) => n.id === 'db');

      expect(clientNode.x).toBeLessThan(authNode.x);
      expect(authNode.x).toBeLessThan(dbNode.x);

      expect(clientNode.x).toBe(100);
      expect(authNode.x).toBe(350); // 100 + 250
      expect(dbNode.x).toBe(600); // 350 + 250

      // All lifelines aligned on Y = startY
      expect(clientNode.y).toBe(60);
      expect(authNode.y).toBe(60);
      expect(dbNode.y).toBe(60);

      // 2. Messages descend chronologically along Y (Y_0 < Y_1 < Y_2 < Y_3)
      const edgeYValues = layoutEdges.map((e) => e.points[1]);
      for (let i = 1; i < edgeYValues.length; i++) {
        expect(edgeYValues[i]).toBeGreaterThan(edgeYValues[i - 1]);
      }

      // 3. Message points are horizontal (start Y === end Y)
      layoutEdges.forEach((e) => {
        expect(e.points[1]).toBe(e.points[3]);
      });

      // 4. Lifelines extend uniformly to cover all messages
      const maxMsgY = Math.max(...edgeYValues);
      layoutNodes.forEach((node) => {
        const floorY = node.y + node.height + node.lineHeight;
        expect(floorY).toBeGreaterThan(maxMsgY);
      });
    });

    it('handles self-calls by creating a loop return path', () => {
      const nodes = [{ id: 'svc', name: 'Service', x: 200, y: 100 }];
      const edges = [
        { id: 'self-1', source: 'svc', target: 'svc', label: 'computeHash()' },
      ];

      const result = sequenceLayout({ nodes, edges });
      const edge = result.edges[0];
      expect(edge.isSelfMessage).toBe(true);
      expect(edge.points.length).toBe(8); // Loop with 4 vertices
    });
  });

  it('renders lifeline node, activation node, and message edge without crashing', () => {
    const commonProps = () => ({ id: 'test' });

    const lifelineShape = {
      id: 'll-1',
      subtype: 'lifeline',
      name: 'Client',
      role: 'Actor',
      x: 100,
      y: 100,
      width: 140,
      height: 50,
      lineHeight: 300,
    };
    const renderedLifeline = plugin.renderNode(lifelineShape, { commonProps });
    expect(renderedLifeline).toBeDefined();

    const activationShape = {
      id: 'act-1',
      subtype: 'activation',
      lifelineId: 'll-1',
      x: 163,
      y: 180,
      width: 14,
      height: 80,
    };
    const renderedActivation = plugin.renderNode(activationShape, { commonProps });
    expect(renderedActivation).toBeDefined();

    const messageShape = {
      id: 'msg-1',
      subtype: 'sync_message',
      points: [170, 200, 370, 200],
      label: 'login(creds)',
    };
    const renderedEdge = plugin.renderEdge(messageShape, { commonProps });
    expect(renderedEdge).toBeDefined();
  });
});
