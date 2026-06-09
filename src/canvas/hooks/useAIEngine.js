import { useState, useCallback, useRef } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import useCanvasStore from './useCanvasStore';
import { LAYOUT_STRATEGIES, getNodeDimensions, mapNodeShapeType } from './layoutStrategies';
import { detectInBrowser } from '../../ai/BrowserDetector';
import { trackAIEvent, AIEvents } from '../../ai/telemetry';
import { markShapeAiGenerated } from './yjsBridge';

const elk = new ELK();
const INFERENCE_BASE =
  import.meta.env.VITE_INFERENCE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8000' : '');
const LEGACY_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '' : 'http://localhost:3001');
const API_BASE = INFERENCE_BASE || LEGACY_BASE;
const FETCH_TIMEOUT_MS = 30000;

const INITIAL_STATE = {
  isProcessing: false,
  stage: null,
  progress: 0,
  aiError: null,
  clarification: null,
  askResponse: null,
  isAsking: false,
  sessionId: null,
  modelUsed: null,
  processingMs: null,
};

const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI service not configured',
  BOTH_MODELS_FAILED: 'AI temporarily unavailable — try again',
  IMAGE_TOO_LARGE: 'Canvas too complex — select a region first',
  model_parse_error: 'Could not read diagram — try a clearer sketch',
  SESSION_EXPIRED: 'Session expired — please enhance again',
  ASK_FAILED: 'AI temporarily unavailable — try again',
  AI_QUOTA_EXCEEDED:
    'AI quota exceeded — add billing at platform.openai.com or aistudio.google.com',
};

async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

function parseApiError(res, body) {
  const code = body?.code;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (body?.error) return body.error;
  if (res.status === 413) return ERROR_MESSAGES.IMAGE_TOO_LARGE;
  if (res.status === 422) return ERROR_MESSAGES.model_parse_error;
  if (res.status === 404) return ERROR_MESSAGES.SESSION_EXPIRED;
  if (res.status === 502) {
    if (body?.code === 'AI_QUOTA_EXCEEDED') return ERROR_MESSAGES.AI_QUOTA_EXCEEDED;
    const msg = body?.error || '';
    if (msg.includes('quota') || msg.includes('429')) return ERROR_MESSAGES.AI_QUOTA_EXCEEDED;
    return msg.length > 120 ? ERROR_MESSAGES.BOTH_MODELS_FAILED : msg || ERROR_MESSAGES.BOTH_MODELS_FAILED;
  }
  if (res.status === 500) return ERROR_MESSAGES.AI_NOT_CONFIGURED;
  return 'AI analysis failed';
}

function clearAIPreviewShapes() {
  const store = useCanvasStore.getState();
  const ids = store.shapes
    .filter((s) => s.aiGenerated && (s.opacity ?? 1) < 1)
    .map((s) => s.id);
  if (ids.length) store.deleteShapes(ids);
}

function summarizeShapes(shapes) {
  return shapes
    .filter((s) => s.type !== 'pencil')
    .map((s) => ({
      id: s.id,
      type: s.type,
      label: s.text || s.label || '',
      x: s.x,
      y: s.y,
    }));
}

function buildElkGraph(diagram) {
  const strategy = LAYOUT_STRATEGIES[diagram.type] || LAYOUT_STRATEGIES.unknown;
  const layoutHint = diagram.layoutHint;

  let algorithm = strategy.algorithm;
  let direction = strategy.direction;

  if (layoutHint === 'radial' || layoutHint === 'force') {
    algorithm = 'force';
    direction = undefined;
  } else if (layoutHint === 'timeline') {
    algorithm = 'layered';
    direction = 'RIGHT';
  }

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': algorithm,
      ...(direction ? { 'elk.direction': direction } : {}),
      'elk.spacing.nodeNode': String(strategy.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(strategy.layerSpacing),
      'elk.edgeRouting': strategy.edgeRouting,
    },
    children: diagram.nodes.map((n) => {
      const dims = getNodeDimensions(n.type);
      return {
        id: n.id,
        width: dims.width,
        height: dims.height,
        labels: [{ text: n.label }],
        data: n,
      };
    }),
    edges: diagram.edges.map((e, i) => ({
      id: e.id || `e${i}`,
      sources: [e.source],
      targets: [e.target],
      data: e,
    })),
  };
}

useAIEngine._lastModelUsed = 'ai-pipeline';

function mergeDiagramResults(browserResult, serverDiagram) {
  if (!serverDiagram?.nodes?.length) {
    return browserResult?.nodes?.length
      ? { type: 'architecture', nodes: browserResult.nodes, edges: [] }
      : serverDiagram;
  }
  if (!browserResult?.nodes?.length) return serverDiagram;
  const serverIds = new Set(serverDiagram.nodes.map((n) => n.id));
  const mergedNodes = [...serverDiagram.nodes];
  browserResult.nodes.forEach((bn, i) => {
    if (!serverIds.has(bn.id)) {
      mergedNodes.push({ ...bn, id: bn.id || `browser-merge-${i}` });
    }
  });
  return {
    ...serverDiagram,
    nodes: mergedNodes,
    edges: serverDiagram.edges?.length ? serverDiagram.edges : [],
  };
}

export default function useAIEngine(stageRef) {
  const [state, setState] = useState(INITIAL_STATE);
  const lastEnhanceOptions = useRef({});
  const browserPreviewRef = useRef(null);

  const applyDiagramToCanvas = useCallback(
    async (diagram, { preview = false } = {}) => {
      if (!stageRef.current || !diagram?.nodes?.length) return [];

      setState((s) => ({ ...s, stage: 'layouting', progress: 75 }));

      const graph = buildElkGraph(diagram);
      const laid = await elk.layout(graph);

      setState((s) => ({ ...s, stage: 'rendering', progress: 88 }));

      const stage = stageRef.current;
      const scale = stage.scaleX() || 1;
      const stagePos = { x: stage.x(), y: stage.y() };

      let offsetX = (-stagePos.x / scale) + 100;
      let offsetY = (-stagePos.y / scale) + 100;

      if (laid.children?.length) {
        const minX = Math.min(...laid.children.map((n) => n.x));
        const maxX = Math.max(...laid.children.map((n) => n.x + n.width));
        const minY = Math.min(...laid.children.map((n) => n.y));
        const maxY = Math.max(...laid.children.map((n) => n.y + n.height));
        const diagramCenterX = (minX + maxX) / 2;
        const diagramCenterY = (minY + maxY) / 2;
        const viewCenterX = (-stagePos.x / scale) + stage.width() / scale / 2;
        const viewCenterY = (-stagePos.y / scale) + stage.height() / scale / 2;
        offsetX = viewCenterX - diagramCenterX;
        offsetY = viewCenterY - diagramCenterY;
      }

      const store = useCanvasStore.getState();
      const addedIds = [];

      for (const node of laid.children || []) {
        const original = diagram.nodes.find((n) => n.id === node.id) || node.data;
        const shapeType = mapNodeShapeType(original?.type);

        if (shapeType === 'circle') {
          const cx = node.x + offsetX + node.width / 2;
          const cy = node.y + offsetY + node.height / 2;
          const id = store.addShape({
            type: 'circle',
            x: cx,
            y: cy,
            radiusX: node.width / 2,
            radiusY: node.height / 2,
            fill: preview ? 'rgba(238,237,254,0.4)' : '#EEEDfe',
            stroke: preview ? '#AFA9EC' : '#6C63FF',
            strokeWidth: preview ? 1 : 2,
            opacity: preview ? 0.6 : 1,
            aiGenerated: true,
          });
          addedIds.push(id);
        } else {
          const id = store.addShape({
            type: 'rectangle',
            x: node.x + offsetX,
            y: node.y + offsetY,
            width: node.width,
            height: node.height,
            fill: preview ? 'rgba(238,237,254,0.4)' : '#EEEDfe',
            stroke: preview ? '#AFA9EC' : '#6C63FF',
            strokeWidth: preview ? 1.5 : 2,
            opacity: preview ? 0.6 : 1,
            aiGenerated: true,
          });
          addedIds.push(id);
        }

        const labelId = store.addShape({
          type: 'text',
          text: original?.label || '',
          x: node.x + offsetX + 10,
          y: node.y + offsetY + node.height / 2 - 8,
          width: Math.max(node.width - 20, 40),
          fontSize: 13,
          fontFamily: 'Plus Jakarta Sans',
          fill: '#1A1A2E',
          aiGenerated: true,
          opacity: preview ? 0.6 : 1,
        });
        addedIds.push(labelId);
      }

      for (const edge of laid.edges || []) {
        if (!edge.sections?.length) continue;
        const section = edge.sections[0];
        const edgeData = diagram.edges.find(
          (e) => e.source === edge.sources?.[0] && e.target === edge.targets?.[0]
        );
        const points = [];
        if (section.startPoint) {
          points.push(section.startPoint.x + offsetX, section.startPoint.y + offsetY);
        }
        section.bendPoints?.forEach((bp) => {
          points.push(bp.x + offsetX, bp.y + offsetY);
        });
        if (section.endPoint) {
          points.push(section.endPoint.x + offsetX, section.endPoint.y + offsetY);
        }

        const id = store.addShape({
          type: 'arrow',
          points,
          stroke: preview ? '#AFA9EC' : '#6C63FF',
          strokeWidth: 1.5,
          dash: edgeData?.style === 'dashed' ? [6, 3] : edgeData?.style === 'dotted' ? [2, 4] : undefined,
          opacity: preview ? 0.5 : 1,
          aiGenerated: true,
        });
        addedIds.push(id);
      }

      if (!preview) {
        const pencilIds = useCanvasStore
          .getState()
          .shapes.filter((s) => s.type === 'pencil')
          .map((s) => s.id);
        if (pencilIds.length > 0) store.deleteShapes(pencilIds);
        store.setSelectedIds(addedIds);
        const modelUsed = useAIEngine._lastModelUsed || 'ai-pipeline';
        addedIds.forEach((id) => {
          markShapeAiGenerated(id, { aiModel: modelUsed });
        });
      }

      return addedIds;
    },
    [stageRef]
  );

  const enhanceDiagram = useCallback(
    async (options = {}) => {
      if (!stageRef.current) return;

      lastEnhanceOptions.current = options;
      const { instruction = null, diagramTypeHint = null, selectionBounds = null } = options;

      setState((s) => ({
        ...s,
        isProcessing: true,
        stage: 'capturing',
        progress: 10,
        aiError: null,
        clarification: null,
      }));
      trackAIEvent(AIEvents.ENHANCE_START, { hasSelection: !!selectionBounds });

      try {
        let imageBase64;
        if (selectionBounds) {
          imageBase64 = stageRef.current.toDataURL({
            x: selectionBounds.x,
            y: selectionBounds.y,
            width: selectionBounds.width,
            height: selectionBounds.height,
            pixelRatio: 1.5,
          });
        } else {
          imageBase64 = stageRef.current.toDataURL({ pixelRatio: 1 });
        }

        const existingShapes = summarizeShapes(useCanvasStore.getState().shapes);
        const sessionId = crypto.randomUUID();

        setState((s) => ({ ...s, stage: 'detecting', progress: 20, sessionId }));
        let browserResult = null;
        try {
          browserResult = await detectInBrowser(stageRef);
          if (browserResult?.nodes?.length) {
            browserPreviewRef.current = browserResult;
            setState((s) => ({
              ...s,
              stage: 'preview',
              progress: 35,
              modelUsed: browserResult.modelUsed,
            }));
            await applyDiagramToCanvas(
              { type: 'architecture', nodes: browserResult.nodes, edges: [] },
              { preview: true }
            );
          }
        } catch (browserErr) {
          console.warn('[AI] Browser ONNX preview skipped:', browserErr.message);
        }

        setState((s) => ({ ...s, stage: 'analyzing', progress: 45 }));

        const res = await fetchWithTimeout(`${API_BASE}/api/enhance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            existingShapes,
            instruction,
            diagramTypeHint,
            sessionId,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setState((s) => ({
            ...s,
            isProcessing: false,
            stage: null,
            progress: 0,
            aiError: parseApiError(res, data),
          }));
          return;
        }

        setState((s) => ({ ...s, modelUsed: data.modelUsed ?? s.modelUsed }));

        useAIEngine._lastModelUsed = data.modelUsed || 'ai-pipeline';

        if (data.status === 'needs_clarification') {
          trackAIEvent(AIEvents.CLARIFICATION_SHOWN, { nodeId: data.nodeId });
          setState((s) => ({
            ...s,
            isProcessing: false,
            stage: 'clarifying',
            progress: 60,
            clarification: {
              question: data.question,
              options: data.options,
              nodeId: data.nodeId,
              sessionId: data.sessionId,
            },
            modelUsed: data.modelUsed ?? s.modelUsed,
          }));

          if (data.partialResult) {
            await applyDiagramToCanvas(data.partialResult, { preview: true });
          }
          return;
        }

        clearAIPreviewShapes();
        setState((s) => ({ ...s, stage: 'layouting', progress: 70 }));
        const merged = mergeDiagramResults(browserPreviewRef.current, data.diagram);
        await applyDiagramToCanvas(merged);

        trackAIEvent(AIEvents.ENHANCE_COMPLETE, {
          modelUsed: data.modelUsed,
          processingMs: data.processingMs,
          nodeCount: merged?.nodes?.length ?? 0,
        });

        setState((s) => ({
          ...s,
          isProcessing: false,
          stage: 'done',
          progress: 100,
          modelUsed: data.modelUsed,
          processingMs: data.processingMs,
          clarification: null,
        }));

        setTimeout(() => {
          setState((s) => (s.stage === 'done' ? { ...s, stage: null, progress: 0 } : s));
        }, 3000);

        return { success: true, clearMarquee: true };
      } catch (err) {
        console.error(err);
        trackAIEvent(AIEvents.ENHANCE_ERROR, { message: err.message });
        setState((s) => ({
          ...s,
          isProcessing: false,
          stage: null,
          progress: 0,
          aiError: err.message || 'AI analysis failed',
        }));
        return { success: false };
      }
    },
    [stageRef, applyDiagramToCanvas]
  );

  const answerClarification = useCallback(
    async (answer) => {
      const clarification = state.clarification;
      if (!clarification) return;

      trackAIEvent(AIEvents.CLARIFICATION_ANSWERED, { nodeId: clarification.nodeId });
      setState((s) => ({ ...s, isProcessing: true, stage: 'analyzing', progress: 65, aiError: null }));

      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/clarify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: clarification.sessionId,
            nodeId: clarification.nodeId,
            answer,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setState((s) => ({
            ...s,
            isProcessing: false,
            stage: 'clarifying',
            aiError: parseApiError(res, data),
          }));
          return;
        }

        if (data.status === 'needs_clarification') {
          setState((s) => ({
            ...s,
            isProcessing: false,
            stage: 'clarifying',
            progress: 60,
            clarification: {
              question: data.question,
              options: data.options,
              nodeId: data.nodeId,
              sessionId: data.sessionId,
            },
          }));
          return;
        }

        clearAIPreviewShapes();
        await applyDiagramToCanvas(data.diagram);
        setState((s) => ({
          ...s,
          isProcessing: false,
          stage: 'done',
          progress: 100,
          clarification: null,
          processingMs: data.processingMs,
        }));

        setTimeout(() => {
          setState((s) => (s.stage === 'done' ? { ...s, stage: null } : s));
        }, 3000);

        return { success: true, clearMarquee: true };
      } catch (err) {
        setState((s) => ({
          ...s,
          isProcessing: false,
          stage: 'clarifying',
          aiError: err.message || 'Clarification failed',
        }));
      }
    },
    [state.clarification, applyDiagramToCanvas]
  );

  const askQuestion = useCallback(
    async (question, conversationHistory = []) => {
      if (!stageRef.current) return;

      setState((s) => ({ ...s, isAsking: true, askResponse: { answer: '', suggestions: [] }, aiError: null }));
      trackAIEvent(AIEvents.ASK_QUESTION, { length: question?.length ?? 0 });

      try {
        const imageBase64 = stageRef.current.toDataURL({ pixelRatio: 0.75 });
        const existingShapes = summarizeShapes(useCanvasStore.getState().shapes);

        const res = await fetchWithTimeout(`${API_BASE}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            existingShapes,
            question,
            conversationHistory,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          setState((s) => ({
            ...s,
            isAsking: false,
            aiError: parseApiError(res, errBody),
          }));
          return null;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullAnswer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            const payload = line.replace('data: ', '').trim();
            if (payload === '[DONE]') break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.delta) {
                fullAnswer += parsed.delta;
                setState((s) => ({
                  ...s,
                  askResponse: { answer: fullAnswer, suggestions: [], streaming: true },
                }));
              }
            } catch {
              /* partial SSE chunk */
            }
          }
        }

        try {
          const jsonMatch = fullAnswer.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { answer: fullAnswer, suggestions: [] };
          setState((s) => ({
            ...s,
            isAsking: false,
            askResponse: {
              answer: parsed.answer || fullAnswer,
              suggestions: parsed.suggestions || [],
              streaming: false,
            },
          }));
          return parsed;
        } catch {
          setState((s) => ({
            ...s,
            isAsking: false,
            askResponse: { answer: fullAnswer, suggestions: [], streaming: false },
          }));
          return { answer: fullAnswer, suggestions: [] };
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          isAsking: false,
          aiError: err.message || 'Ask failed',
        }));
        return null;
      }
    },
    [stageRef]
  );

  const retryEnhance = useCallback(() => {
    setState((s) => ({ ...s, aiError: null }));
    return enhanceDiagram(lastEnhanceOptions.current);
  }, [enhanceDiagram]);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, aiError: null }));
  }, []);

  const clearClarification = useCallback(() => {
    setState((s) => ({ ...s, clarification: null, stage: null }));
  }, []);

  const applySuggestion = useCallback((suggestion) => {
    const store = useCanvasStore.getState();
    const stage = stageRef.current;
    if (!suggestion?.shape && !suggestion?.autoApply) return false;

    const shape = suggestion.shape || {};
    const offsetX = stage ? (-stage.x() / (stage.scaleX() || 1)) + 120 : 120;
    const offsetY = stage ? (-stage.y() / (stage.scaleY() || 1)) + 120 : 120;

    const defaults = {
      fill: '#EEEDfe',
      stroke: '#6C63FF',
      strokeWidth: 2,
      aiGenerated: true,
    };

    if (suggestion.type === 'add_node' || shape.type) {
      const type = shape.type || 'rectangle';
      const payload = {
        ...defaults,
        ...shape,
        type,
        x: (shape.x ?? 0) + offsetX,
        y: (shape.y ?? 0) + offsetY,
      };
      if (type === 'circle') {
        payload.radiusX = shape.radiusX ?? shape.width / 2 ?? 40;
        payload.radiusY = shape.radiusY ?? shape.height / 2 ?? 40;
      }
      const id = store.addShape(payload);
      if (shape.text || shape.label) {
        store.addShape({
          type: 'text',
          text: shape.text || shape.label,
          x: payload.x + 10,
          y: payload.y + 20,
          width: shape.width ?? 140,
          fontSize: 13,
          fill: '#1A1A2E',
          aiGenerated: true,
        });
      }
      store.setSelectedIds([id]);
      return true;
    }

    if (suggestion.type === 'add_edge' && shape.points?.length >= 4) {
      store.addShape({
        type: 'arrow',
        points: shape.points.map((p, i) => p + (i % 2 === 0 ? offsetX : offsetY)),
        stroke: '#6C63FF',
        strokeWidth: 2,
        aiGenerated: true,
      });
      return true;
    }

    if (suggestion.type === 'modify_label' && shape.id) {
      store.updateShape(shape.id, {
        text: shape.text ?? shape.label,
        ...shape,
      });
      return true;
    }

    return false;
  }, [stageRef]);

  return {
    state,
    enhanceDiagram,
    answerClarification,
    askQuestion,
    retryEnhance,
    dismissError,
    clearClarification,
    applyDiagramToCanvas,
    applySuggestion,
    isProcessing: state.isProcessing,
    aiError: state.aiError,
  };
}
