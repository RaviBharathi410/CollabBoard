import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAIRateLimiter } from './rateLimiter.js';
import * as requestLogger from './requestLogger.js';

describe('server/ai/rateLimiter.js', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows requests within limit and passes to next middleware', async () => {
    const limiter = createAIRateLimiter({ userLimit: 2, windowMs: 60000 });
    const logSpy = vi.spyOn(requestLogger, 'logAIRequest').mockResolvedValue(true);

    const req = {
      user: { uid: 'test-user-1' },
      ip: '127.0.0.1',
      originalUrl: '/api/chat-to-diagram',
      body: { prompt: 'Draw a flowchart' },
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    // Request 1
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Request 2
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('rejects requests exceeding user limit with 429 and logs rate_limited event', async () => {
    const limiter = createAIRateLimiter({ userLimit: 1, windowMs: 60000 });
    const logSpy = vi.spyOn(requestLogger, 'logAIRequest').mockResolvedValue(true);

    const req = {
      user: { uid: 'rate-limited-user' },
      ip: '127.0.0.1',
      originalUrl: '/api/chat-to-diagram',
      body: { prompt: 'Over limit prompt' },
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    // Request 1 - should pass
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Request 2 - should be blocked with 429
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1); // Not called again
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
        error: expect.stringContaining('AI request limit exceeded'),
        limit: 1,
      })
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path_taken: 'rate_limited',
        reason: 'rate_limit_exceeded',
        user_id: 'rate-limited-user',
      })
    );
  });

  it('applies stricter IP fallback limit for unauthenticated requests', async () => {
    const limiter = createAIRateLimiter({ userLimit: 10, ipLimit: 1, windowMs: 60000 });
    vi.spyOn(requestLogger, 'logAIRequest').mockResolvedValue(true);

    const req = {
      user: null,
      ip: '192.168.1.100',
      originalUrl: '/api/enhance',
      body: {},
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    // Request 1: passes
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Request 2: blocked
    await limiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
