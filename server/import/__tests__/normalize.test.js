import { describe, it, expect } from 'vitest';
import { normalizeDiagram, sanitizeAndHealGraph } from '../normalize.js';

describe('normalizeDiagram & sanitizeAndHealGraph', () => {
  describe('sanitizeAndHealGraph', () => {
    it('prunes phantom edges referencing non-existent nodes', () => {
      const raw = {
        nodes: [
          { id: 'n1', type: 'rectangle', label: 'Service A' },
          { id: 'n2', type: 'database', label: 'DB' },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e-phantom', source: 'n1', target: 'n999' }, // Phantom
        ],
      };

      const { diagram, healingTelemetry } = sanitizeAndHealGraph(raw);
      expect(diagram.edges).toHaveLength(1);
      expect(diagram.edges[0].id).toBe('e1');
      expect(healingTelemetry.healingApplied).toBe(true);
      expect(healingTelemetry.prunedEdgeCount).toBe(1);
      expect(healingTelemetry.prunedEdges).toContain('n1->n999');
    });

    it('stitches orphan nodes to the graph', () => {
      const raw = {
        nodes: [
          { id: 'n1', type: 'rectangle', label: 'Entry' },
          { id: 'n2', type: 'rectangle', label: 'Processing' },
          { id: 'n3', type: 'rectangle', label: 'Orphan Worker' }, // Orphan
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
        ],
      };

      const { diagram, healingTelemetry } = sanitizeAndHealGraph(raw);
      expect(diagram.edges).toHaveLength(2);
      expect(healingTelemetry.healingApplied).toBe(true);
      expect(healingTelemetry.stitchedNodeCount).toBe(1);
      const stitched = diagram.edges.find((e) => e.target === 'n3');
      expect(stitched).toBeDefined();
      expect(stitched.sourceTag).toBe('healed');
    });
  });

  describe('normalizeDiagram', () => {
    it('normalizes structured file import with 100% confidence and zero low-confidence flags', () => {
      const raw = {
        type: 'architecture',
        nodes: [
          { id: 'gw', type: 'rectangle', label: 'API Gateway', x: 10, y: 20, width: 120, height: 60, source: 'parsed', confidence: 1.0 },
          { id: 'auth', type: 'service', label: 'Auth', x: 200, y: 20, width: 120, height: 60, source: 'parsed', confidence: 1.0 },
        ],
        edges: [
          { id: 'e1', source: 'gw', target: 'auth', label: 'POST /login', style: 'solid', sourceTag: 'parsed', confidence: 1.0 },
        ],
      };

      const normalized = normalizeDiagram(raw, 'drawio');
      expect(normalized.sourceType).toBe('drawio');
      expect(normalized.overallConfidence).toBe(1.0);
      expect(normalized.confidenceReport.lowConfidenceCount).toBe(0);
      expect(normalized.confidenceReport.bySource.parsed).toBe(3); // 2 nodes + 1 edge
      expect(normalized.healingTelemetry.healingApplied).toBe(false);
    });

    it('honestly flags low-confidence elements in image vision import', () => {
      const raw = {
        type: 'architecture',
        nodes: [
          { id: 'n1', type: 'rectangle', label: 'High Conf Shape', confidence: 0.95, source: 'detected' },
          { id: 'n2', type: 'cloud', label: 'Uncertain Cloud', confidence: 0.55, source: 'detected' }, // Low confidence
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', confidence: 0.70, sourceTag: 'detected' }, // Low confidence
        ],
      };

      const normalized = normalizeDiagram(raw, 'image', 0.80);
      expect(normalized.sourceType).toBe('image');
      expect(normalized.overallConfidence).toBeLessThan(0.80);
      expect(normalized.confidenceReport.lowConfidenceCount).toBe(2);

      const lowIds = normalized.confidenceReport.lowConfidenceElements.map((el) => el.id);
      expect(lowIds).toContain('n2');
      expect(lowIds).toContain('e1');
    });
  });
});
