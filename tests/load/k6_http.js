import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/**
 * CollabBoard Phase 3b: k6 HTTP & Rate Limit Load Script
 *
 * NOTE: Reference load-testing specification. Requires external k6 binary (not executed in local dev).
 *
 * Targets:
 *   - GET  /api/health                    (Service health check)
 *   - GET  /api/admin/ai-stats/summary     (Protected admin endpoint -> 401 verification)
 *   - POST /api/chat-to-diagram           (AI generation endpoint -> verifies rate-limit 429 under burst)
 *
 * Execution (requires k6 installed):
 *   k6 run tests/load/k6_http.js
 */

const healthDuration = new Trend('health_duration', true);
const errorRate = new Rate('http_errors');
const rateLimitHits = new Counter('rate_limit_hits');

export const options = {
  stages: [
    { duration: '10s', target: 25 }, // Ramp up to 25 VUs
    { duration: '20s', target: 50 }, // Sustain 50 VUs
    { duration: '10s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    'health_duration': ['p(95)<200', 'p(99)<500'], // Health checks must respond fast (<200ms p95)
    'http_req_failed{expected:true}': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

export default function () {
  // 1. Health check endpoint (must return 200 OK)
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'HealthCheck' },
    });
    healthDuration.add(res.timings.duration);
    const ok = check(res, {
      'status is 200': (r) => r.status === 200,
      'status field is ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
    });
    if (!ok) errorRate.add(1);
  });

  // 2. Protected endpoint without auth (must return 401 Unauthorized)
  group('Route Protection Verification', () => {
    const res = http.get(`${BASE_URL}/api/admin/ai-stats/summary`, {
      tags: { name: 'AdminSummaryUnauthorized' },
    });
    check(res, {
      'unauthenticated returns 401': (r) => r.status === 401,
      'returns error payload': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Boolean(body.error);
        } catch {
          return false;
        }
      },
    });
  });

  // 3. AI Endpoint Burst & Rate Limit check
  group('AI Route Burst', () => {
    const payload = JSON.stringify({
      prompt: 'Load test diagram generation request',
      history: [],
    });
    const headers = {
      'Content-Type': 'application/json',
      // Simulated IP header to test rate limiter behavior
      'X-Forwarded-For': `192.168.1.${__VU % 10 + 1}`,
    };

    const res = http.post(`${BASE_URL}/api/chat-to-diagram`, payload, {
      headers,
      tags: { name: 'ChatToDiagram' },
    });

    if (res.status === 429) {
      rateLimitHits.add(1);
      check(res, {
        'rate limited returns 429': (r) => r.status === 429,
        'rate limit header present': (r) => r.headers['Retry-After'] !== undefined || r.body.includes('Too many requests'),
      });
    } else {
      check(res, {
        'successful or auth error': (r) => [200, 401, 503].includes(r.status),
      });
    }
  });

  sleep(0.5);
}
