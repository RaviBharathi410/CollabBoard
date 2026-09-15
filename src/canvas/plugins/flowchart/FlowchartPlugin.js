import React from 'react';
import DiagramTypePlugin from '../DiagramTypePlugin';
import FlowchartNodeTemplate from './FlowchartTemplates';

export class FlowchartPlugin extends DiagramTypePlugin {
  constructor() {
    super({
      id: 'flowchart',
      displayName: 'Flowchart',
      description: 'Standard system workflows, decision trees, and sequential process flows.',
      defaultLayoutAlgorithm: 'layered',
      nodeSubtypes: [
        { id: 'process', label: 'Process', defaultWidth: 140, defaultHeight: 60 },
        { id: 'decision', label: 'Decision', defaultWidth: 120, defaultHeight: 80 },
        { id: 'terminal', label: 'Start / End', defaultWidth: 130, defaultHeight: 50 },
        { id: 'io', label: 'Input / Output', defaultWidth: 130, defaultHeight: 55 },
        { id: 'database', label: 'Database', defaultWidth: 100, defaultHeight: 70 },
      ],
      edgeSubtypes: [
        { id: 'flow', label: 'Flow', style: 'solid', markerEnd: 'arrow' },
        { id: 'conditional', label: 'Conditional Flow', style: 'solid', markerEnd: 'arrow' },
      ],
    });
  }

  getAnchorPoints(node) {
    const { x = 0, y = 0, width = 140, height = 60, subtype } = node;

    if (subtype === 'decision') {
      // Diamond vertices: top, right, bottom, left
      return [
        { id: 'top', x: x + width / 2, y, position: 'top' },
        { id: 'right', x: x + width, y: y + height / 2, position: 'right' },
        { id: 'bottom', x: x + width / 2, y: y + height, position: 'bottom' },
        { id: 'left', x, y: y + height / 2, position: 'left' },
      ];
    }

    // Default 4 edge centers
    return [
      { id: 'top', x: x + width / 2, y, position: 'top' },
      { id: 'bottom', x: x + width / 2, y: y + height, position: 'bottom' },
      { id: 'left', x, y: y + height / 2, position: 'left' },
      { id: 'right', x: x + width, y: y + height / 2, position: 'right' },
    ];
  }

  renderNode(shape, { commonProps }) {
    return React.createElement(FlowchartNodeTemplate, { shape, commonProps });
  }
}

export default FlowchartPlugin;
