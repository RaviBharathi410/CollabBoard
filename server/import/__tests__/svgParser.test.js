import { describe, it, expect } from 'vitest';
import { parseSvgDiagram } from '../parsers/svgParser.js';

describe('svgParser', () => {
  it('extracts geometric shapes, matches text labels, and links connector lines', () => {
    const svg = `
      <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <!-- Node 1: Rectangle -->
        <rect id="rect-api" x="50" y="50" width="120" height="60" fill="#E8F0FE" stroke="#1A73E8"/>
        <text x="70" y="85">API Service</text>

        <!-- Node 2: Circle -->
        <circle id="circle-worker" cx="300" cy="80" r="40" fill="#CEEAD6" stroke="#1E8E3E"/>
        <text x="270" y="85">Worker</text>

        <!-- Connector Line -->
        <line id="line-1" x1="170" y1="80" x2="260" y2="80" stroke="#5F6368" stroke-width="2"/>
      </svg>
    `;

    const result = parseSvgDiagram(svg);
    expect(result.sourceType).toBe('svg');
    expect(result.confidence).toBe(0.98);
    expect(result.nodes).toHaveLength(2);

    const apiNode = result.nodes.find((n) => n.id === 'rect-api');
    expect(apiNode).toBeDefined();
    expect(apiNode.type).toBe('rectangle');
    expect(apiNode.label).toBe('API Service');
    expect(apiNode.source).toBe('parsed');

    const workerNode = result.nodes.find((n) => n.id === 'circle-worker');
    expect(workerNode).toBeDefined();
    expect(workerNode.type).toBe('circle');
    expect(workerNode.label).toBe('Worker');

    // Connector edge
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('rect-api');
    expect(result.edges[0].target).toBe('circle-worker');
  });

  it('triggers fallbackToRaster when SVG only contains raster <image> tag', () => {
    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" width="800" height="600"/>
      </svg>
    `;

    const result = parseSvgDiagram(svg);
    expect(result.fallbackToRaster).toBe(true);
    expect(result.reason).toContain('SVG only contains raster image');
  });
});
