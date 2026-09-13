import rateLimit from 'express-rate-limit';
import { logAIRequest } from './requestLogger.js';

export function getAIRateLimits() {
  const userLimit = parseInt(process.env.AI_RATE_LIMIT_PER_HOUR || '20', 10);
  const ipLimit = parseInt(process.env.AI_RATE_LIMIT_IP_PER_HOUR || '5', 10);
  return { userLimit, ipLimit };
}

export function createAIRateLimiter(options = {}) {
  const { userLimit: defaultUserLimit, ipLimit: defaultIpLimit } = getAIRateLimits();
  const userLimit = options.userLimit ?? defaultUserLimit;
  const ipLimit = options.ipLimit ?? defaultIpLimit;
  const windowMs = options.windowMs || 60 * 60 * 1000; // 1 hour

  const { userLimit: _u, ipLimit: _i, ...rateLimitOptions } = options;

  return rateLimit({
    windowMs,
    limit: (req) => (req.user?.uid ? userLimit : ipLimit),
    keyGenerator: (req) => {
      if (req.user?.uid) {
        return `user:${req.user.uid}`;
      }
      return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    },
    validate: {
      keyGeneratorIpFallback: false,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      const isUser = Boolean(req.user?.uid);
      const limit = isUser ? userLimit : ipLimit;
      const identifier = req.user?.uid ? `user ${req.user.uid}` : `IP ${req.ip}`;

      console.warn(`[RATE LIMIT] AI request quota exceeded for ${identifier} (${limit}/hr)`);

      try {
        await logAIRequest({
          timestamp: new Date().toISOString(),
          endpoint: req.originalUrl || req.path,
          path_taken: 'rate_limited',
          latency_ms: 0,
          reason: 'rate_limit_exceeded',
          prompt_length: req.body?.prompt?.length || req.body?.question?.length || 0,
          json_valid: false,
          user_id: req.user?.uid || null,
        });
      } catch (err) {
        console.error('[RATE LIMIT] Failed to log rate-limited request:', err);
      }

      return res.status(429).json({
        error: `AI request limit exceeded. Maximum ${limit} requests per hour.`,
        code: 'RATE_LIMIT_EXCEEDED',
        limit,
        windowMs,
      });
    },
    ...rateLimitOptions,
  });
}

export const aiRateLimiter = createAIRateLimiter();
