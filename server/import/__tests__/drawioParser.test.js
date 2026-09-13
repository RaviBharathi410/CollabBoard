import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import { parseDrawioDiagram, unpackDrawioXml } from '../parsers/drawioParser.js';

describe('drawioParser', () => {
  it('parses raw mxGraph XML with shapes, labels, and connections', () => {
    const xml = `
      <mxfile host="app.diagrams.net">
        <diagram id="d1" name="Architecture">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="node-gateway" value="API Gateway" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
                <mxGeometry x="100" y="80" width="140" height="60" as="geometry"/>
              </mxCell>
              <mxCell id="node-db" value="PostgreSQL DB" style="shape=cylinder;whiteSpace=wrap;html=1;" vertex="1" parent="1">
                <mxGeometry x="360" y="80" width="100" height="80" as="geometry"/>
              </mxCell>
              <mxCell id="node-decision" value="Cache Hit?" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1">
                <mxGeometry x="240" y="240" width="100" height="80" as="geometry"/>
              </mxCell>
              <mxCell id="edge-1" value="Queries" style="edgeStyle=orthogonalEdgeStyle;dashed=1;" edge="1" parent="1" source="node-gateway" target="node-db">
                <mxGeometry relative="1" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>
    `;

    const result = parseDrawioDiagram(xml);
    expect(result.sourceType).toBe('drawio');
    expect(result.confidence).toBe(1.0);
    expect(result.nodes).toHaveLength(3);

    // Verify node types and labels
    const gateway = result.nodes.find((n) => n.id === 'node-gateway');
    expect(gateway).toBeDefined();
    expect(gateway.label).toBe('API Gateway');
    expect(gateway.type).toBe('rectangle');
    expect(gateway.x).toBe(100);
    expect(gateway.y).toBe(80);
    expect(gateway.source).toBe('parsed');
    expect(gateway.confidence).toBe(1.0);

    const db = result.nodes.find((n) => n.id === 'node-db');
    expect(db.type).toBe('database');
    expect(db.label).toBe('PostgreSQL DB');

    const decision = result.nodes.find((n) => n.id === 'node-decision');
    expect(decision.type).toBe('diamond');
    expect(decision.label).toBe('Cache Hit?');

    // Verify edge
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('node-gateway');
    expect(result.edges[0].target).toBe('node-db');
    expect(result.edges[0].label).toBe('Queries');
    expect(result.edges[0].style).toBe('dashed');
    expect(result.edges[0].sourceTag).toBe('parsed');
  });

  it('unpacks and parses deflated base64 draw.io diagrams', () => {
    const rawInnerXml = `
      <mxGraphModel>
        <root>
          <mxCell id="0"/>
          <mxCell id="1" parent="0"/>
          <mxCell id="n1" value="Microservice A" vertex="1" parent="1">
            <mxGeometry x="50" y="50" width="120" height="60" as="geometry"/>
          </mxCell>
        </root>
      </mxGraphModel>
    `;

    // Deflate and base64 encode as draw.io export does
    const deflated = zlib.deflateRawSync(Buffer.from(rawInnerXml, 'utf8'));
    const base64Diagram = deflated.toString('base64');
    const drawioFile = `<mxfile><diagram id="compressed">${base64Diagram}</diagram></mxfile>`;

    const unpacked = unpackDrawioXml(drawioFile);
    expect(unpacked).toContain('Microservice A');

    const result = parseDrawioDiagram(drawioFile);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].label).toBe('Microservice A');
    expect(result.nodes[0].x).toBe(50);
  });

  it('resolves grouped / nested container offsets into absolute coordinates', () => {
    const xml = `
      <mxGraphModel>
        <root>
          <mxCell id="0"/>
          <mxCell id="1" parent="0"/>
          <!-- Group Container at (100, 150) -->
          <mxCell id="group-backend" value="Backend Cluster" style="swimlane;" vertex="1" parent="1">
            <mxGeometry x="100" y="150" width="400" height="300" as="geometry"/>
          </mxCell>
          <!-- Nested Child shape inside group-backend with relative offset (40, 60) -->
          <mxCell id="child-auth" value="Auth Service" style="rounded=1;" vertex="1" parent="group-backend">
            <mxGeometry x="40" y="60" width="120" height="50" as="geometry"/>
          </mxCell>
        </root>
      </mxGraphModel>
    `;

    const result = parseDrawioDiagram(xml);
    expect(result.nodes).toHaveLength(2);

    const group = result.nodes.find((n) => n.id === 'group-backend');
    expect(group.x).toBe(100);
    expect(group.y).toBe(150);
    expect(group.type).toBe('group_boundary');

    const child = result.nodes.find((n) => n.id === 'child-auth');
    // Absolute position: 100 + 40 = 140, 150 + 60 = 210
    expect(child.x).toBe(140);
    expect(child.y).toBe(210);
    expect(child.label).toBe('Auth Service');
  });

  it('extracts multi-segment connectors with waypoints', () => {
    const xml = `
      <mxGraphModel>
        <root>
          <mxCell id="0"/>
          <mxCell id="1" parent="0"/>
          <mxCell id="s1" value="Source" vertex="1" parent="1">
            <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
          </mxCell>
          <mxCell id="s2" value="Target" vertex="1" parent="1">
            <mxGeometry x="300" y="300" width="100" height="50" as="geometry"/>
          </mxCell>
          <mxCell id="edge-waypoint" value="Step Routing" edge="1" parent="1" source="s1" target="s2">
            <mxGeometry relative="1" as="geometry">
              <Array as="points">
                <mxPoint x="100" y="25"/>
                <mxPoint x="200" y="25"/>
                <mxPoint x="200" y="325"/>
              </Array>
            </mxGeometry>
          </mxCell>
        </root>
      </mxGraphModel>
    `;

    const result = parseDrawioDiagram(xml);
    expect(result.edges).toHaveLength(1);
    const edge = result.edges[0];
    expect(edge.points).toBeDefined();
    expect(edge.points).toEqual([
      [100, 25],
      [200, 25],
      [200, 325],
    ]);
  });

  it('sanitizes HTML-formatted labels into clean text', () => {
    const xml = `
      <mxGraphModel>
        <root>
          <mxCell id="0"/>
          <mxCell id="1" parent="0"/>
          <mxCell id="node-html" value="&lt;div style=&quot;text-align: center;&quot;&gt;&lt;b&gt;Payment Gateway&lt;/b&gt;&lt;br/&gt;&lt;i&gt;Stripe API&lt;/i&gt;&lt;/div&gt;" vertex="1" parent="1">
            <mxGeometry x="50" y="50" width="160" height="80" as="geometry"/>
          </mxCell>
        </root>
      </mxGraphModel>
    `;

    const result = parseDrawioDiagram(xml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].label).toBe('Payment Gateway Stripe API');
  });
});
