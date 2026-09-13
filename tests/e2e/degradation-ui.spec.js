import { test, expect } from '@playwright/test';
import { loginAsUser, MOCK_USER_A } from './fixtures.js';

test.describe('E2E: Service Degradation & Graceful Fallback UI', () => {
  test('gracefully handles inference outage by falling back to cloud LLM path without crashing', async ({ page }) => {
    const roomId = 'd0000000-0000-4000-8000-000000000001';
    await loginAsUser(page, MOCK_USER_A);

    // Track unhandled errors on the window
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 1. Mock /api/chat-to-diagram to simulate local model outage / network failure
    await page.route('**/api/chat-to-diagram', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'fallback',
          reason: 'network_error',
        }),
      });
    });

    // 2. Mock /api/ask cloud escalation stream
    await page.route('**/api/ask', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: 'data: {"delta": "Cloud LLM response: Here is an explanation of the requested architecture."}\n\ndata: [DONE]\n\n',
      });
    });

    await page.goto(`/board/${roomId}`);
    await expect(page.locator('#canvas-stage')).toBeVisible({ timeout: 15000 });

    // Open Drawer and trigger Ask
    await page.click('button:has-text("Context & Chat")');
    await page.click('#drawer-tab-ai');
    await expect(page.locator('.ai-panel')).toBeVisible();

    const aiInput = page.locator('.ai-input');
    await aiInput.fill('Architecture flow diagram');
    await page.click('.ai-submit-btn');

    // Verify response is received via fallback path without any crash
    const responseCard = page.locator('.ai-response-card');
    await expect(responseCard).toBeVisible({ timeout: 10000 });
    await expect(responseCard).toContainText('Cloud LLM response: Here is an explanation');

    // Verify toolbar and drawing controls remain interactive and operational
    const rectButton = page.locator('button[aria-label*="Rectangle"]');
    await expect(rectButton).toBeVisible();
    await expect(rectButton).toBeEnabled();

    // Verify zero unhandled page crashes
    expect(errors.length).toBe(0);
  });
});
