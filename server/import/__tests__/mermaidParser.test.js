import { describe, it, expect } from 'vitest';
import { parseMermaidDiagram } from '../parsers/mermaidParser.js';

describe('mermaidParser', () => {
  it('parses flowchart TD with multiple node shapes and labeled connections', () => {
    const mermaid = `
      graph TD
        client[Web Client] -->|HTTPS POST| auth(Auth Service)
        auth --> db[(User Credentials DB)]
        auth -.-> cache([Redis Session Cache])
        auth --> decision{Valid Token?}
        decision -->|Yes| allow((Grant Access))
    `;

    const result = parseMermaidDiagram(mermaid);
    expect(result.sourceType).toBe('mermaid');
    expect(result.confidence).toBe(1.0);
    expect(result.layoutHint).toBe('hierarchical-tb');

    // Check extracted nodes
    const client = result.nodes.find((n) => n.id === 'client');
    expect(client).toBeDefined();
    expect(client.type).toBe('rectangle');
    expect(client.label).toBe('Web Client');
    expect(client.source).toBe('parsed');

    const auth = result.nodes.find((n) => n.id === 'auth');
    expect(auth.type).toBe('service');
    expect(auth.label).toBe('Auth Service');

    const db = result.nodes.find((n) => n.id === 'db');
    expect(db.type).toBe('database');
    expect(db.label).toBe('User Credentials DB');

    const cache = result.nodes.find((n) => n.id === 'cache');
    expect(cache.type).toBe('service');
    expect(cache.label).toBe('Redis Session Cache');

    const decision = result.nodes.find((n) => n.id === 'decision');
    expect(decision.type).toBe('diamond');
    expect(decision.label).toBe('Valid Token?');

    const allow = result.nodes.find((n) => n.id === 'allow');
    expect(allow.type).toBe('circle');
    expect(allow.label).toBe('Grant Access');

    // Check extracted edges
    expect(result.edges).toHaveLength(5);
    const edge1 = result.edges.find((e) => e.source === 'client' && e.target === 'auth');
    expect(edge1.label).toBe('HTTPS POST');
    expect(edge1.style).toBe('solid');

    const edgeCache = result.edges.find((e) => e.source === 'auth' && e.target === 'cache');
    expect(edgeCache.style).toBe('dashed');
  });

  it('parses flowchart LR and multi-node chained arrows', () => {
    const mermaid = `
      flowchart LR
        A[Input Data] --> B[Filter Stage] --> C[Aggregation] --> D[Output Report]
    `;

    const result = parseMermaidDiagram(mermaid);
    expect(result.layoutHint).toBe('hierarchical-lr');
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    expect(result.edges[0].source).toBe('A');
    expect(result.edges[0].target).toBe('B');
    expect(result.edges[1].source).toBe('B');
    expect(result.edges[1].target).toBe('C');
    expect(result.edges[2].source).toBe('C');
    expect(result.edges[2].target).toBe('D');
  });

  it('handles comments and subgraphs gracefully', () => {
    const mermaid = `
      graph TD
        %% This is a system architecture diagram
        subgraph Internal Network
          svc1[Payment Service] --> svc2[Notification Worker]
        end
    `;

    const result = parseMermaidDiagram(mermaid);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0].label).toBe('Payment Service');
    expect(result.nodes[1].label).toBe('Notification Worker');
  });
});
