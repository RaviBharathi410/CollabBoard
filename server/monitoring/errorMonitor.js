/**
 * errorMonitor.js
 * Lightweight, zero-dependency production error and anomaly monitoring.
 *
 * Tracks requests in sliding 5-minute windows and flags high-severity alerts:
 *   1. 5xx Error Spike Alert: Triggers when 5xx errors exceed 5% of total requests.
 *   2. AI Fallback Spike Alert: Triggers when AI fallbacks exceed 30% of AI requests
 *      (earliest operational indicator of local ML inference model failure).
 */

const WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const MIN_REQUESTS_FOR_ALERT = 5;
const ERROR_5XX_THRESHOLD = 0.05; // 5%
const AI_FALLBACK_THRESHOLD = 0.30; // 30%

// In-memory sliding window event store
let requestEvents = [];
let aiFallbackEvents = [];
let aiTotalEvents = [];
const startTime = Date.now();

/**
 * Prunes events older than the sliding window.
 */
function pruneOldEvents(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  requestEvents = requestEvents.filter((e) => e.timestamp >= cutoff);
  aiFallbackEvents = aiFallbackEvents.filter((e) => e.timestamp >= cutoff);
  aiTotalEvents = aiTotalEvents.filter((e) => e.timestamp >= cutoff);
}

/**
 * Records a completed HTTP request event.
 */
export function recordRequest(status, isAIFallback = false, isAIRoute = false) {
  const now = Date.now();
  requestEvents.push({ timestamp: now, status });

  if (isAIRoute) {
    aiTotalEvents.push({ timestamp: now });
    if (isAIFallback) {
      aiFallbackEvents.push({ timestamp: now });
    }
  }

  pruneOldEvents(now);
  checkAndEmitAlerts();
}

/**
 * Checks sliding window statistics and emits alerts if thresholds are breached.
 */
function checkAndEmitAlerts() {
  const summary = getMetricsSummary();

  if (summary.activeAlerts.length > 0) {
    for (const alert of summary.activeAlerts) {
      console.warn(`[MONITOR ALERT] ${alert}`);
    }
  }
}

/**
 * Returns aggregated metrics and active alert status.
 */
export function getMetricsSummary() {
  pruneOldEvents();

  const total = requestEvents.length;
  const count5xx = requestEvents.filter((e) => e.status >= 500).length;
  const count4xx = requestEvents.filter((e) => e.status >= 400 && e.status < 500).length;
  const count2xx = requestEvents.filter((e) => e.status >= 200 && e.status < 300).length;

  const totalAI = aiTotalEvents.length;
  const fallbacksAI = aiFallbackEvents.length;

  const errorRate5xx = total > 0 ? count5xx / total : 0.0;
  const fallbackRateAI = totalAI > 0 ? fallbacksAI / totalAI : 0.0;

  const activeAlerts = [];

  // Check 5xx Error Spike Alert
  if (total >= MIN_REQUESTS_FOR_ALERT && errorRate5xx > ERROR_5XX_THRESHOLD) {
    activeAlerts.push(
      `SEVERITY: HIGH - 5xx error rate is ${(errorRate5xx * 100).toFixed(1)}% ` +
        `(${count5xx}/${total} requests in last 5m, threshold: ${ERROR_5XX_THRESHOLD * 100}%)`
    );
  }

  // Check AI Fallback Spike Alert
  if (totalAI >= MIN_REQUESTS_FOR_ALERT && fallbackRateAI > AI_FALLBACK_THRESHOLD) {
    activeAlerts.push(
      `SEVERITY: HIGH - AI Fallback rate spiked to ${(fallbackRateAI * 100).toFixed(1)}% ` +
        `(${fallbacksAI}/${totalAI} AI requests in last 5m, threshold: ${AI_FALLBACK_THRESHOLD * 100}%)`
    );
  }

  return {
    uptime_seconds: Math.round((Date.now() - startTime) / 1000),
    window_minutes: 5,
    requests: {
      total,
      success_2xx: count2xx,
      client_error_4xx: count4xx,
      server_error_5xx: count5xx,
      error_rate_5xx: Math.round(errorRate5xx * 1000) / 1000,
    },
    ai: {
      total_requests: totalAI,
      fallbacks: fallbacksAI,
      fallback_rate: Math.round(fallbackRateAI * 1000) / 1000,
    },
    system_health: activeAlerts.length === 0 ? 'HEALTHY' : 'DEGRADED',
    activeAlerts,
  };
}

/**
 * Express middleware to intercept and record response status & AI fallbacks.
 */
export function errorMonitorMiddleware(req, res, next) {
  const isAIRoute = req.path.startsWith('/api/') && [
    '/api/chat-to-diagram',
    '/api/enhance',
    '/api/ask',
    '/api/analyze',
    '/api/clarify',
    '/api/suggest',
  ].some((r) => req.path.startsWith(r));

  let isFallback = false;

  // Intercept res.json to inspect for fallback status on AI routes
  if (isAIRoute) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && (body.status === 'fallback' || body.fallback === true)) {
        isFallback = true;
      }
      return originalJson(body);
    };
  }

  res.on('finish', () => {
    recordRequest(res.statusCode, isFallback, isAIRoute);
  });

  next();
}

/**
 * Clears metrics for isolated unit testing.
 */
export function resetMetricsForTesting() {
  requestEvents = [];
  aiFallbackEvents = [];
  aiTotalEvents = [];
}
