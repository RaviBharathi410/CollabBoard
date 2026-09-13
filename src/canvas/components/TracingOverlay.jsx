import { Sparkles, Check, X } from 'lucide-react';

export default function TracingOverlay({
  isVisible,
  onAccept,
  onDismiss,
  suggestionTitle = 'AI Diagram Auto-Layout',
  suggestionType = 'diagram',
  nodeCount = 0,
}) {
  if (!isVisible) return null;

  return (
    <div className="tracing-paper-overlay" aria-label="AI Tracing Paper Layer">
      {/* Floating Action Pill */}
      <div className="tracing-action-pill card">
        <div className="tracing-pill-left">
          <div className="tracing-ochre-icon">
            <Sparkles size={14} />
          </div>
          <div className="tracing-text-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="tracing-title">{suggestionTitle}</span>
              {suggestionType && <span className="badge badge-ochre">{suggestionType}</span>}
            </div>
            <span className="tracing-sub">
              {nodeCount > 0 ? `${nodeCount} nodes suggested` : 'Tracing paper overlay active'}
            </span>
          </div>
        </div>

        <div className="tracing-pill-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm dismiss-btn"
            onClick={onDismiss}
            title="Dismiss tracing paper"
          >
            <X size={14} />
            <span>Dismiss</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm accept-btn"
            onClick={onAccept}
            title="Trace over and accept suggestion"
          >
            <Check size={14} />
            <span>Trace to Accept</span>
          </button>
        </div>
      </div>

      <style>{`
        .tracing-paper-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 28;
          border: 2px dashed rgba(158, 88, 38, 0.4);
          background: rgba(253, 246, 240, 0.25);
          animation: tracingFadeIn 200ms ease;
        }
        @keyframes tracingFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .tracing-action-pill {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: auto;
          background: var(--surface-raised);
          border: 1px solid var(--ochre);
          border-radius: 20px;
          padding: 6px 14px 6px 10px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: var(--shadow-lg);
          font-family: var(--font-sans);
        }
        .tracing-pill-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tracing-ochre-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--ochre-subtle);
          color: var(--ochre);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tracing-text-meta {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .tracing-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
        }
        .tracing-sub {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--ochre);
        }
        .tracing-pill-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dismiss-btn {
          height: 28px;
          padding: 0 8px;
          font-size: 12px;
          color: var(--ink-muted);
        }
        .dismiss-btn:hover {
          color: var(--ink);
          background: var(--surface-subtle);
        }
        .accept-btn {
          height: 28px;
          padding: 0 12px;
          font-size: 12px;
          background: var(--moss);
          border-color: var(--moss);
          color: var(--ink-white);
        }
        .accept-btn:hover {
          background: var(--moss-hover);
        }
      `}</style>
    </div>
  );
}
