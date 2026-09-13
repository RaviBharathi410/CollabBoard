/**
 * requestLogger.test.js
 * Unit tests for AI request logging and observability retrieval.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  logAIRequest,
  getRecentAIRequests,
  clearAIRequestsForTesting,
  getLogFilePath,
  computeAIStatsSummary,
} from './requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_LOG_FILE = path.resolve(__dirname, '../logs/ai_requests_logger_test.ndjson');

describe('requestLogger', () => {
  beforeEach(async () => {
    process.env.AI_REQUESTS_LOG_FILE = TEST_LOG_FILE;
    await clearAIRequestsForTesting();
  });

  afterEach(async () => {
    await clearAIRequestsForTesting();
    delete process.env.AI_REQUESTS_LOG_FILE;
    vi.restoreAllMocks();
  });

  it('logs a request record with all expected observability fields', async () => {
    const entry = await logAIRequest({
      prompt_length: 64,
      path_taken: 'local',
      latency_ms: 120.4,
      node_count: 4,
      edge_count: 3,
      json_valid: true,
      confidence: 0.965,
      healing_applied: false,
    });

    expect(entry.path_taken).toBe('local');
    expect(entry.prompt_length).toBe(64);
    expect(entry.latency_ms).toBe(120);
    expect(entry.node_count).toBe(4);
    expect(entry.edge_count).toBe(3);
    expect(entry.json_valid).toBe(true);
    expect(entry.confidence).toBe(0.965);
    expect(entry.healing_applied).toBe(false);
    expect(entry.timestamp).toBeDefined();

    // Verify it was appended to log file
    const fileContent = await fs.promises.readFile(getLogFilePath(), 'utf8');
    const parsed = JSON.parse(fileContent.trim());
    expect(parsed.path_taken).toBe('local');
    expect(parsed.node_count).toBe(4);
  });

  it('logs fallback records with error reason and zero node count', async () => {
    await logAIRequest({
      prompt_length: 42,
      path_taken: 'local_failed_fallback',
      latency_ms: 45,
      node_count: 0,
      edge_count: 0,
      json_valid: false,
      reason: 'parse_failed',
    });

    const recent = await getRecentAIRequests(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].path_taken).toBe('local_failed_fallback');
    expect(recent[0].json_valid).toBe(false);
    expect(recent[0].reason).toBe('parse_failed');
  });

  it('retrieves records in reverse chronological order and respects limits', async () => {
    for (let i = 1; i <= 5; i++) {
      await logAIRequest({
        prompt_length: i * 10,
        path_taken: 'local',
        latency_ms: i * 20,
        node_count: i,
      });
    }

    const recent = await getRecentAIRequests(3);
    expect(recent).toHaveLength(3);
    // Newest first (node_count: 5, then 4, then 3)
    expect(recent[0].node_count).toBe(5);
    expect(recent[1].node_count).toBe(4);
    expect(recent[2].node_count).toBe(3);
  });

  it('returns empty array when log file does not exist', async () => {
    await clearAIRequestsForTesting();
    const recent = await getRecentAIRequests();
    expect(recent).toEqual([]);
  });

  it('guarantees non-blocking behavior when file write throws', async () => {
    vi.spyOn(fs.promises, 'appendFile').mockRejectedValueOnce(new Error('Disk full simulation'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Must not throw
    const entry = await logAIRequest({
      prompt_length: 20,
      path_taken: 'local',
      latency_ms: 15,
    });

    expect(entry).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RequestLogger]'),
      'Disk full simulation'
    );
  });
});

describe('computeAIStatsSummary unit tests', () => {
  it('returns default zero stats for empty record array', () => {
    const summary = computeAIStatsSummary([]);
    expect(summary.total_requests).toBe(0);
    expect(summary.local_count).toBe(0);
    expect(summary.local_rate_pct).toBe(0);
    expect(summary.fallback_count).toBe(0);
    expect(summary.cost_savings_usd).toBe(0);
  });

  it('correctly calculates metrics across mixed local and fallback requests', () => {
    const records = [
      { path_taken: 'local', latency_ms: 100, healing_applied: false },
      { path_taken: 'local', latency_ms: 200, healing_applied: true },
      { path_taken: 'local_low_confidence_fallback', latency_ms: 400, reason: 'structural_risk', healing_applied: true },
      { path_taken: 'local_failed_fallback', latency_ms: 500, reason: 'network_error', healing_applied: false },
    ];

    const summary = computeAIStatsSummary(records);
    expect(summary.total_requests).toBe(4);
    expect(summary.local_count).toBe(2);
    expect(summary.local_rate_pct).toBe(50.0);
    expect(summary.fallback_count).toBe(2);
    expect(summary.fallback_rate_pct).toBe(50.0);
    expect(summary.avg_latency_ms).toBe(300); // (100+200+400+500)/4
    expect(summary.avg_local_latency_ms).toBe(150); // (100+200)/2
    expect(summary.avg_fallback_latency_ms).toBe(450); // (400+500)/2
    expect(summary.healing_applied_count).toBe(2);
    expect(summary.healing_applied_pct).toBe(50.0);
    // Grounded: 2 local requests * $0.00425 (GPT-4o) = $0.0085
    expect(summary.cost_savings_usd).toBe(0.0085);
    // Grounded: 2 local requests * $0.000255 (GPT-4o-mini) = $0.0005
    expect(summary.cost_savings_mini_usd).toBe(0.0005);
    expect(summary.cost_model).toBeDefined();
    expect(summary.cost_model.baseline_model).toContain('GPT-4o');
    expect(summary.cost_model.formula).toContain('500 in');
    expect(summary.fallback_reasons).toEqual({
      structural_risk: 1,
      network_error: 1,
    });
  });

  it('supports selecting alternative baseline cost model like gpt-4o-mini', () => {
    const records = [{ path_taken: 'local', latency_ms: 100 }];
    const summary = computeAIStatsSummary(records, 'gpt-4o-mini');
    expect(summary.cost_savings_usd).toBe(0.0003); // 1 * 0.000255 rounded to 4 decimals
    expect(summary.cost_model.baseline_model).toContain('GPT-4o-mini');
  });
});
