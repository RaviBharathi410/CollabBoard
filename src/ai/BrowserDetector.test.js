/**
 * BrowserDetector.test.js
 * Verifies lazy loading of ONNX runtime and graceful error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBrowserDetector, detectInBrowser } from './BrowserDetector';

describe('BrowserDetector & Dynamic ONNX Loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles unavailable model gracefully without throwing', async () => {
    // Mock global fetch for classes.json
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ classes: ['rectangle', 'circle', 'diamond'] }),
    });

    const result = await loadBrowserDetector();
    expect(result).toHaveProperty('classes');
    expect(result.classes).toContain('rectangle');
  });

  it('returns graceful fallback when session is null', async () => {
    const mockStageRef = {
      current: {
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImage'),
      },
    };

    const result = await detectInBrowser(mockStageRef);
    expect(result).toEqual({
      nodes: [],
      inferenceMs: 0,
      modelUsed: 'browser-onnx-unavailable',
    });
  });
});
