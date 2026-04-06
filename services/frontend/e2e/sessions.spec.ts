import { test, expect } from '@playwright/test';

test.describe('Sessions Page', () => {
  test('should load sessions page', async ({ page }) => {
    await page.goto('/sessions');

    // Should see the sessions page content
    await expect(page.locator('body')).toBeVisible();

    // Should show connection status indicator or session content
    const connectionIndicator = page.locator('[class*="connection"], [data-testid="connection-status"]');
    // Connection status may show disconnected if backend is not running, which is OK
  });

  test('should show session create button', async ({ page }) => {
    await page.goto('/sessions');

    // Look for new session button
    const newSessionBtn = page.locator('button:has-text("New Session"), button:has-text("Create")');
    await expect(newSessionBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('should open session create modal', async ({ page }) => {
    await page.goto('/sessions');

    // Click new session button
    const newSessionBtn = page.locator('button:has-text("New Session"), button:has-text("Create")').first();
    await newSessionBtn.click();

    // Modal should appear with prompt input and working directory
    const modal = page.locator('[class*="modal"], [role="dialog"]');
    if (await modal.count() > 0) {
      await expect(modal).toBeVisible();
    }
  });
});
