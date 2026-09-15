import FlowchartPlugin from './flowchart/FlowchartPlugin';
import UMLClassPlugin from './umlClass/UMLClassPlugin';

/**
 * Diagram Type Plugin Registry.
 * Allows CollabBoard to resolve diagram plugins dynamically.
 */
const pluginRegistry = new Map();

// Register default MVP plugins
const defaultFlowchart = new FlowchartPlugin();
const defaultUML = new UMLClassPlugin();

pluginRegistry.set(defaultFlowchart.id, defaultFlowchart);
pluginRegistry.set(defaultUML.id, defaultUML);

/**
 * Registers a new diagram type plugin.
 * @param {import('./DiagramTypePlugin').DiagramTypePlugin} plugin
 */
export function registerPlugin(plugin) {
  if (!plugin || !plugin.id) {
    throw new Error('Cannot register plugin without valid id');
  }
  pluginRegistry.set(plugin.id, plugin);
}

/**
 * Resolves a plugin by its ID.
 * @param {string} pluginId
 * @returns {import('./DiagramTypePlugin').DiagramTypePlugin|null}
 */
export function getDiagramPlugin(pluginId) {
  if (!pluginId) return null;
  return pluginRegistry.get(pluginId) || null;
}

/**
 * Returns all currently registered diagram plugins.
 * @returns {Array<import('./DiagramTypePlugin').DiagramTypePlugin>}
 */
export function getAllPlugins() {
  return Array.from(pluginRegistry.values());
}

/**
 * Returns the default plugin (Flowchart).
 * @returns {import('./DiagramTypePlugin').DiagramTypePlugin}
 */
export function getDefaultPlugin() {
  return defaultFlowchart;
}

export { FlowchartPlugin, UMLClassPlugin };
