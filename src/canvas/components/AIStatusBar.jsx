import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Brain, Check, AlertCircle, RotateCcw } from 'lucide-react';

const STAGE_LABELS = {
  capturing: { icon: Loader2, spin: true, text: 'Capturing canvas...' },
  detecting: { icon: Loader2, spin: true, text: 'Running browser ONNX detector...' },
  preview: { icon: Brain, pulse: true, text: 'Previewing detections...' },
  analyzing: { icon: Brain, pulse: true, text: 'Refining on inference server...' },
  layouting: { icon: Loader2, spin: true, text: 'Computing layout...' },
  rendering: { icon: Loader2, spin: true, text: 'Placing shapes...' },
  done: { icon: Check, text: null },
};

export default function AIStatusBar({
  stage,
  progress,
  modelUsed,
  processingMs,
  aiError,
  onRetry,
  onDismissError,
}) {
  const showBar = stage && stage !== 'clarifying';
  const showError = Boolean(aiError);
  const visible = showBar || showError;

  const cfg = stage ? STAGE_LABELS[stage] : null;
  const Icon = cfg?.icon;
  const doneText =
    stage === 'done' && processingMs != null
      ? `Done in ${processingMs}ms${modelUsed ? ` via ${modelUsed}` : ''}`
      : 'Enhancement complete';

  return (
    <>
      <AnimatePresence mode="wait">
        {visible && showError && (
          <motion.div
            key="ai-status-error"
            className="ai-status-bar ai-status-error"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <AlertCircle size={16} />
            <span>{aiError}</span>
            {onRetry && (
              <button type="button" className="ai-status-retry" onClick={onRetry}>
                <RotateCcw size={14} />
                Retry
              </button>
            )}
            {onDismissError && (
              <button type="button" className="ai-status-dismiss" onClick={onDismissError}>
                ✕
              </button>
            )}
          </motion.div>
        )}
        {visible && showBar && !showError && cfg && Icon && (
          <motion.div
            key={`ai-status-${stage}`}
            className="ai-status-bar"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <div className="ai-status-content">
              <Icon
                size={16}
                className={cfg.spin ? 'ai-status-spin' : cfg.pulse ? 'ai-status-pulse' : ''}
              />
              <span>{stage === 'done' ? doneText : cfg.text}</span>
              {(stage === 'analyzing' || stage === 'detecting' || stage === 'preview' || stage === 'done') &&
                modelUsed && <span className="ai-status-badge">{modelUsed}</span>}
            </div>
            <div className="ai-status-progress-track">
              <div className="ai-status-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{statusBarStyles}</style>
    </>
  );
}

const statusBarStyles = `
  .ai-status-bar {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    border-radius: 24px;
    padding: 10px 20px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    z-index: 52;
    min-width: 220px;
    max-width: 90vw;
  }
  .ai-status-content {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #1a1a2e;
  }
  .ai-status-badge {
    font-size: 10px;
    font-weight: 600;
    background: #eeedfe;
    color: #6c63ff;
    padding: 2px 8px;
    border-radius: 100px;
  }
  .ai-status-progress-track {
    position: absolute;
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 3px;
    background: #f3f4f6;
    border-radius: 2px;
    overflow: hidden;
  }
  .ai-status-progress-fill {
    height: 100%;
    background: #6c63ff;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .ai-status-spin {
    animation: ai-spin 1s linear infinite;
  }
  .ai-status-pulse {
    animation: ai-pulse 1.2s ease-in-out infinite;
  }
  @keyframes ai-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes ai-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .ai-status-error {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fef2f2;
    color: #dc2626;
    padding-bottom: 10px;
  }
  .ai-status-error span { flex: 1; font-size: 12px; }
  .ai-status-retry {
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid #fecaca;
    background: #fff;
    color: #dc2626;
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .ai-status-dismiss {
    border: none;
    background: transparent;
    color: #dc2626;
    cursor: pointer;
    padding: 4px;
  }
`;
