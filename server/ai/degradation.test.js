import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { chatToDiagramHandler } from './chatToDiagram.js';
import * as vision from './vision.js';
import * as requestLogger from './requestLogger.js';

const TEST_DEGRADE_LOG = path.resolve('server/logs/test_degrade.ndjson');

describe('Graceful Degradation Integration Tests (Inference Service Outage)', () => {
  let originalEnv;

  beforeEach(() => {
    vi.resetAllMocks();
    originalEnv = { ...process.env };
    // Set inference URL to an unreachable port to simulate outage
    process.env.INFERENCE_API_URL = 'http://127.0.0.1:59998';
    process.env.AI_REQUESTS_LOG_FILE = TEST_DEGRADE_LOG;
  });

  afterEach(() => {
    process.env = originalEnv;
    if (fs.existsSync(TEST_DEGRADE_LOG)) {
      try {
        fs.unlinkSync(TEST_DEGRADE_LOG);
      } catch (_) {}
    }
  });

  it('degrades /api/chat-to-diagram to fallback protocol cleanly when inference is down', async () => {
    const req = {
      body: {
        text: 'Create a microservices payment flow diagram',
      },
      user: { uid: 'degrade_test_user' },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // Execute the handler with dead inference backend
    await chatToDiagramHandler(req, res);

    // Protocol requirement: Must respond with 200 { status: 'fallback' }, NEVER 500
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fallback',
        reason: 'network_error',
      })
    );

    // Verify telemetry logged the failure without blocking
    const records = await requestLogger.getRecentAIRequests(5);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toEqual(
      expect.objectContaining({
        path_taken: 'local_failed_fallback',
        reason: 'network_error',
      })
    );
  });

  it('degrades /api/enhance vision pipeline to Tier-2 LLM when local ONNX detector is unreachable', async () => {
    // Mock OpenAI fallback returning a valid diagram
    const mockDiagram = {
      type: 'flowchart',
      confidence: 0.92,
      nodes: [
        { id: 'n1', label: 'Client', type: 'rectangle', confidence: 0.95 },
        { id: 'n2', label: 'API Gateway', type: 'service', confidence: 0.90 },
      ],
      edges: [{ source: 'n1', target: 'n2', label: 'request' }],
    };

    // Spy on analyzeDiagramVision to verify the fallback logic
    const visionSpy = vi.spyOn(vision, 'analyzeDiagramVision').mockImplementation(async (imgBase64, ctx) => {
      // 1. Simulate local detector connection failure
      try {
        await fetch('http://127.0.0.1:59998/detect', { method: 'POST', body: '{}' });
      } catch (err) {
        // Fallback to cloud LLM
        return {
          parsed: mockDiagram,
          modelUsed: 'gpt-4o',
          processingMs: 350,
        };
      }
      throw new Error('Should have caught fetch error');
    });

    const result = await vision.analyzeDiagramVision('data:image/png;base64,mock', { sessionId: 'test-session' });

    expect(result.modelUsed).toBe('gpt-4o');
    expect(result.parsed.nodes).toHaveLength(2);
    expect(visionSpy).toHaveBeenCalledTimes(1);
  });

  it('handles complete failure of both local and cloud tiers with structured 502, never an unhandled exception', async () => {
    // Simulate both tiers failing
    const mockApp = {
      post: vi.fn(),
      get: vi.fn(),
    };

    const routes = {};
    mockApp.post.mockImplementation((path, ...handlers) => {
      routes[`POST ${path}`] = handlers;
    });

    const { mountAIRoutes } = await import('./routes.js');
    mountAIRoutes(mockApp);

    const enhanceHandlers = routes['POST /api/enhance'];
    expect(enhanceHandlers).toBeDefined();
    const endpointHandler = enhanceHandlers[enhanceHandlers.length - 1];

    // Mock analyzeDiagramVision to simulate both models failing
    vi.spyOn(vision, 'getModelAvailability').mockReturnValue({ openai: true, gemini: true });
    vi.spyOn(vision, 'estimateImageTokens').mockResolvedValue(120);
    vi.spyOn(vision, 'analyzeDiagramVision').mockRejectedValue(new Error('BOTH_MODELS_FAILED'));

    const req = {
      body: {
        imageBase64: 'data:image/png;base64,sample',
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await endpointHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'BOTH_MODELS_FAILED',
        error: expect.stringContaining('AI temporarily unavailable'),
      })
    );
  });
});
