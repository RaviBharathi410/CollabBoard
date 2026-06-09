import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ClarificationPopup({
  clarification,
  isProcessing,
  onAnswer,
  anchor = null,
}) {
  if (!clarification) return null;

  const style = anchor
    ? {
        position: 'absolute',
        left: anchor.x,
        top: anchor.y,
        transform: 'translate(-50%, -100%)',
        marginTop: -12,
      }
    : {
        position: 'absolute',
        left: '50%',
        bottom: 100,
        transform: 'translateX(-50%)',
      };

  return (
    <AnimatePresence>
      <motion.div
        className="clarification-popup"
        style={style}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <p className="clarification-question">{clarification.question}</p>
        {isProcessing ? (
          <p className="clarification-loading">Refining diagram...</p>
        ) : (
          <div className="clarification-options">
            {clarification.options?.map((opt) => (
              <button
                key={opt}
                type="button"
                className="clarification-pill"
                onClick={() => onAnswer(opt)}
                disabled={isProcessing}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <style>{`
        .clarification-popup {
          z-index: 60;
          background: #fff;
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
          max-width: 360px;
          transform-origin: bottom center;
        }
        .clarification-question {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          margin: 0 0 12px;
          line-height: 1.4;
        }
        .clarification-loading {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }
        .clarification-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .clarification-pill {
          height: 32px;
          padding: 0 14px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .clarification-pill:hover:not(:disabled) {
          border-color: #6c63ff;
          background: #eeedfe;
          color: #6c63ff;
        }
        .clarification-pill:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </AnimatePresence>
  );
}
