const LAYOUT_BY_TYPE = {
  architecture: [
    {
      name: 'Hierarchical',
      layoutAlgorithm: 'layered',
      direction: 'DOWN',
      description: 'Top-down flow, best for architectures',
    },
    {
      name: 'Compact Grid',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Left-to-right, best for process flows',
    },
    {
      name: 'Radial',
      layoutAlgorithm: 'force',
      direction: null,
      description: 'Centered hub-and-spoke, best for mind maps',
    },
  ],
  flowchart: [
    {
      name: 'Hierarchical',
      layoutAlgorithm: 'layered',
      direction: 'DOWN',
      description: 'Top-down flow, best for flowcharts',
    },
    {
      name: 'Compact Grid',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Left-to-right process flow',
    },
    {
      name: 'Radial',
      layoutAlgorithm: 'force',
      direction: null,
      description: 'Alternative radial layout',
    },
  ],
  erd: [
    {
      name: 'Entity Flow',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Left-to-right entity relationships',
    },
    {
      name: 'Hierarchical',
      layoutAlgorithm: 'layered',
      direction: 'DOWN',
      description: 'Top-down schema view',
    },
    {
      name: 'Compact Grid',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Dense ERD layout',
    },
  ],
  sequence: [
    {
      name: 'Timeline',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Horizontal sequence timeline',
    },
    {
      name: 'Hierarchical',
      layoutAlgorithm: 'layered',
      direction: 'DOWN',
      description: 'Vertical sequence layout',
    },
    {
      name: 'Compact Grid',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Compact message flow',
    },
  ],
  mindmap: [
    {
      name: 'Radial',
      layoutAlgorithm: 'force',
      direction: null,
      description: 'Centered hub-and-spoke, best for mind maps',
    },
    {
      name: 'Tree',
      layoutAlgorithm: 'mrtree',
      direction: 'RIGHT',
      description: 'Tree expansion from root',
    },
    {
      name: 'Hierarchical',
      layoutAlgorithm: 'layered',
      direction: 'DOWN',
      description: 'Top-down mind map',
    },
  ],
  unknown: [
    {
      name: 'Hierarchical',
      layoutAlgorithm: 'layered',
      direction: 'DOWN',
      description: 'Default top-down layout',
    },
    {
      name: 'Radial',
      layoutAlgorithm: 'force',
      direction: null,
      description: 'Force-directed layout',
    },
    {
      name: 'Compact Grid',
      layoutAlgorithm: 'layered',
      direction: 'RIGHT',
      description: 'Left-to-right layout',
    },
  ],
};

export function getLayoutVariations(diagram, currentLayout = 'layered') {
  const type = diagram?.type || 'unknown';
  const variations = LAYOUT_BY_TYPE[type] || LAYOUT_BY_TYPE.unknown;
  return { variations, currentLayout };
}
