import { test, expect } from '@playwright/test';

test.describe('Group Management', () => {
  test('should expand template library and create a new group', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=PromptFlow')).toBeVisible();

    // Expand Template Library section
    await page.click('text=Template Library');
    await expect(page.locator('text=+ New Group')).toBeVisible();

    // Click "+ New Group"
    await page.click('text=+ New Group');

    // Fill in group name
    const nameInput = page.locator('input[placeholder*="Group" i]').first();
    await nameInput.fill('E2E Test Group');

    // Submit
    await page.click('button:has-text("Add")');

    // Verify group appears in sidebar
    await expect(page.locator('text=E2E Test Group')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to group page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=PromptFlow')).toBeVisible();

    // Expand Template Library
    await page.click('text=Template Library');
    await page.waitForTimeout(500);

    // Check if any group exists
    const groupLink = page.locator('a[href^="/groups/"]').first();
    if (await groupLink.count() === 0) {
      // Create one
      await page.click('text=+ New Group');
      const nameInput = page.locator('input[placeholder*="Group" i]').first();
      await nameInput.fill('Nav Test Group');
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(1000);
    }

    // Click the group
    await page.locator('a[href^="/groups/"]').first().click();
    await expect(page).toHaveURL(/\/groups\/\d+/);
  });
});
