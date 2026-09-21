import React from 'react';
import { X, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import useCanvasStore from '../hooks/useCanvasStore';
import { autoArrangeDiagram } from '../utils/orthogonalRouter';

const fillColors = [
  '#FFFFFF', '#EEEDFE', '#FEF3C7', '#D1FAE5',
  '#FEE2E2', '#F3F4F6', '#E0E7FF', 'transparent'
];

const strokeColors = [
  '#6C63FF', '#26241F', '#1A1A2E', '#F59E0B',
  '#10B981', '#EF4444', '#8B85F0', '#9CA3AF'
];

function formatTypeName(type, subtype) {
  if (type === 'uml_class') {
    return subtype === 'interface' ? 'UML Interface' : 'UML Class';
  }
  if (type === 'arrow') return 'Connector Arrow';
  return (type || 'Shape').replace(/_/g, ' ');
}

export default function PropertiesPanel() {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const shapes = useCanvasStore((state) => state.shapes);
  const updateShape = useCanvasStore((state) => state.updateShape);
  const clearSelection = useCanvasStore((state) => state.clearSelection);

  // If no shape or multiple shapes selected, don't show the panel
  if (selectedIds.length !== 1) return null;

  const activeShape = shapes.find((s) => s.id === selectedIds[0]);
  if (!activeShape) return null;

  const handleUpdate = (updates) => {
    updateShape(activeShape.id, updates);
  };

  const handleAutoArrange = () => {
    const store = useCanvasStore.getState();
    const arranged = autoArrangeDiagram(store.shapes);
    // Atomic history update
    const history = store._pushHistory(store.shapes);
    useCanvasStore.setState({
      shapes: arranged,
      ...history,
    });
  };

  const handleBringToFront = () => {
    const store = useCanvasStore.getState();
    const otherShapes = store.shapes.filter((s) => s.id !== activeShape.id);
    const history = store._pushHistory(store.shapes);
    useCanvasStore.setState({
      shapes: [...otherShapes, activeShape],
      ...history,
    });
  };

  const handleSendToBack = () => {
    const store = useCanvasStore.getState();
    const otherShapes = store.shapes.filter((s) => s.id !== activeShape.id);
    const history = store._pushHistory(store.shapes);
    useCanvasStore.setState({
      shapes: [activeShape, ...otherShapes],
      ...history,
    });
  };

  const hasFill = ['rectangle', 'circle', 'diamond', 'uml_class'].includes(activeShape.type);

  return (
    <div className="properties-panel" role="region" aria-label="Properties Panel">
      <div className="panel-header">
        <div className="panel-header-titles">
          <span className="panel-title">Properties</span>
          <span className="panel-subtitle">{formatTypeName(activeShape.type, activeShape.subtype)}</span>
        </div>
        <button
          type="button"
          className="close-panel-btn"
          onClick={() => clearSelection()}
          title="Deselect shape and close panel (Esc)"
          aria-label="Close properties"
        >
          <X size={14} />
        </button>
      </div>

      <div className="panel-body">
        {/* Fill Color */}
        {hasFill && (
          <div className="prop-section">
            <span className="prop-label">Fill</span>
            <div className="color-grid">
              {fillColors.map((c) => (
                <button
                  key={`fill-${c}`}
                  type="button"
                  className={`color-btn ${activeShape.fill === c ? 'active-color' : ''}`}
                  style={{
                    background: c,
                    border: c === 'transparent' ? '1.5px dashed #9ca3af' : '1px solid rgba(0,0,0,0.12)'
                  }}
                  onClick={() => handleUpdate({ fill: c })}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stroke Color */}
        <div className="prop-section">
          <span className="prop-label">{activeShape.type === 'text' ? 'Text Color' : 'Stroke Color'}</span>
          <div className="color-grid">
            {strokeColors.map((c) => (
              <button
                key={`stroke-${c}`}
                type="button"
                className={`color-btn ${activeShape.stroke === c ? 'active-color' : ''}`}
                style={{ background: c, border: '1px solid rgba(0,0,0,0.12)' }}
                onClick={() => handleUpdate(activeShape.type === 'text' ? { fill: c } : { stroke: c })}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        {activeShape.type !== 'text' && (
          <div className="prop-section">
            <span className="prop-label">Line Width</span>
            <div className="width-btns">
              {[1, 2, 4].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`width-btn ${(activeShape.strokeWidth || 1.5) === w ? 'active' : ''}`}
                  onClick={() => handleUpdate({ strokeWidth: w })}
                >
                  <div
                    style={{
                      width: '100%',
                      height: w,
                      borderRadius: 1,
                      background: (activeShape.strokeWidth || 1.5) === w ? '#fff' : 'currentColor'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Editing for Text Shapes */}
        {activeShape.type === 'text' && (
          <div className="prop-section">
            <span className="prop-label">Content</span>
            <textarea
              className="text-edit-input"
              value={activeShape.text || ''}
              onChange={(e) => handleUpdate({ text: e.target.value })}
              rows={3}
            />
          </div>
        )}

        {/* Arrange & Layout Controls */}
        <div className="prop-section arrange-section">
          <span className="prop-label">Arrange & Spacing</span>
          <button
            type="button"
            className="tidy-btn"
            onClick={handleAutoArrange}
            title="Auto-arrange diagram layout with orthogonal lines and clean spacing"
          >
            <Sparkles size={13} />
            <span>Tidy Diagram Layout</span>
          </button>

          <div className="z-order-btns">
            <button
              type="button"
              className="z-btn"
              onClick={handleBringToFront}
              title="Bring to Front"
            >
              <ArrowUp size={13} />
              <span>Forward</span>
            </button>
            <button
              type="button"
              className="z-btn"
              onClick={handleSendToBack}
              title="Send to Back"
            >
              <ArrowDown size={13} />
              <span>Backward</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .properties-panel {
          position: absolute;
          left: 20px;
          top: 20px;
          width: 248px;
          background: var(--surface-raised, #FFFFFF);
          border: 1px solid var(--line, #E5E4DE);
          border-radius: 8px;
          box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.08));
          z-index: 45;
          overflow: hidden;
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          animation: panelFadeIn 120ms ease-out;
        }
        @keyframes panelFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .panel-header {
          padding: 10px 14px;
          border-bottom: 1px solid var(--line, #E5E4DE);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--surface-subtle, #F7F6F3);
        }
        .panel-header-titles {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .panel-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--ink, #26241F);
        }
        .panel-subtitle {
          font-size: 0.6875rem;
          color: var(--ink-muted, #726E67);
          text-transform: capitalize;
        }
        .close-panel-btn {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--ink-muted, #726E67);
          cursor: pointer;
          transition: background-color 120ms, color 120ms;
        }
        .close-panel-btn:hover {
          background: var(--surface-subtle, #EAE8E2);
          color: var(--ink, #26241F);
        }
        .panel-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .prop-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .prop-label {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--ink-muted, #726E67);
        }
        .color-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .color-btn {
          width: 100%;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          transition: transform 100ms, box-shadow 100ms;
        }
        .color-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 2px 6px rgba(0,0,0,0.12);
        }
        .color-btn.active-color {
          outline: 2px solid var(--moss, #4B6455);
          outline-offset: 1px;
        }
        .width-btns {
          display: flex;
          gap: 6px;
        }
        .width-btn {
          flex: 1;
          height: 26px;
          border: 1px solid var(--line, #E5E4DE);
          background: #FFFFFF;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          color: var(--ink-muted, #726E67);
          transition: all 120ms ease;
        }
        .width-btn:hover {
          background: var(--surface-subtle, #F7F6F3);
          color: var(--ink, #26241F);
        }
        .width-btn.active {
          background: var(--moss, #4B6455);
          border-color: var(--moss, #4B6455);
          color: #FFFFFF;
        }
        .text-edit-input {
          width: 100%;
          font-family: inherit;
          font-size: 0.8125rem;
          padding: 6px 8px;
          border: 1px solid var(--line, #E5E4DE);
          border-radius: 4px;
          resize: vertical;
          color: var(--ink, #26241F);
          background: #FFFFFF;
        }
        .text-edit-input:focus {
          outline: none;
          border-color: var(--moss, #4B6455);
        }
        .arrange-section {
          border-top: 1px solid var(--line, #E5E4DE);
          padding-top: 12px;
          margin-top: 2px;
        }
        .tidy-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 28px;
          background: var(--surface-subtle, #F7F6F3);
          border: 1px solid var(--line, #E5E4DE);
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--ink, #26241F);
          cursor: pointer;
          transition: all 120ms ease;
        }
        .tidy-btn:hover {
          background: var(--moss-subtle, #EEF4F0);
          color: var(--moss, #4B6455);
          border-color: rgba(75, 100, 85, 0.3);
        }
        .z-order-btns {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .z-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          height: 26px;
          background: transparent;
          border: 1px solid var(--line, #E5E4DE);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: var(--ink-muted, #726E67);
          cursor: pointer;
          transition: all 120ms ease;
        }
        .z-btn:hover {
          background: var(--surface-subtle, #F7F6F3);
          color: var(--ink, #26241F);
        }
      `}</style>
    </div>
  );
}
