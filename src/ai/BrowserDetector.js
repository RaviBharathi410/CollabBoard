import * as ort from 'onnxruntime-web';
import { trackAIEvent, AIEvents } from './telemetry';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
ort.env.wasm.numThreads = 1; // Force single thread to avoid SharedArrayBuffer/COOP-COEP issues
ort.env.wasm.simd = true;

const MODEL_URL = '/models/collabboard_int8.onnx';
const CLASSES_URL = '/models/classes.json';
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.30;

let _session = null;
let _classes = null;
let _loadPromise = null;

export async function loadBrowserDetector() {
  if (_session && _classes) return { session: _session, classes: _classes };
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    console.log('[BrowserDetector] Loading ONNX model...');
    const t0 = performance.now();

    const executionProviders = ['wasm'];
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        executionProviders.unshift('webgpu');
      }
    } catch {
      /* WebGPU unavailable */
    }

    try {
      _session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });
    } catch (err) {
      console.warn('[BrowserDetector] Model load failed (run training/export first):', err.message);
      _session = null;
      _classes = (await fetch(CLASSES_URL).then((r) => r.json())).classes;
      return { session: null, classes: _classes };
    }

    const classesRes = await fetch(CLASSES_URL);
    const classesData = await classesRes.json();
    _classes = classesData.classes;

    const ms = (performance.now() - t0).toFixed(1);
    console.log(`[BrowserDetector] Ready in ${ms}ms via ${executionProviders[0]}`);
    trackAIEvent(AIEvents.MODEL_LOADED, { ms: parseFloat(ms), provider: executionProviders[0] });
    return { session: _session, classes: _classes };
  })();

  return _loadPromise;
}

function preprocessImageData(imageData, origW, origH) {
  const scale = Math.min(INPUT_SIZE / origH, INPUT_SIZE / origW);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padW = Math.floor((INPUT_SIZE - newW) / 2);
  const padH = Math.floor((INPUT_SIZE - newH) / 2);

  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

  const srcCanvas = new OffscreenCanvas(origW, origH);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(srcCanvas, padW, padH, newW, newH);
  const paddedData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    tensor[i] = paddedData.data[i * 4] / 255;
    tensor[INPUT_SIZE * INPUT_SIZE + i] = paddedData.data[i * 4 + 1] / 255;
    tensor[2 * INPUT_SIZE * INPUT_SIZE + i] = paddedData.data[i * 4 + 2] / 255;
  }

  return { tensor, meta: { origW, origH, padW, padH, scale } };
}

function nms(boxes, scores, iouThreshold = 0.45) {
  const indices = [];
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const suppressed = new Set();

  for (const i of order) {
    if (suppressed.has(i)) continue;
    indices.push(i);
    for (const j of order) {
      if (i === j || suppressed.has(j)) continue;
      const [ax1, ay1, ax2, ay2] = boxes[i];
      const [bx1, by1, bx2, by2] = boxes[j];
      const interX1 = Math.max(ax1, bx1);
      const interY1 = Math.max(ay1, by1);
      const interX2 = Math.min(ax2, bx2);
      const interY2 = Math.min(ay2, by2);
      const interW = Math.max(0, interX2 - interX1);
      const interH = Math.max(0, interY2 - interY1);
      const interArea = interW * interH;
      const areaA = (ax2 - ax1) * (ay2 - ay1);
      const areaB = (bx2 - bx1) * (by2 - by1);
      const iou = interArea / (areaA + areaB - interArea);
      if (iou > iouThreshold) suppressed.add(j);
    }
  }
  return indices;
}

function parseYoloOutput(rawOutput, meta, classes) {
  const preds = rawOutput;
  const numFeatures = preds.length;
  if (numFeatures < 6) return [];

  const numDets = Math.floor(numFeatures / 6);
  const boxes = [];
  const scores = [];
  const classIds = [];

  for (let i = 0; i < numDets; i++) {
    const conf = preds[i * 6 + 4];
    if (conf < CONF_THRESHOLD) continue;
    boxes.push([
      preds[i * 6],
      preds[i * 6 + 1],
      preds[i * 6 + 2],
      preds[i * 6 + 3],
    ]);
    scores.push(conf);
    classIds.push(Math.round(preds[i * 6 + 5]));
  }

  const keepIdx = nms(boxes, scores);
  return keepIdx.map((idx, i) => {
    const [x1, y1, x2, y2] = boxes[idx];
    const x1o = (x1 - meta.padW) / meta.scale;
    const y1o = (y1 - meta.padH) / meta.scale;
    const x2o = (x2 - meta.padW) / meta.scale;
    const y2o = (y2 - meta.padH) / meta.scale;
    return {
      id: `browser-n${i + 1}`,
      type: classes[classIds[idx]] || 'rectangle',
      confidence: scores[idx],
      bbox_normalized: [
        (x1o + x2o) / 2 / meta.origW,
        (y1o + y2o) / 2 / meta.origH,
        (x2o - x1o) / meta.origW,
        (y2o - y1o) / meta.origH,
      ],
      label: '',
    };
  });
}

export async function detectInBrowser(konvaStageRef) {
  const { session, classes } = await loadBrowserDetector();
  if (!session) {
    return { nodes: [], inferenceMs: 0, modelUsed: 'browser-onnx-unavailable' };
  }

  const t0 = performance.now();
  const dataURL = konvaStageRef.current.toDataURL({ pixelRatio: 1 });
  const img = new Image();
  img.src = dataURL;
  await new Promise((r) => { img.onload = r; });

  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  const { tensor, meta } = preprocessImageData(imageData, img.width, img.height);
  const inputName = session.inputNames[0];
  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  const output = await session.run({ [inputName]: inputTensor });
  const rawOutput = output[Object.keys(output)[0]].data;

  const nodes = parseYoloOutput(rawOutput, meta, classes);
  const inferenceMs = performance.now() - t0;

  trackAIEvent(AIEvents.BROWSER_DETECT_COMPLETE, {
    nodeCount: nodes.length,
    inferenceMs,
  });

  return { nodes, inferenceMs, modelUsed: 'browser-onnx-int8' };
}
