/**
 * e2e/landing.spec.ts
 * EquipSync – Playwright E2E tests for the Landing Page.
 * Verified across Chromium Desktop and 390px Mobile viewports.
 */

import { test, expect } from '@playwright/test';

test.describe('Landing Page UI & Ripple Canvas', () => {
  test('landing renders without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Filter out expected benign dev errors (e.g. extension messages or favicon)
    const seriousErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('net::ERR')
    );

    expect(seriousErrors).toEqual([]);
  });

  test('hero ripple canvas exists and clicking the hero does not navigate away', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify canvas has non-zero visible bounding box
    const canvas = page.locator('canvas[aria-hidden="true"]').first();
    await expect(canvas).toBeAttached();
    const box = await canvas.boundingBox();
    expect(box && box.width > 0 && box.height > 0).toBeTruthy();

    const getAlphaSum = async () => {
      return await canvas.evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext('2d');
        if (!ctx) return 0;
        const imgData = ctx.getImageData(0, 0, Math.min(c.width, 300), Math.min(c.height, 300));
        let alpha = 0;
        for (let i = 3; i < imgData.data.length; i += 16) {
          alpha += imgData.data[i];
        }
        return alpha;
      });
    };

    const currentUrl = page.url();

    // 2. Click on hero heading text
    const heading = page.locator('h1', { hasText: 'Idle equipment' });
    await expect(heading).toBeVisible();
    await heading.click({ position: { x: 50, y: 15 } });

    // 3. Sample within 300ms and assert non-transparent pixels exist
    await page.waitForTimeout(150);
    const postClickAlpha = await getAlphaSum();
    expect(postClickAlpha).toBeGreaterThan(0);

    // 4. Clicking a button does not navigate or crash
    const themeBtn = page.getByTitle('Toggle theme');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await page.keyboard.press('Escape');

    // 5. Ensure page stayed on the same URL
    expect(page.url()).toBe(currentUrl);
  });

  test('no fabricated stats block is rendered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Assert that invented metrics and the old stats strip do not exist
    await expect(page.locator('text="150+ institutions"')).toHaveCount(0);
    await expect(page.locator('text="1,200+ resources"')).toHaveCount(0);
    await expect(page.locator('text="5,000+ users"')).toHaveCount(0);
    await expect(page.locator('text="Active Institutional Network"')).toHaveCount(0);
    await expect(page.locator('text="Multidisciplinary Equipment Catalog"')).toHaveCount(0);
  });

  test('theme toggle persists light/dark mode preference', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const themeBtn = page.getByTitle('Toggle theme');
    await expect(themeBtn).toBeVisible();

    await themeBtn.click();
    const darkOption = page.getByRole('menuitem', { name: 'Dark' });
    await expect(darkOption).toBeVisible();
    await darkOption.click();

    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // Reload and assert preference persisted
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(html).toHaveClass(/dark/);
  });
});
