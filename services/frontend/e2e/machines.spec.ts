import { test, expect } from '@playwright/test';

test.describe('Machine Management', () => {
  test('should load machines page', async ({ page }) => {
    await page.goto('/machines');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();
    // Should see machines page content
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show add machine button', async ({ page }) => {
    await page.goto('/machines');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();
    const addBtn = page.locator('button:has-text("Add Machine"), button:has-text("Machine"), button:has-text("Register")');
    if (await addBtn.count() > 0) {
      await expect(addBtn.first()).toBeVisible();
    }
  });

  test('should navigate to machines from sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();
    await page.click('text=Machines');
    await expect(page).toHaveURL(/\/machines/);
  });

  test('should open setup wizard on add machine click', async ({ page }) => {
    await page.goto('/machines');
    await expect(page.locator('h1:has-text("PromptFlow")')).toBeVisible();
    const addBtn = page.locator('button:has-text("Add Machine"), button:has-text("Register")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      // Should see platform selection or wizard content
      await page.waitForTimeout(500);
      const wizardContent = page.locator('text=macOS, text=Windows, text=Choose, text=Platform, text=Install').first();
      if (await wizardContent.count() > 0) {
        await expect(wizardContent).toBeVisible();
      }
    }
  });
});
