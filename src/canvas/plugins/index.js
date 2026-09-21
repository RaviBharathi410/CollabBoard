import FlowchartPlugin from './flowchart/FlowchartPlugin';
import UMLClassPlugin from './umlClass/UMLClassPlugin';
import SequencePlugin from './sequence/SequencePlugin';
import UseCasePlugin from './useCase/UseCasePlugin';
import ERDPlugin from './erd/ERDPlugin';

/**
 * Diagram Type Plugin Registry.
 * Allows CollabBoard to resolve diagram plugins dynamically.
 */
const pluginRegistry = new Map();

// Register default plugins
const defaultFlowchart = new FlowchartPlugin();
const defaultUML = new UMLClassPlugin();
const defaultSequence = new SequencePlugin();
const defaultUseCase = new UseCasePlugin();
const defaultERD = new ERDPlugin();

pluginRegistry.set(defaultFlowchart.id, defaultFlowchart);
pluginRegistry.set(defaultUML.id, defaultUML);
pluginRegistry.set(defaultSequence.id, defaultSequence);
pluginRegistry.set(defaultUseCase.id, defaultUseCase);
pluginRegistry.set(defaultERD.id, defaultERD);

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

export { FlowchartPlugin, UMLClassPlugin, SequencePlugin, UseCasePlugin, ERDPlugin };
