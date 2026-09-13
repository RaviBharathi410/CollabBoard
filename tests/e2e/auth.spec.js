import { test, expect } from '@playwright/test';

test.describe('E2E: Authentication & Route Protection', () => {
  test('unauthenticated users accessing a protected board route are redirected to /auth', async ({ page }) => {
    // Attempt to access a board without authentication
    await page.goto('/board/unauthenticated-test-room');

    // Should be redirected to /auth
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator('h1')).toContainText(/Log In|Welcome/);
  });

  test('user can switch between Login, Sign Up, and Forgot Password views', async ({ page }) => {
    await page.goto('/auth');

    // Default view: Log In
    await expect(page.locator('h1')).toContainText('Log In');
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();

    // Switch to Sign Up
    await page.click('button.auth-tab:has-text("Sign Up")');
    await expect(page.locator('h1')).toContainText('Create Account');
    await expect(page.locator('#full-name')).toBeVisible();

    // Switch back to Log In
    await page.click('button.auth-tab:has-text("Log In")');
    await expect(page.locator('h1')).toContainText('Log In');

    // Click Forgot Password
    await page.click('.forgot-password-btn');
    await expect(page.locator('h1')).toContainText('Reset Password');
    await expect(page.locator('#reset-email')).toBeVisible();
    await expect(page.locator('.auth-tabs')).not.toBeVisible();

    // Return to Log In
    await page.click('.auth-back-btn');
    await expect(page.locator('h1')).toContainText('Log In');
  });

  test('password recovery form validates input and shows feedback banner', async ({ page }) => {
    await page.goto('/auth');

    // Navigate to Forgot Password
    await page.click('.forgot-password-btn');
    await expect(page.locator('#reset-email')).toBeVisible();

    // Fill valid email address
    await page.fill('#reset-email', 'tester@collabboard.dev');
    await page.click('button[type="submit"]');

    // Should either show success or clear error banner (never unhandled rejection)
    const banner = page.locator('.auth-success-banner, .auth-error-banner');
    await expect(banner).toBeVisible({ timeout: 5000 });
  });

  test('login with invalid credentials renders accessible error banner', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('#auth-email', 'nonexistent_user_999@test.com');
    await page.fill('#auth-password', 'WrongPassword!123');
    await page.click('button[type="submit"]');

    // Verify error banner is displayed
    const errorBanner = page.locator('.auth-error-banner');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toHaveAttribute('role', 'alert');
  });
});
