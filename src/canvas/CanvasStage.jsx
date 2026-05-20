import React, { useRef, useState, useEffect } from 'react';
import { Stage } from 'react-konva';
import { useParams } from 'react-router-dom';
import useViewport from './hooks/useViewport';
import useCanvasStore from './hooks/useCanvasStore';
import useMultiplayer from './hooks/useMultiplayer';
import useAIEngine from './hooks/useAIEngine';
import GridLayer from './layers/GridLayer';
import ShapesLayer from './layers/ShapesLayer';
import CursorLayer from './layers/CursorLayer';
import { Sparkles, Loader2 } from 'lucide-react';

export default function CanvasStage() {
  const { id } = useParams();
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const { position, scale, handleWheel } = useViewport();
  const { others, updateCursor } = useMultiplayer(id || 'default');
  const { enhanceDiagram, isProcessing, aiError } = useAIEngine(stageRef);
  
  const activeTool = useCanvasStore((state) => state.activeTool);
  const addShape = useCanvasStore((state) => state.addShape);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const clearSelection = useCanvasStore((state) => state.clearSelection);

  // Resize observer
  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const setTool = useCanvasStore.getState().setActiveTool;
      const { undo, redo, deleteShapes, selectedIds } = useCanvasStore.getState();

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) deleteShapes(selectedIds);
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo(); else undo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      } else {
        const key = e.key.toLowerCase();
        if (key === 'v') setTool('select');
        if (key === 'h') setTool('hand');
        if (key === 'r') setTool('rectangle');
        if (key === 'o') setTool('circle');
        if (key === 'a') setTool('arrow');
        if (key === 'p') setTool('pencil');
        if (key === 't') setTool('text');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drawing state
  const isDrawing = useRef(false);
  const newShapeId = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });

  const getPointerPos = (stage) => {
    const pointer = stage.getPointerPosition();
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  };

  const handlePointerDown = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'grid';
    if (clickedOnEmpty) {
      clearSelection();
    }

    if (activeTool === 'select' || activeTool === 'hand') return;

    isDrawing.current = true;
    const pos = getPointerPos(e.target.getStage());
    startPos.current = pos;

    if (activeTool === 'rectangle') {
      newShapeId.current = addShape({ type: 'rectangle', x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (activeTool === 'circle') {
      newShapeId.current = addShape({ type: 'circle', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0 });
    } else if (activeTool === 'arrow') {
      newShapeId.current = addShape({ type: 'arrow', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y] });
    } else if (activeTool === 'pencil') {
      newShapeId.current = addShape({ type: 'pencil', x: 0, y: 0, points: [pos.x, pos.y] });
    } else if (activeTool === 'text' && clickedOnEmpty) {
      const text = window.prompt('Enter text:');
      if (text) {
        const id = addShape({ type: 'text', x: pos.x, y: pos.y, text, width: 200 });
        setSelectedIds([id]);
      }
      isDrawing.current = false;
      useCanvasStore.getState().setActiveTool('select');
    }
  };

  const handlePointerMove = (e) => {
    const stage = e.target.getStage();
    const pos = getPointerPos(stage);
    
    // Broadcast cursor position to other users
    updateCursor(pos.x, pos.y);

    if (!isDrawing.current || !newShapeId.current) return;
    
    const sx = startPos.current.x;
    const sy = startPos.current.y;
    const store = useCanvasStore.getState();

    if (activeTool === 'rectangle') {
      store.updateShapeSilent(newShapeId.current, {
        x: Math.min(pos.x, sx),
        y: Math.min(pos.y, sy),
        width: Math.abs(pos.x - sx),
        height: Math.abs(pos.y - sy),
      });
    } else if (activeTool === 'circle') {
      store.updateShapeSilent(newShapeId.current, {
        radiusX: Math.abs(pos.x - sx),
        radiusY: Math.abs(pos.y - sy),
      });
    } else if (activeTool === 'arrow') {
      store.updateShapeSilent(newShapeId.current, {
        points: [sx, sy, pos.x, pos.y],
      });
    } else if (activeTool === 'pencil') {
      const shape = store.shapes.find(s => s.id === newShapeId.current);
      if (shape) {
        store.updateShapeSilent(newShapeId.current, {
          points: [...shape.points, pos.x, pos.y],
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      if (newShapeId.current) {
        const store = useCanvasStore.getState();
        const shape = store.shapes.find(s => s.id === newShapeId.current);
        if (shape) {
          // Discard shapes that are too small (accidental clicks)
          const isTooSmall = 
            (shape.type === 'rectangle' && shape.width < 5 && shape.height < 5) ||
            (shape.type === 'circle' && shape.radiusX < 5 && shape.radiusY < 5) ||
            (shape.type === 'arrow' && Math.abs(shape.points[0] - shape.points[2]) < 5 && Math.abs(shape.points[1] - shape.points[3]) < 5) ||
            (shape.type === 'pencil' && shape.points.length < 4);

          if (isTooSmall) {
            store.deleteShapes([shape.id]);
          } else {
            store.updateShape(shape.id, { ...shape }); // Commit to history
            setSelectedIds([shape.id]);
          }
        }
      }
      newShapeId.current = null;
      useCanvasStore.getState().setActiveTool('select');
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'var(--color-bg-primary)', position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        draggable={activeTool === 'hand'}
        style={{ cursor: activeTool === 'hand' ? 'grab' : (activeTool !== 'select' ? 'crosshair' : 'default') }}
      >
        <GridLayer width={size.width} height={size.height} scale={scale} position={position} />
        <ShapesLayer selectedIds={selectedIds} onSelect={(id) => setSelectedIds([id])} />
        <CursorLayer others={others} />
      </Stage>

      {/* AI Assistant Floating Action Button */}
      <div className="ai-fab-container">
        {aiError && <div className="ai-error">{aiError}</div>}
        <button 
          className="ai-fab" 
          onClick={enhanceDiagram}
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
          <span>{isProcessing ? 'Enhancing...' : 'Enhance with AI'}</span>
        </button>
      </div>

      <style>{`
        .ai-fab-container {
          position: absolute;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          z-index: 50;
        }
        .ai-error {
          background: #FEF2F2;
          color: #DC2626;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .ai-fab {
          background: var(--color-brand);
          color: #fff;
          border: none;
          padding: 12px 20px;
          border-radius: 100px;
          font-weight: 600;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(108, 99, 255, 0.3);
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .ai-fab:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(108, 99, 255, 0.4);
          background: var(--color-brand-dark);
        }
        .ai-fab:disabled {
          background: var(--color-brand-mid);
          cursor: not-allowed;
          opacity: 0.8;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
