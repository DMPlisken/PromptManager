import { test, expect } from '@playwright/test';

test.describe('Group Management', () => {
  test('should create a new group', async ({ page }) => {
    await page.goto('/');

    // Click "New Group" in sidebar
    await page.click('text=New Group');

    // Fill in group name
    const nameInput = page.locator('input[placeholder*="group" i], input[placeholder*="name" i]').first();
    await nameInput.fill('E2E Test Group');

    // Submit (press Enter or click create button)
    await nameInput.press('Enter');

    // Verify group appears in sidebar
    await expect(page.locator('text=E2E Test Group')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to group page', async ({ page }) => {
    await page.goto('/');

    // Click on a group in the sidebar (first available)
    const groupLink = page.locator('[data-testid="group-link"], a[href^="/groups/"]').first();

    // If no groups exist, create one first
    if (await groupLink.count() === 0) {
      await page.click('text=New Group');
      const nameInput = page.locator('input').first();
      await nameInput.fill('Test Group');
      await nameInput.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Now click the group
    await page.locator('a[href^="/groups/"]').first().click();
    await expect(page).toHaveURL(/\/groups\/\d+/);
  });
});
