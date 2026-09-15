import { describe, it, expect } from 'vitest';
import { DiagramTypePlugin } from '../DiagramTypePlugin';
import { FlowchartPlugin } from '../flowchart/FlowchartPlugin';
import { UMLClassPlugin } from '../umlClass/UMLClassPlugin';
import { parseUmlClassContent } from '../umlClass/UMLClassNode';
import {
  getDiagramPlugin,
  getAllPlugins,
  getDefaultPlugin,
  registerPlugin,
} from '../index';

describe('DiagramTypePlugin & Registry', () => {
  it('throws when instantiated without id or displayName', () => {
    expect(() => new DiagramTypePlugin({})).toThrow('DiagramTypePlugin requires id and displayName');
  });

  it('resolves default plugins from registry', () => {
    const flowchart = getDiagramPlugin('flowchart');
    expect(flowchart).toBeInstanceOf(FlowchartPlugin);
    expect(flowchart.id).toBe('flowchart');

    const uml = getDiagramPlugin('uml-class');
    expect(uml).toBeInstanceOf(UMLClassPlugin);
    expect(uml.id).toBe('uml-class');

    expect(getDefaultPlugin()).toBe(flowchart);
    expect(getAllPlugins().length).toBeGreaterThanOrEqual(2);
  });

  it('allows registering a custom plugin', () => {
    class CustomPlugin extends DiagramTypePlugin {
      constructor() {
        super({ id: 'test-custom', displayName: 'Custom Diagram' });
      }
    }
    registerPlugin(new CustomPlugin());
    expect(getDiagramPlugin('test-custom')).toBeDefined();
    expect(getDiagramPlugin('test-custom').displayName).toBe('Custom Diagram');
  });
});

describe('FlowchartPlugin', () => {
  const plugin = new FlowchartPlugin();

  it('declares standard flowchart node and edge subtypes', () => {
    const nodeIds = plugin.nodeSubtypes.map((n) => n.id);
    expect(nodeIds).toContain('process');
    expect(nodeIds).toContain('decision');
    expect(nodeIds).toContain('terminal');
    expect(nodeIds).toContain('io');

    const edgeIds = plugin.edgeSubtypes.map((e) => e.id);
    expect(edgeIds).toContain('flow');
    expect(edgeIds).toContain('conditional');
  });

  it('calculates anchor points for process and decision nodes', () => {
    const processNode = { x: 100, y: 100, width: 140, height: 60, subtype: 'process' };
    const pAnchors = plugin.getAnchorPoints(processNode);
    expect(pAnchors).toHaveLength(4);
    expect(pAnchors.find((a) => a.id === 'top').y).toBe(100);
    expect(pAnchors.find((a) => a.id === 'bottom').y).toBe(160);

    const decisionNode = { x: 100, y: 100, width: 120, height: 80, subtype: 'decision' };
    const dAnchors = plugin.getAnchorPoints(decisionNode);
    expect(dAnchors).toHaveLength(4);
    expect(dAnchors.find((a) => a.id === 'right').x).toBe(220);
  });
});

describe('UMLClassPlugin', () => {
  const plugin = new UMLClassPlugin();

  it('declares 3-compartment class and interface nodes and 5 relationship edges', () => {
    const nodeIds = plugin.nodeSubtypes.map((n) => n.id);
    expect(nodeIds).toContain('class');
    expect(nodeIds).toContain('interface');

    const edgeIds = plugin.edgeSubtypes.map((e) => e.id);
    expect(edgeIds).toContain('inheritance');
    expect(edgeIds).toContain('composition');
    expect(edgeIds).toContain('aggregation');
    expect(edgeIds).toContain('association');
    expect(edgeIds).toContain('dependency');
  });

  it('provides compartment boundary snapping anchors (8 total)', () => {
    const classNode = { x: 50, y: 50, width: 200, height: 150 };
    const anchors = plugin.getAnchorPoints(classNode);
    expect(anchors).toHaveLength(8);

    const anchorIds = anchors.map((a) => a.id);
    expect(anchorIds).toContain('top');
    expect(anchorIds).toContain('bottom');
    expect(anchorIds).toContain('left');
    expect(anchorIds).toContain('right');
    expect(anchorIds).toContain('left-div1');
    expect(anchorIds).toContain('right-div1');
    expect(anchorIds).toContain('left-div2');
    expect(anchorIds).toContain('right-div2');
  });

  it('validates node requirements and edge relationship constraints', () => {
    // Valid node
    expect(plugin.validateNode({ name: 'OrderService' }).valid).toBe(true);
    // Invalid node without any name or label
    expect(plugin.validateNode({}).valid).toBe(false);

    // Valid inheritance between two classes
    const nodes = [
      { id: 'c1', subtype: 'class' },
      { id: 'c2', subtype: 'class' },
      { id: 'a1', subtype: 'actor' },
    ];
    expect(plugin.validateEdge({ source: 'c1', target: 'c2', subtype: 'inheritance' }, nodes).valid).toBe(true);

    // Invalid inheritance connected to an actor
    const invalidEdge = plugin.validateEdge({ source: 'c1', target: 'a1', subtype: 'inheritance' }, nodes);
    expect(invalidEdge.valid).toBe(false);
    expect(invalidEdge.errors[0]).toContain('Inheritance edges may only connect Class or Interface');
  });

  it('parses multiline OCR strings into 3 UML compartments cleanly', () => {
    const rawLabel = `<<entity>>\nWindow\n- radius : float\n- center : unsigned int\n+ draw()\n+ resize()`;
    const parsed = parseUmlClassContent({ label: rawLabel });

    expect(parsed.stereotype).toBe('<<entity>>');
    expect(parsed.name).toBe('Window');
    expect(parsed.attributes).toEqual(['- radius : float', '- center : unsigned int']);
    expect(parsed.methods).toEqual(['+ draw()', '+ resize()']);
  });
});
