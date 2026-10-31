/**
 * e2e/auth.spec.ts
 * EquipSync – Playwright E2E tests for Authentication, Placeholders, Password Toggles,
 * and Live Autocomplete Search.
 */

import { test, expect } from '@playwright/test';
import { mockAuthenticatedSession } from './helpers';

test.describe('Authentication Forms & Interactions', () => {
  test('SignIn has no placeholder on email and password input toggles type', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // 1. Assert email input has no placeholder
    const emailInput = page.getByLabel(/Work.*Email/i);
    await expect(emailInput).toBeVisible();
    const emailPlaceholder = await emailInput.getAttribute('placeholder');
    expect(emailPlaceholder).toBeFalsy();

    // 2. Password field eye toggle
    const passwordInput = page.locator('input[aria-label="Password"]');
    await expect(passwordInput).toBeVisible();
    expect(await passwordInput.getAttribute('type')).toBe('password');

    const toggleBtn = page.getByRole('button', { name: /Show password/i });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Input changes type to text
    expect(await passwordInput.getAttribute('type')).toBe('text');
    await expect(page.getByRole('button', { name: /Hide password/i })).toBeVisible();

    // Toggle back
    await page.getByRole('button', { name: /Hide password/i }).click();
    expect(await passwordInput.getAttribute('type')).toBe('password');
  });

  test('Register has no placeholders on specified fields and toggles passwords across tabs', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');

    // --- Member Tab ---
    const memberEmailInput = page.locator('input[aria-label="Email Address"]');
    await expect(memberEmailInput).toBeVisible();
    expect(await memberEmailInput.getAttribute('placeholder')).toBeFalsy();

    const memberPassword = page.locator('input[aria-label="Password"]');
    await expect(memberPassword).toBeVisible();
    expect(await memberPassword.getAttribute('type')).toBe('password');

    const memberEye = page.getByRole('button', { name: /Show password/i });
    await memberEye.click();
    expect(await memberPassword.getAttribute('type')).toBe('text');
    await page.getByRole('button', { name: /Hide password/i }).click();
    expect(await memberPassword.getAttribute('type')).toBe('password');
    // --- Organization Admin Tab ---
    const adminTab = page.getByRole('button', { name: /Organi[sz]ation Admin/i });
    await adminTab.click();

    const adminNameInput = page.locator('input[aria-label="Full Name"]');
    await expect(adminNameInput).toBeVisible();
    expect(await adminNameInput.getAttribute('placeholder')).toBeFalsy();

    const adminOrgNameInput = page.locator('input[aria-label*="rgani"][aria-label*="ation Name"]');
    await expect(adminOrgNameInput).toBeVisible();
    expect(await adminOrgNameInput.getAttribute('placeholder')).toBeFalsy();

    const adminEmailInput = page.locator('input[aria-label="Email Address"]');
    await expect(adminEmailInput).toBeVisible();
    expect(await adminEmailInput.getAttribute('placeholder')).toBeFalsy();

    // Organisation type dropdown remains visible and operational
    const orgTypeSelect = page.locator('select');
    await expect(orgTypeSelect).toBeVisible();
  });

  test('typing 3 characters in member organization field displays suggestions', async ({ page }) => {
    // Intercept search_institutions RPC
    await page.route('**/rest/v1/rpc/search_institutions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'inst-1', name: 'Stanford Robotics Lab', type: 'University' },
          { id: 'inst-2', name: 'Stanford Makerspace', type: 'Workshop' },
        ]),
      });
    });

    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByLabel(/Organi[sz]ation Name Search/i);
    await expect(searchInput).toBeVisible();

    // Type fewer than 3 characters -> no suggestions popup
    await searchInput.fill('St');
    await page.waitForTimeout(350);
    await expect(page.getByRole('listbox')).toHaveCount(0);

    // Type 3 characters -> suggestions appear
    await searchInput.fill('Stan');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const option = page.getByRole('option', { name: /Stanford Robotics Lab/i });
    await expect(option).toBeVisible();
    await option.click();

    // Input reflects selection
    await expect(searchInput).toHaveValue('Stanford Robotics Lab');
  });

  test('back button while logged in redirects from /login to dashboard', async ({ page }) => {
    await mockAuthenticatedSession(page, 'member');

    // User is on member dashboard
    await page.goto('/app/user');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/app/user');

    // Attempting to visit /login while authenticated triggers PublicRoute
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Verified redirected back away from /login to role's dashboard
    await expect(page).toHaveURL(/\/app\/user/);

    // Browser history back also stays safely on dashboard
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/app\/user/);
  });
});
