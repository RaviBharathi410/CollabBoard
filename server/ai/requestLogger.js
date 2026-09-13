/**
 * requestLogger.js
 * Lightweight, non-blocking request logging for AI pipeline observability.
 * Stores records in structured NDJSON format (server/logs/ai_requests.ndjson).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store in server/logs/ai_requests.ndjson (configurable via env for test isolation)
const LOGS_DIR = path.resolve(__dirname, '../logs');
const DEFAULT_LOG_FILE = path.join(LOGS_DIR, 'ai_requests.ndjson');

export function getLogFilePath() {
  return process.env.AI_REQUESTS_LOG_FILE || DEFAULT_LOG_FILE;
}

const LOG_FILE = DEFAULT_LOG_FILE;

/**
 * Ensures the log directory exists.
 */
function ensureLogDir() {
  const currentFile = getLogFilePath();
  const dir = path.dirname(currentFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Sanitizes user prompt text by masking common PII patterns (emails, credit cards, phones, IPs).
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizePromptText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[CARD]')
    .replace(/\b\+?[0-9]{1,3}?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '[PHONE]')
    .replace(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, '[IP]');
}

/**
 * Appends a request record to the NDJSON log asynchronously.
 * Non-blocking guarantee: Never throws or interrupts the calling request pipeline.
 *
 * @param {Object} record
 * @param {string} record.path_taken - 'local' | 'local_low_confidence_fallback' | 'local_failed_fallback' | 'cloud_direct'
 * @param {number} record.prompt_length - length of the input prompt text
 * @param {string} [record.prompt_text] - optional user prompt text (sanitized for privacy)
 * @param {number} record.latency_ms - total processing duration in milliseconds
 * @param {number} [record.node_count=0] - number of nodes in generated diagram
 * @param {number} [record.edge_count=0] - number of edges in generated diagram
 * @param {boolean} [record.json_valid=true] - whether response contained valid diagram JSON
 * @param {number|null} [record.confidence=null] - model or sequence generation confidence
 * @param {boolean} [record.healing_applied=false] - whether runtime graph repair intervened
 * @param {string} [record.reason] - optional error or fallback reason
 */
export async function logAIRequest(record) {
  const entry = {
    timestamp: record.timestamp || new Date().toISOString(),
    prompt_length: typeof record.prompt_length === 'number' ? record.prompt_length : 0,
    path_taken: record.path_taken || 'local',
    latency_ms: Math.round(record.latency_ms || 0),
    node_count: record.node_count ?? 0,
    edge_count: record.edge_count ?? 0,
    json_valid: Boolean(record.json_valid),
    confidence: typeof record.confidence === 'number' ? record.confidence : null,
    healing_applied: Boolean(record.healing_applied),
    ...(record.reason ? { reason: String(record.reason) } : {}),
  };

  const shouldLogPromptText = process.env.LOG_PROMPT_TEXT !== 'false';
  if (shouldLogPromptText && typeof record.prompt_text === 'string') {
    entry.prompt_text = sanitizePromptText(record.prompt_text);
  }

  // Asynchronous fire-and-forget write
  try {
    ensureLogDir();
    const logPath = getLogFilePath();
    const line = JSON.stringify(entry) + '\n';
    await fs.promises.appendFile(logPath, line, 'utf8');
  } catch (err) {
    // Non-blocking: warning only, never fails the user request
    console.warn('[RequestLogger] Failed to write AI request log:', err.message);
  }

  return entry;
}

/**
 * Retrieves the most recent N log records.
 *
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getRecentAIRequests(limit = 50) {
  try {
    const logPath = getLogFilePath();
    if (!fs.existsSync(logPath)) {
      return [];
    }

    const content = await fs.promises.readFile(logPath, 'utf8');
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed = [];
    for (let i = lines.length - 1; i >= 0 && parsed.length < limit; i--) {
      try {
        parsed.push(JSON.parse(lines[i]));
      } catch {
        /* ignore corrupted line */
      }
    }

    return parsed;
  } catch (err) {
    console.warn('[RequestLogger] Failed to read AI request logs:', err.message);
    return [];
  }
}

/**
 * Helper for testing: clears log file.
 */
export async function clearAIRequestsForTesting() {
  try {
    const logPath = getLogFilePath();
    if (!logPath.includes('test') && !process.env.AI_REQUESTS_LOG_FILE && process.env.NODE_ENV === 'production') {
      return;
    }
    if (fs.existsSync(logPath)) {
      await fs.promises.unlink(logPath);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Published pricing models (USD per token) for cloud fallback providers:
 * - gpt-4o (CollabBoard default PRIMARY_MODEL): $2.50 / 1M input ($0.0000025), $10.00 / 1M output ($0.000010)
 * - gpt-4o-mini: $0.15 / 1M input ($0.00000015), $0.60 / 1M output ($0.00000060)
 * - gemini-2.0-flash (CollabBoard default FALLBACK_MODEL): $0.10 / 1M input, $0.40 / 1M output
 *
 * Typical CollabBoard /api/ask fallback query token profile:
 * - Input: ~500 tokens (system prompt ~250 tokens + user prompt ~50 tokens + canvas context ~200 tokens)
 * - Output: ~300 tokens (structured JSON diagram/suggestions)
 *
 * Grounded cost per query:
 * - GPT-4o (Primary): (500 * 2.50 / 1e6) + (300 * 10.00 / 1e6) = $0.00125 + $0.00300 = $0.00425
 * - GPT-4o-mini: (500 * 0.15 / 1e6) + (300 * 0.60 / 1e6) = $0.000075 + $0.00018 = $0.000255
 */
export const COST_MODELS = {
  'gpt-4o': {
    name: 'OpenAI GPT-4o (Default Primary)',
    input_cost_per_m: 2.50,
    output_cost_per_m: 10.00,
    avg_input_tokens: 500,
    avg_output_tokens: 300,
    cost_per_query: 0.00425,
  },
  'gpt-4o-mini': {
    name: 'OpenAI GPT-4o-mini',
    input_cost_per_m: 0.15,
    output_cost_per_m: 0.60,
    avg_input_tokens: 500,
    avg_output_tokens: 300,
    cost_per_query: 0.000255,
  },
  'gemini-2.0-flash': {
    name: 'Google Gemini 2.0 Flash (Fallback)',
    input_cost_per_m: 0.10,
    output_cost_per_m: 0.40,
    avg_input_tokens: 500,
    avg_output_tokens: 300,
    cost_per_query: 0.000170,
  },
};

/**
 * Computes aggregate observability metrics across request records.
 *
 * @param {Array<Object>} records
 * @param {string} [modelKey='gpt-4o']
 * @returns {Object}
 */
export function computeAIStatsSummary(records = [], modelKey = 'gpt-4o') {
  const costModel = COST_MODELS[modelKey] || COST_MODELS['gpt-4o'];
  const miniModel = COST_MODELS['gpt-4o-mini'];

  const defaultCostMeta = {
    baseline_model: costModel.name,
    cost_per_query: costModel.cost_per_query,
    mini_cost_per_query: miniModel.cost_per_query,
    formula: `(${costModel.avg_input_tokens} in * $${costModel.input_cost_per_m}/M) + (${costModel.avg_output_tokens} out * $${costModel.output_cost_per_m}/M)`,
    assumptions: `Based on ~${costModel.avg_input_tokens} input tokens and ~${costModel.avg_output_tokens} output tokens per diagram request.`,
  };

  const total = records.length;
  if (total === 0) {
    return {
      total_requests: 0,
      local_count: 0,
      local_rate_pct: 0,
      fallback_count: 0,
      fallback_rate_pct: 0,
      avg_latency_ms: 0,
      avg_local_latency_ms: 0,
      avg_fallback_latency_ms: 0,
      cost_savings_usd: 0,
      cost_savings_mini_usd: 0,
      cost_model: defaultCostMeta,
      healing_applied_count: 0,
      healing_applied_pct: 0,
      fallback_reasons: {},
    };
  }

  let localCount = 0;
  let fallbackCount = 0;
  let totalLatency = 0;
  let localLatency = 0;
  let fallbackLatency = 0;
  let healingCount = 0;
  const fallbackReasons = {};

  for (const r of records) {
    const lat = r.latency_ms || 0;
    totalLatency += lat;

    if (r.path_taken === 'local') {
      localCount++;
      localLatency += lat;
    } else {
      fallbackCount++;
      fallbackLatency += lat;
      const reason = r.reason || 'unknown';
      fallbackReasons[reason] = (fallbackReasons[reason] || 0) + 1;
    }

    if (r.healing_applied) {
      healingCount++;
    }
  }

  const costSavingsUsd = +(localCount * costModel.cost_per_query).toFixed(4);
  const costSavingsMiniUsd = +(localCount * miniModel.cost_per_query).toFixed(4);

  return {
    total_requests: total,
    local_count: localCount,
    local_rate_pct: +((localCount / total) * 100).toFixed(1),
    fallback_count: fallbackCount,
    fallback_rate_pct: +((fallbackCount / total) * 100).toFixed(1),
    avg_latency_ms: Math.round(totalLatency / total),
    avg_local_latency_ms: localCount > 0 ? Math.round(localLatency / localCount) : 0,
    avg_fallback_latency_ms: fallbackCount > 0 ? Math.round(fallbackLatency / fallbackCount) : 0,
    cost_savings_usd: costSavingsUsd,
    cost_savings_mini_usd: costSavingsMiniUsd,
    cost_model: defaultCostMeta,
    healing_applied_count: healingCount,
    healing_applied_pct: +((healingCount / total) * 100).toFixed(1),
    fallback_reasons: fallbackReasons,
  };
}

export { LOG_FILE, LOGS_DIR };
