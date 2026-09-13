import { test, expect } from '@playwright/test';
import { loginAsUser, MOCK_USER_A, MOCK_USER_B } from './fixtures.js';

test.describe('E2E: Multiplayer Real-Time CRDT Sync', () => {
  test('two concurrent users in the same room synchronize shape additions, updates, and deletions in real time', async ({ browser }) => {
    // Valid UUID ensures both peers join the identical collaborative room ID
    const roomId = 'c1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
    const roomUrl = `/board/${roomId}`;

    // 1. Create two isolated browser contexts representing Alice and Bob
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAsUser(pageA, MOCK_USER_A);
    await loginAsUser(pageB, MOCK_USER_B);

    // 2. Both users join the identical room
    await Promise.all([
      pageA.goto(roomUrl),
      pageB.goto(roomUrl),
    ]);

    // Wait for canvas stage to mount on both clients
    await expect(pageA.locator('#canvas-stage')).toBeVisible({ timeout: 15000 });
    await expect(pageB.locator('#canvas-stage')).toBeVisible({ timeout: 15000 });

    // Wait for store initialization
    await pageA.waitForFunction(() => !!window.__CANVAS_STORE__);
    await pageB.waitForFunction(() => !!window.__CANVAS_STORE__);

    // 3. User A adds a rectangle to the board
    const shapeId = await pageA.evaluate(() => {
      const store = window.__CANVAS_STORE__.getState();
      const testShape = {
        type: 'rectangle',
        x: 120,
        y: 180,
        width: 150,
        height: 90,
        fill: '#3B82F6',
        stroke: '#1D4ED8',
      };
      store.addShape(testShape);
      const shapes = window.__CANVAS_STORE__.getState().shapes;
      return shapes[shapes.length - 1].id;
    });

    expect(shapeId).toBeTruthy();

    // 4. User B receives the shape via WebSocket CRDT sync (Hocuspocus)
    await expect.poll(async () => {
      return await pageB.evaluate((id) => {
        const shapes = window.__CANVAS_STORE__?.getState().shapes || [];
        return shapes.some((s) => s.id === id);
      }, shapeId);
    }, { timeout: 10000, intervals: [200, 500] }).toBe(true);

    // 5. User A updates the shape position (drag / move simulation)
    await pageA.evaluate((id) => {
      const store = window.__CANVAS_STORE__.getState();
      store.updateShape(id, { x: 420, y: 360 });
    }, shapeId);

    // Verify User B receives the position update in real time
    await expect.poll(async () => {
      return await pageB.evaluate((id) => {
        const shape = window.__CANVAS_STORE__?.getState().shapes.find((s) => s.id === id);
        return shape ? { x: shape.x, y: shape.y } : null;
      }, shapeId);
    }, { timeout: 10000, intervals: [200, 500] }).toEqual({ x: 420, y: 360 });

    // 6. User B deletes the shape
    await pageB.evaluate((id) => {
      const store = window.__CANVAS_STORE__.getState();
      store.deleteShapes([id]);
    }, shapeId);

    // Verify User A receives the deletion
    await expect.poll(async () => {
      return await pageA.evaluate((id) => {
        const shapes = window.__CANVAS_STORE__?.getState().shapes || [];
        return shapes.some((s) => s.id === id);
      }, shapeId);
    }, { timeout: 10000, intervals: [200, 500] }).toBe(false);

    await contextA.close();
    await contextB.close();
  });
});
