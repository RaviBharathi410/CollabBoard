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
import ClarificationPopup from './components/ClarificationPopup';
import AskPanel from './components/AskPanel';
import AIStatusBar from './components/AIStatusBar';
import { Sparkles, MessageCircle } from 'lucide-react';

export default function CanvasStage() {
  const { id } = useParams();
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [marquee, setMarquee] = useState(null);
  const [askOpen, setAskOpen] = useState(false);
  const isMarqueeDrawing = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });

  const { position, scale, handleWheel } = useViewport();
  const { others, updateCursor } = useMultiplayer(id || 'default');
  const {
    state: aiState,
    enhanceDiagram,
    answerClarification,
    askQuestion,
    retryEnhance,
    dismissError,
    applySuggestion,
  } = useAIEngine(stageRef);

  const activeTool = useCanvasStore((state) => state.activeTool);
  const addShape = useCanvasStore((state) => state.addShape);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const clearSelection = useCanvasStore((state) => state.clearSelection);

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const setTool = useCanvasStore.getState().setActiveTool;
      const { undo, redo, deleteShapes, selectedIds } = useCanvasStore.getState();

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) deleteShapes(selectedIds);
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      } else {
        const key = e.key.toLowerCase();
        if (key === 'v') setTool('select');
        if (key === 'h') setTool('hand');
        if (key === 'm') setTool('marquee');
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

  const marqueeToScreen = (rect) => {
    if (!rect) return null;
    return {
      left: rect.x * scale + position.x,
      top: rect.y * scale + position.y,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  };

  const handleEnhance = async () => {
    const options = {};
    if (marquee && marquee.width > 10 && marquee.height > 10) {
      options.selectionBounds = { ...marquee };
    }
    const result = await enhanceDiagram(options);
    if (result?.clearMarquee) setMarquee(null);
  };

  const handlePointerDown = (e) => {
    const stage = e.target.getStage();
    const clickedOnEmpty = e.target === stage || e.target.name() === 'grid';

    if (activeTool === 'marquee' && clickedOnEmpty) {
      const pos = getPointerPos(stage);
      isMarqueeDrawing.current = true;
      marqueeStart.current = pos;
      setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    if (clickedOnEmpty) clearSelection();
    if (activeTool === 'select' || activeTool === 'hand' || activeTool === 'marquee') return;

    isDrawing.current = true;
    const pos = getPointerPos(stage);
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
        const shapeId = addShape({ type: 'text', x: pos.x, y: pos.y, text, width: 200 });
        setSelectedIds([shapeId]);
      }
      isDrawing.current = false;
      useCanvasStore.getState().setActiveTool('select');
    }
  };

  const handlePointerMove = (e) => {
    const stage = e.target.getStage();
    const pos = getPointerPos(stage);
    updateCursor(pos.x, pos.y);

    if (isMarqueeDrawing.current) {
      const sx = marqueeStart.current.x;
      const sy = marqueeStart.current.y;
      setMarquee({
        x: Math.min(pos.x, sx),
        y: Math.min(pos.y, sy),
        width: Math.abs(pos.x - sx),
        height: Math.abs(pos.y - sy),
      });
      return;
    }

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
      const shape = store.shapes.find((s) => s.id === newShapeId.current);
      if (shape) {
        store.updateShapeSilent(newShapeId.current, {
          points: [...shape.points, pos.x, pos.y],
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (isMarqueeDrawing.current) {
      isMarqueeDrawing.current = false;
      useCanvasStore.getState().setActiveTool('select');
      return;
    }

    if (isDrawing.current) {
      isDrawing.current = false;
      if (newShapeId.current) {
        const store = useCanvasStore.getState();
        const shape = store.shapes.find((s) => s.id === newShapeId.current);
        if (shape) {
          const isTooSmall =
            (shape.type === 'rectangle' && shape.width < 5 && shape.height < 5) ||
            (shape.type === 'circle' && shape.radiusX < 5 && shape.radiusY < 5) ||
            (shape.type === 'arrow' &&
              Math.abs(shape.points[0] - shape.points[2]) < 5 &&
              Math.abs(shape.points[1] - shape.points[3]) < 5) ||
            (shape.type === 'pencil' && shape.points.length < 4);

          if (isTooSmall) {
            store.deleteShapes([shape.id]);
          } else {
            store.updateShape(shape.id, { ...shape });
            setSelectedIds([shape.id]);
          }
        }
      }
      newShapeId.current = null;
      useCanvasStore.getState().setActiveTool('select');
    }
  };

  const screenMarquee = marqueeToScreen(marquee);
  const isBusy = aiState.isProcessing || aiState.isAsking;

  const clarificationAnchor = (() => {
    const clar = aiState.clarification;
    if (!clar?.nodeId || !stageRef.current) return null;
    const shapes = useCanvasStore.getState().shapes;
    const target = shapes.find((s) => s.id === clar.nodeId);
    if (!target) return null;
    const stage = stageRef.current;
    const sx = stage.scaleX() || 1;
    const sy = stage.scaleY() || 1;
    let cx = target.x;
    let cy = target.y;
    if (target.type === 'rectangle') {
      cx += (target.width || 0) / 2;
      cy += (target.height || 0) / 2;
    } else if (target.type === 'circle') {
      cx = target.x;
      cy = target.y;
    }
    return {
      x: cx * sx + position.x,
      y: cy * sy + position.y,
    };
  })();

  return (
    <div
      id="canvas-stage"
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)',
        position: 'relative',
      }}
    >
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
        style={{
          cursor:
            activeTool === 'hand'
              ? 'grab'
              : activeTool === 'marquee'
                ? 'crosshair'
                : activeTool !== 'select'
                  ? 'crosshair'
                  : 'default',
        }}
      >
        <GridLayer width={size.width} height={size.height} scale={scale} position={position} />
        <ShapesLayer selectedIds={selectedIds} onSelect={(shapeId) => setSelectedIds([shapeId])} />
        <CursorLayer others={others} />
      </Stage>

      {screenMarquee && screenMarquee.width > 2 && (
        <div
          className="marquee-overlay"
          style={{
            left: screenMarquee.left,
            top: screenMarquee.top,
            width: screenMarquee.width,
            height: screenMarquee.height,
          }}
        />
      )}

      <AIStatusBar
        stage={aiState.stage}
        progress={aiState.progress}
        modelUsed={aiState.modelUsed}
        processingMs={aiState.processingMs}
        aiError={aiState.aiError}
        onRetry={retryEnhance}
        onDismissError={dismissError}
      />

      <ClarificationPopup
        clarification={aiState.clarification}
        isProcessing={aiState.isProcessing}
        onAnswer={answerClarification}
        anchor={clarificationAnchor}
      />

      <AskPanel
        open={askOpen}
        onClose={() => setAskOpen(false)}
        onAsk={askQuestion}
        onApplySuggestion={applySuggestion}
        askResponse={aiState.askResponse}
        isAsking={aiState.isAsking}
      />

      <div className="ai-fab-container">
        <button
          type="button"
          className="ai-fab ai-fab-secondary"
          onClick={() => setAskOpen(true)}
          disabled={isBusy}
          title="Ask AI about your diagram"
        >
          <MessageCircle size={18} />
          <span>Ask me</span>
        </button>
        <button
          type="button"
          className="ai-fab"
          onClick={handleEnhance}
          disabled={isBusy}
          title={marquee ? 'Enhance selected region' : 'Enhance entire canvas'}
        >
          <Sparkles size={18} />
          <span>{aiState.isProcessing ? 'Enhancing...' : 'Enhance with AI'}</span>
        </button>
      </div>

      <style>{`
        .marquee-overlay {
          position: absolute;
          border: 2px dashed #6c63ff;
          background: rgba(108, 99, 255, 0.08);
          pointer-events: none;
          z-index: 40;
          border-radius: 4px;
        }
        .ai-fab-container {
          position: absolute;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          z-index: 50;
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
        .ai-fab-secondary {
          background: #fff;
          color: #6c63ff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .ai-fab-secondary:hover:not(:disabled) {
          background: #eeedfe;
        }
        .ai-fab:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(108, 99, 255, 0.4);
          background: var(--color-brand-dark);
        }
        .ai-fab:disabled,
        .ai-fab-secondary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
