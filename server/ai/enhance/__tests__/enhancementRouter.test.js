import { describe, it, expect, vi } from 'vitest';
import { getEnhancementPlugin, enhanceDiagram } from '../enhancementRouter.js';

describe('enhancementRouter', () => {
  it('resolves plugins by diagram type correctly', () => {
    const fcPlugin = getEnhancementPlugin('flowchart');
    expect(fcPlugin).toBeDefined();
    expect(fcPlugin.id).toBe('flowchart');

    const umlPlugin = getEnhancementPlugin('uml-class');
    expect(umlPlugin).toBeDefined();
    expect(umlPlugin.id).toBe('uml-class');

    expect(getEnhancementPlugin('unknown-type')).toBeNull();
  });

  it('gates UML enhancement in MVP with explicit status', async () => {
    const result = await enhanceDiagram({ type: 'uml-class' }, 'Add an Order class');
    expect(result.status).toBe('unsupported');
    expect(result.type).toBe('uml-class');
    expect(result.message).toContain('Phase 2');
  });

  it('gates Sequence, Use Case, and ERD AI enhancements with explicit status', async () => {
    const seqResult = await enhanceDiagram({ type: 'sequence' }, 'Add lifeline');
    expect(seqResult.status).toBe('unsupported');
    expect(seqResult.type).toBe('sequence');
    expect(seqResult.message).toContain('gated');

    const ucResult = await enhanceDiagram({ type: 'use-case' }, 'Add actor');
    expect(ucResult.status).toBe('unsupported');
    expect(ucResult.type).toBe('use-case');
    expect(ucResult.message).toContain('gated');

    const erdResult = await enhanceDiagram({ type: 'erd' }, 'Add table');
    expect(erdResult.status).toBe('unsupported');
    expect(erdResult.type).toBe('erd');
    expect(erdResult.message).toContain('gated');
  });

  it('handles unknown diagram types gracefully without throwing', async () => {
    const result = await enhanceDiagram({ type: 'quantum-circuit' }, 'Add qubit');
    expect(result.status).toBe('unsupported');
    expect(result.message).toContain('quantum-circuit');
  });

  it('routes flowchart requests to flowchart enhancement plugin', async () => {
    const fcPlugin = getEnhancementPlugin('flowchart');
    const spy = vi.spyOn(fcPlugin, 'enhance').mockResolvedValueOnce({
      status: 'success',
      type: 'flowchart',
      diagram: { nodes: [{ id: 'n1', type: 'process' }] },
    });

    const result = await enhanceDiagram({ type: 'flowchart' }, 'Add user login step');
    expect(spy).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.type).toBe('flowchart');
  });
});
