import fs from 'fs';
import { parseDrawioDiagram } from '../server/import/parsers/drawioParser.js';
import { parseMermaidDiagram } from '../server/import/parsers/mermaidParser.js';
import { parseSvgDiagram } from '../server/import/parsers/svgParser.js';
import { normalizeDiagram } from '../server/import/normalize.js';

const [, , filePath, formatType] = process.argv;

if (!filePath || !formatType) {
  console.error('Usage: node scripts/run_structured_parser.mjs <file_path> <format>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  let raw;
  if (formatType === 'drawio') {
    raw = parseDrawioDiagram(content);
  } else if (formatType === 'mermaid') {
    raw = parseMermaidDiagram(content);
  } else if (formatType === 'svg') {
    raw = parseSvgDiagram(content);
  } else {
    throw new Error(`Unknown format: ${formatType}`);
  }

  const normalized = normalizeDiagram(raw, formatType);
  console.log(JSON.stringify(normalized));
} catch (err) {
  console.error('Parser error:', err.message);
  process.exit(1);
}
