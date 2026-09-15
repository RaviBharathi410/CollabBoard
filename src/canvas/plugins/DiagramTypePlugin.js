/**
 * DiagramTypePlugin Base Contract.
 * Every supported diagram type (Flowchart, UML Class, ERD, Sequence, State Machine)
 * implements this contract to define its node shapes, relationship styles,
 * anchor point snapping, and validation rules.
 */
export class DiagramTypePlugin {
  /**
   * @param {Object} config
   * @param {string} config.id - Unique identifier ('flowchart', 'uml-class', etc.)
   * @param {string} config.displayName - Human-readable name
   * @param {string} [config.description] - Description of diagram domain
   * @param {Array<{id: string, label: string, defaultWidth?: number, defaultHeight?: number, schema?: Object}>} config.nodeSubtypes
   * @param {Array<{id: string, label: string, style?: string, markerStart?: string, markerEnd?: string}>} config.edgeSubtypes
   * @param {'layered'|'force'|'mrtree'} [config.defaultLayoutAlgorithm='layered']
   * @param {Object} [config.snapping]
   */
  constructor({
    id,
    displayName,
    description = '',
    nodeSubtypes = [],
    edgeSubtypes = [],
    defaultLayoutAlgorithm = 'layered',
    snapping = {},
  }) {
    if (!id || !displayName) {
      throw new Error('DiagramTypePlugin requires id and displayName');
    }
    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.nodeSubtypes = nodeSubtypes;
    this.edgeSubtypes = edgeSubtypes;
    this.defaultLayoutAlgorithm = defaultLayoutAlgorithm;
    this.snapping = snapping;
  }

  /**
   * Computes snapping anchor points for a given node.
   * Plugins can override this to provide custom anchors (e.g. compartment boundaries).
   * @param {Object} node
   * @returns {Array<{id: string, x: number, y: number, position: 'top'|'bottom'|'left'|'right'|'custom'}>}
   */
  getAnchorPoints(node) {
    const { x = 0, y = 0, width = 120, height = 60 } = node;
    return [
      { id: 'top', x: x + width / 2, y, position: 'top' },
      { id: 'bottom', x: x + width / 2, y: y + height, position: 'bottom' },
      { id: 'left', x, y: y + height / 2, position: 'left' },
      { id: 'right', x: x + width, y: y + height / 2, position: 'right' },
    ];
  }

  /**
   * Validates a node's structure against plugin schema.
   * @param {Object} node
   * @returns {{ valid: boolean, errors?: string[] }}
   */
  validateNode(node) {
    return { valid: true };
  }

  /**
   * Validates whether an edge connects compatible node subtypes.
   * @param {Object} edge
   * @param {Array<Object>} nodes
   * @returns {{ valid: boolean, errors?: string[] }}
   */
  validateEdge(edge, nodes = []) {
    return { valid: true };
  }

  /**
   * Optional custom Konva renderer for nodes belonging to this plugin.
   * Returns null if standard primitive rendering should be used.
   * @param {Object} shape
   * @param {Object} props
   * @returns {React.ReactElement|null}
   */
  renderNode(shape, props) {
    return null;
  }

  /**
   * Optional custom Konva renderer for connectors/edges belonging to this plugin.
   * Returns null if standard arrow rendering should be used.
   * @param {Object} shape
   * @param {Object} props
   * @returns {React.ReactElement|null}
   */
  renderEdge(shape, props) {
    return null;
  }
}

export default DiagramTypePlugin;
