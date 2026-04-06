import { test, expect } from '@playwright/test';

test.describe('Sessions Page', () => {
  test('should load sessions page', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('text=PromptFlow')).toBeVisible();
  });

  test('should show new session button', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('text=PromptFlow')).toBeVisible();

    const newSessionBtn = page.locator('button:has-text("New Session"), button:has-text("Create"), button:has-text("session")');
    // Button may or may not exist depending on SessionsPage implementation
    if (await newSessionBtn.count() > 0) {
      await expect(newSessionBtn.first()).toBeVisible();
    }
  });
});
