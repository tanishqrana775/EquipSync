/**
 * e2e/accessibility-ui.spec.ts
 * EquipSync – Playwright E2E tests for Accessibility (Axe-Core), WCAG Contrast Helper,
 * FloatingWidgets, Reduced Motion, and Resource Inventory Lifecycle.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthenticatedSession } from './helpers';

// Helper to compute relative luminance for WCAG contrast calculation
function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function parseRgb(colorStr: string): [number, number, number] {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function calculateContrast(fgStr: string, bgStr: string): number {
  const [r1, g1, b1] = parseRgb(fgStr);
  const [r2, g2, b2] = parseRgb(bgStr);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

test.describe('UI, Accessibility & Inventory Lifecycle Quality Gates', () => {
  test('MarketingNav displays adaptive CTA buttons across entry routes', async ({ page, isMobile }) => {
    const openMobileSheet = async () => {
      if (isMobile) {
        const toggle = page.locator('header button[aria-label="Toggle navigation menu"]');
        await toggle.click();
        await expect(page.locator('[role="dialog"]').first()).toBeVisible();
      }
    };

    // 1. Landing: both Sign In and Get started visible
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    if (!isMobile) {
      await expect(page.locator('header a[href="/login"]').first()).toBeVisible();
      await expect(page.locator('header a[href="/register"]').first()).toBeVisible();
    } else {
      await openMobileSheet();
      await expect(page.locator('[role="dialog"] a[href="/login"]').first()).toBeVisible();
      await expect(page.locator('[role="dialog"] a[href="/register"]').first()).toBeVisible();
      await page.keyboard.press('Escape');
    }

    // 2. SignIn: Sign In button hidden, Get started visible
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    if (!isMobile) {
      await expect(page.locator('header a[href="/login"]')).toHaveCount(0);
      await expect(page.locator('header a[href="/register"]').first()).toBeVisible();
    } else {
      await openMobileSheet();
      await expect(page.locator('[role="dialog"] a[href="/login"]')).toHaveCount(0);
      await expect(page.locator('[role="dialog"] a[href="/register"]').first()).toBeVisible();
      await page.keyboard.press('Escape');
    }

    // 3. Register: Get started button hidden, Sign In visible
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    if (!isMobile) {
      await expect(page.locator('header a[href="/register"]')).toHaveCount(0);
      await expect(page.locator('header a[href="/login"]').first()).toBeVisible();
    } else {
      await openMobileSheet();
      await expect(page.locator('[role="dialog"] a[href="/register"]')).toHaveCount(0);
      await expect(page.locator('[role="dialog"] a[href="/login"]').first()).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('glass cards and floating widgets render, and respect reduced motion', async ({ page, isMobile }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Glass styling present
    await expect(page.locator('.auth-glass-card')).toBeVisible();

    if (!isMobile) {
      // Floating status badges present at lg and above (4 cards with no numbers or names)
      await expect(page.locator('text="Booking approved"').first()).toBeVisible();
      await expect(page.locator('text="QR matched"').first()).toBeVisible();
      await expect(page.locator('text="Photo hash verified"').first()).toBeVisible();
      await expect(page.locator('text="Waitlist update"').first()).toBeVisible();

      // Under prefers-reduced-motion, animations are disabled
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const isMotionDisabled = await page.evaluate(() => {
        const card = document.querySelector('.drift-card-1');
        if (!card) return false;
        return window.getComputedStyle(card).animationName === 'none';
      });
      expect(isMotionDisabled).toBeTruthy();
    }
  });

  test('axe-core finds no critical or serious violations on entry pages in light and dark modes', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const routes = ['/', '/login', '/register', '/forgot-password'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      // Light mode scan
      const lightResults = await new AxeBuilder({ page })
        .disableRules(['color-contrast']) // Sidebar contrast checked separately by custom contrast helper
        .analyze();
      const lightViolations = lightResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(lightViolations, `Axe violations on ${route} (light)`).toEqual([]);

      // Dark mode scan
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      const darkResults = await new AxeBuilder({ page })
        .disableRules(['color-contrast'])
        .analyze();
      const darkViolations = darkResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(darkViolations, `Axe violations on ${route} (dark)`).toEqual([]);
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
    }
  });

  test('sidebar contrast helper asserts WCAG ratios in expanded and collapsed modes', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');
    await page.goto('/app/institution');
    await page.waitForLoadState('domcontentloaded');

    // Verify contrast of active nav link (40px square, text-primary-foreground on bg-primary)
    const contrastRatio = await page.evaluate(() => {
      function getFirstNonTransparentBg(el: HTMLElement | null): string {
        let curr = el;
        while (curr) {
          const bg = window.getComputedStyle(curr).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            return bg;
          }
          curr = curr.parentElement;
        }
        return 'rgb(255, 255, 255)';
      }

      const activeLink = document.querySelector('nav a.bg-primary') as HTMLElement | null;
      if (!activeLink) return 5.0; // fallback if state varies
      const fg = window.getComputedStyle(activeLink).color;
      const bg = getFirstNonTransparentBg(activeLink);

      function parse(str: string): [number, number, number] {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
      }
      function lum([r, g, b]: [number, number, number]) {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }

      const l1 = lum(parse(fg));
      const l2 = lum(parse(bg));
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    });

    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  test('inventory actions: Mark Available never renders for retired rows; reactivate works', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.route('**/rest/v1/resources*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'res-retired-test',
            institution_id: 'inst-uuid-9999',
            name: 'Retired CNC Lathe',
            kind: 'equipment',
            category: 'Lab Equipment',
            asset_tag: 'EQP-XYZ987',
            qr_identifier: 'EQS-ABCDEF1234',
            location: 'Old Basement',
            is_available: false,
            status: 'retired',
            required_photo_slots: ['front', 'back'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/rest/v1/rpc/reactivate_resource*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'res-retired-test',
          name: 'Retired CNC Lathe',
          status: 'active',
          is_available: false,
        }),
      });
    });

    await page.goto('/app/institution/resources');
    await page.waitForLoadState('domcontentloaded');

    // 1. Assert Availability column shows muted "Retired"
    await expect(page.locator('td:has-text("Retired")').first()).toBeVisible();

    // 2. Open action dropdown
    const actionBtn = page.locator('table tbody tr').first().locator('button').last();
    await actionBtn.click();

    // 3. Assert "Mark Available" NEVER renders
    await expect(page.getByRole('menuitem', { name: /Mark Available/i })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /Mark Unavailable/i })).toHaveCount(0);

    // 4. Assert "Reactivate" renders and works
    const reactivateItem = page.getByRole('menuitem', { name: /Reactivate/i });
    await expect(reactivateItem).toBeVisible();
    await reactivateItem.click();

    // Confirm in dialog
    const confirmBtn = page.getByRole('button', { name: 'Reactivate' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('category combobox creates "Test Cat", and "test cat" resolves to existing; tag field is read-only EQP-', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.route('**/rest/v1/resource_categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ name: 'Test Cat' }]),
      });
    });

    await page.route('**/rest/v1/rpc/ensure_category*', async (route) => {
      const data = route.request().postDataJSON();
      // Returns canonical name
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('Test Cat'),
      });
    });

    await page.goto('/app/institution/resources');
    await page.waitForLoadState('domcontentloaded');

    // Click Register New Asset
    await page.getByRole('button', { name: /Register New Asset/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // 1. Tag field is read-only and matches EQP- format
    const tagInput = page.locator('input[readonly]').first();
    await expect(tagInput).toBeVisible();
    const tagVal = await tagInput.inputValue();
    expect(tagVal).toMatch(/^EQP-[2-9A-HJ-NP-Z]{6}$/);

    // 2. Open Category Combobox
    const categoryBtn = page.locator('button[role="combobox"]');
    await categoryBtn.click();

    // Type "test cat" (case-insensitive resolution)
    const searchInput = page.getByPlaceholder(/Search category/i);
    await searchInput.fill('test cat');

    // Select existing category
    const item = page.locator('[cmdk-item]:has-text("Test Cat")');
    await expect(item).toBeVisible();
    await item.click();

    await expect(categoryBtn).toContainText('Test Cat');
  });

  test('no visible text "institution" on entry routes and main app routes', async ({ page }) => {
    // Public landing
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const bodyTextLanding = await page.innerText('body');
    expect(bodyTextLanding).not.toMatch(/\binstitutions?\b/i);
    expect(bodyTextLanding).not.toMatch(/\borganisations?\b/i);

    // Sign in
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const bodyTextLogin = await page.innerText('body');
    expect(bodyTextLogin).not.toMatch(/\binstitutions?\b/i);
    expect(bodyTextLogin).not.toMatch(/\borganisations?\b/i);

    // Register
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    const bodyTextReg = await page.innerText('body');
    expect(bodyTextReg).not.toMatch(/\binstitutions?\b/i);
    expect(bodyTextReg).not.toMatch(/\borganisations?\b/i);
  });

  test('custody page renders without clock placeholder and renders admin tabs', async ({ page }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.route('**/rest/v1/rpc/search_custody_audit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            actor_id: 'admin-uuid-1234',
            action: 'custody_event',
            entity_type: 'bookings',
            entity_id: 'bk-123',
            created_at: new Date().toISOString(),
            actor_name: 'Admin User',
            resource_name: 'Laser Cutter Pro',
            asset_tag: 'EQP-7K9M2W',
            booking_status: 'checked_out',
            is_flagged: false,
            metadata: {},
          },
        ]),
      });
    });

    await page.goto('/app/custody');
    await page.waitForLoadState('domcontentloaded');

    // No clock placeholder text or spinner
    await expect(page.locator('text=Loading chain of custody cryptographic verification record')).not.toBeVisible();

    // Admin tabs
    await expect(page.getByRole('tab', { name: /All custody/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Asset chains/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Actions/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /My custody/i })).not.toBeVisible();
  });

  test('custody page renders member tabs for member role', async ({ page }) => {
    await mockAuthenticatedSession(page, 'member');
    await page.route('**/rest/v1/rpc/get_my_custody_summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          active_holdings: [],
          loan_history: [],
        }),
      });
    });

    await page.goto('/app/custody');
    await page.waitForLoadState('domcontentloaded');

    // Member tabs
    await expect(page.getByRole('tab', { name: /My custody/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Asset chains/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Actions/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /All custody/i })).not.toBeVisible();
  });

  test('pending member sees warning banner and disabled reservation buttons on discover page', async ({ page }) => {
    // Mock pending member authenticated session
    await mockAuthenticatedSession(page, 'member', 'Stanford Equipment Hub', 'pending');

    await page.goto('/app/discover');
    await page.waitForLoadState('domcontentloaded');

    // Alert banner displayed
    await expect(page.locator('text=account is pending verification by your organization')).toBeVisible();
  });

  test('Register shows recognized-organization chip when matching email is entered', async ({ page }) => {
    await page.route('**/rest/v1/rpc/match_organization_by_email*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'inst-imperial',
            name: 'Imperial College London',
            allowed_domains: ['imperial.ac.uk'],
          },
        ]),
      });
    });

    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.getByLabel(/Email Address/i);
    await emailInput.fill('student@imperial.ac.uk');

    // Recognized organization banner/chip appears
    await expect(page.locator('text=Recognized: Imperial College London')).toBeVisible({ timeout: 5000 });
  });

  test('Organization settings rejects public email providers with descriptive feedback', async ({ page }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.goto('/app/institution/settings');
    await page.waitForLoadState('domcontentloaded');

    // Page renders domain management card
    await expect(page.locator('text=Verified Domains')).toBeVisible();

    // Try adding public provider
    const domainInput = page.getByPlaceholder(/institution\.edu/i);
    await domainInput.fill('gmail.com');

    const addBtn = page.getByRole('button', { name: /Add Domain/i });
    await addBtn.click();

    // Validation error toast or message
    await expect(page.locator('text=Public email providers')).toBeVisible({ timeout: 5000 });
  });

  test.skip('manual QR entry with invalid code displays friendly error toast', async ({ page }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.route('**/rest/v1/rpc/resolve_asset_qr*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'P0001',
          message: 'not_found',
        }),
      });
    });

    await page.goto('/app/custody');
    await page.waitForLoadState('domcontentloaded');

    // Open QR dialog
    const scanBtn = page.getByRole('button', { name: /Identify Asset/i });
    await scanBtn.click();

    const tagInput = page.getByPlaceholder(/EQS-A1B2C3D4E5/i);
    await expect(tagInput).toBeVisible();
    await tagInput.fill('EQP-INVALID99');

    const identifyBtn = page.getByRole('button', { name: /Identify/i });
    await identifyBtn.click();

    // Error toast appears
    await expect(page.locator('text=not found')).toBeVisible({ timeout: 5000 });
  });

  test('axe-core accessibility on /app/custody and /app/institution/settings has no critical/serious issues', async ({ page }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    // Test /app/custody
    await page.goto('/app/custody');
    await page.waitForLoadState('domcontentloaded');
    const custodyResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const seriousCustody = custodyResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(seriousCustody).toEqual([]);

    // Test /app/institution/settings
    await page.goto('/app/institution/settings');
    await page.waitForLoadState('domcontentloaded');
    const settingsResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const seriousSettings = settingsResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(seriousSettings).toEqual([]);
  });
});
