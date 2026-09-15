import React from 'react';
import DiagramTypePlugin from '../DiagramTypePlugin';
import UMLClassNode from './UMLClassNode';
import UMLConnector from './UMLConnector';

export class UMLClassPlugin extends DiagramTypePlugin {
  constructor() {
    super({
      id: 'uml-class',
      displayName: 'UML Class Diagram',
      description: 'Object-oriented software architectures, classes, interfaces, and relationships.',
      defaultLayoutAlgorithm: 'layered',
      nodeSubtypes: [
        {
          id: 'class',
          label: 'Class',
          defaultWidth: 160,
          defaultHeight: 120,
          schema: {
            name: { type: 'string', required: true },
            fields: { type: 'array' },
            methods: { type: 'array' },
          },
        },
        {
          id: 'interface',
          label: 'Interface',
          defaultWidth: 160,
          defaultHeight: 110,
          schema: {
            name: { type: 'string', required: true },
            methods: { type: 'array' },
          },
        },
      ],
      edgeSubtypes: [
        { id: 'inheritance', label: 'Inheritance / Generalization', markerEnd: 'triangle-hollow' },
        { id: 'composition', label: 'Composition', markerStart: 'diamond-filled' },
        { id: 'aggregation', label: 'Aggregation', markerStart: 'diamond-hollow' },
        { id: 'association', label: 'Association', style: 'solid' },
        { id: 'dependency', label: 'Dependency', style: 'dashed', markerEnd: 'arrow-open' },
      ],
    });
  }

  getAnchorPoints(node) {
    const { x = 0, y = 0, width = 160, height = 120 } = node;

    // Approximate compartment dividers for snapping
    const div1Y = y + Math.round(height * 0.28);
    const div2Y = y + Math.round(height * 0.62);

    return [
      // 4 primary perimeter anchors
      { id: 'top', x: x + width / 2, y, position: 'top' },
      { id: 'bottom', x: x + width / 2, y: y + height, position: 'bottom' },
      { id: 'left', x, y: y + height / 2, position: 'left' },
      { id: 'right', x: x + width, y: y + height / 2, position: 'right' },

      // Compartment boundary snapping anchors
      { id: 'left-div1', x, y: div1Y, position: 'left' },
      { id: 'right-div1', x: x + width, y: div1Y, position: 'right' },
      { id: 'left-div2', x, y: div2Y, position: 'left' },
      { id: 'right-div2', x: x + width, y: div2Y, position: 'right' },
    ];
  }

  validateNode(node) {
    const errors = [];
    if (!node.name && !node.label && !node.text) {
      errors.push('UML Class requires a class name');
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

    if (edge.subtype === 'inheritance' && sourceNode && targetNode) {
      const allowed = ['class', 'interface'];
      if (!allowed.includes(sourceNode.subtype || 'class') || !allowed.includes(targetNode.subtype || 'class')) {
        errors.push('Inheritance edges may only connect Class or Interface nodes');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  renderNode(shape, { commonProps }) {
    return React.createElement(UMLClassNode, { shape, commonProps });
  }

  renderEdge(shape, { commonProps }) {
    return React.createElement(UMLConnector, { shape, commonProps });
  }
}

export default UMLClassPlugin;
