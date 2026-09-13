import 'dotenv/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pRetry from 'p-retry';
import { VISION_SYSTEM_PROMPT, buildVisionUserPrompt, ASK_SYSTEM_PROMPT } from './prompts.js';
import { parseDiagramJson } from './schema.js';

const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gpt-4o';
const rawFallback = process.env.FALLBACK_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = rawFallback === 'gemini-3.6-flash' ? 'gemini-2.5-flash' : rawFallback;
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '2048', 10);

let _openai = null;
let _genAI = null;

/** Lazy-init so clients exist after dotenv loads (imports run before server.js config). */
export function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export function getGenAI() {
  if (!_genAI && process.env.GEMINI_API_KEY) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

let _tiktokenEncoder = null;

async function getTiktokenEncoder() {
  if (_tiktokenEncoder) return _tiktokenEncoder;
  try {
    const { encoding_for_model } = await import('tiktoken');
    _tiktokenEncoder = encoding_for_model('gpt-4o');
    return _tiktokenEncoder;
  } catch {
    return null;
  }
}

export async function estimateImageTokens(imageBase64) {
  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const byteLength = Math.floor((base64.length * 3) / 4);

  const tileEstimate = Math.ceil(byteLength / 5120) * 170;
  const heuristic = 765 + tileEstimate;

  try {
    const enc = await getTiktokenEncoder();
    if (enc) {
      const promptTokens = enc.encode(VISION_SYSTEM_PROMPT).length + 120;
      return promptTokens + heuristic;
    }
  } catch {
    /* fallback */
  }

  return Math.ceil(byteLength / 1500) + 850;
}

export function stripBase64Header(imageBase64) {
  return imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
}

async function callOpenAIVision(imageBase64, context) {
  const openai = getOpenAI();
  if (!openai) throw new Error('OPENAI_NOT_CONFIGURED');

  const userPromptText = buildVisionUserPrompt(context);
  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    max_tokens: MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          { type: 'text', text: userPromptText },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content || '';
  const parsed = parseDiagramJson(text);
  return { parsed, modelUsed: PRIMARY_MODEL, rawText: text };
}

async function callGeminiVision(imageBase64, context) {
  const genAI = getGenAI();
  if (!genAI) throw new Error('GEMINI_NOT_CONFIGURED');

  const base64Data = stripBase64Header(imageBase64);
  const userPromptText = buildVisionUserPrompt(context);
  const model = genAI.getGenerativeModel({
    model: FALLBACK_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    VISION_SYSTEM_PROMPT,
    userPromptText,
    { inlineData: { data: base64Data, mimeType: 'image/png' } },
  ]);

  const text = result.response.text();
  const parsed = parseDiagramJson(text);
  return { parsed, modelUsed: FALLBACK_MODEL, rawText: text };
}

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.85');

export async function analyzeDiagramVision(imageBase64, context) {
  const start = Date.now();
  const inferenceUrl = (process.env.INFERENCE_API_URL || 'http://localhost:8000') + '/detect';

  // 1. Try Local ONNX Inference Server only when not explicitly requesting cloud-first
  if (!context?.preferCloud && !context?.skipLocal) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

      const res = await fetch(inferenceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          sessionId: context?.sessionId,
          existingShapes: context?.existingShapes,
          diagramTypeHint: context?.diagramTypeHint,
          instruction: context?.instruction,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.diagram) {
          const conf = data.diagram.confidence;
          if (conf >= CONFIDENCE_THRESHOLD) {
            console.log(`[AI Pipeline] Local ONNX success (confidence: ${conf.toFixed(4)})`);
            return {
              parsed: data.diagram,
              modelUsed: data.modelUsed || 'local-onnx-int8',
              processingMs: Date.now() - start,
            };
          } else {
            console.warn(`[AI Pipeline] Local ONNX confidence low (${conf.toFixed(4)} < ${CONFIDENCE_THRESHOLD}). Falling back to LLMs.`);
          }
        }
      } else {
        console.warn(`[AI Pipeline] Local ONNX returned non-200 status: ${res.status}`);
      }
    } catch (err) {
      console.warn(`[AI Pipeline] Local ONNX connection failed or timed out: ${err.message}. Falling back to LLMs.`);
    }
  }

  // 2. Fallback to LLM pipeline (GPT-4o -> Gemini)
  try {
    const result = await pRetry(() => callOpenAIVision(imageBase64, context), { retries: 1 });

    if (result.parsed.confidence < CONFIDENCE_THRESHOLD) {
      throw new Error('LOW_CONFIDENCE_PRIMARY');
    }

    return { ...result, processingMs: Date.now() - start };
  } catch (primaryErr) {
    console.warn('Primary vision model failed, falling back to Gemini:', primaryErr.message);

    try {
      const result = await callGeminiVision(imageBase64, context);
      return { ...result, processingMs: Date.now() - start };
    } catch (fallbackErr) {
      const err = new Error('BOTH_MODELS_FAILED');
      err.cause = fallbackErr;
      throw err;
    }
  }
}

export function getModelAvailability() {
  return {
    openai: Boolean(getOpenAI()),
    gemini: Boolean(getGenAI()),
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
  };
}

/** Stream Ask responses via Gemini when OpenAI is unavailable (e.g. quota). */
export async function* streamAskGemini(imageBase64, question, conversationHistory = []) {
  const genAI = getGenAI();
  if (!genAI) throw new Error('GEMINI_NOT_CONFIGURED');

  const base64Data = stripBase64Header(imageBase64);
  const historyText = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const model = genAI.getGenerativeModel({
    model: FALLBACK_MODEL,
    systemInstruction: ASK_SYSTEM_PROMPT,
  });

  const prompt = historyText
    ? `${historyText}\n\nuser: ${question}`
    : question;

  const result = await model.generateContentStream([
    prompt,
    { inlineData: { data: base64Data, mimeType: 'image/png' } },
  ]);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export { PRIMARY_MODEL, MAX_TOKENS };
