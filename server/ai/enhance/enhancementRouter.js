import flowchartEnhance from './plugins/flowchartEnhance.js';
import umlClassEnhance from './plugins/umlClassEnhance.js';

const enhancementPlugins = new Map();
enhancementPlugins.set(flowchartEnhance.id, flowchartEnhance);
enhancementPlugins.set(umlClassEnhance.id, umlClassEnhance);

const createGatedPlugin = (id, displayName) => ({
  id,
  enhance: async () => ({
    status: 'unsupported',
    type: id,
    message: `AI enhancement for ${displayName} is gated to preserve domain-specific notation. Canvas and direct editing are fully supported.`,
  }),
});

enhancementPlugins.set('sequence', createGatedPlugin('sequence', 'UML Sequence Diagrams'));
enhancementPlugins.set('use-case', createGatedPlugin('use-case', 'UML Use Case Diagrams'));
enhancementPlugins.set('erd', createGatedPlugin('erd', 'Entity-Relationship Diagrams'));

/**
 * Retrieves the AI enhancement plugin for a specific diagram type.
 * @param {string} diagramType
 * @returns {Object|null}
 */
export function getEnhancementPlugin(diagramType) {
  if (!diagramType) return flowchartEnhance;
  return enhancementPlugins.get(diagramType) || null;
}

/**
 * Main AI enhancement dispatcher.
 * @param {Object} diagram - Current diagram state
 * @param {string} userPrompt - User prompt / modification request
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function enhanceDiagram(diagram, userPrompt, options = {}) {
  const type = diagram?.type || options.diagramType || 'flowchart';
  const plugin = getEnhancementPlugin(type);

  if (!plugin) {
    return {
      status: 'unsupported',
      message: `AI enhancement is not currently supported for diagram type "${type}".`,
    };
  }

  return plugin.enhance(diagram, userPrompt, options);
}

export default {
  enhanceDiagram,
  getEnhancementPlugin,
};
