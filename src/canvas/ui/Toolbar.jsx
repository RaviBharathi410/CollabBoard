import React from 'react';
import { 
  MousePointer2, 
  Hand, 
  Square, 
  Circle, 
  Diamond,
  Minus, 
  PenTool, 
  Type, 
  Undo, 
  Redo, 
  Scan,
  Sparkles,
  Plus
} from 'lucide-react';
import useCanvasStore from '../hooks/useCanvasStore';
import { autoArrangeDiagram } from '../utils/orthogonalRouter';

const tools = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'hand', icon: Hand, label: 'Pan (H)' },
  { id: 'marquee', icon: Scan, label: 'Marquee Region (M)' },
  { id: 'rectangle', icon: Square, label: 'Rectangle (R)' },
  { id: 'circle', icon: Circle, label: 'Circle (C)' },
  { id: 'diamond', icon: Diamond, label: 'Diamond (D)' },
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
  const diagramType = useCanvasStore((state) => state.diagramType);
  const addShape = useCanvasStore((state) => state.addShape);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (undoManager) {
      const listener = () => setTick((t) => t + 1);
      undoManager.on('stack-item-added', listener);
      undoManager.on('stack-item-popped', listener);
      return () => {
        undoManager.off('stack-item-added', listener);
        undoManager.off('stack-item-popped', listener);
      };
    }
  }, [undoManager]);

  // Global keyboard shortcuts for tools: V, H, R, C (or O), D, A, P, T
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target?.tagName === 'INPUT' ||
        e.target?.tagName === 'TEXTAREA' ||
        e.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key?.toLowerCase();
      switch (key) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 'r':
          setActiveTool('rectangle');
          break;
        case 'c':
        case 'o':
          setActiveTool('circle');
          break;
        case 'd':
          setActiveTool('diamond');
          break;
        case 'a':
          setActiveTool('arrow');
          break;
        case 'p':
          setActiveTool('pencil');
          break;
        case 't':
          setActiveTool('text');
          break;
        default:
          // Unrecognized key does nothing
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  const handleQuickInsert = () => {
    if (diagramType === 'erd') {
      const id = addShape({
        type: 'erd_table',
        subtype: 'table',
        name: 'NewTable',
        columns: [
          { name: 'id', type: 'INT', isPrimaryKey: true },
          { name: 'name', type: 'VARCHAR(255)' },
        ],
        x: 250,
        y: 200,
        width: 220,
        height: 140,
      });
      setSelectedIds([id]);
    } else if (diagramType === 'uml-class') {
      const id = addShape({
        type: 'uml_class',
        subtype: 'class',
        name: 'NewClass',
        attributes: ['+ id: string'],
        methods: ['+ execute(): void'],
        x: 250,
        y: 200,
        width: 180,
        height: 120,
        fill: '#FFFFFF',
        stroke: '#26241F',
      });
      setSelectedIds([id]);
    } else if (diagramType === 'sequence') {
      const id = addShape({
        type: 'sequence_lifeline',
        name: 'Actor',
        x: 250,
        y: 100,
        width: 120,
        height: 350,
      });
      setSelectedIds([id]);
    } else if (diagramType === 'use-case') {
      const id = addShape({
        type: 'usecase_actor',
        subtype: 'actor',
        name: 'User',
        x: 250,
        y: 200,
        width: 60,
        height: 90,
      });
      setSelectedIds([id]);
    }
  };

  const canUndo = undoManager && undoManager.undoStack.length > 0;
  const canRedo = undoManager && undoManager.redoStack.length > 0;

  return (
    <nav className="drafting-floating-toolbar" aria-label="Drawing Tools">
      <div className="toolbar-section">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`tool-btn ${isActive ? 'active' : ''}`}
              title={t.label}
              aria-label={t.label}
              aria-pressed={isActive}
              onClick={() => setActiveTool(t.id)}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.75} />
            </button>
          );
        })}
      </div>
      
      {['erd', 'uml-class', 'sequence', 'use-case'].includes(diagramType) && (
        <>
          <div className="toolbar-v-divider" />
          <div className="toolbar-section">
            <button
              type="button"
              className="tool-btn quick-insert-btn"
              title={`Insert ${diagramType === 'erd' ? 'ERD Table' : diagramType === 'uml-class' ? 'UML Class' : diagramType === 'sequence' ? 'Sequence Lifeline' : 'Use Case Actor'}`}
              aria-label={`Insert ${diagramType === 'erd' ? 'Table' : diagramType === 'uml-class' ? 'Class' : diagramType === 'sequence' ? 'Lifeline' : 'Actor'}`}
              onClick={handleQuickInsert}
            >
              <Plus size={15} />
            </button>
          </div>
        </>
      )}

      <div className="toolbar-v-divider" />
      
      <div className="toolbar-section">
        <button 
          type="button"
          className="tool-btn" 
          title="Undo (Ctrl+Z)" 
          aria-label="Undo"
          onClick={undo} 
          disabled={!canUndo}
          style={{ opacity: !canUndo ? 0.35 : 1 }}
        >
          <Undo size={15} />
        </button>
        <button 
          type="button"
          className="tool-btn" 
          title="Redo (Ctrl+Y)" 
          aria-label="Redo"
          onClick={redo} 
          disabled={!canRedo}
          style={{ opacity: !canRedo ? 0.35 : 1 }}
        >
          <Redo size={15} />
        </button>
      </div>

      <div className="toolbar-v-divider" />

      <div className="toolbar-section">
        <button
          type="button"
          className="tool-btn"
          title="Tidy Diagram (Auto-Arrange Layout & Orthogonal Arrows)"
          aria-label="Tidy Diagram"
          onClick={() => {
            const store = useCanvasStore.getState();
            const arranged = autoArrangeDiagram(store.shapes);
            const history = store._pushHistory(store.shapes);
            useCanvasStore.setState({
              shapes: arranged,
              ...history,
            });
          }}
        >
          <Sparkles size={15} />
        </button>
      </div>

      <style>{`
        .drafting-floating-toolbar {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--surface-raised);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 4px 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: var(--shadow-md);
          z-index: 30;
          user-select: none;
        }
        .toolbar-section {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .toolbar-v-divider {
          width: 1px;
          height: 20px;
          background: var(--line);
          margin: 0 2px;
        }
        .tool-btn {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-muted);
          border: 1px solid transparent;
          transition: all 120ms ease;
        }
        .tool-btn:hover:not(:disabled) {
          background: var(--surface-subtle);
          color: var(--ink);
        }
        .tool-btn.active {
          background: var(--moss-subtle);
          color: var(--moss);
          border-color: rgba(75, 100, 85, 0.25);
        }
      `}</style>
    </nav>
  );
}
