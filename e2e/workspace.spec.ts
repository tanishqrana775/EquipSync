/**
 * e2e/workspace.spec.ts
 * EquipSync – Playwright E2E tests for Workspace Navigation, LiveBadge,
 * QR Label & Centered Print Layout, Hardcoded Data Purge, and Retired Status.
 */

import { test, expect } from '@playwright/test';
import { mockAuthenticatedSession } from './helpers';

test.describe('Workspace Navigation, Tools & Custody Gates', () => {
  test('sidebar collapse and expand work, Quick Links is purged, and dialogs open', async ({
    page,
    isMobile,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.goto('/app/institution');
    await page.waitForLoadState('domcontentloaded');

    // 1. Assert Quick Links group is completely removed
    await expect(page.locator('text="Quick Links"')).toHaveCount(0);
    await expect(page.locator('text="Public Portal (Home)"')).toHaveCount(0);

    // 2. Sidebar collapse & expand on desktop, drawer on mobile
    if (!isMobile) {
      const toggleTrigger = page.locator('button:has(svg.lucide-panel-left)');
      await expect(toggleTrigger).toBeVisible();

      // Click to collapse
      await toggleTrigger.click();
      await page.waitForTimeout(300);

      const sidebar = page.locator('aside, div[data-collapsible="icon"]').first();
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed');

      // Click to expand again
      await toggleTrigger.click();
      await page.waitForTimeout(300);
      await expect(sidebar).toHaveAttribute('data-state', 'expanded');
    } else {
      const mobileTrigger = page.locator('button:has(svg.lucide-panel-left)');
      await expect(mobileTrigger).toBeVisible();
      await mobileTrigger.click();
      await page.waitForTimeout(350);
    }

    // 3. Help Center dialog opens
    const helpBtn = page.getByRole('button', { name: /Help Center/i });
    await helpBtn.click();

    const helpDialog = page.getByRole('dialog', { name: /Help & Platform Guidance/i });
    await expect(helpDialog).toBeVisible();
    await expect(page.locator('text="Full documentation is coming soon"')).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /Got it/i }).click();
    await expect(helpDialog).not.toBeVisible();

    // 4. Account Settings dialog opens
    const settingsBtn = page.getByRole('button', { name: /Account Settings/i });
    await settingsBtn.click();

    const settingsDialog = page.getByRole('dialog', { name: /Account Settings/i });
    await expect(settingsDialog).toBeVisible();
    await expect(page.getByRole('button', { name: /Change password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('LiveBadge renders only dot with role status and unified aria-label (no text Live)', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.goto('/app/institution');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify no visible text saying "Live" or "Reconnecting" inside app shell
    const visibleTextLive = page.locator('aside, header').locator('text="Live", text="Reconnecting"');
    await expect(visibleTextLive).toHaveCount(0);

    // 2. All LiveBadges have role="status" and share the same aria-label
    const statusBadges = page.locator('[role="status"]');
    const badgeCount = await statusBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    const firstAriaLabel = await statusBadges.first().getAttribute('aria-label');
    expect(firstAriaLabel === 'Live' || firstAriaLabel === 'Reconnecting').toBeTruthy();

    for (let i = 0; i < badgeCount; i++) {
      expect(await statusBadges.nth(i).getAttribute('aria-label')).toBe(firstAriaLabel);
    }
  });

  test('QR label dialog enforces EQS format, allows regenerate, and print layout is centered', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    // Intercept resources query with an active QR
    await page.route('**/rest/v1/resources*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'res-e2e-1',
            institution_id: 'inst-uuid-9999',
            name: 'Optical Laser Spectrometer',
            kind: 'equipment',
            category: 'Lab Equipment',
            asset_tag: 'TAG-SPEC-01',
            qr_identifier: 'EQS-A1B2C3D4E5',
            location: 'Optics Bench 3',
            is_available: true,
            status: 'active',
            required_photo_slots: ['front', 'back'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
      });
    });

    // Intercept regenerate_resource_qr
    await page.route('**/rest/v1/rpc/regenerate_resource_qr*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('EQS-9988776655'),
      });
    });

    await page.goto('/app/institution/resources');
    await page.waitForLoadState('domcontentloaded');

    // Open row actions dropdown
    const actionBtn = page.locator('table tbody tr').first().locator('button').last();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    // Click "QR Asset Label"
    const qrAction = page.getByRole('menuitem', { name: /QR.*label/i });
    await expect(qrAction).toBeVisible();
    await qrAction.click();

    // Assert QR modal opens
    const qrDialog = page.getByRole('dialog');
    await expect(qrDialog).toBeVisible();

    // Verify identifier format and no "PENDING"
    const identifierSpan = page.locator('#qr-print-area span.font-mono').first();
    await expect(identifierSpan).toBeVisible();
    const idText = (await identifierSpan.innerText()).trim();
    expect(idText).toMatch(/^EQS-[0-9A-F]{10}$/);
    expect(idText).not.toContain('PENDING');

    // Test Regenerate QR
    const regenBtn = page.getByRole('button', { name: /Regenerate QR/i });
    await regenBtn.click();

    const confirmRegen = page.getByRole('button', { name: 'Regenerate' });
    await expect(confirmRegen).toBeVisible();
    await confirmRegen.click();

    await expect(page.locator('#qr-print-area span.font-mono').first()).toHaveText('EQS-9988776655');

    // Test Print media layout
    await page.emulateMedia({ media: 'print' });
    const printPortal = page.locator('#qr-print-portal');
    await expect(printPortal).toBeVisible();

    const portalInner = page.locator('#qr-print-portal > div');
    const portalBox = await portalInner.boundingBox();
    const viewport = page.viewportSize();
    if (portalBox && viewport) {
      const labelCenter = portalBox.x + portalBox.width / 2;
      const viewportCenter = viewport.width / 2;
      expect(Math.abs(labelCenter - viewportCenter)).toBeLessThanOrEqual(8);
    }

    // App chrome is hidden in print
    await expect(page.locator('aside').first()).not.toBeVisible();
    await expect(page.locator('header').first()).not.toBeVisible();

    await page.emulateMedia({ media: 'screen' });
  });

  test('no hardcoded data (65%, units, Campus Custodian, Faculty Sign-off, EQS-PENDING) under /app', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'institution_admin');

    await page.goto('/app/institution/resources');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('65%');
    expect(bodyText).not.toContain('units');
    expect(bodyText).not.toContain('Campus Custodian');
    expect(bodyText).not.toContain('Faculty Sign-off');
    expect(bodyText).not.toContain('EQS-PENDING');
  });

  test('retired resource shows Retired, retired reserve copy, and is hidden from member Discover list', async ({
    page,
  }) => {
    // 1. Check member Discover list hides retired resource
    await mockAuthenticatedSession(page, 'member');

    await page.route('**/rest/v1/resources*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'res-active-1',
            institution_id: 'inst-uuid-9999',
            name: 'Digital Oscilloscope',
            kind: 'equipment',
            category: 'Lab Equipment',
            asset_tag: 'TAG-OSC-01',
            qr_identifier: 'EQS-1122334455',
            location: 'Electronics Lab',
            is_available: true,
            status: 'active',
            required_photo_slots: ['front', 'back'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'res-retired-1',
            institution_id: 'inst-uuid-9999',
            name: 'Decommissioned Laser Cutter',
            kind: 'equipment',
            category: 'Lab Equipment',
            asset_tag: 'TAG-OLD-99',
            qr_identifier: 'EQS-9999999999',
            location: 'Storage B',
            is_available: false,
            status: 'retired',
            required_photo_slots: ['front', 'back'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/app/discover');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text="Digital Oscilloscope"')).toBeVisible();
    await expect(page.locator('text="Decommissioned Laser Cutter"')).toHaveCount(0);

    // 2. Open admin resources to inspect Retired resource
    await mockAuthenticatedSession(page, 'institution_admin');
    await page.goto('/app/institution/resources');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text="Decommissioned Laser Cutter"')).toBeVisible();
    await expect(page.locator('span:has-text("Retired")').first()).toBeVisible();
  });

  test('user navigation clicks all sidebar items and stays under /app, never ending on /', async ({
    page,
    isMobile,
  }) => {
    await mockAuthenticatedSession(page, 'member');

    await page.goto('/app/user');
    await page.waitForLoadState('domcontentloaded');
    const openDrawer = async () => {
      if (isMobile) {
        const toggleBtn = page.getByRole('button', { name: /Toggle Sidebar/i });
        await toggleBtn.click();
        await expect(page.locator('[role="dialog"]').first()).toBeVisible();
      }
    };

    // 1. Click My Bookings
    await openDrawer();
    const myBookingsLink = page.getByRole('link', { name: /My Bookings/i });
    await expect(myBookingsLink).toBeVisible();
    await myBookingsLink.click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/app/bookings');
    expect(page.url()).not.toBe('http://localhost:3000/');
    // 2. Click Chain of Custody
    await openDrawer();
    const custodyLink = page.getByRole('link', { name: /Chain of Custody/i });
    await expect(custodyLink).toBeVisible();
    await custodyLink.click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/app/custody');
    expect(page.url()).not.toBe('http://localhost:3000/');

    // 3. Click Discover & Reserve
    await openDrawer();
    const discoverLink = page.getByRole('link', { name: /Discover & Reserve/i });
    await expect(discoverLink).toBeVisible();
    await discoverLink.click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/app/discover');
    expect(page.url()).not.toBe('http://localhost:3000/');

    // 3. Click Member Dashboard
    await openDrawer();
    const dashboardLink = page.getByRole('link', { name: /Member Dashboard/i });
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/app/user');
    expect(page.url()).not.toBe('http://localhost:3000/');
  });

  test('custody page blocks Next until QR is verified; wrong code surfaces mismatch error', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'member');

    // Intercept booking and custody endpoints
    await page.route('**/rest/v1/bookings*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'bk-e2e-custody',
          resource_id: 'res-e2e-1',
          user_id: 'member-uuid-5678',
          institution_id: 'inst-uuid-9999',
          start_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          purpose: 'Field research testing',
          status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          resources: {
            id: 'res-e2e-1',
            name: 'Optical Laser Spectrometer',
            kind: 'equipment',
            category: 'Lab Equipment',
            image_path: null,
            qr_identifier: 'EQS-A1B2C3D4E5',
            required_photo_slots: ['front', 'back'],
            resource_accessories: [],
          },
          profiles: {
            id: 'member-uuid-5678',
            full_name: 'E2E Member',
            user_type: 'student',
            avatar_url: null,
          },
        }),
      });
    });

    // Intercept verify_asset_qr RPC to return false for mismatch
    await page.route('**/rest/v1/rpc/verify_asset_qr*', async (route) => {
      const postData = route.request().postDataJSON();
      const isMatch = postData?.p_qr === 'EQS-A1B2C3D4E5';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isMatch),
      });
    });

    await page.goto('/app/bookings/bk-e2e-custody');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify Next button is disabled initially
    const nextBtn = page.getByRole('button', { name: /Next: Multi-Angle Photos/i });
    await expect(nextBtn).toBeDisabled();

    // 2. Enter a wrong QR tag manually
    const manualInput = page.getByPlaceholder(/e\.g\. EQS-/i);
    await expect(manualInput).toBeVisible();
    await manualInput.fill('EQS-WRONG9999');

    const verifyTagBtn = page.getByRole('button', { name: /Verify Tag/i });
    await verifyTagBtn.click();

    // 3. Assert error message surfaces and Next remains disabled
    await expect(page.getByText(/Scanned QR does not match this asset/i)).toBeVisible();
    await expect(nextBtn).toBeDisabled();

    // 4. Enter correct QR tag
    await manualInput.fill('EQS-A1B2C3D4E5');
    await verifyTagBtn.click();

    // 5. Assert verified state and Next button becomes enabled
    await expect(page.getByText(/Asset Tag Verified/i)).toBeVisible();
    await expect(nextBtn).toBeEnabled();
  });
});
