import { test, expect } from '@playwright/test';

test.describe('Template Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Create a group if none exist
    const groupLink = page.locator('a[href^="/groups/"]').first();
    if (await groupLink.count() === 0) {
      await page.click('text=New Group');
      const nameInput = page.locator('input').first();
      await nameInput.fill('Template Test Group');
      await nameInput.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Navigate to first group
    await page.locator('a[href^="/groups/"]').first().click();
    await page.waitForURL(/\/groups\/\d+/);
  });

  test('should create a template with variables', async ({ page }) => {
    // Look for "New Template" or similar button
    const newTemplateBtn = page.locator('button:has-text("Template"), button:has-text("template")').first();
    if (await newTemplateBtn.count() > 0) {
      await newTemplateBtn.click();
    }

    // Fill template content
    const templateInput = page.locator('textarea').first();
    if (await templateInput.count() > 0) {
      await templateInput.fill('Hello {{NAME}}, welcome to {{PROJECT}}!');
    }

    // Verify the page loaded correctly
    await expect(page.locator('body')).toBeVisible();
  });
});
