/**
 * chatToDiagram.test.js
 * Unit tests for POST /api/chat-to-diagram handler
 *
 * Coverage:
 *  1. Happy path — inference returns valid diagram → 200 with diagram
 *  2. inference returns parse_failed → 200 with { status: 'fallback' }
 *  3. inference returns 503 (model not loaded) → 200 with { status: 'fallback' }
 *  4. inference network error (service down) → 200 with { status: 'fallback' }
 *  5. Missing/invalid body → 400 validation error
 *  6. Diagram with no nodes → fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mock node-fetch so we control inference responses --------------------
vi.mock('node-fetch', () => ({ default: vi.fn() }));

import path from 'path';
import { fileURLToPath } from 'url';
import fetchMock from 'node-fetch';
import {
  chatToDiagramHandler,
  assessStructuralRisk,
  getConfidenceThreshold,
  getMaxPruneRatio,
} from './chatToDiagram.js';
import { getRecentAIRequests, clearAIRequestsForTesting } from './requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_LOG_FILE = path.resolve(__dirname, '../logs/ai_requests_chat_test.ndjson');

const VALID_DIAGRAM = {
  status: 'ok',
  modelUsed: 'flan-t5-fine-tuned',
  confidence: 0.93,
  diagram: {
    type: 'architecture',
    confidence: 0.93,
    nodes: [
      { id: 'n1', type: 'rectangle', label: 'API Gateway', confidence: 0.95 },
      { id: 'n2', type: 'database', label: 'PostgreSQL', confidence: 0.94 },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: '', style: 'solid' }],
    layoutHint: 'hierarchical',
    ambiguities: [],
  },
};

function mockFetch(status, body) {
  fetchMock.mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

function mockFetchNetworkError() {
  fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
}

function createMocks(body = {}) {
  const req = {
    body,
    headers: {},
  };
  const res = {
    statusCode: 200,
    body: null,
    status: vi.fn().mockImplementation(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (data) {
      this.body = data;
      return this;
    }),
  };
  return { req, res };
}

describe('chatToDiagramHandler', () => {
  let originalEnv;

  beforeEach(async () => {
    vi.resetAllMocks();
    originalEnv = { ...process.env };
    process.env.INFERENCE_API_URL = 'http://localhost:8000';
    process.env.AI_REQUESTS_LOG_FILE = TEST_LOG_FILE;
    await clearAIRequestsForTesting();
  });

  afterEach(async () => {
    await clearAIRequestsForTesting();
    process.env = originalEnv;
  });

  // ---- 1. Happy path -------------------------------------------------------
  it('returns 200 with diagram when inference succeeds and logs local path', async () => {
    mockFetch(200, VALID_DIAGRAM);

    const { req, res } = createMocks({ text: 'microservices with API Gateway and Postgres' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('ok');
    expect(res.body.diagram.nodes).toHaveLength(2);
    expect(res.body.modelUsed).toBe('flan-t5-fine-tuned');

    // Observability record
    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local');
    expect(logs[0].json_valid).toBe(true);
    expect(logs[0].node_count).toBe(2);
    expect(logs[0].edge_count).toBe(1);
    expect(logs[0].prompt_length).toBe('microservices with API Gateway and Postgres'.length);
  });

  // ---- 2. parse_failed → fallback -----------------------------------------
  it('returns fallback when inference returns parse_failed status and logs fallback path', async () => {
    mockFetch(200, { status: 'parse_failed', diagram: {}, modelUsed: 'flan-t5-fine-tuned', confidence: 0 });

    const { req, res } = createMocks({ text: 'what does an API gateway do?' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
    expect(res.body.reason).toBe('parse_failed');

    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local_failed_fallback');
    expect(logs[0].json_valid).toBe(false);
    expect(logs[0].reason).toBe('parse_failed');
  });

  // ---- 3. 503 inference service not loaded → fallback ----------------------
  it('returns fallback when inference service returns 503 and logs unavailable reason', async () => {
    mockFetch(503, { detail: 'NLP model not loaded' });

    const { req, res } = createMocks({ text: 'design an auth service with Redis and Postgres' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
    expect(res.body.reason).toBe('nlp_model_unavailable');

    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local_failed_fallback');
    expect(logs[0].json_valid).toBe(false);
    expect(logs[0].reason).toBe('nlp_model_unavailable');
  });

  // ---- 4. Network error → fallback ----------------------------------------
  it('returns fallback when inference service is unreachable and logs network_error', async () => {
    mockFetchNetworkError();

    const { req, res } = createMocks({ text: 'draw a flowchart for user sign up' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
    expect(res.body.reason).toBe('network_error');

    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local_failed_fallback');
    expect(logs[0].json_valid).toBe(false);
    expect(logs[0].reason).toBe('network_error');
  });

  // ---- 5. Missing body → 400 -----------------------------------------------
  it('returns 400 when text field is missing', async () => {
    const { req, res } = createMocks({});
    await chatToDiagramHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 when text is too short', async () => {
    const { req, res } = createMocks({ text: 'hi' });
    await chatToDiagramHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('Invalid request');
  });

  // ---- 6. Diagram with no nodes → fallback ---------------------------------
  it('returns fallback when inference diagram has no nodes', async () => {
    mockFetch(200, {
      status: 'ok',
      diagram: { type: 'architecture', nodes: [], edges: [] },
      modelUsed: 'flan-t5-fine-tuned',
      confidence: 0.1,
    });

    const { req, res } = createMocks({ text: 'some ambiguous short description' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
  });

  // ---- 7. Signal 1: High Structural Risk → local_low_confidence_fallback ---
  it('falls back with structural_risk when phantom prune ratio exceeds MAX_PRUNE_RATIO', async () => {
    mockFetch(200, {
      status: 'ok',
      modelUsed: 'flan-t5-fine-tuned',
      confidence: 0.96, // high token confidence, but structurally damaged
      diagram: {
        type: 'flowchart',
        confidence: 0.96,
        nodes: [
          { id: 'n1', type: 'rectangle', label: 'Start' },
          { id: 'n2', type: 'rectangle', label: 'Process' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        healingInfo: {
          healing_applied: true,
          phantom_edges_pruned: ['n2->n3'], // 1 prune / 2 nodes = 0.50 >= 0.50 threshold
          orphan_nodes_healed: [],
        },
      },
    });

    const { req, res } = createMocks({ text: 'build a flowchart process' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
    expect(res.body.reason).toBe('structural_risk');
    expect(res.body.detail).toContain('prune_ratio_0.50_exceeds_threshold_0.5');

    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local_low_confidence_fallback');
    expect(logs[0].json_valid).toBe(true);
    expect(logs[0].healing_applied).toBe(true);
    expect(logs[0].reason).toBe('structural_risk');
  });

  it('allows safe, minor healing to pass through to ok status', async () => {
    mockFetch(200, {
      status: 'ok',
      modelUsed: 'flan-t5-fine-tuned',
      confidence: 0.95,
      diagram: {
        type: 'architecture',
        confidence: 0.95,
        nodes: [
          { id: 'n1', type: 'rectangle', label: 'Client' },
          { id: 'n2', type: 'rectangle', label: 'Gateway' },
          { id: 'n3', type: 'rectangle', label: 'Service' },
          { id: 'n4', type: 'database', label: 'DB' },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n3', target: 'n4' },
        ],
        healingInfo: {
          healing_applied: true,
          phantom_edges_pruned: ['n4->n5'], // 1 prune / 4 nodes = 0.25 < 0.50 safe limit
          orphan_nodes_healed: [],
        },
      },
    });

    const { req, res } = createMocks({ text: 'create standard 4 tier architecture' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('ok');
    expect(res.body.diagram.nodes).toHaveLength(4);

    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local');
    expect(logs[0].healing_applied).toBe(true);
  });

  // ---- 8. Signal 2: Domain Familiarity (Sequence Confidence) Fallback ------
  it('falls back with low_confidence when token confidence is below threshold', async () => {
    mockFetch(200, {
      status: 'ok',
      modelUsed: 'flan-t5-fine-tuned',
      confidence: 0.82, // Below default 0.88
      diagram: {
        type: 'mindmap',
        confidence: 0.82,
        nodes: [{ id: 'n1', type: 'circle', label: 'Casual thoughts' }],
        edges: [],
        healingInfo: { healing_applied: false },
      },
    });

    const { req, res } = createMocks({ text: 'idk maybe just brainstorm something casual' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
    expect(res.body.reason).toBe('low_confidence');
    expect(res.body.confidence).toBe(0.82);

    const logs = await getRecentAIRequests(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].path_taken).toBe('local_low_confidence_fallback');
    expect(logs[0].reason).toBe('low_confidence');
    expect(logs[0].confidence).toBe(0.82);
  });

  it('respects NLP_CONFIDENCE_THRESHOLD environment variable override', async () => {
    process.env.NLP_CONFIDENCE_THRESHOLD = '0.96'; // Strictly require 0.96+

    mockFetch(200, {
      status: 'ok',
      modelUsed: 'flan-t5-fine-tuned',
      confidence: 0.93, // 0.93 is normally valid, but under strict 0.96 falls back
      diagram: {
        type: 'architecture',
        confidence: 0.93,
        nodes: [{ id: 'n1', type: 'rectangle', label: 'Auth' }],
        edges: [],
      },
    });

    const { req, res } = createMocks({ text: 'draw auth service architecture' });
    await chatToDiagramHandler(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.body.status).toBe('fallback');
    expect(res.body.reason).toBe('low_confidence');
  });
});

describe('assessStructuralRisk unit tests', () => {
  it('returns not risky when diagram is null, empty, or has no healing info', () => {
    expect(assessStructuralRisk(null)).toEqual({ isRisky: false, pruneRatio: 0 });
    expect(assessStructuralRisk({})).toEqual({ isRisky: false, pruneRatio: 0 });
    expect(assessStructuralRisk({ healingInfo: { healing_applied: false } })).toEqual({
      isRisky: false,
      pruneRatio: 0,
    });
  });

  it('flags risk when prune ratio is greater than or equal to maxPruneRatio', () => {
    const diagram = {
      nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      healingInfo: {
        healing_applied: true,
        phantom_edges_pruned: ['n3->n4', 'n4->n5'], // 2 / 3 = 0.67 >= 0.50
      },
    };
    const result = assessStructuralRisk(diagram, 0.5);
    expect(result.isRisky).toBe(true);
    expect(result.pruneRatio).toBeCloseTo(0.666, 2);
    expect(result.reason).toContain('prune_ratio_0.67_exceeds_threshold_0.5');
  });

  it('allows healing when prune ratio is below maxPruneRatio', () => {
    const diagram = {
      nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }, { id: 'n4' }, { id: 'n5' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      healingInfo: {
        healing_applied: true,
        phantom_edges_pruned: ['n5->n6'], // 1 / 5 = 0.20 < 0.50
      },
    };
    const result = assessStructuralRisk(diagram, 0.5);
    expect(result.isRisky).toBe(false);
    expect(result.pruneRatio).toBe(0.2);
  });

  it('flags risk when multi-node diagram has zero edges after healing', () => {
    const diagram = {
      nodes: [{ id: 'n1' }, { id: 'n2' }],
      edges: [],
      healingInfo: {
        healing_applied: true,
        phantom_edges_pruned: ['n1->phantom'],
      },
    };
    const result = assessStructuralRisk(diagram, 0.8);
    expect(result.isRisky).toBe(true);
    expect(result.reason).toBe('disconnected_multi_node_graph');
  });
});
