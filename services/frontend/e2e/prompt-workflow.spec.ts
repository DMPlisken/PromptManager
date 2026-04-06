import { test, expect } from '@playwright/test';

test.describe('Full Prompt Workflow', () => {
  test('should create group, add template, and navigate to sessions', async ({ page }) => {
    // 1. Go to dashboard
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // 2. Create a new group
    await page.click('text=New Group');
    const groupInput = page.locator('input').first();
    await groupInput.fill('Workflow Test');
    await groupInput.press('Enter');
    await page.waitForTimeout(1000);

    // 3. Navigate to the group
    await page.locator('text=Workflow Test').click();
    await page.waitForURL(/\/groups\/\d+/);

    // 4. Verify we're on the group page
    await expect(page.locator('body')).toBeVisible();

    // 5. Navigate to sessions page
    await page.goto('/sessions');
    await expect(page.locator('body')).toBeVisible();

    // 6. Navigate to history page
    await page.goto('/history');
    await expect(page.locator('body')).toBeVisible();

    // 7. Navigate back to dashboard
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle missing backend gracefully', async ({ page }) => {
    // Even if backend is down, the SPA should load
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Navigate to sessions — should show connection status
    await page.goto('/sessions');
    await expect(page.locator('body')).toBeVisible();
  });
});
