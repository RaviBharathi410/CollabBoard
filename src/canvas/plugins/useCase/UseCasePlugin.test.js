import { describe, it, expect } from 'vitest';
import UseCasePlugin from './UseCasePlugin';
import { useCaseLayout } from './useCaseLayout';

describe('UseCasePlugin & useCaseLayout', () => {
  const plugin = new UseCasePlugin();

  it('correctly initializes plugin metadata and subtypes', () => {
    expect(plugin.id).toBe('use-case');
    expect(plugin.displayName).toBe('UML Use Case Diagram');
    expect(plugin.defaultLayoutAlgorithm).toBe('use-case');

    const nodeIds = plugin.nodeSubtypes.map((n) => n.id);
    expect(nodeIds).toContain('actor');
    expect(nodeIds).toContain('use_case');
    expect(nodeIds).toContain('system_boundary');

    const edgeIds = plugin.edgeSubtypes.map((e) => e.id);
    expect(edgeIds).toContain('association');
    expect(edgeIds).toContain('include');
    expect(edgeIds).toContain('extend');
    expect(edgeIds).toContain('generalization');
  });

  it('computes cardinal anchor points for nodes', () => {
    const node = { id: 'uc-1', x: 200, y: 150, width: 160, height: 70 };
    const anchors = plugin.getAnchorPoints(node);

    expect(anchors.length).toBe(4);
    const top = anchors.find((a) => a.id === 'top');
    expect(top).toBeDefined();
    expect(top.x).toBe(280); // 200 + 160/2
    expect(top.y).toBe(150);
  });

  it('validates actors, use cases, and boundaries correctly', () => {
    // Valid nodes
    expect(plugin.validateNode({ id: 'a1', subtype: 'actor', name: 'Customer' }).valid).toBe(true);
    expect(plugin.validateNode({ id: 'uc1', subtype: 'use_case', name: 'Checkout' }).valid).toBe(true);
    expect(plugin.validateNode({ id: 'b1', subtype: 'system_boundary', name: 'Store System' }).valid).toBe(true);

    // Invalid actor without name
    const invalidActor = plugin.validateNode({ id: 'a2', subtype: 'actor' });
    expect(invalidActor.valid).toBe(false);
    expect(invalidActor.errors[0]).toContain('Actor node requires a name');

    // Invalid use case without title
    const invalidUc = plugin.validateNode({ id: 'uc2', subtype: 'use_case' });
    expect(invalidUc.valid).toBe(false);
    expect(invalidUc.errors[0]).toContain('Use Case node requires a title');
  });

  it('validates edges and enforces UML rules for include and extend', () => {
    const nodes = [
      { id: 'actor-cust', subtype: 'actor', name: 'Customer' },
      { id: 'uc-login', subtype: 'use_case', name: 'Login' },
      { id: 'uc-auth', subtype: 'use_case', name: 'Verify 2FA' },
    ];

    // Valid include between two use cases
    const validInclude = { id: 'e1', source: 'uc-login', target: 'uc-auth', subtype: 'include' };
    expect(plugin.validateEdge(validInclude, nodes).valid).toBe(true);

    // Invalid include from actor to use case
    const invalidInclude = { id: 'e2', source: 'actor-cust', target: 'uc-login', subtype: 'include' };
    const incResult = plugin.validateEdge(invalidInclude, nodes);
    expect(incResult.valid).toBe(false);
    expect(incResult.errors[0]).toContain('may only connect Use Case to Use Case');

    // Missing target node
    const missingTarget = { id: 'e3', source: 'uc-login', target: 'unknown' };
    const missingResult = plugin.validateEdge(missingTarget, nodes);
    expect(missingResult.valid).toBe(false);
    expect(missingResult.errors[0]).toContain("target 'unknown' does not exist");
  });

  describe('useCaseLayout Engine', () => {
    it('positions actors on the left and nests use cases inside system boundary', () => {
      const nodes = [
        { id: 'actor-user', subtype: 'actor', name: 'Architect' },
        { id: 'uc-draw', subtype: 'use_case', name: 'Draw Diagram' },
        { id: 'uc-export', subtype: 'use_case', name: 'Export SVG' },
      ];

      const edges = [
        { id: 'e-1', source: 'actor-user', target: 'uc-draw', subtype: 'association' },
        { id: 'e-2', source: 'uc-draw', target: 'uc-export', subtype: 'include' },
      ];

      const result = useCaseLayout({
        nodes,
        edges,
        options: {
          startX: 80,
          startY: 60,
          boundaryX: 280,
          boundaryWidth: 500,
        },
      });

      const layoutNodes = result.nodes;
      const actor = layoutNodes.find((n) => n.id === 'actor-user');
      const boundary = layoutNodes.find((n) => n.subtype === 'system_boundary');
      const ucDraw = layoutNodes.find((n) => n.id === 'uc-draw');
      const ucExport = layoutNodes.find((n) => n.id === 'uc-export');

      // 1. Actor is placed on the left
      expect(actor.x).toBe(80);

      // 2. System boundary is created and positioned
      expect(boundary).toBeDefined();
      expect(boundary.x).toBe(280);

      // 3. Use cases are contained horizontally within boundary
      expect(ucDraw.x).toBeGreaterThan(boundary.x);
      expect(ucDraw.x + ucDraw.width).toBeLessThan(boundary.x + boundary.width);

      expect(ucExport.x).toBeGreaterThan(boundary.x);
      expect(ucExport.x + ucExport.width).toBeLessThan(boundary.x + boundary.width);

      // 4. Edges are updated with connector points
      const updatedEdge = result.edges.find((e) => e.id === 'e-1');
      expect(updatedEdge.points.length).toBe(4);
      expect(typeof updatedEdge.points[0]).toBe('number');
    });
  });

  it('renders actor stick figure, use case oval, and boundary without crashing', () => {
    const commonProps = () => ({ id: 'test' });

    const actorShape = { id: 'act-1', subtype: 'actor', name: 'Client' };
    const renderedActor = plugin.renderNode(actorShape, { commonProps });
    expect(renderedActor).toBeDefined();

    const ucShape = { id: 'uc-1', subtype: 'use_case', name: 'Process Order' };
    const renderedUc = plugin.renderNode(ucShape, { commonProps });
    expect(renderedUc).toBeDefined();

    const boundaryShape = { id: 'b-1', subtype: 'system_boundary', name: 'Order Processing' };
    const renderedBoundary = plugin.renderNode(boundaryShape, { commonProps });
    expect(renderedBoundary).toBeDefined();

    const edgeShape = { id: 'ed-1', subtype: 'include', points: [100, 100, 250, 100], label: '«include»' };
    const renderedEdge = plugin.renderEdge(edgeShape, { commonProps });
    expect(renderedEdge).toBeDefined();
  });
});
