/**
 * e2e/helpers.ts
 * EquipSync – Playwright test helpers and staging credentials.
 */

import { Page } from '@playwright/test';

export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin.e2e@equipsync.org';
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'AdminPass123!#';
export const E2E_MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL || 'member.e2e@equipsync.org';
export const E2E_MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD || 'MemberPass123!#';

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 * 24, ...payload })).toString('base64url');
  const sig = Buffer.from('mock-sig').toString('base64url');
  return `${header}.${body}.${sig}`;
}

export async function mockAuthenticatedSession(
  page: Page,
  role: 'institution_admin' | 'member' = 'member',
  institutionName = 'Stanford Equipment Hub'
) {
  const userId = role === 'institution_admin' ? 'admin-uuid-1234' : 'member-uuid-5678';
  const instId = 'inst-uuid-9999';
  const userEmail = role === 'institution_admin' ? E2E_ADMIN_EMAIL : E2E_MEMBER_EMAIL;
  const jwtToken = makeFakeJwt({ sub: userId, email: userEmail, role: 'authenticated' });

  // Intercept auth/v1/user
  await page.route('**/auth/v1/user*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: userEmail,
        user_metadata: {
          role,
          full_name: role === 'institution_admin' ? 'E2E Administrator' : 'E2E Member',
          institution_id: instId,
        },
        created_at: new Date().toISOString(),
      }),
    });
  });

  // Intercept get_my_context RPC to return complete user context
  await page.route('**/rest/v1/rpc/get_my_context*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          id: userId,
          institution_id: instId,
          full_name: role === 'institution_admin' ? 'E2E Administrator' : 'E2E Member',
          role,
          user_type: role === 'institution_admin' ? 'staff' : 'student',
          verification_status: 'verified',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        institution_id: instId,
        institution_name: institutionName,
        institution: {
          id: instId,
          name: institutionName,
          type: 'University',
          email_domain: 'equipsync.org',
          address: '100 Campus Way',
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        verified_qualification_ids: ['qual-1', 'qual-2'],
      }),
    });
  });

  // Inject Supabase localStorage auth session token
  await page.addInitScript(
    ({ uid, email, userRole, iId, token }) => {
      const nowSec = Math.floor(Date.now() / 1000);
      const mockSession = {
        access_token: token,
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: nowSec + 86400,
        refresh_token: 'mock-refresh-token',
        user: {
          id: uid,
          aud: 'authenticated',
          role: 'authenticated',
          email,
          user_metadata: {
            role: userRole,
            full_name: userRole === 'institution_admin' ? 'E2E Administrator' : 'E2E Member',
            institution_id: iId,
          },
          created_at: new Date().toISOString(),
        },
      };

      const keys = ['sb-jkpbvpfxqkkbxxwmfdpj-auth-token'];
      for (const k of keys) {
        localStorage.setItem(k, JSON.stringify(mockSession));
      }
    },
    {
      uid: userId,
      email: userEmail,
      userRole: role,
      iId: instId,
      token: jwtToken,
    }
  );
}
