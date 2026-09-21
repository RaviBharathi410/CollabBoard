import React from 'react';
import DiagramTypePlugin from '../DiagramTypePlugin';
import { ERDTableNode, ERDRelationshipEdge } from './ERDNodes';

export class ERDPlugin extends DiagramTypePlugin {
  constructor() {
    super({
      id: 'erd',
      displayName: 'Entity-Relationship Diagram (ERD)',
      description: 'Relational database schemas, tables, primary/foreign key attributes, and cardinality relationships.',
      defaultLayoutAlgorithm: 'erd',
      nodeSubtypes: [
        {
          id: 'table',
          label: 'Entity / Table',
          defaultWidth: 220,
          defaultHeight: 160,
          schema: {
            name: { type: 'string', required: true },
            columns: { type: 'array' },
          },
        },
      ],
      edgeSubtypes: [
        { id: 'one_to_many', label: 'One-to-Many (1 : N)', style: 'solid', markerEnd: 'crows-foot' },
        { id: 'one_to_one', label: 'One-to-One (1 : 1)', style: 'solid', markerEnd: 'one-bar' },
        { id: 'many_to_many', label: 'Many-to-Many (N : M)', style: 'solid', markerEnd: 'crows-foot', markerStart: 'crows-foot' },
      ],
    });
  }

  getAnchorPoints(node) {
    const { x = 0, y = 0, width = 220, height = 160 } = node;
    return [
      { id: 'top', x: x + width / 2, y, position: 'top' },
      { id: 'bottom', x: x + width / 2, y: y + height, position: 'bottom' },
      { id: 'left', x, y: y + height / 2, position: 'left' },
      { id: 'right', x: x + width, y: y + height / 2, position: 'right' },
    ];
  }

  validateNode(node) {
    const errors = [];
    if (!node.name && !node.title && !node.text) {
      errors.push('ERD Entity requires a table name');
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  validateEdge(edge, nodes = []) {
    const errors = [];
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode) {
      errors.push(`ERD edge source '${edge.source}' does not exist in diagram`);
    }
    if (!targetNode) {
      errors.push(`ERD edge target '${edge.target}' does not exist in diagram`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  renderNode(shape, { commonProps }) {
    return React.createElement(ERDTableNode, { shape, commonProps });
  }

  renderEdge(shape, { commonProps }) {
    return React.createElement(ERDRelationshipEdge, { shape, commonProps });
  }
}

export default ERDPlugin;
