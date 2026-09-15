/**
 * Content-Type Classifier for Diagram Import.
 * Classifies diagram content (structured files and raster images) into target diagram types:
 * - 'uml-class'
 * - 'flowchart'
 * - 'erd'
 * - 'sequence'
 * - 'state-machine'
 * 
 * Principle: Deterministic syntax first, then local heuristic, then cloud verification.
 */

/**
 * Classifies structured text/diagram content deterministically from syntax.
 * @param {string} format - Detected format ('mermaid' | 'drawio' | 'svg')
 * @param {string} text - File raw text content
 * @returns {{ type: string, confidence: number, method: string }}
 */
export function classifyStructuredDiagram(format, text) {
  if (!text || typeof text !== 'string') {
    return { type: 'flowchart', confidence: 0.5, method: 'default_fallback' };
  }

  const trimmed = text.trim();

  // 1. Mermaid deterministic keyword classification
  if (format === 'mermaid' || trimmed.startsWith('classDiagram') || trimmed.startsWith('graph') || trimmed.startsWith('flowchart') || trimmed.startsWith('erDiagram')) {
    const firstLine = trimmed.split('\n')[0].trim().toLowerCase();
    if (firstLine.startsWith('classdiagram')) {
      return { type: 'uml-class', confidence: 1.0, method: 'mermaid_syntax' };
    }
    if (firstLine.startsWith('erdiagram')) {
      return { type: 'erd', confidence: 1.0, method: 'mermaid_syntax' };
    }
    if (firstLine.startsWith('sequencediagram')) {
      return { type: 'sequence', confidence: 1.0, method: 'mermaid_syntax' };
    }
    if (firstLine.startsWith('statediagram')) {
      return { type: 'state-machine', confidence: 1.0, method: 'mermaid_syntax' };
    }
    if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
      return { type: 'flowchart', confidence: 1.0, method: 'mermaid_syntax' };
    }
  }

  // 2. Draw.io / mxGraph XML inspection
  if (format === 'drawio' || trimmed.includes('<mxGraphModel') || trimmed.includes('<diagram')) {
    const lower = trimmed.toLowerCase();

    // Check for UML markers in mxGraph styles
    const umlIndicators = ['umlclass', 'swimlane', 'shape=uml', 'umlactor', 'umlboundary', 'umlcontrol', 'umlentity'];
    const hasUml = umlIndicators.some((kw) => lower.includes(kw));

    if (hasUml || (lower.includes('interface') && lower.includes('class') && lower.includes('public'))) {
      return { type: 'uml-class', confidence: 0.95, method: 'drawio_style_inspection' };
    }

    // Check for ER markers
    const erIndicators = ['erentity', 'crowsfoot', 'shape=er', 'cardinality'];
    if (erIndicators.some((kw) => lower.includes(kw))) {
      return { type: 'erd', confidence: 0.95, method: 'drawio_style_inspection' };
    }

    // Check for Flowchart markers
    const fcIndicators = ['rhombus', 'decision', 'process', 'terminator', 'document'];
    if (fcIndicators.some((kw) => lower.includes(kw))) {
      return { type: 'flowchart', confidence: 0.9, method: 'drawio_style_inspection' };
    }

    return { type: 'flowchart', confidence: 0.75, method: 'drawio_default' };
  }

  // 3. SVG inspection
  if (format === 'svg' || trimmed.startsWith('<svg')) {
    const lower = trimmed.toLowerCase();
    if (lower.includes('class') && (lower.includes('+') || lower.includes('-') || lower.includes('<<'))) {
      return { type: 'uml-class', confidence: 0.85, method: 'svg_content_heuristic' };
    }
    if (lower.includes('decision') || lower.includes('yes') || lower.includes('no')) {
      return { type: 'flowchart', confidence: 0.8, method: 'svg_content_heuristic' };
    }
    return { type: 'flowchart', confidence: 0.7, method: 'svg_default' };
  }

  return { type: 'flowchart', confidence: 0.6, method: 'unrecognized_fallback' };
}

/**
 * Heuristically classifies raster diagram images based on detected text and shapes.
 * @param {Array<{text: string}>} ocrResults
 * @param {Array<{class_name: string}>} detectedShapes
 * @returns {{ type: string, confidence: number, method: string }}
 */
export function classifyFromOcrAndShapes(ocrResults = [], detectedShapes = []) {
  const allText = ocrResults.map((r) => r.text || '').join(' ').toLowerCase();

  let umlScore = 0;
  let flowchartScore = 0;
  let erdScore = 0;

  // UML keywords
  const umlKeywords = ['<<', '>>', 'class', 'interface', 'extends', 'implements', 'override', 'public', 'private', 'protected', 'void', 'string', 'int', 'float', 'boolean', 'unsigned'];
  for (const kw of umlKeywords) {
    if (allText.includes(kw)) umlScore += 1;
  }
  // Visibility markers (+, -, #)
  if (allText.includes('+') || allText.includes('-') || allText.includes('#')) {
    umlScore += 2;
  }
  // Parentheses indicating methods
  if (allText.includes('()') || allText.includes('(')) {
    umlScore += 2;
  }

  // Flowchart keywords
  const fcKeywords = ['start', 'end', 'yes', 'no', 'true', 'false', 'decision', 'input', 'output', 'submit', 'cancel', 'process'];
  for (const kw of fcKeywords) {
    if (allText.includes(kw)) flowchartScore += 1;
  }
  // Diamonds in detected shapes
  const diamondCount = detectedShapes.filter((s) => s.class_name === 'diamond').length;
  if (diamondCount > 0) flowchartScore += 2 * diamondCount;

  // ER keywords
  const erKeywords = ['1:1', '1:n', '1:m', 'n:m', 'fk', 'pk', 'foreign key', 'primary key', 'entity', 'table', 'attributes', 'relation'];
  for (const kw of erKeywords) {
    if (allText.includes(kw)) erdScore += 1.5;
  }

  const maxScore = Math.max(umlScore, flowchartScore, erdScore);
  if (maxScore === 0) {
    return { type: 'flowchart', confidence: 0.6, method: 'heuristic_default' };
  }

  if (umlScore >= flowchartScore && umlScore >= erdScore) {
    const conf = Math.min(0.92, 0.65 + umlScore * 0.04);
    return { type: 'uml-class', confidence: Number(conf.toFixed(2)), method: 'heuristic_ocr_shapes' };
  }

  if (erdScore >= flowchartScore) {
    const conf = Math.min(0.90, 0.65 + erdScore * 0.04);
    return { type: 'erd', confidence: Number(conf.toFixed(2)), method: 'heuristic_ocr_shapes' };
  }

  const conf = Math.min(0.90, 0.65 + flowchartScore * 0.04);
  return { type: 'flowchart', confidence: Number(conf.toFixed(2)), method: 'heuristic_ocr_shapes' };
}
