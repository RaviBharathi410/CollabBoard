import NodeCache from 'node-cache';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import {
  analyzeDiagramVision,
  estimateImageTokens,
  getModelAvailability,
  getOpenAI,
  getGenAI,
  streamAskGemini,
  MAX_TOKENS,
  PRIMARY_MODEL,
} from './vision.js';
import { parseDiagramJson, AskResponseSchema } from './schema.js';
import { ASK_SYSTEM_PROMPT } from './prompts.js';
import { getLayoutVariations } from './suggest.js';
import { chatToDiagramHandler } from './chatToDiagram.js';
import { getRecentAIRequests, computeAIStatsSummary } from './requestLogger.js';
import { aiRateLimiter } from './rateLimiter.js';

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.85');
const sessionCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const ClarifyBodySchema = z.object({
  sessionId: z.string(),
  nodeId: z.string(),
  answer: z.string(),
});

function needsClarification(parsed) {
  const lowConfidence = parsed.nodes.some((n) => n.confidence < CONFIDENCE_THRESHOLD);
  const hasAmbiguities = parsed.ambiguities && parsed.ambiguities.length > 0;
  return lowConfidence || hasAmbiguities;
}

function pickTopAmbiguity(parsed) {
  if (parsed.ambiguities?.length > 0) return parsed.ambiguities[0];
  const lowest = [...parsed.nodes].sort((a, b) => a.confidence - b.confidence)[0];
  return {
    nodeId: lowest.id,
    question: `What type is "${lowest.label || 'this node'}"?`,
    options: ['rectangle', 'database', 'circle', 'service'],
  };
}

function buildClarificationResponse(parsed, sessionId) {
  const topAmbiguity = pickTopAmbiguity(parsed);
  return {
    status: 'needs_clarification',
    sessionId,
    question: topAmbiguity.question,
    options: topAmbiguity.options,
    nodeId: topAmbiguity.nodeId,
    partialResult: parsed,
  };
}

function applyClarificationAnswer(parsed, nodeId, answer) {
  const next = structuredClone(parsed);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (node) {
    node.type = answer;
    node.confidence = 1.0;
  }
  next.ambiguities = (next.ambiguities || []).filter((a) => a.nodeId !== nodeId);
  return next;
}

function checkAIConfigured(res) {
  const avail = getModelAvailability();
  if (!avail.openai && !avail.gemini) {
    res.status(500).json({ error: 'AI service not configured', code: 'AI_NOT_CONFIGURED' });
    return false;
  }
  return true;
}

export const requireAuth = async (req, res, next) => {
  if (process.env.ALLOW_UNAUTHENTICATED === 'true' && process.env.NODE_ENV !== 'production') {
    console.warn(`[SECURITY WARNING] Bypassing Firebase ID token verification because ALLOW_UNAUTHENTICATED is set to true (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
    return next();
  }

  if (admin.apps.length === 0) {
    console.error('[SECURITY ERROR] Firebase Admin SDK is not initialized. Request blocked (401). Set ALLOW_UNAUTHENTICATED=true in dev mode to bypass.');
    return res.status(401).json({ error: 'Unauthorized: Firebase config missing or service account not loaded' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error(`[SECURITY ERROR] ID Token verification failed: ${err.message}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export function mountAIRoutes(app) {
  app.get('/api/health', (_req, res) => {
    const models = getModelAvailability();
    res.json({
      status: 'ok',
      models,
      confidenceThreshold: CONFIDENCE_THRESHOLD,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/enhance', requireAuth, aiRateLimiter, async (req, res) => {
    const start = Date.now();
    try {
      if (!checkAIConfigured(res)) return;

      const { imageBase64, existingShapes, diagramTypeHint, instruction, sessionId } = req.body;
      if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

      const tokens = await estimateImageTokens(imageBase64);
      if (tokens > 3500) {
        return res.status(413).json({
          error: 'Canvas too complex — select a region first.',
          code: 'IMAGE_TOO_LARGE',
        });
      }

      const sid = sessionId || crypto.randomUUID();

      let parsed, modelUsed, processingMs;
      try {
        const result = await analyzeDiagramVision(imageBase64, {
          diagramTypeHint,
          instruction,
          existingShapes,
          sessionId: sid,
        });
        parsed = result.parsed;
        modelUsed = result.modelUsed;
        processingMs = result.processingMs;
      } catch (err) {
        if (err.message === 'OPENAI_NOT_CONFIGURED' && !process.env.GEMINI_API_KEY) {
          return res.status(500).json({ error: 'AI service not configured', code: 'AI_NOT_CONFIGURED' });
        }
        console.error('Vision pipeline failed:', err);
        return res.status(502).json({
          error: 'AI temporarily unavailable — try again',
          code: 'BOTH_MODELS_FAILED',
        });
      }

      if (needsClarification(parsed)) {
        sessionCache.set(sid, { parsed, imageBase64 });
        return res.json(buildClarificationResponse(parsed, sid));
      }

      return res.json({
        status: 'complete',
        sessionId: sid,
        diagram: parsed,
        processingMs: processingMs ?? Date.now() - start,
        modelUsed,
      });
    } catch (err) {
      if (err.name === 'ZodError' || err instanceof SyntaxError) {
        console.error('Model parse error:', err);
        return res.status(422).json({
          error: 'Could not read diagram — try a clearer sketch',
          code: 'model_parse_error',
          raw: err.message,
        });
      }
      console.error('Enhance error:', err);
      return res.status(500).json({ error: 'Failed to enhance diagram' });
    }
  });

  app.post('/api/clarify', requireAuth, aiRateLimiter, async (req, res) => {
    try {
      const body = ClarifyBodySchema.parse(req.body);
      const cached = sessionCache.get(body.sessionId);

      if (!cached) {
        return res.status(404).json({
          error: 'Session expired — please enhance again',
          code: 'SESSION_EXPIRED',
        });
      }

      let parsed = applyClarificationAnswer(cached.parsed, body.nodeId, body.answer);

      if (needsClarification(parsed)) {
        sessionCache.set(body.sessionId, { parsed, imageBase64: cached.imageBase64 });
        return res.json(buildClarificationResponse(parsed, body.sessionId));
      }

      sessionCache.del(body.sessionId);
      return res.json({
        status: 'complete',
        sessionId: body.sessionId,
        diagram: parsed,
        modelUsed: 'cached-clarification',
      });
    } catch (err) {
      console.error('Clarify error:', err);
      return res.status(400).json({ error: 'Invalid clarification request' });
    }
  });

  app.post('/api/ask', requireAuth, aiRateLimiter, async (req, res) => {
    try {
      if (!checkAIConfigured(res)) return;

      const { imageBase64, question, conversationHistory = [] } = req.body;
      if (!imageBase64 || !question) {
        return res.status(400).json({ error: 'imageBase64 and question are required' });
      }

      const tokens = await estimateImageTokens(imageBase64);
      if (tokens > 3500) {
        return res.status(413).json({
          error: 'Canvas too complex — select a region first.',
          code: 'IMAGE_TOO_LARGE',
        });
      }

      const safeHistory = (conversationHistory || [])
        .filter((m) => m?.role && m?.content && typeof m.content === 'string')
        .slice(-10)
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const openai = getOpenAI();
      let fullText = '';
      let usedModel = PRIMARY_MODEL;

      const writeDelta = (delta) => {
        fullText += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      };

      const tryOpenAI = async () => {
        const imageUrl = imageBase64.startsWith('data:')
          ? imageBase64
          : `data:image/png;base64,${imageBase64}`;
        const messages = [
          { role: 'system', content: ASK_SYSTEM_PROMPT },
          ...safeHistory,
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
              { type: 'text', text: question },
            ],
          },
        ];
        const stream = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          max_tokens: MAX_TOKENS,
          stream: true,
          messages,
        });
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) writeDelta(delta);
        }
      };

      try {
        if (openai) {
          await tryOpenAI();
        } else {
          throw new Error('OPENAI_NOT_CONFIGURED');
        }
      } catch (openaiErr) {
        console.warn('Ask OpenAI failed, trying Gemini:', openaiErr?.message);
        if (!getGenAI()) throw openaiErr;
        fullText = '';
        usedModel = process.env.FALLBACK_MODEL || 'gemini-2.0-flash';
        for await (const delta of streamAskGemini(imageBase64, question, safeHistory)) {
          writeDelta(delta);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, fullText, modelUsed: usedModel })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const errMsg = err?.message || String(err);
      console.error('Ask error:', errMsg);
      if (!res.headersSent) {
        const isQuota =
          errMsg.includes('429') ||
          errMsg.includes('quota') ||
          errMsg.includes('Too Many Requests');
        return res.status(502).json({
          error: isQuota
            ? 'AI quota exceeded on OpenAI and Gemini — add billing or use a new API key with credits.'
            : errMsg || 'AI temporarily unavailable — try again',
          code: isQuota ? 'AI_QUOTA_EXCEEDED' : 'ASK_FAILED',
        });
      }
      res.end();
    }
  });

  app.post('/api/suggest', requireAuth, (req, res) => {
    try {
      const { diagram, currentLayout } = req.body;
      if (!diagram) return res.status(400).json({ error: 'diagram is required' });
      const result = getLayoutVariations(diagram, currentLayout);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid suggest request' });
    }
  });

  // NLP text-to-diagram: POST /api/chat-to-diagram
  // Proxies to inference-api /nlp-to-diagram, returns { status: 'fallback' } on any failure
  // so the frontend can silently escalate to the streaming /api/ask LLM path.
  app.post('/api/chat-to-diagram', requireAuth, aiRateLimiter, chatToDiagramHandler);

  // Observability: GET /api/admin/ai-stats/raw
  // Returns recent request records from NDJSON log for latency, routing, and error inspection.
  app.get('/api/admin/ai-stats/raw', requireAuth, async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 500);
      const requests = await getRecentAIRequests(limit);
      return res.json({
        status: 'ok',
        count: requests.length,
        requests,
      });
    } catch (err) {
      console.error('[Admin API] Failed to get AI stats:', err);
      return res.status(500).json({ error: 'Failed to retrieve AI stats' });
    }
  });

  // Observability: GET /api/admin/ai-stats/summary
  // Returns aggregated metrics (local vs fallback %, avg latency, estimated savings, fallback reasons).
  app.get('/api/admin/ai-stats/summary', requireAuth, async (req, res) => {
    try {
      const model = req.query?.model || 'gpt-4o';
      const records = await getRecentAIRequests(1000);
      const summary = computeAIStatsSummary(records, model);
      return res.json({
        status: 'ok',
        summary,
      });
    } catch (err) {
      console.error('[Admin API] Failed to compute AI stats summary:', err);
      return res.status(500).json({ error: 'Failed to compute AI stats summary' });
    }
  });

  // Backward compatibility with legacy /api/analyze
  app.post('/api/analyze', requireAuth, aiRateLimiter, async (req, res) => {
    try {
      if (!checkAIConfigured(res)) return;
      const { imageBase64 } = req.body;
      if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

      const result = await analyzeDiagramVision(imageBase64, {});
      const d = result.parsed;
      return res.json({
        type: d.type,
        nodes: d.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          confidence: n.confidence,
        })),
        edges: d.edges.map((e) => ({
          source: e.source,
          target: e.target,
          label: e.label || '',
        })),
      });
    } catch (err) {
      console.error('Legacy analyze error:', err);
      return res.status(500).json({ error: 'Failed to parse diagram' });
    }
  });

  const handleFeedback = async (req, res) => {
    try {
      const {
        action,
        sessionId,
        nodeId,
        correctedLabel,
        correctedType,
        imageBase64,
        hasImage,
        original_prompt,
        generated_diagram,
        corrected_diagram,
      } = req.body;

      if (!action || !sessionId || (!nodeId && !original_prompt)) {
        return res.status(400).json({
          error: 'action, sessionId, and either nodeId or original_prompt are required',
        });
      }

      const dateStr = new Date().toISOString().split('T')[0];

      // 1. If this is an NLP diagram correction, save to ml/datasets/nlp_diagrams/corrections/
      let savedNLP = false;
      if (original_prompt || corrected_diagram) {
        const nlpDir = path.resolve('ml/datasets/nlp_diagrams/corrections');
        fs.mkdirSync(nlpDir, { recursive: true });
        const nlpLogFile = path.join(nlpDir, `${dateStr}_corrections.ndjson`);
        const nlpRecord = {
          timestamp: new Date().toISOString(),
          sessionId,
          action: action || 'correction',
          original_prompt,
          generated_diagram: generated_diagram || null,
          corrected_diagram: corrected_diagram || null,
        };
        fs.appendFileSync(nlpLogFile, JSON.stringify(nlpRecord) + '\n', 'utf8');
        savedNLP = true;
        console.log(`[Feedback API] Saved NLP correction for session ${sessionId}`);
      }

      // 2. Vision/sketch feedback path (when nodeId is provided)
      let savedImage = false;
      if (nodeId) {
        const feedbackDir = path.resolve('ml/datasets/feedback');
        const imagesDir = path.join(feedbackDir, 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        if (imageBase64 && hasImage) {
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const imgPath = path.join(imagesDir, `${sessionId}_${nodeId}.png`);
          fs.writeFileSync(imgPath, buffer);
          savedImage = true;
        }

        const logFile = path.join(feedbackDir, `${dateStr}_feedback.ndjson`);
        const record = {
          timestamp: new Date().toISOString(),
          action,
          sessionId,
          nodeId,
          hasImage: savedImage,
          correctedLabel,
          correctedType,
        };
        fs.appendFileSync(logFile, JSON.stringify(record) + '\n', 'utf8');
        console.log(`[Feedback API] Saved vision correction for session ${sessionId}, node ${nodeId}`);
      }

      return res.json({ status: 'ok', savedImage, savedNLP });
    } catch (err) {
      console.error('Feedback capture failed:', err);
      return res.status(500).json({ error: 'Failed to record feedback' });
    }
  };

  app.post('/api/feedback', requireAuth, aiRateLimiter, handleFeedback);
  app.post('/api/ai/feedback', requireAuth, aiRateLimiter, handleFeedback);
}
