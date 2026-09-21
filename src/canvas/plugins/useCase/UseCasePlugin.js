import React from 'react';
import DiagramTypePlugin from '../DiagramTypePlugin';
import { ActorNode, UseCaseOvalNode, SystemBoundaryNode, UseCaseEdge } from './UseCaseNodes';
import { useCaseLayout } from './useCaseLayout';

export class UseCasePlugin extends DiagramTypePlugin {
  constructor() {
    super({
      id: 'use-case',
      displayName: 'UML Use Case Diagram',
      description: 'System boundaries, human/system actors, and functional use cases with include/extend relationships.',
      defaultLayoutAlgorithm: 'use-case',
      nodeSubtypes: [
        {
          id: 'actor',
          label: 'Actor (Stick Figure)',
          defaultWidth: 80,
          defaultHeight: 110,
          schema: {
            name: { type: 'string', required: true },
            role: { type: 'string' },
          },
        },
        {
          id: 'use_case',
          label: 'Use Case (Oval)',
          defaultWidth: 160,
          defaultHeight: 70,
          schema: {
            name: { type: 'string', required: true },
            stereotype: { type: 'string' },
          },
        },
        {
          id: 'system_boundary',
          label: 'System Boundary',
          defaultWidth: 600,
          defaultHeight: 400,
          schema: {
            name: { type: 'string', required: true },
          },
        },
      ],
      edgeSubtypes: [
        { id: 'association', label: 'Association', style: 'solid' },
        { id: 'include', label: '«include»', style: 'dashed', markerEnd: 'arrow-open' },
        { id: 'extend', label: '«extend»', style: 'dashed', markerEnd: 'arrow-open' },
        { id: 'generalization', label: 'Generalization', style: 'solid', markerEnd: 'triangle-hollow' },
      ],
    });
  }

  getAnchorPoints(node) {
    const { x = 0, y = 0, width = 140, height = 70 } = node;
    return [
      { id: 'top', x: x + width / 2, y, position: 'top' },
      { id: 'bottom', x: x + width / 2, y: y + height, position: 'bottom' },
      { id: 'left', x, y: y + height / 2, position: 'left' },
      { id: 'right', x: x + width, y: y + height / 2, position: 'right' },
    ];
  }

  validateNode(node) {
    const errors = [];
    const subtype = node.subtype || node.type;

    if (subtype === 'actor' || subtype === 'usecase_actor') {
      if (!node.name && !node.label && !node.text) {
        errors.push('Actor node requires a name');
      }
    } else if (subtype === 'use_case' || subtype === 'usecase_oval') {
      if (!node.name && !node.label && !node.text) {
        errors.push('Use Case node requires a title');
      }
    } else if (subtype === 'system_boundary' || subtype === 'usecase_boundary') {
      if (!node.name && !node.title && !node.text) {
        errors.push('System Boundary requires a system name');
      }
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
      errors.push(`Edge source '${edge.source}' does not exist in diagram`);
    }
    if (!targetNode) {
      errors.push(`Edge target '${edge.target}' does not exist in diagram`);
    }

    if (sourceNode && targetNode) {
      const sType = sourceNode.subtype || sourceNode.type;
      const tType = targetNode.subtype || targetNode.type;
      const edgeSubtype = (edge.subtype || '').toLowerCase();

      // Include and Extend are strictly between Use Cases
      if (edgeSubtype === 'include' || edgeSubtype === 'extend') {
        const isSourceUC = sType === 'use_case' || sType === 'usecase_oval';
        const isTargetUC = tType === 'use_case' || tType === 'usecase_oval';
        if (!isSourceUC || !isTargetUC) {
          errors.push(`'«${edgeSubtype}»' relationships may only connect Use Case to Use Case`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  layout({ nodes, edges, options }) {
    return useCaseLayout({ nodes, edges, options });
  }

  renderNode(shape, { commonProps }) {
    const subtype = shape.subtype || shape.type;
    if (subtype === 'actor' || subtype === 'usecase_actor') {
      return React.createElement(ActorNode, { shape, commonProps });
    }
    if (subtype === 'system_boundary' || subtype === 'usecase_boundary') {
      return React.createElement(SystemBoundaryNode, { shape, commonProps });
    }
    return React.createElement(UseCaseOvalNode, { shape, commonProps });
  }

  renderEdge(shape, { commonProps }) {
    return React.createElement(UseCaseEdge, { shape, commonProps });
  }
}

export default UseCasePlugin;
