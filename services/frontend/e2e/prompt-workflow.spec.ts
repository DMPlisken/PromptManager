import { test, expect } from '@playwright/test';

test.describe('Full Prompt Workflow', () => {
  test('should navigate across all pages', async ({ page }) => {
    // 1. Load app
    await page.goto('/');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();

    // 2. Tasks page (default)
    await page.click('text=Tasks');
    await expect(page).toHaveURL(/\/tasks/);

    // 3. Sessions page
    await page.click('text=Sessions');
    await expect(page).toHaveURL(/\/sessions/);

    // 4. History page
    await page.click('text=History');
    await expect(page).toHaveURL(/\/history/);

    // 5. Manual page
    await page.click('text=Manual');
    await expect(page).toHaveURL(/\/manual/);

    // 6. Back to tasks
    await page.click('text=Tasks');
    await expect(page).toHaveURL(/\/tasks/);
  });

  test('should create a group via template library', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();

    // Expand Template Library
    await page.click('text=Template Library');
    await page.waitForTimeout(500);

    // Create a new group
    await page.click('text=+ New Group');
    const nameInput = page.locator('input[placeholder*="Group" i]').first();
    await nameInput.fill('Workflow E2E Test');
    await page.click('button:has-text("Add")');

    // Verify it appears
    await expect(page.locator('text=Workflow E2E Test')).toBeVisible({ timeout: 5000 });

    // Navigate to it
    await page.click('text=Workflow E2E Test');
    await expect(page).toHaveURL(/\/groups\/\d+/);
  });
});
