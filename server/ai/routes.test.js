import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import admin from 'firebase-admin';
import { requireAuth } from './routes.js';

// Mock firebase-admin auth services
vi.mock('firebase-admin', () => {
  const mockAuth = {
    verifyIdToken: vi.fn(),
  };
  return {
    default: {
      apps: [{ name: '[DEFAULT]' }],
      auth: () => mockAuth,
    },
  };
});

describe('routes.js:requireAuth middleware', () => {
  let req, res, next;
  let originalEnv;

  beforeEach(() => {
    vi.resetAllMocks();
    originalEnv = { ...process.env };
    
    // Default request mock
    req = {
      headers: {},
    };
    
    // Default response mock
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    
    next = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should bypass auth check in dev when ALLOW_UNAUTHENTICATED is true', async () => {
    process.env.ALLOW_UNAUTHENTICATED = 'true';
    process.env.NODE_ENV = 'development';

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should NOT bypass auth check in production even if ALLOW_UNAUTHENTICATED is true', async () => {
    process.env.ALLOW_UNAUTHENTICATED = 'true';
    process.env.NODE_ENV = 'production';

    // Mock verifyIdToken to fail to simulate token check occurring
    admin.auth().verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 when no Authorization header is provided', async () => {
    process.env.ALLOW_UNAUTHENTICATED = 'false';
    process.env.NODE_ENV = 'production';

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('No token provided'),
    }));
  });

  it('should return 401 when invalid Authorization header is provided', async () => {
    process.env.ALLOW_UNAUTHENTICATED = 'false';
    req.headers.authorization = 'InvalidPrefix token123';

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should call next() and assign req.user on valid token', async () => {
    process.env.ALLOW_UNAUTHENTICATED = 'false';
    req.headers.authorization = 'Bearer validToken123';
    
    const mockUser = { uid: 'user_123', email: 'test@example.com' };
    admin.auth().verifyIdToken.mockResolvedValue(mockUser);

    await requireAuth(req, res, next);

    expect(admin.auth().verifyIdToken).toHaveBeenCalledWith('validToken123');
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('routes.js:GET /api/admin/ai-stats/raw', () => {
  it('registers endpoint and returns recent requests from logger', async () => {
    const routes = {};
    const mockApp = {
      get: (path, ...handlers) => { routes[`GET ${path}`] = handlers; },
      post: (path, ...handlers) => { routes[`POST ${path}`] = handlers; },
    };

    const { mountAIRoutes } = await import('./routes.js');
    const requestLogger = await import('./requestLogger.js');

    mountAIRoutes(mockApp);

    const handlers = routes['GET /api/admin/ai-stats/raw'];
    expect(handlers).toBeDefined();
    const endpointHandler = handlers[handlers.length - 1];

    vi.spyOn(requestLogger, 'getRecentAIRequests').mockResolvedValueOnce([
      { path_taken: 'local', latency_ms: 150, prompt_length: 45, json_valid: true }
    ]);

    const req = { query: { limit: '25' } };
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    await endpointHandler(req, res);

    expect(requestLogger.getRecentAIRequests).toHaveBeenCalledWith(25);
    expect(res.json).toHaveBeenCalledWith({
      status: 'ok',
      count: 1,
      requests: [expect.objectContaining({ path_taken: 'local', latency_ms: 150 })],
    });
  });

  it('registers summary endpoint and returns aggregated metrics', async () => {
    const routes = {};
    const mockApp = {
      get: (path, ...handlers) => { routes[`GET ${path}`] = handlers; },
      post: (path, ...handlers) => { routes[`POST ${path}`] = handlers; },
    };

    const { mountAIRoutes } = await import('./routes.js');
    const requestLogger = await import('./requestLogger.js');

    mountAIRoutes(mockApp);

    const handlers = routes['GET /api/admin/ai-stats/summary'];
    expect(handlers).toBeDefined();
    const endpointHandler = handlers[handlers.length - 1];

    vi.spyOn(requestLogger, 'getRecentAIRequests').mockResolvedValueOnce([
      { path_taken: 'local', latency_ms: 120, healing_applied: false },
      { path_taken: 'local_low_confidence_fallback', latency_ms: 400, reason: 'low_confidence', healing_applied: false },
    ]);

    const req = {};
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    await endpointHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      summary: expect.objectContaining({
        total_requests: 2,
        local_count: 1,
        fallback_count: 1,
        local_rate_pct: 50.0,
      }),
    }));
  });
});

describe('routes.js:server-side auth enforcement & 401 audits', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_UNAUTHENTICATED = 'false';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('verifies requireAuth is mounted on every admin and AI route', async () => {
    const routes = {};
    const mockApp = {
      get: (path, ...handlers) => { routes[`GET ${path}`] = handlers; },
      post: (path, ...handlers) => { routes[`POST ${path}`] = handlers; },
    };

    const { mountAIRoutes, requireAuth } = await import('./routes.js');
    mountAIRoutes(mockApp);

    const protectedEndpoints = [
      'GET /api/admin/ai-stats/raw',
      'GET /api/admin/ai-stats/summary',
      'POST /api/chat-to-diagram',
      'POST /api/enhance',
      'POST /api/ask',
      'POST /api/clarify',
      'POST /api/suggest',
      'POST /api/feedback',
      'POST /api/analyze',
    ];

    for (const endpoint of protectedEndpoints) {
      const handlers = routes[endpoint];
      expect(handlers, `Endpoint ${endpoint} must be registered`).toBeDefined();
      expect(handlers).toContain(requireAuth);
    }
  });

  it('rejects unauthenticated requests to admin raw stats with 401', async () => {
    const { requireAuth } = await import('./routes.js');
    const req = { headers: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('No token provided'),
      })
    );
  });

  it('rejects unauthenticated requests to admin summary stats with 401', async () => {
    const { requireAuth } = await import('./routes.js');
    const req = { headers: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects unauthenticated requests to /api/chat-to-diagram with 401', async () => {
    const { requireAuth } = await import('./routes.js');
    const req = { headers: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('verifies aiRateLimiter is mounted on all AI and mutating endpoints', async () => {
    const routes = {};
    const mockApp = {
      get: (path, ...handlers) => { routes[`GET ${path}`] = handlers; },
      post: (path, ...handlers) => { routes[`POST ${path}`] = handlers; },
    };

    const { mountAIRoutes } = await import('./routes.js');
    const { aiRateLimiter } = await import('./rateLimiter.js');
    mountAIRoutes(mockApp);

    const rateLimitedEndpoints = [
      'POST /api/chat-to-diagram',
      'POST /api/enhance',
      'POST /api/ask',
      'POST /api/analyze',
      'POST /api/clarify',
      'POST /api/feedback',
    ];

    for (const endpoint of rateLimitedEndpoints) {
      const handlers = routes[endpoint];
      expect(handlers, `Endpoint ${endpoint} must be registered`).toBeDefined();
      expect(handlers).toContain(aiRateLimiter);
    }
  });

  it('verifies Firebase Admin verifyIdToken rejects invalid or expired tokens with 401', async () => {
    const { requireAuth } = await import('./routes.js');
    admin.auth().verifyIdToken.mockRejectedValueOnce(new Error('Firebase ID token has expired'));

    const req = { headers: { authorization: 'Bearer expired.firebase.token' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(admin.auth().verifyIdToken).toHaveBeenCalledWith('expired.firebase.token');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Unauthorized: Invalid token',
    }));
  });

  it('verifies Firebase Admin verifyIdToken allows valid tokens and assigns req.user', async () => {
    const { requireAuth } = await import('./routes.js');
    const verifiedUser = { uid: 'user_production_456', email: 'alice@collabboard.io' };
    admin.auth().verifyIdToken.mockResolvedValueOnce(verifiedUser);

    const req = { headers: { authorization: 'Bearer valid.jwt.token' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(admin.auth().verifyIdToken).toHaveBeenCalledWith('valid.jwt.token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(verifiedUser);
    expect(res.status).not.toHaveBeenCalled();
  });
});

