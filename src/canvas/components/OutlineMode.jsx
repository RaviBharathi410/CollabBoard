import { X, Square, Circle, Minus, PenTool, Type, CornerDownRight } from 'lucide-react';
import useCanvasStore from '../hooks/useCanvasStore';

export default function OutlineMode({ isOpen, onClose }) {
  const shapes = useCanvasStore((state) => state.shapes);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);

  if (!isOpen) return null;

  const getShapeIcon = (type) => {
    switch (type) {
      case 'rectangle': return <Square size={14} />;
      case 'circle': return <Circle size={14} />;
      case 'arrow': return <Minus size={14} />;
      case 'pencil': return <PenTool size={14} />;
      case 'text': return <Type size={14} />;
      default: return <Square size={14} />;
    }
  };

  const handleSelect = (shapeId) => {
    setSelectedIds([shapeId]);
  };

  // Group nodes vs connections
  const nodes = shapes.filter((s) => s.type !== 'arrow' && s.type !== 'pencil');
  const connections = shapes.filter((s) => s.type === 'arrow');
  const sketches = shapes.filter((s) => s.type === 'pencil');

  return (
    <aside 
      className="outline-panel" 
      role="region" 
      aria-label="Canvas Outline Mode"
      aria-live="polite"
    >
      <div className="outline-header">
        <div className="outline-header-title">
          <span className="outline-title">Canvas Outline</span>
          <span className="outline-count">{shapes.length} elements</span>
        </div>
        <button 
          type="button" 
          className="outline-close-btn" 
          onClick={onClose} 
          aria-label="Close Outline Mode (O)"
          title="Close Outline Mode (O)"
        >
          <X size={16} />
        </button>
      </div>

      <div className="outline-body">
        {shapes.length === 0 ? (
          <div className="outline-empty">
            <p>Canvas is empty.</p>
            <span>Add shapes or draw to populate the outline.</span>
          </div>
        ) : (
          <>
            {/* 1. Structural Nodes */}
            {nodes.length > 0 && (
              <section className="outline-section" aria-label="Nodes">
                <h3 className="section-title">Diagram Nodes ({nodes.length})</h3>
                <ul className="outline-list">
                  {nodes.map((node, i) => {
                    const isSelected = selectedIds.includes(node.id);
                    const label = node.text || node.label || `Node ${i + 1}`;
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          className={`outline-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelect(node.id)}
                          aria-selected={isSelected}
                        >
                          <span className="item-glyph">{getShapeIcon(node.type)}</span>
                          <span className="item-label">{label}</span>
                          <span className="item-type-badge">{node.type}</span>
                          {node.aiGenerated && <span className="ai-tag">AI</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 2. Connections & Arrows */}
            {connections.length > 0 && (
              <section className="outline-section" aria-label="Connections">
                <h3 className="section-title">Flow Connections ({connections.length})</h3>
                <ul className="outline-list">
                  {connections.map((conn, i) => {
                    const isSelected = selectedIds.includes(conn.id);
                    return (
                      <li key={conn.id}>
                        <button
                          type="button"
                          className={`outline-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelect(conn.id)}
                          aria-selected={isSelected}
                        >
                          <span className="item-glyph"><CornerDownRight size={14} /></span>
                          <span className="item-label">
                            {conn.label || `Connection ${i + 1}`}
                          </span>
                          <span className="item-type-badge">
                            {conn.dash ? 'dashed' : 'solid'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 3. Freehand Sketches */}
            {sketches.length > 0 && (
              <section className="outline-section" aria-label="Sketches">
                <h3 className="section-title">Hand-Drawn Sketches ({sketches.length})</h3>
                <ul className="outline-list">
                  {sketches.map((sk, i) => {
                    const isSelected = selectedIds.includes(sk.id);
                    return (
                      <li key={sk.id}>
                        <button
                          type="button"
                          className={`outline-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelect(sk.id)}
                          aria-selected={isSelected}
                        >
                          <span className="item-glyph"><PenTool size={14} /></span>
                          <span className="item-label">Stroke {i + 1}</span>
                          <span className="item-type-badge">ink</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <div className="outline-footer">
        <span>Press <kbd>O</kbd> to toggle</span>
        <span>Click item to select</span>
      </div>

      <style>{`
        .outline-panel {
          position: fixed;
          top: var(--navbar-height);
          left: var(--rail-width);
          bottom: 0;
          width: 280px;
          background: var(--surface-raised);
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          z-index: 32;
          box-shadow: 2px 0 8px rgba(38, 36, 31, 0.04);
          font-family: var(--font-sans);
          user-select: none;
        }
        .outline-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--line);
          background: var(--surface-subtle);
        }
        .outline-header-title {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .outline-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
        }
        .outline-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-faint);
        }
        .outline-close-btn {
          color: var(--ink-faint);
          padding: 4px;
          border-radius: 3px;
        }
        .outline-close-btn:hover {
          color: var(--ink);
          background: var(--surface-paper);
        }
        .outline-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .outline-empty {
          margin: auto;
          text-align: center;
          color: var(--ink-faint);
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .outline-empty span {
          font-size: 11.5px;
        }
        .outline-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .section-title {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .outline-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .outline-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 12.5px;
          color: var(--ink);
          text-align: left;
          cursor: pointer;
          transition: background 100ms ease;
          border: 1px solid transparent;
        }
        .outline-item:hover {
          background: var(--surface-subtle);
        }
        .outline-item.selected {
          background: var(--moss-subtle);
          border-color: rgba(75, 100, 85, 0.25);
          color: var(--moss);
          font-weight: 500;
        }
        .item-glyph {
          color: var(--ink-muted);
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .outline-item.selected .item-glyph {
          color: var(--moss);
        }
        .item-label {
          flex: 1;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
        .item-type-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ink-faint);
          background: var(--surface-paper);
          border: 1px solid var(--line);
          padding: 1px 4px;
          border-radius: 3px;
        }
        .ai-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          color: #FFFFFF;
          background: var(--ochre);
          padding: 1px 4px;
          border-radius: 2px;
          font-weight: 600;
        }
        .outline-footer {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          border-top: 1px solid var(--line);
          background: var(--surface-subtle);
          font-size: 11px;
          color: var(--ink-faint);
        }
        .outline-footer kbd {
          font-family: var(--font-mono);
          background: var(--surface-raised);
          border: 1px solid var(--line);
          padding: 0 4px;
          border-radius: 2px;
        }
      `}</style>
    </aside>
  );
}
