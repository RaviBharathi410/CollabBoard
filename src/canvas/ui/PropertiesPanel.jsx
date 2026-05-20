import React from 'react';
import useCanvasStore from '../hooks/useCanvasStore';

const colors = [
  '#EEEDfe', '#6C63FF', '#8B85F0', '#1A1A2E',
  '#FEF3C7', '#F59E0B', '#D1FAE5', '#10B981',
  '#FEE2E2', '#EF4444', '#F3F4F6', '#9CA3AF',
  'transparent'
];

export default function PropertiesPanel() {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const shapes = useCanvasStore((state) => state.shapes);
  const updateShape = useCanvasStore((state) => state.updateShape);

  // If no shape or multiple shapes selected, don't show the panel
  if (selectedIds.length !== 1) return null;

  const activeShape = shapes.find((s) => s.id === selectedIds[0]);
  if (!activeShape) return null;

  const handleUpdate = (updates) => {
    updateShape(activeShape.id, updates);
  };

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <span className="panel-title">Properties</span>
        <span className="panel-subtitle">{activeShape.type}</span>
      </div>

      <div className="panel-body">
        {/* Fill Color */}
        {(activeShape.type === 'rectangle' || activeShape.type === 'circle') && (
          <div className="prop-section">
            <span className="prop-label">Fill</span>
            <div className="color-grid">
              {colors.map((c) => (
                <button
                  key={`fill-${c}`}
                  className="color-btn"
                  style={{ background: c, border: c === 'transparent' ? '1px dashed #9ca3af' : '1px solid rgba(0,0,0,0.1)' }}
                  onClick={() => handleUpdate({ fill: c })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stroke Color */}
        <div className="prop-section">
          <span className="prop-label">{activeShape.type === 'text' ? 'Color' : 'Stroke'}</span>
          <div className="color-grid">
            {colors.map((c) => (
              <button
                key={`stroke-${c}`}
                className="color-btn"
                style={{ background: c, border: c === 'transparent' ? '1px dashed #9ca3af' : '1px solid rgba(0,0,0,0.1)' }}
                onClick={() => handleUpdate(activeShape.type === 'text' ? { fill: c } : { stroke: c })}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        {activeShape.type !== 'text' && (
          <div className="prop-section">
            <span className="prop-label">Stroke Width</span>
            <div className="width-btns">
              {[1, 2, 4, 8].map((w) => (
                <button
                  key={w}
                  className={`width-btn ${activeShape.strokeWidth === w ? 'active' : ''}`}
                  onClick={() => handleUpdate({ strokeWidth: w })}
                >
                  <div style={{ width: '100%', height: w, background: activeShape.strokeWidth === w ? '#fff' : 'currentColor' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text specific properties */}
        {activeShape.type === 'text' && (
          <div className="prop-section">
            <span className="prop-label">Content</span>
            <textarea
              className="text-edit-input"
              value={activeShape.text}
              onChange={(e) => handleUpdate({ text: e.target.value })}
              rows={3}
            />
          </div>
        )}
      </div>

      <style>{`
        .properties-panel {
          position: absolute;
          right: 20px;
          top: 20px;
          width: 240px;
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          z-index: 50;
          overflow: hidden;
        }
        .panel-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--color-bg-primary);
        }
        .panel-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .panel-subtitle {
          font-size: 0.6875rem;
          color: var(--color-text-tertiary);
          text-transform: capitalize;
        }
        .panel-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .prop-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .prop-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }
        .color-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
        }
        .color-btn {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .color-btn:hover {
          transform: scale(1.1);
        }
        .width-btns {
          display: flex;
          gap: 8px;
        }
        .width-btn {
          flex: 1;
          height: 28px;
          border: 1px solid var(--color-border);
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          color: var(--color-text-tertiary);
        }
        .width-btn.active {
          background: var(--color-brand);
          border-color: var(--color-brand);
          color: #fff;
        }
        .text-edit-input {
          width: 100%;
          font-family: inherit;
          font-size: 0.8125rem;
          padding: 8px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          resize: vertical;
        }
        .text-edit-input:focus {
          outline: none;
          border-color: var(--color-brand);
        }
      `}</style>
    </div>
  );
}
