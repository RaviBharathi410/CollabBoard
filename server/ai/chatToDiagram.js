/**
 * chatToDiagram.js
 * Express route handler for POST /api/chat-to-diagram
 *
 * Pipeline:
 *   1. Validate request body (text required, diagramTypeHint optional)
 *   2. POST to inference service /nlp-to-diagram
 *   3a. status=ok + nodes present  → return diagram to client (renders on canvas)
 *   3b. status=parse_failed / 503 / network error → return { status: 'fallback' }
 *       The frontend's chatToDiagram() then calls /api/ask instead.
 *
 * This is the same fallback pattern used by vision.js (ONNX → cloud LLM).
 */

import fetch from 'node-fetch';
import { z } from 'zod';
import { logAIRequest } from './requestLogger.js';

// --------------------------------------------------------------------------
// Schema
// --------------------------------------------------------------------------
const ChatToDiagramBodySchema = z.object({
  text: z.string().min(3, 'text must be at least 3 characters').max(2000),
  diagramTypeHint: z
    .enum(['architecture', 'flowchart', 'erd', 'sequence', 'mindmap'])
    .optional()
    .nullable(),
});

// --------------------------------------------------------------------------
// Inference service URL (set via env, same variable used by compose)
// --------------------------------------------------------------------------
function getInferenceUrl() {
  return (
    process.env.INFERENCE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000'
  );
}

const INFERENCE_TIMEOUT_MS = 15_000;

// --------------------------------------------------------------------------
// Dual-Signal Routing Thresholds & Structural Risk Assessment
// --------------------------------------------------------------------------
export function getConfidenceThreshold() {
  return parseFloat(process.env.NLP_CONFIDENCE_THRESHOLD || '0.88');
}

export function getMaxPruneRatio() {
  return parseFloat(process.env.MAX_PRUNE_RATIO || '0.5');
}

/**
 * Evaluates whether post-healing diagram exhibits high structural risk.
 * Prevents returning severely broken or heavily hallucinated graph structures.
 *
 * @param {Object} diagram
 * @param {number} [maxPruneRatio=0.5]
 * @returns {{ isRisky: boolean, reason?: string, pruneRatio: number }}
 */
export function assessStructuralRisk(diagram, maxPruneRatio = getMaxPruneRatio()) {
  if (!diagram || typeof diagram !== 'object') {
    return { isRisky: false, pruneRatio: 0 };
  }

  const healingInfo = diagram.healingInfo;
  if (!healingInfo || !healingInfo.healing_applied) {
    return { isRisky: false, pruneRatio: 0 };
  }

  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
  const prunedEdges = Array.isArray(healingInfo.phantom_edges_pruned)
    ? healingInfo.phantom_edges_pruned
    : [];

  const nodeCount = nodes.length;
  const prunedCount = prunedEdges.length;
  const pruneRatio = nodeCount > 0 ? prunedCount / nodeCount : 0;

  // 1. High phantom prune ratio indicates severe sequence extrapolation / hallucination breakdown
  if (pruneRatio >= maxPruneRatio) {
    return {
      isRisky: true,
      reason: `prune_ratio_${pruneRatio.toFixed(2)}_exceeds_threshold_${maxPruneRatio}`,
      pruneRatio,
    };
  }

  // 2. Multiple nodes generated but zero valid edges remained even after repair
  if (nodeCount > 1 && edges.length === 0) {
    return {
      isRisky: true,
      reason: 'disconnected_multi_node_graph',
      pruneRatio,
    };
  }

  return { isRisky: false, pruneRatio };
}

// --------------------------------------------------------------------------
// Route handler (exported for mounting in routes.js)
// --------------------------------------------------------------------------
export async function chatToDiagramHandler(req, res) {
  const startTime = Date.now();

  // 1. Validate body
  const parseResult = ChatToDiagramBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { text, diagramTypeHint } = parseResult.data;

  // 2. Call inference service
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
    const inferenceRes = await fetch(
      `${getInferenceUrl()}/nlp-to-diagram`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, diagramTypeHint: diagramTypeHint ?? null }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    // 3a. Inference model not trained yet or down → fallback
    if (inferenceRes.status === 503) {
      await logAIRequest({
        prompt_length: text.length,
        prompt_text: text,
        path_taken: 'local_failed_fallback',
        latency_ms: latency,
        node_count: 0,
        edge_count: 0,
        json_valid: false,
        reason: 'nlp_model_unavailable',
      });
      return res.json({ status: 'fallback', reason: 'nlp_model_unavailable' });
    }

    const data = await inferenceRes.json().catch(() => ({}));

    // 3b. Parse failed (model ran but output wasn't valid JSON) → fallback
    if (!inferenceRes.ok || data.status === 'parse_failed' || !data.diagram?.nodes?.length) {
      await logAIRequest({
        prompt_length: text.length,
        prompt_text: text,
        path_taken: 'local_failed_fallback',
        latency_ms: latency,
        node_count: 0,
        edge_count: 0,
        json_valid: false,
        reason: data.reason || 'parse_failed',
      });
      return res.json({ status: 'fallback', reason: 'parse_failed' });
    }

    const nodes = data.diagram.nodes || [];
    const edges = data.diagram.edges || [];
    const confidence =
      typeof data.confidence === 'number'
        ? data.confidence
        : (typeof data.diagram?.confidence === 'number' ? data.diagram.confidence : 0.85);

    // 3c. Signal 1: Check Structural Risk from runtime graph healing (Correctness)
    const structuralAssessment = assessStructuralRisk(data.diagram, getMaxPruneRatio());
    if (structuralAssessment.isRisky) {
      await logAIRequest({
        prompt_length: text.length,
        prompt_text: text,
        path_taken: 'local_low_confidence_fallback',
        latency_ms: latency,
        node_count: nodes.length,
        edge_count: edges.length,
        json_valid: true,
        confidence,
        healing_applied: true,
        reason: 'structural_risk',
      });
      return res.json({
        status: 'fallback',
        reason: 'structural_risk',
        detail: structuralAssessment.reason,
      });
    }

    // 3d. Signal 2: Check Domain Familiarity (sequence token log-prob confidence)
    const confidenceThreshold = getConfidenceThreshold();
    if (confidence < confidenceThreshold) {
      await logAIRequest({
        prompt_length: text.length,
        prompt_text: text,
        path_taken: 'local_low_confidence_fallback',
        latency_ms: latency,
        node_count: nodes.length,
        edge_count: edges.length,
        json_valid: true,
        confidence,
        healing_applied: Boolean(data.diagram?.healingInfo?.healing_applied),
        reason: 'low_confidence',
      });
      return res.json({
        status: 'fallback',
        reason: 'low_confidence',
        confidence,
      });
    }

    // 3e. Healthy path: local generation verified structurally and linguistically
    await logAIRequest({
      prompt_length: text.length,
      prompt_text: text,
      path_taken: 'local',
      latency_ms: latency,
      node_count: nodes.length,
      edge_count: edges.length,
      json_valid: true,
      confidence,
      healing_applied: Boolean(data.diagram?.healingInfo?.healing_applied),
    });

    return res.json({
      status: 'ok',
      diagram: data.diagram,
      modelUsed: data.modelUsed ?? 'flan-t5-fine-tuned',
      confidence,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';

    if (err.name === 'AbortError') {
      console.warn('[chatToDiagram] Inference timeout — falling back to LLM');
    } else {
      console.warn('[chatToDiagram] Inference error — falling back to LLM:', err.message);
    }

    await logAIRequest({
      prompt_length: text.length,
      prompt_text: text,
      path_taken: 'local_failed_fallback',
      latency_ms: latency,
      node_count: 0,
      edge_count: 0,
      json_valid: false,
      reason,
    });

    // Network failure / timeout → always fall back, never crash the request
    return res.json({ status: 'fallback', reason: 'network_error' });
  }
}
