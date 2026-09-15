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
