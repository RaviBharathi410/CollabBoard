import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AIStatsDashboardPage from './AIStatsDashboardPage';

// Mocks
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../canvas/hooks/useAIEngine', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ 'Content-Type': 'application/json' }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_SUMMARY = {
  total_requests: 10,
  local_count: 8,
  local_rate_pct: 80.0,
  fallback_count: 2,
  fallback_rate_pct: 20.0,
  avg_latency_ms: 185,
  avg_local_latency_ms: 140,
  avg_fallback_latency_ms: 365,
  cost_savings_usd: 0.0340,
  cost_savings_mini_usd: 0.0020,
  cost_model: {
    baseline_model: 'OpenAI GPT-4o (Default Primary)',
    cost_per_query: 0.00425,
    mini_cost_per_query: 0.000255,
    formula: '(500 in * $2.50/M) + (300 out * $10.00/M) = $0.00425/query',
    assumptions: 'Assumes ~500 in tokens and ~300 out tokens per diagram request.',
  },
  healing_applied_count: 3,
  healing_applied_pct: 30.0,
  fallback_reasons: {
    structural_risk: 1,
    low_confidence: 1,
  },
};

const MOCK_REQUESTS = [
  {
    timestamp: '2026-09-12T12:00:00.000Z',
    path_taken: 'local',
    latency_ms: 140,
    node_count: 3,
    edge_count: 2,
    json_valid: true,
    confidence: 0.965,
    healing_applied: false,
  },
  {
    timestamp: '2026-09-12T12:01:00.000Z',
    path_taken: 'local',
    latency_ms: 155,
    node_count: 4,
    edge_count: 3,
    json_valid: true,
    confidence: 0.942,
    healing_applied: true,
  },
  {
    timestamp: '2026-09-12T12:02:00.000Z',
    path_taken: 'local_low_confidence_fallback',
    latency_ms: 380,
    node_count: 2,
    edge_count: 1,
    json_valid: true,
    confidence: 0.97,
    healing_applied: true,
    reason: 'structural_risk',
  },
  {
    timestamp: '2026-09-12T12:03:00.000Z',
    path_taken: 'local_low_confidence_fallback',
    latency_ms: 350,
    node_count: 1,
    edge_count: 0,
    json_valid: true,
    confidence: 0.81,
    healing_applied: false,
    reason: 'low_confidence',
  },
];

describe('AIStatsDashboardPage Component', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock global fetch
    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/api/admin/ai-stats/summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'ok', summary: MOCK_SUMMARY }),
        });
      }
      if (url.includes('/api/admin/ai-stats/raw')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'ok', count: MOCK_REQUESTS.length, requests: MOCK_REQUESTS }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.useRealTimers();
  });

  it('renders dashboard title and grounded metrics after data load', async () => {
    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    expect(container.textContent).toContain('NLP-to-Diagram Telemetry');
    expect(container.textContent).toContain('Dual-Signal Routing Observability');

    // KPI cards
    const localRate = container.querySelector('#metric-local-rate');
    expect(localRate?.textContent).toBe('80%');

    const fallbackRate = container.querySelector('#metric-fallback-rate');
    expect(fallbackRate?.textContent).toBe('20%');

    const costSavings = container.querySelector('#metric-cost-savings');
    expect(costSavings?.textContent).toBe('$0.0340');

    const avgLatency = container.querySelector('#metric-avg-latency');
    expect(avgLatency?.textContent).toBe('140ms');
  });

  it('displays dual-signal routing card metrics and fallback triggers', async () => {
    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    const structCount = container.querySelector('#stat-structural-risk-count');
    expect(structCount?.textContent).toBe('1');

    const lowConfCount = container.querySelector('#stat-low-conf-count');
    expect(lowConfCount?.textContent).toBe('1');

    const healingRate = container.querySelector('#stat-healing-rate');
    expect(healingRate?.textContent).toContain('30%');
  });

  it('toggles cost baseline between GPT-4o and Mini and toggles formula callout', async () => {
    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    // Toggle formula modal
    const formulaBtn = container.querySelector('#cost-formula-toggle-btn');
    expect(container.querySelector('#cost-formula-modal')).toBeNull();

    await act(async () => {
      formulaBtn.click();
    });
    expect(container.querySelector('#cost-formula-modal')).not.toBeNull();
    expect(container.querySelector('#cost-formula-modal').textContent).toContain('Formula:');

    // Toggle off
    await act(async () => {
      formulaBtn.click();
    });
    expect(container.querySelector('#cost-formula-modal')).toBeNull();

    // Switch to Mini baseline
    const miniBtn = container.querySelector('#baseline-mini-btn');
    await act(async () => {
      miniBtn.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('model=gpt-4o-mini'),
      expect.any(Object)
    );

    // Switch back to GPT-4o baseline
    const gpt4oBtn = container.querySelector('#baseline-gpt4o-btn');
    await act(async () => {
      gpt4oBtn.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('model=gpt-4o'),
      expect.any(Object)
    );
  });

  it('handles limit selector change and manual refresh button click', async () => {
    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    const initialFetchCount = globalThis.fetch.mock.calls.length;

    // Change limit selector
    const limitSelect = container.querySelector('#requests-limit-select');
    await act(async () => {
      limitSelect.value = '100';
      limitSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=100'),
      expect.any(Object)
    );

    // Manual refresh click
    const refreshBtn = container.querySelector('#manual-refresh-button');
    await act(async () => {
      refreshBtn.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(initialFetchCount);
  });

  it('renders requests table and filters by all, local, fallback, and healed', async () => {
    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    const table = container.querySelector('#requests-log-table');
    expect(table).toBeTruthy();

    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);

    // Filter by local
    const localFilterBtn = container.querySelector('#filter-local-btn');
    await act(async () => {
      localFilterBtn.click();
    });
    expect(table.querySelectorAll('tbody tr').length).toBe(2);

    // Filter by fallback
    const fallbackFilterBtn = container.querySelector('#filter-fallback-btn');
    await act(async () => {
      fallbackFilterBtn.click();
    });
    expect(table.querySelectorAll('tbody tr').length).toBe(2);

    // Filter by healed
    const healedFilterBtn = container.querySelector('#filter-healed-btn');
    await act(async () => {
      healedFilterBtn.click();
    });
    expect(table.querySelectorAll('tbody tr').length).toBe(2);

    // Filter by all
    const allFilterBtn = container.querySelector('#filter-all-btn');
    await act(async () => {
      allFilterBtn.click();
    });
    expect(table.querySelectorAll('tbody tr').length).toBe(4);
  });

  it('handles auto-refresh toggle and polling timer ticks', async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    const initialFetchCount = globalThis.fetch.mock.calls.length;

    // Advance timers by 5000ms to fire interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(initialFetchCount);

    // Toggle auto-refresh off
    const toggle = container.querySelector('#auto-refresh-toggle');
    await act(async () => {
      toggle.click();
    });

    const countAfterToggle = globalThis.fetch.mock.calls.length;

    // Advance timers again; should not fire because autoRefresh is off
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(globalThis.fetch.mock.calls.length).toBe(countAfterToggle);
  });

  it('displays error banner when fetch fails and allows retry', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    await act(async () => {
      root.render(<AIStatsDashboardPage />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    const errorBanner = container.querySelector('#stats-error-banner');
    expect(errorBanner).toBeTruthy();
    expect(errorBanner.textContent).toContain('Network offline');

    // Setup success on retry
    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/api/admin/ai-stats/summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'ok', summary: MOCK_SUMMARY }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok', count: MOCK_REQUESTS.length, requests: MOCK_REQUESTS }),
      });
    });

    const retryBtn = container.querySelector('#error-retry-btn');
    expect(retryBtn).toBeTruthy();

    await act(async () => {
      retryBtn.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    expect(container.querySelector('#stats-error-banner')).toBeNull();
  });
});
