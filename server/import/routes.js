import express from 'express';
import { detectDiagramFormat } from './formatRouter.js';
import { parseDrawioDiagram } from './parsers/drawioParser.js';
import { parseMermaidDiagram } from './parsers/mermaidParser.js';
import { parseSvgDiagram } from './parsers/svgParser.js';
import { normalizeDiagram } from './normalize.js';
import { requireAuth } from '../ai/routes.js';
import { aiRateLimiter } from '../ai/rateLimiter.js';

export const importRouter = express.Router();

const INFERENCE_API_URL = process.env.INFERENCE_API_URL || 'http://localhost:8000';

/**
 * Helper to proxy raster image payloads to internal FastAPI /import-image
 */
async function proxyToInferenceAPI(imageBase64, options = {}) {
  const payload = {
    imageBase64,
    enablePreprocessing: options.enablePreprocessing !== false,
    enableHighPrecision: options.enableHighPrecision === true,
    sessionId: options.sessionId,
  };

  const response = await fetch(`${INFERENCE_API_URL}/import-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Inference API /import-image failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * POST /api/import/file
 * Primary import endpoint accepting structured files or raster images.
 */
importRouter.post('/file', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { filename, content, enablePreprocessing, enableHighPrecision, sessionId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Sniff format
    const detected = detectDiagramFormat(filename, content);

    // 1. Structured draw.io MXGraph XML
    if (detected.format === 'drawio') {
      const raw = parseDrawioDiagram(detected.text);
      const normalized = normalizeDiagram(raw, 'drawio');
      return res.json({
        status: 'success',
        format: 'drawio',
        isStructured: true,
        diagram: normalized,
      });
    }

    // 2. Structured Mermaid Diagram
    if (detected.format === 'mermaid') {
      const raw = parseMermaidDiagram(detected.text);
      const normalized = normalizeDiagram(raw, 'mermaid');
      return res.json({
        status: 'success',
        format: 'mermaid',
        isStructured: true,
        diagram: normalized,
      });
    }

    // 3. Vector SVG (with raster fallback check)
    if (detected.format === 'svg') {
      const raw = parseSvgDiagram(detected.text);
      if (raw.fallbackToRaster) {
        // Fallback to raster vision pipeline
        const b64 = Buffer.from(detected.text).toString('base64');
        const imgData = `data:image/svg+xml;base64,${b64}`;
        const infResult = await proxyToInferenceAPI(imgData, { enablePreprocessing, enableHighPrecision, sessionId });
        const normalized = normalizeDiagram(infResult.diagram, 'image');
        return res.json({
          status: 'success',
          format: 'raster_image',
          isStructured: false,
          diagram: normalized,
          preprocessing: infResult.preprocessing,
          fallbackReason: raw.reason,
        });
      }

      const normalized = normalizeDiagram(raw, 'svg');
      return res.json({
        status: 'success',
        format: 'svg',
        isStructured: true,
        diagram: normalized,
      });
    }

    // 4. Raster Image (PNG, JPG, WEBP) -> Internal FastAPI
    if (detected.format === 'raster_image') {
      const imgBase64 = content.startsWith('data:') ? content : `data:${detected.mimeType};base64,${content}`;
      const infResult = await proxyToInferenceAPI(imgBase64, { enablePreprocessing, enableHighPrecision, sessionId });
      const normalized = normalizeDiagram(infResult.diagram, 'image');
      return res.json({
        status: 'success',
        format: 'raster_image',
        isStructured: false,
        diagram: normalized,
        preprocessing: infResult.preprocessing,
      });
    }

    return res.status(400).json({
      error: 'Unsupported or unrecognized diagram format',
      reason: detected.reason,
    });
  } catch (err) {
    console.error('[Import Route Error]', err);
    return res.status(500).json({ error: err.message || 'Import processing failed' });
  }
});

/**
 * POST /api/import/text
 * Direct text import for raw Mermaid or XML diagrams.
 */
importRouter.post('/text', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { text, formatHint } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text string is required' });
    }

    const detected = detectDiagramFormat(formatHint ? `diagram.${formatHint}` : '', text);

    if (detected.format === 'mermaid') {
      const raw = parseMermaidDiagram(text);
      const normalized = normalizeDiagram(raw, 'mermaid');
      return res.json({ status: 'success', format: 'mermaid', diagram: normalized });
    }

    if (detected.format === 'drawio') {
      const raw = parseDrawioDiagram(text);
      const normalized = normalizeDiagram(raw, 'drawio');
      return res.json({ status: 'success', format: 'drawio', diagram: normalized });
    }

    return res.status(400).json({
      error: 'Unrecognized diagram text format: expected Mermaid or mxGraph XML',
      reason: detected.reason,
    });
  } catch (err) {
    console.error('[Import Text Error]', err);
    return res.status(500).json({ error: err.message || 'Import text processing failed' });
  }
});
