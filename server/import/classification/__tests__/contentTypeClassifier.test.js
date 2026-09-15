import { describe, it, expect } from 'vitest';
import {
  classifyStructuredDiagram,
  classifyFromOcrAndShapes,
} from '../contentTypeClassifier.js';

describe('classifyStructuredDiagram', () => {
  it('correctly classifies Mermaid diagrams by syntax header', () => {
    expect(classifyStructuredDiagram('mermaid', 'classDiagram\n  class Animal { +String name }')).toEqual({
      type: 'uml-class',
      confidence: 1.0,
      method: 'mermaid_syntax',
    });

    expect(classifyStructuredDiagram('mermaid', 'graph TD\n  A[Start] --> B[Process]')).toEqual({
      type: 'flowchart',
      confidence: 1.0,
      method: 'mermaid_syntax',
    });

    expect(classifyStructuredDiagram('mermaid', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places')).toEqual({
      type: 'erd',
      confidence: 1.0,
      method: 'mermaid_syntax',
    });

    expect(classifyStructuredDiagram('mermaid', 'sequenceDiagram\n  Alice->>Bob: Hello')).toEqual({
      type: 'sequence',
      confidence: 1.0,
      method: 'mermaid_syntax',
    });

    expect(classifyStructuredDiagram('mermaid', 'stateDiagram\n  [*] --> Still')).toEqual({
      type: 'state-machine',
      confidence: 1.0,
      method: 'mermaid_syntax',
    });
  });

  it('classifies draw.io diagrams by mxGraph style inspection', () => {
    const umlXml = `<mxfile><diagram><mxGraphModel><root><mxCell id="2" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;" value="Window" /></root></mxGraphModel></diagram></mxfile>`;
    expect(classifyStructuredDiagram('drawio', umlXml).type).toBe('uml-class');

    const flowchartXml = `<mxfile><diagram><mxGraphModel><root><mxCell id="2" style="rhombus;whiteSpace=wrap;html=1;" value="Is Valid?" /></root></mxGraphModel></diagram></mxfile>`;
    expect(classifyStructuredDiagram('drawio', flowchartXml).type).toBe('flowchart');

    const erXml = `<mxfile><diagram><mxGraphModel><root><mxCell id="2" style="shape=er;crowsfoot" value="User" /></root></mxGraphModel></diagram></mxfile>`;
    expect(classifyStructuredDiagram('drawio', erXml).type).toBe('erd');
  });

  it('classifies SVG content based on semantic markers', () => {
    const umlSvg = `<svg><g class="class-node"><text>+open()</text><text>&lt;&lt;interface&gt;&gt;</text></g></svg>`;
    expect(classifyStructuredDiagram('svg', umlSvg).type).toBe('uml-class');

    const fcSvg = `<svg><polygon class="decision" /><text>Yes</text><text>No</text></svg>`;
    expect(classifyStructuredDiagram('svg', fcSvg).type).toBe('flowchart');
  });
});

describe('classifyFromOcrAndShapes', () => {
  it('identifies UML class diagrams from OCR keywords and methods', () => {
    const ocr = [
      { text: '<<boundary>>' },
      { text: 'Window' },
      { text: '+open()' },
      { text: '+close()' },
      { text: '-radius: float' },
    ];
    const res = classifyFromOcrAndShapes(ocr, []);
    expect(res.type).toBe('uml-class');
    expect(res.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('identifies flowcharts from decision diamonds and flow text', () => {
    const ocr = [
      { text: 'Start' },
      { text: 'Validate' },
      { text: 'Yes' },
      { text: 'No' },
    ];
    const shapes = [{ class_name: 'diamond' }, { class_name: 'rectangle' }];
    const res = classifyFromOcrAndShapes(ocr, shapes);
    expect(res.type).toBe('flowchart');
  });

  it('identifies ERDs from cardinality and key markers', () => {
    const ocr = [
      { text: 'Users' },
      { text: 'PK id' },
      { text: 'FK tenant_id' },
      { text: '1:N' },
    ];
    const res = classifyFromOcrAndShapes(ocr, []);
    expect(res.type).toBe('erd');
  });
});
