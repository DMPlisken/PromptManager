import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load the app', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=PromptFlow')).toBeVisible();
  });

  test('should navigate to history page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=PromptFlow')).toBeVisible();
    await page.click('text=History');
    await expect(page).toHaveURL(/\/history/);
  });

  test('should navigate to sessions page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=PromptFlow')).toBeVisible();
    await page.click('text=Sessions');
    await expect(page).toHaveURL(/\/sessions/);
  });

  test('should navigate to manual page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=PromptFlow')).toBeVisible();
    await page.click('text=Manual');
    await expect(page).toHaveURL(/\/manual/);
  });
});
