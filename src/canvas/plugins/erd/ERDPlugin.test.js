import { describe, it, expect } from 'vitest';
import ERDPlugin from './ERDPlugin';
import { normalizeColumns } from './ERDNodes';

describe('ERDPlugin & ERDNodes', () => {
  const plugin = new ERDPlugin();

  it('correctly initializes ERD metadata and subtypes', () => {
    expect(plugin.id).toBe('erd');
    expect(plugin.displayName).toBe('Entity-Relationship Diagram (ERD)');
    expect(plugin.defaultLayoutAlgorithm).toBe('erd');

    const nodeIds = plugin.nodeSubtypes.map((n) => n.id);
    expect(nodeIds).toContain('table');

    const edgeIds = plugin.edgeSubtypes.map((e) => e.id);
    expect(edgeIds).toContain('one_to_many');
    expect(edgeIds).toContain('one_to_one');
    expect(edgeIds).toContain('many_to_many');
  });

  it('computes cardinal anchor points on table perimeter', () => {
    const table = { id: 't1', x: 100, y: 100, width: 220, height: 160 };
    const anchors = plugin.getAnchorPoints(table);

    expect(anchors.length).toBe(4);
    const top = anchors.find((a) => a.id === 'top');
    expect(top).toBeDefined();
    expect(top.x).toBe(210); // 100 + 220/2
    expect(top.y).toBe(100);
  });

  it('validates ERD table nodes and relationship edges', () => {
    // Valid node
    expect(plugin.validateNode({ id: 't1', name: 'users' }).valid).toBe(true);

    // Invalid node without name
    const invalidNode = plugin.validateNode({ id: 't1' });
    expect(invalidNode.valid).toBe(false);
    expect(invalidNode.errors[0]).toContain('requires a table name');

    // Valid edge
    const nodes = [{ id: 'users' }, { id: 'orders' }];
    expect(plugin.validateEdge({ id: 'e1', source: 'users', target: 'orders' }, nodes).valid).toBe(true);

    // Invalid edge
    const invalidEdge = plugin.validateEdge({ id: 'e2', source: 'users', target: 'products' }, nodes);
    expect(invalidEdge.valid).toBe(false);
    expect(invalidEdge.errors[0]).toContain("target 'products' does not exist");
  });

  it('normalizes string and object column definitions with PK/FK tags', () => {
    const rawCols = [
      'id : uuid [PK]',
      'user_id : uuid [FK]',
      'email : varchar(255) [UQ]',
      { name: 'amount', type: 'decimal', isPk: false },
    ];

    const normalized = normalizeColumns(rawCols);
    expect(normalized.length).toBe(4);

    expect(normalized[0]).toEqual({
      name: 'id',
      type: 'uuid',
      isPk: true,
      isFk: false,
      isUnique: false,
    });

    expect(normalized[1].isFk).toBe(true);
    expect(normalized[1].name).toBe('user_id');

    expect(normalized[2].isUnique).toBe(true);

    expect(normalized[3].name).toBe('amount');
    expect(normalized[3].type).toBe('decimal');
  });

  it('renders ERD table node and relationship edge without crashing', () => {
    const commonProps = () => ({ id: 'test' });

    const tableShape = {
      id: 'table-users',
      subtype: 'table',
      name: 'users',
      x: 100,
      y: 100,
      width: 220,
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'varchar(255)', unique: true },
      ],
    };
    const renderedTable = plugin.renderNode(tableShape, { commonProps });
    expect(renderedTable).toBeDefined();

    const edgeShape = {
      id: 'rel-users-orders',
      subtype: 'one_to_many',
      points: [100, 100, 300, 100],
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      label: 'places',
    };
    const renderedEdge = plugin.renderEdge(edgeShape, { commonProps });
    expect(renderedEdge).toBeDefined();
  });
});
