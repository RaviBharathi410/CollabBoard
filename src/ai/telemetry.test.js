import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackAIEvent, AIEvents } from './telemetry';

describe('telemetry', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    sessionStorage.clear();
  });

  it('defines AI event constants', () => {
    expect(AIEvents.ENHANCE_START).toBe('ai.enhance.start');
    expect(AIEvents.BROWSER_DETECT_COMPLETE).toBe('ai.browser_detect.complete');
  });

  it('logs payload without image data', () => {
    trackAIEvent(AIEvents.ENHANCE_COMPLETE, { modelUsed: 'onnx', nodeCount: 3 });
    expect(console.log).toHaveBeenCalled();
    const payload = console.log.mock.calls[0][1];
    expect(payload.event).toBe(AIEvents.ENHANCE_COMPLETE);
    expect(payload.properties.nodeCount).toBe(3);
    expect(payload.properties.imageBase64).toBeUndefined();
  });
});
