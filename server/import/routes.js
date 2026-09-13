import express from 'express';
import { detectDiagramFormat } from './formatRouter.js';
import { parseDrawioDiagram } from './parsers/drawioParser.js';
import { parseMermaidDiagram } from './parsers/mermaidParser.js';
import { parseSvgDiagram } from './parsers/svgParser.js';
import { normalizeDiagram } from './normalize.js';
import { requireAuth } from '../ai/routes.js';
import { aiRateLimiter } from '../ai/rateLimiter.js';
import { analyzeDiagramVision } from '../ai/vision.js';

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
 * Unified raster image processor:
 * Supports engine choice: 'cloud' (GPT-4o / Gemini Flash, default) or 'local' (FastAPI Classical CV + EasyOCR)
 * Automatically cross-cascades if the preferred engine fails.
 */
async function processRasterImage(imgBase64, options = {}) {
  const preferredEngine = options.engine || 'cloud';

  if (preferredEngine === 'cloud') {
    let cloudVisionError = null;
    try {
      const visionResult = await analyzeDiagramVision(imgBase64, {
        sessionId: options.sessionId,
        preferCloud: true,
        diagramTypeHint: options.diagramTypeHint || 'class_diagram',
        instruction: 'Extract all diagram nodes, classes, labels, and connecting arrows accurately into standard diagram schema. Exclude explanatory callout annotations from being nodes.',
      });
      if (visionResult?.parsed?.nodes && visionResult.parsed.nodes.length > 0) {
        return {
          diagram: visionResult.parsed,
          preprocessing: { engine: 'cloud-vision' },
          modelUsed: visionResult.modelUsed || 'cloud-vision',
        };
      }
    } catch (visionErr) {
      cloudVisionError = visionErr.message || String(visionErr);
      console.warn('[Import Route] Cloud vision failed, cascading to local CV pipeline:', cloudVisionError);
    }

    // 2. Fallback to Local CV microservice
    try {
      const infResult = await proxyToInferenceAPI(imgBase64, options);
      if (infResult && infResult.diagram) {
        return {
          diagram: infResult.diagram,
          preprocessing: infResult.preprocessing,
          modelUsed: 'local-cv-fallback',
          fallbackReason: cloudVisionError ? `Cloud Vision unavailable (${cloudVisionError}). Processed with Classical CV offline pipeline.` : undefined,
        };
      }
    } catch (proxyErr) {
      console.error('[Import Route] Local CV pipeline also failed:', proxyErr.message);
    }
  } else {
    // 1. Try Local CV microservice (Fast offline line-art)
    try {
      const infResult = await proxyToInferenceAPI(imgBase64, options);
      if (infResult && infResult.diagram) {
        return {
          diagram: infResult.diagram,
          preprocessing: infResult.preprocessing,
          modelUsed: infResult.modelUsed || 'local-cv-pipeline',
        };
      }
    } catch (proxyErr) {
      console.warn('[Import Route] Local CV microservice failed, cascading to Cloud Vision:', proxyErr.message);
    }

    // 2. Fallback to Cloud Vision
    try {
      const visionResult = await analyzeDiagramVision(imgBase64, {
        sessionId: options.sessionId,
        preferCloud: true,
        diagramTypeHint: options.diagramTypeHint || 'class_diagram',
        instruction: 'Extract all diagram nodes, classes, labels, and connecting arrows accurately into standard diagram schema. Exclude explanatory callout annotations from being nodes.',
      });
      if (visionResult?.parsed?.nodes && visionResult.parsed.nodes.length > 0) {
        return {
          diagram: visionResult.parsed,
          preprocessing: { engine: 'cloud-vision-fallback' },
          modelUsed: visionResult.modelUsed || 'cloud-vision-fallback',
        };
      }
    } catch (visionErr) {
      console.error('[Import Route] Cloud vision fallback also failed:', visionErr.message);
    }
  }

  throw new Error(
    'Image diagram recognition failed. Ensure the inference microservice is running ("npm run dev:inference") or configure OPENAI_API_KEY / GEMINI_API_KEY for cloud fallback.'
  );
}

/**
 * POST /api/import/file
 * Primary import endpoint accepting structured files or raster images.
 */
importRouter.post('/file', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { filename, content, enablePreprocessing, enableHighPrecision, sessionId, engine = 'cloud' } = req.body;

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
        // Fallback to raster vision pipeline (local CV + cloud vision fallback)
        const b64 = Buffer.from(detected.text).toString('base64');
        const imgData = `data:image/svg+xml;base64,${b64}`;
        const infResult = await processRasterImage(imgData, { enablePreprocessing, enableHighPrecision, sessionId, engine });
        const normalized = normalizeDiagram(infResult.diagram, 'image');
        return res.json({
          status: 'success',
          format: 'raster_image',
          isStructured: false,
          diagram: normalized,
          preprocessing: infResult.preprocessing,
          modelUsed: infResult.modelUsed,
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

    // 4. Raster Image (PNG, JPG, WEBP) -> Local FastAPI with Cloud Vision Fallback
    if (detected.format === 'raster_image') {
      const imgBase64 = content.startsWith('data:') ? content : `data:${detected.mimeType};base64,${content}`;
      const infResult = await processRasterImage(imgBase64, { enablePreprocessing, enableHighPrecision, sessionId, engine });
      const normalized = normalizeDiagram(infResult.diagram, 'image');
      return res.json({
        status: 'success',
        format: 'raster_image',
        isStructured: false,
        diagram: normalized,
        preprocessing: infResult.preprocessing,
        modelUsed: infResult.modelUsed,
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
