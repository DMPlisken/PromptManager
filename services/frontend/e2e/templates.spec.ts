import { test, expect } from '@playwright/test';

test.describe('Template Management', () => {
  test('should navigate to a group page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();

    // Expand Template Library
    await page.click('text=Template Library');
    await page.waitForTimeout(500);

    // Check if any group exists
    const groupLink = page.locator('a[href^="/groups/"]').first();
    if (await groupLink.count() === 0) {
      // Create one
      await page.click('text=+ New Group');
      const nameInput = page.locator('input[placeholder*="Group" i]').first();
      await nameInput.fill('Template E2E Group');
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(1000);
    }

    // Navigate to first group
    await page.locator('a[href^="/groups/"]').first().click();
    await page.waitForURL(/\/groups\/\d+/);

    // Verify the group page loaded
    await expect(page.locator('body')).toBeVisible();
  });
});
