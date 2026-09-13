import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordRequest,
  getMetricsSummary,
  resetMetricsForTesting,
  errorMonitorMiddleware,
} from './errorMonitor.js';

describe('errorMonitor.js - Production Error & Fallback Anomaly Monitoring', () => {
  beforeEach(() => {
    resetMetricsForTesting();
  });

  it('records healthy 2xx and client 4xx requests without emitting alerts', () => {
    // 10 healthy requests
    for (let i = 0; i < 10; i++) {
      recordRequest(200, false, false);
    }
    // 1 client error
    recordRequest(404, false, false);

    const summary = getMetricsSummary();
    expect(summary.requests.total).toBe(11);
    expect(summary.requests.success_2xx).toBe(10);
    expect(summary.requests.client_error_4xx).toBe(1);
    expect(summary.requests.server_error_5xx).toBe(0);
    expect(summary.system_health).toBe('HEALTHY');
    expect(summary.activeAlerts).toHaveLength(0);
  });

  it('triggers a SEVERITY: HIGH alert when 5xx server error rate exceeds 5%', () => {
    // 8 healthy requests
    for (let i = 0; i < 8; i++) {
      recordRequest(200, false, false);
    }
    // 2 server 500 errors (2/10 = 20% > 5% threshold)
    recordRequest(500, false, false);
    recordRequest(500, false, false);

    const summary = getMetricsSummary();
    expect(summary.requests.total).toBe(10);
    expect(summary.requests.server_error_5xx).toBe(2);
    expect(summary.requests.error_rate_5xx).toBe(0.2);
    expect(summary.system_health).toBe('DEGRADED');
    expect(summary.activeAlerts).toHaveLength(1);
    expect(summary.activeAlerts[0]).toContain('SEVERITY: HIGH');
    expect(summary.activeAlerts[0]).toContain('5xx error rate is 20.0%');
  });

  it('triggers a SEVERITY: HIGH alert when AI fallback rate exceeds 30%', () => {
    // 3 healthy local AI requests
    for (let i = 0; i < 3; i++) {
      recordRequest(200, false, true);
    }
    // 2 fallback AI requests (2/5 = 40% > 30% threshold)
    recordRequest(200, true, true);
    recordRequest(200, true, true);

    const summary = getMetricsSummary();
    expect(summary.ai.total_requests).toBe(5);
    expect(summary.ai.fallbacks).toBe(2);
    expect(summary.ai.fallback_rate).toBe(0.4);
    expect(summary.system_health).toBe('DEGRADED');
    expect(summary.activeAlerts).toHaveLength(1);
    expect(summary.activeAlerts[0]).toContain('SEVERITY: HIGH');
    expect(summary.activeAlerts[0]).toContain('AI Fallback rate spiked to 40.0%');
  });

  it('middleware intercepts AI fallback responses correctly', () => {
    const req = { path: '/api/chat-to-diagram' };
    let finishCallback;
    const res = {
      statusCode: 200,
      json(data) {
        return data;
      },
      on(event, cb) {
        if (event === 'finish') finishCallback = cb;
      },
    };
    const next = () => {};

    errorMonitorMiddleware(req, res, next);

    // Simulate returning fallback JSON body
    res.json({ status: 'fallback', reason: 'structural_risk' });
    finishCallback();

    const summary = getMetricsSummary();
    expect(summary.requests.total).toBe(1);
    expect(summary.ai.total_requests).toBe(1);
    expect(summary.ai.fallbacks).toBe(1);
  });
});
