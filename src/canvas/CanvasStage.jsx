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
import AIStatusBar from './components/AIStatusBar';
import Toolbar from './ui/Toolbar';
import PropertiesPanel from './ui/PropertiesPanel';
import OutlineMode from './components/OutlineMode';
import TracingOverlay from './components/TracingOverlay';
import { Sparkles } from 'lucide-react';

export default function CanvasStage({ isOutlineOpen: externalOutlineOpen, onCloseOutline }) {
  const { id } = useParams();
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [marquee, setMarquee] = useState(null);
  const [internalOutlineOpen, setInternalOutlineOpen] = useState(false);
  const isOutlineOpen = externalOutlineOpen !== undefined ? externalOutlineOpen : internalOutlineOpen;

  const isMarqueeDrawing = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });

  const { position, scale, handleWheel } = useViewport();
  const { others, updateCursor } = useMultiplayer(id || 'default');
  const {
    state: aiState,
    enhanceDiagram,
    answerClarification,
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

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept shortcuts when typing in an input field or contenteditable element
      if (
        e.target?.tagName === 'INPUT' ||
        e.target?.tagName === 'TEXTAREA' ||
        e.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      const store = useCanvasStore.getState();
      const setTool = store.setActiveTool;
      const {
        undo,
        redo,
        deleteShapes,
        selectedIds,
        selectAll,
        copy,
        cut,
        paste,
        duplicate,
      } = store;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteShapes(selectedIds);
        }
      } else if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        } else if (key === 'a') {
          e.preventDefault();
          selectAll();
        } else if (key === 'c') {
          e.preventDefault();
          copy();
        } else if (key === 'x') {
          e.preventDefault();
          cut();
        } else if (key === 'v') {
          e.preventDefault();
          paste();
        } else if (key === 'd') {
          e.preventDefault();
          duplicate();
        }
      } else {
        const key = e.key.toLowerCase();
        if (key === 'o') {
          // Toggle Outline Mode per redesign spec
          if (onCloseOutline && externalOutlineOpen) {
            onCloseOutline();
          } else {
            setInternalOutlineOpen((prev) => !prev);
          }
        }
        if (key === 'v') setTool('select');
        if (key === 'h') setTool('hand');
        if (key === 'm') setTool('marquee');
        if (key === 'r') setTool('rectangle');
        if (key === 'c') setTool('circle');
        if (key === 'a') setTool('arrow');
        if (key === 'p') setTool('pencil');
        if (key === 't') setTool('text');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [externalOutlineOpen, onCloseOutline]);

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
      newShapeId.current = addShape({ type: 'rectangle', x: pos.x, y: pos.y, width: 0, height: 0, fill: '#FFFFFF', stroke: '#26241F' });
    } else if (activeTool === 'circle') {
      newShapeId.current = addShape({ type: 'circle', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0, fill: '#FFFFFF', stroke: '#26241F' });
    } else if (activeTool === 'arrow') {
      newShapeId.current = addShape({ type: 'arrow', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], stroke: '#26241F' });
    } else if (activeTool === 'pencil') {
      newShapeId.current = addShape({ type: 'pencil', x: 0, y: 0, points: [pos.x, pos.y], stroke: '#26241F' });
    } else if (activeTool === 'text' && clickedOnEmpty) {
      const text = window.prompt('Enter drafting text:');
      if (text) {
        const shapeId = addShape({ type: 'text', x: pos.x, y: pos.y, text, width: 160, fill: '#26241F' });
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
      const x1 = marqueeStart.current.x;
      const y1 = marqueeStart.current.y;
      const x2 = pos.x;
      const y2 = pos.y;
      setMarquee({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
      return;
    }

    if (!isDrawing.current || !newShapeId.current) return;
    const updateShapeSilent = useCanvasStore.getState().updateShapeSilent;

    if (activeTool === 'rectangle') {
      const w = pos.x - startPos.current.x;
      const h = pos.y - startPos.current.y;
      updateShapeSilent(newShapeId.current, {
        x: w < 0 ? pos.x : startPos.current.x,
        y: h < 0 ? pos.y : startPos.current.y,
        width: Math.abs(w),
        height: Math.abs(h),
      });
    } else if (activeTool === 'circle') {
      const rx = Math.abs(pos.x - startPos.current.x);
      const ry = Math.abs(pos.y - startPos.current.y);
      updateShapeSilent(newShapeId.current, { radiusX: rx, radiusY: ry });
    } else if (activeTool === 'arrow') {
      updateShapeSilent(newShapeId.current, {
        points: [startPos.current.x, startPos.current.y, pos.x, pos.y],
      });
    } else if (activeTool === 'pencil') {
      const shape = useCanvasStore.getState().shapes.find((s) => s.id === newShapeId.current);
      if (shape) {
        updateShapeSilent(newShapeId.current, {
          points: [...shape.points, pos.x, pos.y],
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (isMarqueeDrawing.current) {
      isMarqueeDrawing.current = false;
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;
    newShapeId.current = null;
    useCanvasStore.getState().setActiveTool('select');
  };

  const isDraggable = activeTool === 'hand';
  const screenMarquee = marqueeToScreen(marquee);
  const isBusy = aiState.isProcessing;

  return (
    <div
      ref={containerRef}
      className="canvas-container-root bg-graph-paper"
      id="canvas-stage"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: activeTool === 'hand' ? 'grab' : activeTool === 'pencil' ? 'crosshair' : 'default',
        overflow: 'hidden',
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={isDraggable}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <GridLayer width={size.width} height={size.height} scale={scale} position={position} />
        <ShapesLayer selectedIds={selectedIds} onSelect={(id) => setSelectedIds([id])} />
        <CursorLayer others={others} />
      </Stage>

      {/* Floating Bottom-Center Drafting Toolbar */}
      <Toolbar />

      {/* Properties Panel for selected shapes */}
      <PropertiesPanel />

      {/* Accessible Outline Mode Drawer */}
      <OutlineMode 
        isOpen={isOutlineOpen} 
        onClose={() => {
          if (onCloseOutline) onCloseOutline();
          else setInternalOutlineOpen(false);
        }} 
      />

      {/* Ochre Tracing-Paper AI Overlay */}
      <TracingOverlay
        isVisible={aiState.stage === 'preview' || Boolean(aiState.clarification)}
        suggestionTitle="AI Diagram Layout Blueprint"
        nodeCount={useCanvasStore.getState().shapes.filter((s) => s.aiGenerated).length}
        onAccept={() => {
          // Commit preview shapes to permanent ink state
          const store = useCanvasStore.getState();
          store.shapes.forEach((s) => {
            if (s.aiGenerated && (s.opacity ?? 1) < 1) {
              store.updateShape(s.id, { opacity: 1, fill: '#FFFFFF', stroke: '#26241F' });
            }
          });
        }}
        onDismiss={() => {
          // Remove preview shapes
          const store = useCanvasStore.getState();
          const previewIds = store.shapes.filter((s) => s.aiGenerated && (s.opacity ?? 1) < 1).map((s) => s.id);
          if (previewIds.length > 0) store.deleteShapes(previewIds);
        }}
      />

      {/* Marquee Region Visualizer */}
      {screenMarquee && screenMarquee.width > 2 && screenMarquee.height > 2 && (
        <div
          className="marquee-overlay"
          style={{
            left: `${screenMarquee.left}px`,
            top: `${screenMarquee.top}px`,
            width: `${screenMarquee.width}px`,
            height: `${screenMarquee.height}px`,
          }}
        />
      )}

      {/* AI Processing Status */}
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
      />

      {/* Quiet AI Enhance Action Button */}
      <div className="drafting-ai-action-wrap">
        <button
          type="button"
          className="drafting-ai-btn"
          onClick={handleEnhance}
          disabled={isBusy}
          title={marquee ? 'Enhance selected region with AI' : 'Draft full diagram from sketch'}
        >
          <Sparkles size={15} />
          <span>{aiState.isProcessing ? 'Drafting...' : 'AI Enhance'}</span>
        </button>
      </div>

      <style>{`
        .canvas-container-root {
          background-color: var(--surface-paper);
        }
        .marquee-overlay {
          position: absolute;
          border: 1.5px dashed var(--ochre);
          background: var(--ochre-translucent);
          pointer-events: none;
          z-index: 25;
          border-radius: 3px;
        }
        .drafting-ai-action-wrap {
          position: absolute;
          bottom: 24px;
          right: 24px;
          z-index: 30;
        }
        .drafting-ai-btn {
          background: var(--moss);
          color: var(--ink-white);
          border: 1px solid var(--moss);
          padding: 8px 16px;
          border-radius: 4px;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: background-color 150ms ease, box-shadow 150ms ease;
        }
        .drafting-ai-btn:hover:not(:disabled) {
          background: var(--moss-hover);
          box-shadow: var(--shadow-md);
        }
        .drafting-ai-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
