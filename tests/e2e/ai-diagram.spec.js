import { test, expect } from '@playwright/test';
import { loginAsUser, MOCK_USER_A } from './fixtures.js';

test.describe('E2E: AI Diagram Synthesis & Persistence', () => {
  test('generates diagram from natural language prompt and persists nodes across page reload', async ({ page }) => {
    const roomId = 'a0000000-0000-4000-8000-000000000001';
    await loginAsUser(page, MOCK_USER_A);
    await page.route('**/api/chat-to-diagram', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          modelUsed: 'flan-t5-fine-tuned',
          confidence: 0.96,
          confidenceComputed: true,
          diagram: {
            type: 'architecture',
            nodes: [
              { id: 'n1', label: 'API Gateway', type: 'rectangle', confidence: 0.98 },
              { id: 'n2', label: 'Auth Service', type: 'service', confidence: 0.95 },
              { id: 'n3', label: 'Database', type: 'database', confidence: 0.96 },
            ],
            edges: [
              { id: 'e1', source: 'n1', target: 'n2', label: 'authenticates' },
              { id: 'e2', source: 'n2', target: 'n3', label: 'queries' },
            ],
          },
        }),
      });
    });

    // Navigate to board
    await page.goto(`/board/${roomId}`);
    await expect(page.locator('#canvas-stage')).toBeVisible({ timeout: 15000 });

    // Open Context & Chat Drawer
    await page.click('button:has-text("Context & Chat")');
    const drawer = page.locator('.context-drawer');
    await expect(drawer).toBeVisible();

    // Switch to Ask AI tab
    await page.click('#drawer-tab-ai');
    await expect(page.locator('.ai-panel')).toBeVisible();

    // Input natural language diagram query
    const aiInput = page.locator('.ai-input');
    await aiInput.fill('Microservices architecture with API Gateway, Auth Service, and Database');

    // Click Ask button
    await page.click('.ai-submit-btn');

    // Wait for AI response confirmation
    const responseCard = page.locator('.ai-response-card');
    await expect(responseCard).toBeVisible({ timeout: 10000 });
    await expect(responseCard).toContainText('Diagram generated from your description (3 nodes)');

    // Verify shapes exist in canvas store
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const shapes = window.__CANVAS_STORE__?.getState().shapes || [];
        return shapes.length >= 3;
      });
    }, { timeout: 10000 }).toBe(true);

    // Verify node labels are present in canvas shapes
    const labels = await page.evaluate(() => {
      return (window.__CANVAS_STORE__?.getState().shapes || [])
        .map((s) => s.text || s.label || '')
        .filter(Boolean);
    });
    expect(labels.some((l) => l.includes('API Gateway') || l.includes('Auth') || l.includes('Database'))).toBe(true);

    // Reload the page to test persistence across sessions
    await page.reload();
    await expect(page.locator('#canvas-stage')).toBeVisible({ timeout: 15000 });

    // Verify shapes persist on canvas after reload
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return window.__CANVAS_STORE__?.getState().shapes?.length || 0;
      });
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(3);
  });
});
