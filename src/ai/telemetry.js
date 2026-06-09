const TELEMETRY_ENDPOINT = import.meta.env.VITE_TELEMETRY_URL || null;

export const AIEvents = {
  ENHANCE_START: 'ai.enhance.start',
  ENHANCE_COMPLETE: 'ai.enhance.complete',
  ENHANCE_ERROR: 'ai.enhance.error',
  CLARIFICATION_SHOWN: 'ai.clarification.shown',
  CLARIFICATION_ANSWERED: 'ai.clarification.answered',
  ASK_QUESTION: 'ai.ask.question',
  BROWSER_DETECT_COMPLETE: 'ai.browser_detect.complete',
  MODEL_LOADED: 'ai.model.loaded',
  FEEDBACK_CORRECTION: 'ai.feedback.correction',
};

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('ai_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('ai_session_id', id);
  }
  return id;
}

export function trackAIEvent(eventName, properties = {}) {
  const payload = {
    event: eventName,
    timestamp: Date.now(),
    sessionId: getOrCreateSessionId(),
    properties: { ...properties },
  };
  console.log('[Telemetry]', payload);
  if (TELEMETRY_ENDPOINT) {
    navigator.sendBeacon(TELEMETRY_ENDPOINT, JSON.stringify(payload));
  }
}
