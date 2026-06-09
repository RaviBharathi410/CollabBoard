import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';

const MAX_HISTORY = 5;

export default function AskPanel({ open, onClose, onAsk, onApplySuggestion, askResponse, isAsking }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || isAsking) return;

    const nextHistory = [...history, { role: 'user', content: q }].slice(-MAX_HISTORY);
    setHistory(nextHistory);
    setQuestion('');

    const result = await onAsk(q, nextHistory.slice(0, -1));
    if (result?.answer) {
      setHistory((h) =>
        [...h, { role: 'assistant', content: result.answer }].slice(-MAX_HISTORY * 2)
      );
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ask-backdrop"
            className="ask-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="ask-panel"
            className="ask-panel"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <header className="ask-panel-header">
              <h2>Ask AI</h2>
              <button type="button" className="ask-panel-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <div className="ask-panel-messages">
              {history.map((msg, i) => (
                <div key={`${msg.role}-${i}-${msg.content?.slice(0, 24)}`} className={`ask-msg ask-msg-${msg.role}`}>
                  {msg.content}
                </div>
              ))}
              {askResponse?.streaming && askResponse?.answer && (
                <div key="streaming-answer" className="ask-msg ask-msg-assistant">
                  {askResponse.answer}
                  <span className="ask-cursor" />
                </div>
              )}
            </div>

            {askResponse?.suggestions?.length > 0 && (
              <div className="ask-suggestions">
                <p className="ask-suggestions-label">Suggestions</p>
                {askResponse.suggestions.map((sg, i) => (
                  <div key={i} className="ask-suggestion-card">
                    <p>{sg.description}</p>
                    {(sg.autoApply || sg.shape) && onApplySuggestion && (
                      <button
                        type="button"
                        className="ask-apply-btn"
                        onClick={() => onApplySuggestion(sg)}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form className="ask-panel-form" onSubmit={handleSubmit}>
              <textarea
                rows={3}
                placeholder="Ask about your diagram..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isAsking}
              />
              <button type="submit" className="ask-send-btn" disabled={isAsking || !question.trim()}>
                <Send size={16} />
                Send
              </button>
            </form>
          </motion.aside>

          <style>{`
            .ask-panel-backdrop {
              position: absolute;
              inset: 0;
              background: rgba(0,0,0,0.08);
              z-index: 55;
            }
            .ask-panel {
              position: absolute;
              top: 0;
              right: 0;
              width: 320px;
              height: 100%;
              background: #fff;
              border-left: 1px solid #e5e7eb;
              z-index: 56;
              display: flex;
              flex-direction: column;
            }
            .ask-panel-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 16px 18px;
              border-bottom: 1px solid #f3f4f6;
            }
            .ask-panel-header h2 {
              font-size: 15px;
              font-weight: 700;
              margin: 0;
              color: #1a1a2e;
            }
            .ask-panel-close {
              border: none;
              background: transparent;
              cursor: pointer;
              color: #6b7280;
              padding: 4px;
              border-radius: 6px;
            }
            .ask-panel-close:hover { background: #f3f4f6; }
            .ask-panel-messages {
              flex: 1;
              overflow-y: auto;
              padding: 16px;
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .ask-msg {
              font-size: 13px;
              line-height: 1.5;
              padding: 10px 12px;
              border-radius: 10px;
              max-width: 100%;
            }
            .ask-msg-user {
              background: #eeedfe;
              color: #1a1a2e;
              align-self: flex-end;
            }
            .ask-msg-assistant {
              background: #f9fafb;
              color: #374151;
              align-self: flex-start;
            }
            .ask-cursor {
              display: inline-block;
              width: 2px;
              height: 14px;
              background: #6c63ff;
              margin-left: 2px;
              vertical-align: text-bottom;
              animation: ask-blink 1s step-end infinite;
            }
            @keyframes ask-blink {
              50% { opacity: 0; }
            }
            .ask-suggestions {
              padding: 0 16px 12px;
              border-top: 1px solid #f3f4f6;
            }
            .ask-suggestions-label {
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #9ca3af;
              margin: 0 0 8px;
            }
            .ask-suggestion-card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 10px 12px;
              margin-bottom: 8px;
              font-size: 12px;
              color: #374151;
            }
            .ask-suggestion-card p { margin: 0 0 8px; }
            .ask-apply-btn {
              font-size: 12px;
              font-weight: 600;
              color: #6c63ff;
              background: #eeedfe;
              border: none;
              padding: 4px 10px;
              border-radius: 6px;
              cursor: pointer;
            }
            .ask-panel-form {
              padding: 14px 16px;
              border-top: 1px solid #e5e7eb;
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .ask-panel-form textarea {
              resize: none;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 10px 12px;
              font-size: 13px;
              font-family: inherit;
              outline: none;
            }
            .ask-panel-form textarea:focus {
              border-color: #6c63ff;
            }
            .ask-send-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              background: var(--color-brand, #6c63ff);
              color: #fff;
              border: none;
              border-radius: 8px;
              padding: 10px;
              font-weight: 600;
              font-size: 13px;
              cursor: pointer;
            }
            .ask-send-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
