import React from 'react';
import DiagramTypePlugin from '../DiagramTypePlugin';
import { SequenceLifelineNode, SequenceActivationNode, SequenceMessageEdge } from './SequenceNodes';
import { sequenceLayout } from './sequenceLayout';

export class SequencePlugin extends DiagramTypePlugin {
  constructor() {
    super({
      id: 'sequence',
      displayName: 'UML Sequence Diagram',
      description: 'Chronological interactions, message exchanges, lifelines, and activation bars.',
      defaultLayoutAlgorithm: 'sequence',
      nodeSubtypes: [
        {
          id: 'lifeline',
          label: 'Lifeline / Participant',
          defaultWidth: 140,
          defaultHeight: 50,
          schema: {
            name: { type: 'string', required: true },
            role: { type: 'string' },
            lineHeight: { type: 'number' },
          },
        },
        {
          id: 'activation',
          label: 'Activation Bar',
          defaultWidth: 14,
          defaultHeight: 80,
          schema: {
            lifelineId: { type: 'string', required: true },
          },
        },
      ],
      edgeSubtypes: [
        { id: 'sync_message', label: 'Synchronous Call', style: 'solid', markerEnd: 'triangle-filled' },
        { id: 'async_message', label: 'Asynchronous Message', style: 'solid', markerEnd: 'arrow-open' },
        { id: 'return_message', label: 'Reply / Return', style: 'dashed', markerEnd: 'arrow-open' },
        { id: 'create_message', label: 'Create Participant', style: 'dashed', markerEnd: 'arrow-open' },
      ],
    });
  }

  /**
   * Snapping anchor points for lifelines:
   * Header anchors + anchors along the dashed vertical centerline
   */
  getAnchorPoints(node) {
    const { x = 0, y = 0, width = 140, height = 50, lineHeight = 400 } = node;
    const cx = x + width / 2;

    const anchors = [
      { id: 'top', x: cx, y, position: 'top' },
      { id: 'header-bottom', x: cx, y: y + height, position: 'bottom' },
      { id: 'left', x, y: y + height / 2, position: 'left' },
      { id: 'right', x: x + width, y: y + height / 2, position: 'right' },
    ];

    // Centerline anchors along the vertical timeline (every 50px)
    const totalLine = Math.min(1000, Math.max(150, lineHeight));
    const step = 50;
    for (let offset = step; offset <= totalLine; offset += step) {
      anchors.push({
        id: `center-${offset}`,
        x: cx,
        y: y + height + offset,
        position: 'custom',
      });
    }

    return anchors;
  }

  validateNode(node) {
    const errors = [];
    if (node.subtype === 'activation' || node.type === 'sequence_activation') {
      if (!node.lifelineId && !node.parent) {
        errors.push('Activation bar must be attached to a parent lifeline (lifelineId required)');
      }
    } else {
      if (!node.name && !node.label && !node.text) {
        errors.push('Sequence Lifeline requires a participant name');
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
      errors.push(`Message source '${edge.source}' does not exist in diagram`);
    }
    if (!targetNode) {
      errors.push(`Message target '${edge.target}' does not exist in diagram`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Deterministic layout engine for Sequence diagrams
   */
  layout({ nodes, edges, options }) {
    return sequenceLayout({ nodes, edges, options });
  }

  renderNode(shape, { commonProps }) {
    const isActivation =
      shape.subtype === 'activation' ||
      shape.type === 'sequence_activation';

    if (isActivation) {
      return React.createElement(SequenceActivationNode, { shape, commonProps });
    }
    return React.createElement(SequenceLifelineNode, { shape, commonProps });
  }

  renderEdge(shape, { commonProps }) {
    return React.createElement(SequenceMessageEdge, { shape, commonProps });
  }
}

export default SequencePlugin;
