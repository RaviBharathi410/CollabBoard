import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  Cloud,
  DollarSign,
  Clock,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Terminal,
  Server,
  HelpCircle,
} from 'lucide-react';
import { getAuthHeaders } from '../canvas/hooks/useAIEngine';

const API_BASE = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '')
).replace(/\/+$/, '');


export default function AIStatsDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterPath, setFilterPath] = useState('all'); // 'all' | 'local' | 'fallback' | 'healed'
  const [limit, setLimit] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [costBaseline, setCostBaseline] = useState('gpt-4o'); // 'gpt-4o' | 'gpt-4o-mini'
  const [showCostFormula, setShowCostFormula] = useState(false);

  // Fetch summary and raw records
  const fetchData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();

        const [summaryRes, rawRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/ai-stats/summary?model=${costBaseline}`, { headers }),
          fetch(`${API_BASE}/api/admin/ai-stats/raw?limit=${limit}`, { headers }),
        ]);

        if (!summaryRes.ok || !rawRes.ok) {
          throw new Error(
            `Failed to fetch stats: Summary ${summaryRes.status}, Raw ${rawRes.status}`
          );
        }

        const summaryData = await summaryRes.json();
        const rawData = await rawRes.json();

        if (summaryData.status === 'ok') {
          setSummary(summaryData.summary);
        }
        if (rawData.status === 'ok') {
          setRequests(rawData.requests || []);
        }
      } catch (err) {
        console.error('[AIStatsDashboard] Fetch error:', err);
        setError(err.message || 'Could not load AI telemetry data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit, costBaseline]
  );

  // Explicit handler functions for accessibility and testing
  const handleAutoRefreshToggle = (e) => {
    setAutoRefresh(e.target.checked);
  };

  const handleManualRefresh = () => {
    fetchData(true);
  };

  const handleRetry = () => {
    fetchData(true);
  };

  const handleFilterChange = (path) => {
    setFilterPath(path);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
  };

  const handleCostBaselineChange = (model) => {
    setCostBaseline(model);
  };

  const toggleCostFormula = () => {
    setShowCostFormula((prev) => !prev);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for live dashboard updates
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filterPath === 'local') return r.path_taken === 'local';
      if (filterPath === 'fallback') return r.path_taken !== 'local';
      if (filterPath === 'healed') return Boolean(r.healing_applied);
      return true;
    });
  }, [requests, filterPath]);

  return (
    <div
      id="ai-stats-dashboard"
      className="min-h-screen bg-[#090b10] text-[#e2e8f0] font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200"
    >
      {/* Glow ambient background highlights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[130px]" />
        <div className="absolute top-[30%] right-[-5%] w-[450px] h-[450px] rounded-full bg-indigo-600/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[400px] h-[400px] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                id="back-to-boards-link"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors py-1 px-2.5 rounded-md bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Boards</span>
              </Link>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-0.5 rounded-full">
                <Activity className="w-3 h-3 animate-pulse" />
                <span>Dual-Signal Routing Observability</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              NLP-to-Diagram Telemetry
            </h1>
            <p className="text-sm text-slate-400">
              Live measurement of local Flan-T5 generation, runtime structural auto-healing, and cloud LLM routing.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 cursor-pointer select-none hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                id="auto-refresh-toggle"
                checked={autoRefresh}
                onChange={handleAutoRefreshToggle}
                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-400 bg-slate-800"
              />
              <span>Live Poll (5s)</span>
            </label>

            <button
              id="manual-refresh-button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3.5 py-1.5 rounded-lg border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div
            id="stats-error-banner"
            className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-start gap-3 text-sm"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Failed to refresh metrics:</span> {error}
            </div>
            <button
              id="error-retry-btn"
              onClick={handleRetry}
              className="text-xs font-semibold underline hover:text-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <section
          id="kpi-metrics-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Card 1: Local Served Rate */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/90 rounded-xl p-5 relative overflow-hidden backdrop-blur-md shadow-lg shadow-black/20 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Local Served Rate
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span id="metric-local-rate" className="text-3xl font-extrabold text-white tracking-tight">
                {summary ? `${summary.local_rate_pct}%` : '--'}
              </span>
              <span className="text-xs text-emerald-400 font-medium">
                {summary ? `${summary.local_count} / ${summary.total_requests} reqs` : ''}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Handled on-premise by fine-tuned Flan-T5 with 0 API cost.
            </p>
          </div>

          {/* Card 2: Cloud Fallback Rate */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/90 rounded-xl p-5 relative overflow-hidden backdrop-blur-md shadow-lg shadow-black/20 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Cloud Fallback Rate
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Cloud className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span id="metric-fallback-rate" className="text-3xl font-extrabold text-white tracking-tight">
                {summary ? `${summary.fallback_rate_pct}%` : '--'}
              </span>
              <span className="text-xs text-amber-400 font-medium">
                {summary ? `${summary.fallback_count} reqs routed` : ''}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Escalated to Tier-2 LLM on structural risk or unfamiliar prompts.
            </p>
          </div>

          {/* Card 3: Average Latency */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/90 rounded-xl p-5 relative overflow-hidden backdrop-blur-md shadow-lg shadow-black/20 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Avg Latency
              </span>
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span id="metric-avg-latency" className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {summary ? `${summary.avg_local_latency_ms || summary.avg_latency_ms}ms` : '--'}
              </span>
              <span className="text-xs text-slate-400">
                {summary?.avg_fallback_latency_ms ? `(Fallback: ${summary.avg_fallback_latency_ms}ms)` : 'local'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Local latency vs multi-second cloud LLM streaming rounds.
            </p>
          </div>

          {/* Card 4: Estimated Cost Savings (Grounded in Published LLM Pricing) */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/90 rounded-xl p-5 relative overflow-hidden backdrop-blur-md shadow-lg shadow-black/20 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Cost Savings
                </span>
                <button
                  id="cost-formula-toggle-btn"
                  onClick={toggleCostFormula}
                  title="View cost calculation formula"
                  className="text-slate-500 hover:text-cyan-400 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px]">
                <button
                  id="baseline-gpt4o-btn"
                  onClick={() => handleCostBaselineChange('gpt-4o')}
                  className={`px-1.5 py-0.5 rounded ${
                    costBaseline === 'gpt-4o'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  GPT-4o
                </button>
                <button
                  id="baseline-mini-btn"
                  onClick={() => handleCostBaselineChange('gpt-4o-mini')}
                  className={`px-1.5 py-0.5 rounded ${
                    costBaseline === 'gpt-4o-mini'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mini
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span id="metric-cost-savings" className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
                {summary ? `$${summary.cost_savings_usd.toFixed(4)}` : '$0.0000'}
              </span>
              <span className="text-xs text-slate-400 font-normal">saved</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {costBaseline === 'gpt-4o'
                ? 'Grounded: $0.00425/query vs GPT-4o primary fallback.'
                : 'Grounded: $0.00026/query vs GPT-4o-mini fallback.'}
            </p>

            {/* Formula Explanation Callout */}
            {showCostFormula && (
              <div
                id="cost-formula-modal"
                className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800"
              >
                <div className="font-semibold text-cyan-400">
                  {summary?.cost_model?.baseline_model || 'GPT-4o'} Formula:
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  {summary?.cost_model?.formula || '(500 in * $2.50/M) + (300 out * $10.00/M) = $0.00425/query'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {summary?.cost_model?.assumptions || 'Assumes ~500 in tokens (system prompt + context) and ~300 out tokens (JSON diagram).'}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Dual-Signal Routing Architecture & Fallback Reason Analysis */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Signal 1 Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <h3>Signal 1: Structural Risk (Correctness)</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Monitors runtime graph repair (<code className="text-cyan-300 font-mono text-[11px]">healingInfo</code>). If phantom prune ratio <span className="font-semibold text-white">&ge; 0.50</span> or edges fail to connect nodes, the diagram is rejected and routed to Tier-2 LLM before reaching the user.
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-400">Structural Risk Fallbacks:</span>
              <span id="stat-structural-risk-count" className="font-mono font-semibold text-amber-400">
                {summary?.fallback_reasons?.structural_risk ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Safe Healing Rate:</span>
              <span id="stat-healing-rate" className="font-mono font-semibold text-cyan-400">
                {summary?.healing_applied_pct ?? 0}% ({summary?.healing_applied_count ?? 0} reqs)
              </span>
            </div>
          </div>

          {/* Signal 2 Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
              <Zap className="w-4 h-4" />
              <h3>Signal 2: Domain Familiarity (Confidence)</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Measures normalized token log-probability <code className="text-cyan-300 font-mono text-[11px]">&exp;(mean(log p))</code>. Threshold <span className="font-semibold text-white">&lt; 0.88</span> catches unfamiliar colloquial queries, leaving structural verification to Signal 1.
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
              <span className="text-slate-400">Low Confidence Fallbacks:</span>
              <span id="stat-low-conf-count" className="font-mono font-semibold text-amber-400">
                {summary?.fallback_reasons?.low_confidence ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Configured Threshold:</span>
              <span className="font-mono font-semibold text-slate-300">0.88 (exp)</span>
            </div>
          </div>

          {/* Fallback Reasons Breakdown */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Server className="w-4 h-4 text-indigo-400" />
              <h3>All Fallback Triggers</h3>
            </div>
            <div className="space-y-2 pt-1">
              {summary && Object.keys(summary.fallback_reasons).length > 0 ? (
                Object.entries(summary.fallback_reasons).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">{reason}</span>
                    <span className="font-mono font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic py-2">
                  No fallbacks recorded yet. Local inference running at 100%.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Live Request Stream Table */}
        <section className="bg-slate-900/70 border border-slate-800/90 rounded-xl overflow-hidden backdrop-blur-md shadow-xl">
          {/* Table Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">Recent Requests Log Stream</h2>
              <span className="text-xs text-slate-400 font-mono">({filteredRequests.length} shown)</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filter by Path Taken */}
              <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                {['all', 'local', 'fallback', 'healed'].map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    id={`filter-${f}-btn`}
                    className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
                      filterPath === f
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Limit Selector */}
              <select
                id="requests-limit-select"
                value={limit}
                onChange={handleLimitChange}
                className="text-xs bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value={25}>Last 25</option>
                <option value={50}>Last 50</option>
                <option value={100}>Last 100</option>
                <option value={250}>Last 250</option>
              </select>
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto">
            {loading && requests.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500/70" />
                Loading AI telemetry records...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div id="empty-requests-state" className="py-16 text-center text-slate-500 text-sm">
                No request records match the selected filter.
              </div>
            ) : (
              <table id="requests-log-table" className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Path Taken</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Graph Topology</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Details / Healing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRequests.map((req, idx) => {
                    const isLocal = req.path_taken === 'local';
                    const isLowConf = req.path_taken === 'local_low_confidence_fallback';
                    const isFailed = req.path_taken === 'local_failed_fallback';

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : '--'}
                        </td>

                        {/* Path Taken Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isLocal && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                              <CheckCircle2 className="w-3 h-3" />
                              local (Flan-T5)
                            </span>
                          )}
                          {isLowConf && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
                              <AlertTriangle className="w-3 h-3" />
                              fallback: {req.reason || 'low_confidence'}
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/60 text-red-400 border border-red-800/60">
                              <AlertTriangle className="w-3 h-3" />
                              fallback: {req.reason || 'failed'}
                            </span>
                          )}
                          {!isLocal && !isLowConf && !isFailed && (
                            <span className="text-slate-400">{req.path_taken}</span>
                          )}
                        </td>

                        {/* Generation Confidence */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {typeof req.confidence === 'number' ? (
                            <span
                              className={`font-semibold ${
                                req.confidence >= 0.88 ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {(req.confidence * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>

                        {/* Topology: Nodes & Edges */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                          {req.json_valid ? (
                            <span>
                              {req.node_count} nodes &bull; {req.edge_count} edges
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No JSON</span>
                          )}
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                          {req.latency_ms}ms
                        </td>

                        {/* Details / Healing info */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {req.healing_applied && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                                <Sparkles className="w-3 h-3" />
                                Auto-healed
                              </span>
                            )}
                            {req.reason && req.reason !== 'none' && (
                              <span className="text-[11px] text-slate-400">
                                {req.reason}
                              </span>
                            )}
                            {!req.healing_applied && !req.reason && (
                              <span className="text-slate-600">&mdash;</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
