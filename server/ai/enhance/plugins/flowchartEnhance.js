import { getConfidenceThreshold, assessStructuralRisk } from '../../chatToDiagram.js';

/**
 * Flowchart Diagram AI Enhancement Plugin.
 * Wraps text-to-flowchart enhancement with structural risk validation.
 */
export async function enhanceFlowchart(diagram, userPrompt, options = {}) {
  const inferenceUrl = process.env.INFERENCE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

  try {
    const response = await fetch(`${inferenceUrl}/nlp-to-diagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: userPrompt,
        diagramTypeHint: 'flowchart',
      }),
    });

    if (!response.ok) {
      return { status: 'fallback', reason: `Inference service returned HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.status !== 'ok' || !data.diagram?.nodes?.length) {
      return { status: 'fallback', reason: 'Empty or invalid diagram returned by NLP model' };
    }

    const { isRisky, reason } = assessStructuralRisk(data.diagram);
    if (isRisky) {
      return { status: 'fallback', reason: `Structural risk detected: ${reason}` };
    }

    return {
      status: 'success',
      type: 'flowchart',
      diagram: data.diagram,
      confidence: data.diagram.confidence || getConfidenceThreshold(),
      healingInfo: data.diagram.healingInfo,
    };
  } catch (err) {
    return { status: 'fallback', reason: err.message || 'Network error during flowchart enhancement' };
  }
}

export default {
  id: 'flowchart',
  enhance: enhanceFlowchart,
};
