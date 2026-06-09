import React from 'react';
import { MousePointer2, Hand, Square, Circle, Minus, PenTool, Type, Undo, Redo, Scan } from 'lucide-react';
import useCanvasStore from '../hooks/useCanvasStore';

const tools = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'hand', icon: Hand, label: 'Pan (H)' },
  { id: 'marquee', icon: Scan, label: 'Region select (M)' },
  { id: 'rectangle', icon: Square, label: 'Rectangle (R)' },
  { id: 'circle', icon: Circle, label: 'Circle (O)' },
  { id: 'arrow', icon: Minus, label: 'Arrow (A)' },
  { id: 'pencil', icon: PenTool, label: 'Draw (P)' },
  { id: 'text', icon: Type, label: 'Text (T)' },
];

export default function Toolbar() {
  const activeTool = useCanvasStore((state) => state.activeTool);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const undoManager = useCanvasStore((state) => state.undoManager);
  
  // Force update when stack changes
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (undoManager) {
      const listener = () => setTick(t => t + 1);
      undoManager.on('stack-item-added', listener);
      undoManager.on('stack-item-popped', listener);
      return () => {
        undoManager.off('stack-item-added', listener);
        undoManager.off('stack-item-popped', listener);
      }
    }
  }, [undoManager]);

  const canUndo = undoManager && undoManager.undoStack.length > 0;
  const canRedo = undoManager && undoManager.redoStack.length > 0;

  return (
    <div className="canvas-toolbar">
      <div className="toolbar-group">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              className={`tool-btn ${isActive ? 'active' : ''}`}
              title={t.label}
              onClick={() => setActiveTool(t.id)}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </button>
          );
        })}
      </div>
      
      <div className="toolbar-divider" />
      
      <div className="toolbar-group">
        <button 
          className="tool-btn" 
          title="Undo" 
          onClick={undo} 
          disabled={!canUndo}
          style={{ opacity: !canUndo ? 0.4 : 1 }}
        >
          <Undo size={18} />
        </button>
        <button 
          className="tool-btn" 
          title="Redo" 
          onClick={redo} 
          disabled={!canRedo}
          style={{ opacity: !canRedo ? 0.4 : 1 }}
        >
          <Redo size={18} />
        </button>
      </div>

      <style>{`
        .canvas-toolbar {
          position: absolute;
          left: 20px;
          top: 50%;
          transform: translateY(-50%);
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          z-index: 50;
        }
        .toolbar-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .toolbar-divider {
          height: 1px;
          background: var(--color-border);
          margin: 4px 0;
        }
        .tool-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tool-btn:hover:not(:disabled) {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
        .tool-btn.active {
          background: var(--color-brand-light);
          color: var(--color-brand);
        }
      `}</style>
    </div>
  );
}
