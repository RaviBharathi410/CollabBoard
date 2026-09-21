/**
 * templateRegistry.test.js
 * Unit tests for blueprint template registry definitions and lookups.
 */

import { describe, it, expect } from 'vitest';
import { TEMPLATES, getTemplateById, getTemplateByTitle } from './templateRegistry';

describe('templateRegistry', () => {
  it('defines the 4 required blueprint templates', () => {
    expect(TEMPLATES).toHaveLength(4);
    const ids = TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      'system-architecture',
      'user-flow-sequence',
      'er-diagram',
      'mindmap',
    ]);
  });

  it('maps each template to the correct diagram domain type', () => {
    const sys = getTemplateById('system-architecture');
    const seq = getTemplateById('user-flow-sequence');
    const erd = getTemplateById('er-diagram');
    const mm = getTemplateById('mindmap');

    expect(sys.diagramType).toBe('flowchart');
    expect(seq.diagramType).toBe('sequence');
    expect(erd.diagramType).toBe('erd');
    expect(mm.diagramType).toBe('mindmap');
  });

  it('provides pre-populated starter shapes for every blueprint', () => {
    for (const tpl of TEMPLATES) {
      expect(Array.isArray(tpl.starterShapes)).toBe(true);
      expect(tpl.starterShapes.length).toBeGreaterThan(0);

      // Verify every starter shape has a valid id and type
      for (const shape of tpl.starterShapes) {
        expect(shape.id).toBeDefined();
        expect(shape.type).toBeDefined();
        const isEdge =
          shape.type === 'pencil' ||
          shape.type === 'arrow' ||
          shape.type === 'connector' ||
          shape.type === 'sequence_message' ||
          shape.type === 'erd_edge';

        if (!isEdge) {
          expect(typeof shape.x).toBe('number');
          expect(typeof shape.y).toBe('number');
        } else {
          expect(Array.isArray(shape.points)).toBe(true);
        }
      }
    }
  });

  it('looks up templates by title case-insensitively', () => {
    const tpl1 = getTemplateByTitle('System Architecture');
    const tpl2 = getTemplateByTitle('system architecture');
    const tpl3 = getTemplateByTitle('User Flow Sequence');
    const tpl4 = getTemplateByTitle('ER Diagram & Schema');
    const tpl5 = getTemplateByTitle('Brainstorm & Mindmap');

    expect(tpl1).not.toBeNull();
    expect(tpl1.id).toBe('system-architecture');
    expect(tpl2.id).toBe('system-architecture');
    expect(tpl3.id).toBe('user-flow-sequence');
    expect(tpl4.id).toBe('er-diagram');
    expect(tpl5.id).toBe('mindmap');
    expect(getTemplateByTitle('Nonexistent')).toBeNull();
  });

  it('resolves templates by common aliases for IDs and titles', () => {
    // ID aliases
    expect(getTemplateById('architecture')?.id).toBe('system-architecture');
    expect(getTemplateById('sequence')?.id).toBe('user-flow-sequence');
    expect(getTemplateById('erd')?.id).toBe('er-diagram');
    expect(getTemplateById('brainstorm-mindmap')?.id).toBe('mindmap');

    // Title aliases
    expect(getTemplateByTitle('Architecture')?.id).toBe('system-architecture');
    expect(getTemplateByTitle('Sequence')?.id).toBe('user-flow-sequence');
    expect(getTemplateByTitle('ERD')?.id).toBe('er-diagram');
    expect(getTemplateByTitle('Mindmap')?.id).toBe('mindmap');
    expect(getTemplateByTitle('Brainstorm')?.id).toBe('mindmap');
  });
});
