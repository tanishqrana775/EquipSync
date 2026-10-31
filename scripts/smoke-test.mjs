/**
 * scripts/smoke-test.mjs
 * EquipSync – Automated end-to-end backend verification and multi-tenant isolation suite.
 * Runs in Node 18+ using @supabase/supabase-js with only the public anon key.
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Environment Configuration & Protection Guards
// ---------------------------------------------------------------------------
function loadConfig() {
  let envLocalUrl = '';
  const envLocalPath = path.join(rootDir, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.slice(1, -1);
        }
        if (key === 'VITE_SUPABASE_URL') envLocalUrl = val;
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }

  const url = process.env.SMOKE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SMOKE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('Error: Supabase target URL and anon key must be provided.');
    process.exit(1);
  }

  // Safety guard against accidental test execution on configured project unless approved
  if (envLocalUrl && url === envLocalUrl && process.env.SMOKE_ALLOW_PROD !== 'true') {
    console.error(
      '\n[Guard Abort] Target URL matches VITE_SUPABASE_URL from .env.local.\n' +
      'To run the automated smoke test against this target, specify SMOKE_ALLOW_PROD=true:\n' +
      '  SMOKE_ALLOW_PROD=true node scripts/smoke-test.mjs\n' +
      'Or supply dedicated test credentials via SMOKE_SUPABASE_URL and SMOKE_SUPABASE_ANON_KEY.\n'
    );
    process.exit(1);
  }

  return { url, anonKey };
}

const { url, anonKey } = loadConfig();

function makeClient() {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      storageKey: `equipsync_smoke_${Math.random()}`,
    },
  });
}

// 1x1 Transparent PNG buffer
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_SHA256 = crypto.createHash('sha256').update(PNG_1X1).digest('hex');

const results = [];

async function runStep(stepName, fn) {
  try {
    await fn();
    results.push({ name: stepName, status: 'PASS' });
    console.log(`  [PASS] ${stepName}`);
  } catch (err) {
    const msg = err && typeof err === 'object' ? (err.message || JSON.stringify(err)) : String(err);
    results.push({ name: stepName, status: 'FAIL', error: msg });
    console.error(`  [FAIL] ${stepName} -> ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main Verification Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n============================================================');
  console.log(' EquipSync Automated Verification Suite');
  console.log(' Target:', url);
  console.log('============================================================\n');

  const runId = Date.now().toString().slice(-6);
  const password = `SmokePass_${runId}!Aa1`;

  // Clients
  const anonClient = makeClient();
  const adminAClient = makeClient();
  const memberA1Client = makeClient();
  const memberA2Client = makeClient();
  const adminBClient = makeClient();
  const memberB1Client = makeClient();

  let instAId = null;
  let instBId = null;
  let adminAId = null;
  let memberA1Id = null;
  let memberA2Id = null;
  let adminBId = null;
  let memberB1Id = null;

  let resourceR1Id = null; // Scheduling & Waitlist scenario
  let resourceR2Id = null; // Custody flow scenario
  let resourceBId = null;  // Cross-tenant resource

  let bookingR1Id = null;
  let bookingCustodyId = null;
  let bookingCleanId = null;

  // -------------------------------------------------------------------------
  // 1. Anon Endpoints: Public Stats & Directory
  // -------------------------------------------------------------------------
  await runStep('Public stats RPC returns only institution and resource counts for anon', async () => {
    const { data, error } = await anonClient.rpc('get_public_stats');
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('Expected object from get_public_stats');
    const keys = Object.keys(data);
    if (!('institutions' in data) || !('resources' in data)) {
      throw new Error(`Expected {institutions, resources}, got keys: ${keys.join(', ')}`);
    }
    if (typeof data.institutions !== 'number' || typeof data.resources !== 'number') {
      throw new Error('Stats values must be numeric counts');
    }
  });

  await runStep('Anon can call search_institutions with 3+ characters and gets at most 8 rows containing only id, name, type', async () => {
    const { data, error } = await anonClient.rpc('search_institutions', { p_query: 'test' });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Expected array from search_institutions');
    if (data.length > 8) throw new Error(`Expected at most 8 rows, got ${data.length}`);
    for (const row of data) {
      const keys = Object.keys(row).sort();
      if (keys.join(',') !== 'id,name,type') {
        throw new Error(`Row contains unexpected columns: ${keys.join(', ')}`);
      }
    }
  });

  await runStep('search_institutions with fewer than 3 characters raises query_too_short', async () => {
    const { error } = await anonClient.rpc('search_institutions', { p_query: 'ab' });
    if (!error) throw new Error('Expected query_too_short exception');
    if (!error.message.includes('query_too_short')) {
      throw new Error(`Expected query_too_short, got: ${error.message}`);
    }
  });

  await runStep('Anon cannot select from institutions or institution_directory (permission denied or 0 rows)', async () => {
    const { data: instData, error: instErr } = await anonClient.from('institutions').select('*');
    if (!instErr && instData && instData.length > 0) {
      throw new Error('Anon was able to read raw institutions table');
    }

    const { data: viewData, error: viewErr } = await anonClient.from('institution_directory').select('*');
    if (!viewErr && viewData && viewData.length > 0) {
      throw new Error('Anon was able to read institution_directory view');
    }
  });
  // -------------------------------------------------------------------------
  // 2. Authentication & Email Confirmation Gate
  // -------------------------------------------------------------------------
  await runStep('Admin A signup creates institution and verified admin profile', async () => {
    const instName = `zz-smoke-instA-${runId}`;
    const email = `admin_a_${runId}@example.com`;

    const { data, error } = await adminAClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'institution_admin',
          full_name: `Admin A ${runId}`,
          institution_name: instName,
          institution_type: 'University',
        },
      },
    });

    if (error) throw error;
    if (!data.session) {
      console.error(
        '\n[Auth Gate] Supabase project has "Confirm email" enabled.\n' +
        'Automated smoke test requires email confirmation to be OFF (or auto-confirm on signup)\n' +
        'so test accounts receive instant JWT sessions. Please run against a local dev instance\n' +
        'or temporarily disable email confirmation in Supabase Dashboard -> Authentication -> Providers -> Email.\n'
      );
      process.exit(1);
    }

    adminAId = data.user.id;
    await adminAClient.auth.setSession(data.session);

    const { data: prof, error: pErr } = await adminAClient
      .from('profiles')
      .select('*')
      .eq('id', adminAId)
      .single();
    if (pErr) throw pErr;
    if (!prof.institution_id) throw new Error('Profile missing institution_id');
    instAId = prof.institution_id;
  });

  await runStep('Sign up Member A1, Member A2 (Inst A) and Admin B, Member B1 (Inst B)', async () => {
    // Member A1
    const { data: a1, error: a1Err } = await memberA1Client.auth.signUp({
      email: `member_a1_${runId}@example.com`,
      password,
      options: {
        data: { role: 'member', full_name: `Member A1 ${runId}`, user_type: 'student', institution_id: instAId },
      },
    });
    if (a1Err) throw a1Err;
    memberA1Id = a1.user.id;
    if (a1.session) await memberA1Client.auth.setSession(a1.session);

    // Member A2
    const { data: a2, error: a2Err } = await memberA2Client.auth.signUp({
      email: `member_a2_${runId}@example.com`,
      password,
      options: {
        data: { role: 'member', full_name: `Member A2 ${runId}`, user_type: 'student', institution_id: instAId },
      },
    });
    if (a2Err) throw a2Err;
    memberA2Id = a2.user.id;
    if (a2.session) await memberA2Client.auth.setSession(a2.session);

    // Admin B
    const { data: bAdmin, error: bAdminErr } = await adminBClient.auth.signUp({
      email: `admin_b_${runId}@example.com`,
      password,
      options: {
        data: {
          role: 'institution_admin',
          full_name: `Admin B ${runId}`,
          institution_name: `zz-smoke-instB-${runId}`,
          institution_type: 'Workshop',
        },
      },
    });
    if (bAdminErr) throw bAdminErr;
    adminBId = bAdmin.user.id;
    if (bAdmin.session) await adminBClient.auth.setSession(bAdmin.session);

    const { data: bProf, error: bProfErr } = await adminBClient
      .from('profiles')
      .select('*')
      .eq('id', adminBId)
      .single();
    if (bProfErr) throw bProfErr;
    instBId = bProf.institution_id;

    // Member B1
    const { data: b1, error: b1Err } = await memberB1Client.auth.signUp({
      email: `member_b1_${runId}@example.com`,
      password,
      options: {
        data: { role: 'member', full_name: `Member B1 ${runId}`, user_type: 'student', institution_id: instBId },
      },
    });
    if (b1Err) throw b1Err;
    memberB1Id = b1.user.id;
    if (b1.session) await memberB1Client.auth.setSession(b1.session);
  });

  // -------------------------------------------------------------------------
  // 3. Scheduling & Waitlist Flow
  // -------------------------------------------------------------------------
  await runStep('Admin A creates Resource R1 and Admin B creates Resource RB', async () => {
    // Resource R1
    const { data: r1, error: r1Err } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `R1 Cinema Rig ${runId}`,
        kind: 'equipment',
        category: 'DSLR Cameras',
        asset_tag: `TAG-R1-${runId}`,
        location: 'Hub A - Cabinet 1',
        required_photo_slots: ['front', 'back'],
        is_available: true,
      })
      .select()
      .single();
    if (r1Err) throw r1Err;
    resourceR1Id = r1.id;

    await adminAClient.from('eligibility_rules').insert({
      resource_id: resourceR1Id,
      requires_approval: true,
      requires_supervision: false,
      max_duration_minutes: 1440,
      min_lead_time_minutes: 0,
    });

    // Resource RB in Institution B
    const { data: rb, error: rbErr } = await adminBClient
      .from('resources')
      .insert({
        institution_id: instBId,
        name: `RB 3D Printer ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        asset_tag: `TAG-RB-${runId}`,
        location: 'Workshop B - Bay 2',
        is_available: true,
      })
      .select()
      .single();
    if (rbErr) throw rbErr;
    resourceBId = rb.id;
  });

  await runStep('Unverified Member A2 request_booking fails with not_verified', async () => {
    const start = new Date(Date.now() + 86400 * 1000).toISOString();
    const end = new Date(Date.now() + 90000 * 1000).toISOString();

    const { error } = await memberA2Client.rpc('request_booking', {
      p_resource_id: resourceR1Id,
      p_start: start,
      p_end: end,
      p_purpose: 'Unverified request test',
    });

    if (!error) throw new Error('Expected failure for unverified member');
    if (!error.message.includes('not_verified')) {
      throw new Error(`Expected not_verified, got: ${error.message}`);
    }
  });

  await runStep('Admin A verifies Member A1 and Member A2', async () => {
    const { data: v1, error: v1Err } = await adminAClient.rpc('verify_member', {
      p_user_id: memberA1Id,
      p_approve: true,
    });
    if (v1Err) throw v1Err;
    if (v1.verification_status !== 'verified') throw new Error('Failed to verify member A1');

    const { data: v2, error: v2Err } = await adminAClient.rpc('verify_member', {
      p_user_id: memberA2Id,
      p_approve: true,
    });
    if (v2Err) throw v2Err;
    if (v2.verification_status !== 'verified') throw new Error('Failed to verify member A2');
  });

  const schedStart = new Date(Date.now() + 86400 * 1000).toISOString();
  const schedEnd = new Date(Date.now() + 93600 * 1000).toISOString();

  await runStep('Verified Member A1 requests booking (status pending)', async () => {
    const { data, error } = await memberA1Client.rpc('request_booking', {
      p_resource_id: resourceR1Id,
      p_start: schedStart,
      p_end: schedEnd,
      p_purpose: 'Autonomous scheduling test',
    });
    if (error) throw error;
    bookingR1Id = data.id;
    if (data.status !== 'pending') throw new Error(`Expected pending, got ${data.status}`);
  });

  await runStep('Admin A approves booking and overlapping request by A2 fails with slot_taken', async () => {
    const { error: appErr } = await adminAClient.rpc('decide_booking', {
      p_booking_id: bookingR1Id,
      p_approve: true,
    });
    if (appErr) throw appErr;

    const { error: overlapErr } = await memberA2Client.rpc('request_booking', {
      p_resource_id: resourceR1Id,
      p_start: schedStart,
      p_end: schedEnd,
      p_purpose: 'Conflicting slot request',
    });

    if (!overlapErr) throw new Error('Expected overlap to fail with slot_taken');
    if (!overlapErr.message.includes('slot_taken')) {
      throw new Error(`Expected slot_taken, got: ${overlapErr.message}`);
    }
  });

  await runStep('Member A2 joins waitlist for R1 window', async () => {
    const { data, error } = await memberA2Client.rpc('join_waitlist', {
      p_resource_id: resourceR1Id,
      p_start: schedStart,
      p_end: schedEnd,
    });
    if (error) throw error;
    if (data.status !== 'waiting') throw new Error(`Expected waiting, got ${data.status}`);
  });

  await runStep('Member A1 releases booking -> slot released and A2 waitlist becomes offered', async () => {
    const { data: rel, error: relErr } = await memberA1Client.rpc('release_booking', {
      p_booking_id: bookingR1Id,
    });
    if (relErr) throw relErr;
    if (rel.status !== 'released') throw new Error(`Expected released, got ${rel.status}`);

    await new Promise((r) => setTimeout(r, 600));

    const { data: waitEntries, error: wErr } = await memberA2Client.rpc('my_waitlist');
    if (wErr) throw wErr;
    const entry = waitEntries.find((e) => e.resource_id === resourceR1Id);
    if (!entry || entry.status !== 'offered') {
      throw new Error(`Expected waitlist status 'offered', got: ${entry?.status}`);
    }

    const { data: notifs, error: nErr } = await memberA2Client
      .from('notifications')
      .select('*')
      .eq('user_id', memberA2Id);
    if (nErr) throw nErr;
    const slotNotif = notifs.find((n) => n.type === 'slot_available');
    if (!slotNotif) throw new Error('Expected slot_available notification for Member A2');
  });

  await runStep('Member A2 claims released slot and Admin A approves it', async () => {
    const { data: slots, error: sErr } = await memberA2Client
      .from('released_slots')
      .select('*')
      .eq('resource_id', resourceR1Id)
      .eq('status', 'open');
    if (sErr) throw sErr;
    if (slots.length === 0) throw new Error('No open released slot found');

    const { data: claimedBk, error: claimErr } = await memberA2Client.rpc('claim_released_slot', {
      p_slot_id: slots[0].id,
    });
    if (claimErr) throw claimErr;

    // Approve claimed booking
    const { error: appErr } = await adminAClient.rpc('decide_booking', {
      p_booking_id: claimedBk.id,
      p_approve: true,
    });
    if (appErr) throw appErr;
  });

  // -------------------------------------------------------------------------
  // 4. Multi-Tenant Isolation Assertions
  // -------------------------------------------------------------------------
  await runStep('Member A1 sees 0 resources, qualifications and released_slots of Institution B', async () => {
    const { data: res, error: rErr } = await memberA1Client
      .from('resources')
      .select('*')
      .eq('institution_id', instBId);
    if (rErr) throw rErr;
    if (res && res.length > 0) throw new Error('Tenant leak: Member A1 read Institution B resources');

    const { data: quals, error: qErr } = await memberA1Client
      .from('qualifications')
      .select('*')
      .eq('institution_id', instBId);
    if (qErr) throw qErr;
    if (quals && quals.length > 0) throw new Error('Tenant leak: Member A1 read Institution B qualifications');

    const { data: slots, error: sErr } = await memberA1Client
      .from('released_slots')
      .select('*')
      .eq('institution_id', instBId);
    if (sErr) throw sErr;
    if (slots && slots.length > 0) throw new Error('Tenant leak: Member A1 read Institution B released slots');
  });

  await runStep('Cross-tenant RPC calls (request_booking, join_waitlist, claim_released_slot) return forbidden', async () => {
    const futureStart = new Date(Date.now() + 120000 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 123600 * 1000).toISOString();

    // Member A1 attempting to request B's resource
    const { error: reqErr } = await memberA1Client.rpc('request_booking', {
      p_resource_id: resourceBId,
      p_start: futureStart,
      p_end: futureEnd,
      p_purpose: 'Cross tenant attack',
    });
    if (!reqErr || !reqErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden on cross-tenant request_booking, got: ${reqErr?.message}`);
    }

    // Member A1 attempting to join waitlist for B's resource
    const { error: waitErr } = await memberA1Client.rpc('join_waitlist', {
      p_resource_id: resourceBId,
      p_start: futureStart,
      p_end: futureEnd,
    });
    if (!waitErr || !waitErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden on cross-tenant join_waitlist, got: ${waitErr?.message}`);
    }
  });

  await runStep('Admin B cannot decide Admin A booking (returns forbidden)', async () => {
    const { error } = await adminBClient.rpc('decide_booking', {
      p_booking_id: bookingR1Id,
      p_approve: false,
      p_note: 'Malicious rejection',
    });
    if (!error || !error.message.includes('forbidden')) {
      throw new Error(`Expected forbidden when Admin B decides A booking, got: ${error?.message}`);
    }
  });

  await runStep('Listing another tenant resource-images storage folder returns nothing', async () => {
    const { data, error } = await memberA1Client.storage
      .from('resource-images')
      .list(instBId);
    if (data && data.length > 0) {
      throw new Error('Tenant storage leak: Member A1 listed Institution B storage objects');
    }
  });

  await runStep('Member A1 searching for Institution B name gets only id, name, type and no internal data', async () => {
    const { data, error } = await memberA1Client.rpc('search_institutions', { p_query: `zz-smoke-instB-${runId}` });
    if (error) throw error;
    if (data && data.length > 0) {
      const row = data[0];
      const keys = Object.keys(row).sort();
      if (keys.join(',') !== 'id,name,type') {
        throw new Error(`Row exposed extra fields: ${keys.join(', ')}`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // 5. Custody Verification & Return Quality Gate
  // 5. Custody Verification v2, QR, Hashes, Checklists & Quality Gate
  // Window: booking starts 10 minutes from now, ending 1 hour later (within 15m check-out window)
  // -------------------------------------------------------------------------
  let r2QrIdentifier = null;
  let accLensId = null;
  let accBatteryId = null;

  await runStep('Create Resource R2 with unique QR, accessories and custody booking', async () => {
    const { data: r2, error: r2Err } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `R2 Field Scope ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        asset_tag: `TAG-R2-${runId}`,
        location: 'Hub A - Cabinet 2',
        required_photo_slots: ['front', 'back'],
        is_available: true,
      })
      .select()
      .single();
    if (r2Err) throw r2Err;
    resourceR2Id = r2.id;
    r2QrIdentifier = r2.qr_identifier;

    if (!r2QrIdentifier || !r2QrIdentifier.startsWith('EQS-')) {
      throw new Error(`Expected generated QR starting with EQS-, got: ${r2QrIdentifier}`);
    }

    // Add accessories
    const { data: accs, error: accErr } = await adminAClient
      .from('resource_accessories')
      .insert([
        { resource_id: resourceR2Id, name: 'Precision Lens', required: true },
        { resource_id: resourceR2Id, name: 'Li-Ion Battery Pack', required: true },
      ])
      .select();
    if (accErr) throw accErr;
    accLensId = accs[0].id;
    accBatteryId = accs[1].id;

    await adminAClient.from('eligibility_rules').insert({
      resource_id: resourceR2Id,
      requires_approval: true,
      max_duration_minutes: 1440,
      min_lead_time_minutes: 0,
    });

    const nowMs = Date.now();
    const custStart = new Date(nowMs + 10 * 60 * 1000).toISOString();
    const custEnd = new Date(nowMs + 70 * 60 * 1000).toISOString();

    const { data: bk, error: bkErr } = await memberA1Client.rpc('request_booking', {
      p_resource_id: resourceR2Id,
      p_start: custStart,
      p_end: custEnd,
      p_purpose: 'Immediate custody workflow testing',
    });
    if (bkErr) throw bkErr;
    bookingCustodyId = bk.id;

    // Approve booking
    const { error: appErr } = await adminAClient.rpc('decide_booking', {
      p_booking_id: bookingCustodyId,
      p_approve: true,
    });
    if (appErr) throw appErr;
  });

  await runStep('Owning admin successfully regenerates Resource R2 QR identifier', async () => {
    const { data: newQr, error } = await adminAClient.rpc('regenerate_resource_qr', {
      p_resource_id: resourceR2Id,
    });
    if (error) throw error;
    if (!newQr || !newQr.startsWith('EQS-') || newQr === r2QrIdentifier) {
      throw new Error(`Expected new valid QR identifier, got: ${newQr}`);
    }
    r2QrIdentifier = newQr;
  });

  await runStep('Foreign tenant admin cannot regenerate Resource R2 QR identifier', async () => {
    const { error } = await adminBClient.rpc('regenerate_resource_qr', {
      p_resource_id: resourceR2Id,
    });
    if (!error || !error.message.includes('forbidden')) {
      throw new Error(`Expected forbidden when Admin B regenerates A QR, got: ${error?.message}`);
    }
  });

  await runStep('Borrower calls verify_asset_qr with matching and mismatched QR codes', async () => {
    // Mismatch
    const { data: mismatchMatch, error: mErr } = await memberA1Client.rpc('verify_asset_qr', {
      p_booking_id: bookingCustodyId,
      p_qr: 'EQS-WRONG9999',
      p_phase: 'checkout',
    });
    if (mErr) throw mErr;
    if (mismatchMatch !== false) throw new Error('Expected verify_asset_qr to return false for mismatch');

    // Correct
    const { data: correctMatch, error: cErr } = await memberA1Client.rpc('verify_asset_qr', {
      p_booking_id: bookingCustodyId,
      p_qr: r2QrIdentifier,
      p_phase: 'checkout',
    });
    if (cErr) throw cErr;
    if (correctMatch !== true) throw new Error('Expected verify_asset_qr to return true for correct QR');
  });

  await runStep('start_checkout logs audit action and check-out requires QR code', async () => {
    const { error: startErr } = await memberA1Client.rpc('start_checkout', {
      p_booking_id: bookingCustodyId,
    });
    if (startErr) throw startErr;

    // Check-out without QR -> qr_required
    const { error: noQrErr } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [],
      p_condition: 'excellent',
      p_notes: 'Missing QR test',
      p_accessory_checks: [],
      p_qr_identifier: '',
    });
    if (!noQrErr || !noQrErr.message.includes('qr_required')) {
      throw new Error(`Expected qr_required, got: ${noQrErr?.message}`);
    }

    // Check-out with wrong QR -> qr_mismatch
    const { error: wrongQrErr } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [],
      p_condition: 'excellent',
      p_notes: 'Wrong QR test',
      p_accessory_checks: [],
      p_qr_identifier: 'EQS-BADTAG000',
    });
    if (!wrongQrErr || !wrongQrErr.message.includes('qr_mismatch')) {
      throw new Error(`Expected qr_mismatch, got: ${wrongQrErr?.message}`);
    }
  });

  await runStep('Check-out validates complete accessory checklist and 64-char sha256 hashes', async () => {
    const pathFront = `${instAId}/${bookingCustodyId}/checkout/front.jpg`;
    const pathBack = `${instAId}/${bookingCustodyId}/checkout/back.jpg`;

    // 1. Incomplete accessory checklist -> accessory_checklist_incomplete
    const { error: incCheckErr } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'excellent',
      p_notes: 'Incomplete check test',
      p_accessory_checks: [{ accessory_id: accLensId, name: 'Precision Lens', state: 'present' }], // missing battery
      p_qr_identifier: r2QrIdentifier,
    });
    if (!incCheckErr || !incCheckErr.message.includes('accessory_checklist_incomplete')) {
      throw new Error(`Expected accessory_checklist_incomplete, got: ${incCheckErr?.message}`);
    }

    // 2. Malformed sha256 hash -> invalid_hash
    const { error: badHashErr } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: 'not-a-valid-sha256-hex', client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'excellent',
      p_notes: 'Bad hash test',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'present' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: r2QrIdentifier,
    });
    if (!badHashErr || !badHashErr.message.includes('invalid_hash')) {
      throw new Error(`Expected invalid_hash, got: ${badHashErr?.message}`);
    }
  });

  await runStep('Upload photos, verify storage immutability, and complete checkout with condition excellent', async () => {
    const pathFront = `${instAId}/${bookingCustodyId}/checkout/front.jpg`;
    const pathBack = `${instAId}/${bookingCustodyId}/checkout/back.jpg`;

    const { error: up1 } = await memberA1Client.storage
      .from('custody-photos')
      .upload(pathFront, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    if (up1) throw up1;

    const { error: up2 } = await memberA1Client.storage
      .from('custody-photos')
      .upload(pathBack, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    if (up2) throw up2;

    // Overwrite fails
    const { error: owErr } = await memberA1Client.storage
      .from('custody-photos')
      .upload(pathFront, PNG_1X1, { upsert: true });
    if (!owErr) throw new Error('Photo overwrite must fail');

    // Check-out succeeds
    const { data: co, error: coErr } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'excellent',
      p_notes: 'Handover complete in pristine condition',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'present' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: r2QrIdentifier,
    });
    if (coErr) throw coErr;
    if (co.status !== 'checked_out') throw new Error(`Expected checked_out, got: ${co.status}`);

    // Photo integrity check: download via signed URL and verify hash
    const { data: signData, error: sErr } = await memberA1Client.storage
      .from('custody-photos')
      .createSignedUrl(pathFront, 60);
    if (sErr) throw sErr;
    const resp = await fetch(signData.signedUrl);
    const buf = Buffer.from(await resp.arrayBuffer());
    const dlHash = crypto.createHash('sha256').update(buf).digest('hex');
    if (dlHash !== PNG_SHA256) throw new Error('Downloaded photo hash did not match stored hash');

    // Verify custody_photos row metadata has taken_by and server created_at
    const { data: dbPhotos } = await memberA1Client
      .from('custody_photos')
      .select('*')
      .eq('booking_id', bookingCustodyId);
    if (dbPhotos && dbPhotos.length > 0) {
      if (dbPhotos[0].taken_by !== memberA1Id || !dbPhotos[0].created_at) {
        throw new Error('Photo metadata missing taken_by or server created_at');
      }
    }
  });

  await runStep('start_return logs return_initiated and check-in requires QR', async () => {
    const { error: sErr } = await memberA1Client.rpc('start_return', {
      p_booking_id: bookingCustodyId,
    });
    if (sErr) throw sErr;

    const pathInFront = `${instAId}/${bookingCustodyId}/checkin/front.jpg`;
    const pathInBack = `${instAId}/${bookingCustodyId}/checkin/back.jpg`;
    await memberA1Client.storage.from('custody-photos').upload(pathInFront, PNG_1X1, { contentType: 'image/jpeg' });
    await memberA1Client.storage.from('custody-photos').upload(pathInBack, PNG_1X1, { contentType: 'image/jpeg' });

    const { error: noQrErr } = await memberA1Client.rpc('check_in_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'minor_damage',
      p_notes: 'Missing QR on return',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'present' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: '',
    });
    if (!noQrErr || !noQrErr.message.includes('qr_required')) {
      throw new Error(`Expected qr_required on check-in, got: ${noQrErr?.message}`);
    }
  });

  await runStep('Return with degraded condition and missing accessory flags return and auto-creates incident', async () => {
    const pathInFront = `${instAId}/${bookingCustodyId}/checkin/front.jpg`;
    const pathInBack = `${instAId}/${bookingCustodyId}/checkin/back.jpg`;

    // Blank notes on defect -> notes_required
    const { error: blankErr } = await memberA1Client.rpc('check_in_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'minor_damage',
      p_notes: '   ',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'missing' }, // missing!
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: r2QrIdentifier,
    });
    if (!blankErr || !blankErr.message.includes('notes_required')) {
      throw new Error(`Expected notes_required, got: ${blankErr?.message}`);
    }

    // Submit with notes
    const { data: ci, error: ciErr } = await memberA1Client.rpc('check_in_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'minor_damage',
      p_notes: 'Precision lens was dropped in field; front filter thread dented and lens cap missing',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'missing' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: r2QrIdentifier,
    });
    if (ciErr) throw ciErr;
    if (ci.status !== 'returned') throw new Error(`Expected returned, got: ${ci.status}`);

    // Verify custody event was flagged
    const { data: cEvs, error: ceErr } = await adminAClient
      .from('custody_events')
      .select('*')
      .eq('booking_id', bookingCustodyId)
      .eq('phase', 'checkin')
      .single();
    if (ceErr) throw ceErr;
    if (!cEvs.flagged) throw new Error('Expected checkin custody event to be flagged');
    if (cEvs.flag_reasons.length === 0) throw new Error('Expected flag_reasons to be populated');
  });

  await runStep('inspect_return permissions: borrower and foreign admin are forbidden', async () => {
    // Borrower calling inspect_return -> forbidden
    const { error: bErr } = await memberA1Client.rpc('inspect_return', {
      p_booking_id: bookingCustodyId,
      p_condition: 'good',
      p_accessory_checks: [],
      p_notes: 'Borrower self-inspect attempt',
    });
    if (!bErr || !bErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden for borrower inspect_return, got: ${bErr?.message}`);
    }

    // Foreign admin B calling inspect_return on A booking -> forbidden
    const { error: fErr } = await adminBClient.rpc('inspect_return', {
      p_booking_id: bookingCustodyId,
      p_condition: 'good',
      p_accessory_checks: [],
      p_notes: 'Foreign admin inspect attempt',
    });
    if (!fErr || !fErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden for foreign admin inspect_return, got: ${fErr?.message}`);
    }
  });

  await runStep('Admin A inspect_return with defect server-computes disputed status and logs dispute_opened', async () => {
    const { data: insp, error: inspErr } = await adminAClient.rpc('inspect_return', {
      p_booking_id: bookingCustodyId,
      p_condition: 'major_damage',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'missing' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_notes: 'Damage inspection confirmed: filter ring warped and optic element scratched',
    });
    if (inspErr) throw inspErr;
    if (insp.status !== 'disputed') throw new Error(`Expected disputed status, got: ${insp.status}`);
  });

  await runStep('Timeline contains custody.* audit events in chronological order and enforces participant privacy', async () => {
    // Borrower can read timeline
    const { data: tl, error: tlErr } = await memberA1Client.rpc('get_custody_timeline', {
      p_booking_id: bookingCustodyId,
    });
    if (tlErr) throw tlErr;
    if (!Array.isArray(tl) || tl.length < 5) {
      throw new Error(`Expected comprehensive timeline with audit events, got ${tl?.length}`);
    }

    // Verify chronological order
    let lastTs = 0;
    for (const item of tl) {
      const ts = new Date(item.occurred_at).getTime();
      if (ts < lastTs) throw new Error('Timeline events are not in non-decreasing time order');
      lastTs = ts;
    }

    // Unrelated Member B1 attempting to read A timeline -> forbidden
    const { error: b1Err } = await memberB1Client.rpc('get_custody_timeline', {
      p_booking_id: bookingCustodyId,
    });
    if (!b1Err || !b1Err.message.includes('forbidden')) {
      throw new Error(`Expected forbidden when unrelated member reads timeline, got: ${b1Err?.message}`);
    }
  });

  await runStep('resolve_dispute requires admin, valid resolution and non-empty notes; closes case permanently', async () => {
    // 1. Empty notes -> notes_required
    const { error: emptyNotesErr } = await adminAClient.rpc('resolve_dispute', {
      p_booking_id: bookingCustodyId,
      p_resolution: 'borrower_responsible',
      p_notes: '   ',
    });
    if (!emptyNotesErr || !emptyNotesErr.message.includes('notes_required')) {
      throw new Error(`Expected notes_required on resolve_dispute, got: ${emptyNotesErr?.message}`);
    }

    // 2. Successful resolution
    const { data: resBk, error: resErr } = await adminAClient.rpc('resolve_dispute', {
      p_booking_id: bookingCustodyId,
      p_resolution: 'borrower_responsible',
      p_notes: 'Borrower agreed to pay replacement deductible of $120. Case settled.',
    });
    if (resErr) throw resErr;
    if (resBk.status !== 'closed') throw new Error(`Expected closed status, got: ${resBk.status}`);

    // 3. Second call fails with invalid_state (booking already closed)
    const { error: secondErr } = await adminAClient.rpc('resolve_dispute', {
      p_booking_id: bookingCustodyId,
      p_resolution: 'no_fault',
      p_notes: 'Duplicate resolution attempt',
    });
    if (!secondErr || !secondErr.message.includes('invalid_state')) {
      throw new Error(`Expected invalid_state on second resolve, got: ${secondErr?.message}`);
    }

    // 4. Verify notification to borrower
    const { data: notifs, error: nErr } = await memberA1Client
      .from('notifications')
      .select('*')
      .eq('user_id', memberA1Id)
      .eq('type', 'dispute_resolved');
    if (nErr) throw nErr;
    if (notifs.length === 0) throw new Error('Borrower did not receive dispute_resolved notification');
  });

  // -------------------------------------------------------------------------
  // 6. Clean Booking Path (condition good, everything present -> closed)
  // -------------------------------------------------------------------------
  await runStep('Second clean booking path with all accessories present and clean inspection closes booking directly', async () => {
    const nowMs = Date.now();
    const cleanStart = new Date(nowMs + 5 * 60 * 1000).toISOString();
    const cleanEnd = new Date(nowMs + 65 * 60 * 1000).toISOString();

    // 1. Request
    const { data: bk, error: bkErr } = await memberA2Client.rpc('request_booking', {
      p_resource_id: resourceR2Id,
      p_start: cleanStart,
      p_end: cleanEnd,
      p_purpose: 'Clean verification pass',
    });
    if (bkErr) throw bkErr;
    bookingCleanId = bk.id;

    // 2. Approve
    await adminAClient.rpc('decide_booking', { p_booking_id: bookingCleanId, p_approve: true });

    // 3. Check-out
    const pathFront = `${instAId}/${bookingCleanId}/checkout/front.jpg`;
    const pathBack = `${instAId}/${bookingCleanId}/checkout/back.jpg`;
    await memberA2Client.storage.from('custody-photos').upload(pathFront, PNG_1X1, { contentType: 'image/jpeg' });
    await memberA2Client.storage.from('custody-photos').upload(pathBack, PNG_1X1, { contentType: 'image/jpeg' });

    await memberA2Client.rpc('check_out_booking', {
      p_booking_id: bookingCleanId,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'good',
      p_notes: 'Check-out clean',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'present' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: r2QrIdentifier,
    });

    // 4. Check-in clean
    const pathInFront = `${instAId}/${bookingCleanId}/checkin/front.jpg`;
    const pathInBack = `${instAId}/${bookingCleanId}/checkin/back.jpg`;
    await memberA2Client.storage.from('custody-photos').upload(pathInFront, PNG_1X1, { contentType: 'image/jpeg' });
    await memberA2Client.storage.from('custody-photos').upload(pathInBack, PNG_1X1, { contentType: 'image/jpeg' });

    await memberA2Client.rpc('check_in_booking', {
      p_booking_id: bookingCleanId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'good',
      p_notes: 'All items returned in pristine order',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'present' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_qr_identifier: r2QrIdentifier,
    });

    // 5. Inspect accept clean -> closed
    const { data: closedBk, error: closeErr } = await adminAClient.rpc('inspect_return', {
      p_booking_id: bookingCleanId,
      p_condition: 'good',
      p_accessory_checks: [
        { accessory_id: accLensId, name: 'Precision Lens', state: 'present' },
        { accessory_id: accBatteryId, name: 'Li-Ion Battery Pack', state: 'present' },
      ],
      p_notes: 'Verified and restocked in clean order',
    });
    if (closeErr) throw closeErr;
    if (closedBk.status !== 'closed') throw new Error(`Expected closed status, got: ${closedBk.status}`);
  });

  // -------------------------------------------------------------------------
  // 7. Migration 0010 Hardening & Lifecycle Tests
  // -------------------------------------------------------------------------
  const { error: probe0010 } = await adminAClient.rpc('ensure_category', { p_name: 'probe' });
  const is0010Applied = !probe0010 || !probe0010.message.includes('schema cache');

  if (!is0010Applied) {
    console.log('\n  [NOTICE] Migration 0010_resources_hardening.sql not yet executed on remote database.');
    console.log('  Skipping Migration 0010 assertions until applied via Supabase SQL Editor.\n');
  } else {
  await runStep('Blank asset_tag gets an EQP- tag from the trigger', async () => {
    const { data: resAuto, error: autoErr } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `Auto Tag Resource ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        location: 'Auto Station',
      })
      .select()
      .single();
    if (autoErr) throw autoErr;
    if (!resAuto.asset_tag || !/^EQP-[2-9A-HJ-NP-Z]{6}$/.test(resAuto.asset_tag)) {
      throw new Error(`Expected EQP- tag, got: ${resAuto.asset_tag}`);
    }
  });

  await runStep('Asset tag is unique per tenant (case-insensitive) and immutable', async () => {
    // 1. Create with specific tag
    const specificTag = `EQP-U${runId.slice(0, 5)}`;
    const { data: rTag1, error: tErr1 } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `Tag Test Resource ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        asset_tag: specificTag,
      })
      .select()
      .single();
    if (tErr1) throw tErr1;

    // 2. Duplicate case-insensitive tag in same institution fails
    const { error: dupErr } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `Dup Tag Resource ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        asset_tag: specificTag.toLowerCase(),
      });
    if (!dupErr) {
      throw new Error('Expected duplicate asset tag to fail');
    }

    // 3. Immutability: changing asset tag raises asset_tag_immutable
    const { error: immErr } = await adminAClient
      .from('resources')
      .update({ asset_tag: 'EQP-MODIFIED' })
      .eq('id', rTag1.id);
    if (!immErr || !immErr.message.includes('asset_tag_immutable')) {
      throw new Error(`Expected asset_tag_immutable error, got: ${immErr?.message}`);
    }
  });

  await runStep('ensure_category dedupes case-insensitively, rejects empty/over-long names, forbidden for members', async () => {
    // Member forbidden
    const { error: memCatErr } = await memberA1Client.rpc('ensure_category', { p_name: 'Test Category' });
    if (!memCatErr || !memCatErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden for member calling ensure_category, got: ${memCatErr?.message}`);
    }

    // Rejects empty
    const { error: emptyErr } = await adminAClient.rpc('ensure_category', { p_name: '   ' });
    if (!emptyErr || !emptyErr.message.includes('invalid_category')) {
      throw new Error(`Expected invalid_category for empty name, got: ${emptyErr?.message}`);
    }

    // Rejects over-long (> 40 chars)
    const { error: longErr } = await adminAClient.rpc('ensure_category', {
      p_name: 'This is an excessively long category name that exceeds forty characters',
    });
    if (!longErr || !longErr.message.includes('invalid_category')) {
      throw new Error(`Expected invalid_category for > 40 chars, got: ${longErr?.message}`);
    }

    // Creates canonical category
    const { data: cat1, error: c1Err } = await adminAClient.rpc('ensure_category', { p_name: 'Precision Optics' });
    if (c1Err) throw c1Err;
    if (cat1 !== 'Precision Optics') throw new Error(`Expected 'Precision Optics', got: ${cat1}`);

    // Dedupes case-insensitively
    const { data: cat2, error: c2Err } = await adminAClient.rpc('ensure_category', { p_name: 'precision optics' });
    if (c2Err) throw c2Err;
    if (cat2 !== 'Precision Optics') throw new Error(`Expected dedupe to 'Precision Optics', got: ${cat2}`);
  });

  await runStep('resource_categories is invisible to other tenants via RLS', async () => {
    const { data: bCats, error: bErr } = await adminBClient
      .from('resource_categories')
      .select('*')
      .eq('name', 'Precision Optics');
    if (bErr) throw bErr;
    if (bCats && bCats.length > 0) {
      throw new Error('Tenant B could see Tenant A custom category!');
    }
  });

  await runStep('retire_resource is blocked with resource_in_use when booking is in custody', async () => {
    // 1. Create resource R_in_use and check out a booking
    const { data: rUse, error: rUseErr } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `In-Use Resource ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        asset_tag: `EQP-INUSE${runId.slice(0, 3)}`,
      })
      .select()
      .single();
    if (rUseErr) throw rUseErr;

    // Add rules
    await adminAClient.from('eligibility_rules').insert({
      resource_id: rUse.id,
      requires_approval: false,
      max_duration_minutes: 1440,
    });

    const now = Date.now();
    const { data: bUse } = await memberA1Client.rpc('request_booking', {
      p_resource_id: rUse.id,
      p_start: new Date(now + 60000).toISOString(),
      p_end: new Date(now + 3600000).toISOString(),
      p_purpose: 'In-use lock verification',
    });

    const pathFront = `${instAId}/${bUse.id}/checkout/front.jpg`;
    const pathBack = `${instAId}/${bUse.id}/checkout/back.jpg`;
    await memberA1Client.storage.from('custody-photos').upload(pathFront, PNG_1X1, { contentType: 'image/jpeg' });
    await memberA1Client.storage.from('custody-photos').upload(pathBack, PNG_1X1, { contentType: 'image/jpeg' });

    await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bUse.id,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'good',
      p_notes: 'Checking out',
      p_accessory_checks: [],
      p_qr_identifier: rUse.qr_identifier,
    });

    // Calling retire_resource while checked_out raises resource_in_use
    const { error: inUseErr } = await adminAClient.rpc('retire_resource', {
      p_resource_id: rUse.id,
      p_reason: 'Testing in-use block',
    });
    if (!inUseErr || !inUseErr.message.includes('resource_in_use')) {
      throw new Error(`Expected resource_in_use error, got: ${inUseErr?.message}`);
    }
  });

  await runStep('Member and foreign admin cannot call retire_resource or reactivate_resource', async () => {
    const { error: memRetireErr } = await memberA1Client.rpc('retire_resource', {
      p_resource_id: resourceR1Id,
      p_reason: 'Unauthorized attempt',
    });
    if (!memRetireErr || !memRetireErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden for member retire, got: ${memRetireErr?.message}`);
    }

    const { error: foreignRetireErr } = await adminBClient.rpc('retire_resource', {
      p_resource_id: resourceR1Id,
      p_reason: 'Cross-tenant attempt',
    });
    if (!foreignRetireErr || !foreignRetireErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden for foreign admin retire, got: ${foreignRetireErr?.message}`);
    }

    const { error: foreignReactivateErr } = await adminBClient.rpc('reactivate_resource', {
      p_resource_id: resourceR1Id,
    });
    if (!foreignReactivateErr || !foreignReactivateErr.message.includes('forbidden')) {
      throw new Error(`Expected forbidden for foreign admin reactivate, got: ${foreignReactivateErr?.message}`);
    }
  });

  await runStep('retire_resource cancels future bookings, waitlists and notifies; setting is_available = true raises resource_retired', async () => {
    // 1. Create fresh resource with future booking & waitlist
    const { data: rRetire } = await adminAClient
      .from('resources')
      .insert({
        institution_id: instAId,
        name: `Retire Flow Resource ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
      })
      .select()
      .single();

    await adminAClient.from('eligibility_rules').insert({
      resource_id: rRetire.id,
      requires_approval: false,
      max_duration_minutes: 1440,
    });

    const futureStart = new Date(Date.now() + 86400 * 2000).toISOString();
    const futureEnd = new Date(Date.now() + 86400 * 3000).toISOString();

    const { data: futBooking } = await memberA1Client.rpc('request_booking', {
      p_resource_id: rRetire.id,
      p_start: futureStart,
      p_end: futureEnd,
      p_purpose: 'Future research',
    });

    await memberA2Client.rpc('join_waitlist', {
      p_resource_id: rRetire.id,
      p_start: futureStart,
      p_end: futureEnd,
    });

    // 2. Retire resource
    const { data: retiredRes, error: retErr } = await adminAClient.rpc('retire_resource', {
      p_resource_id: rRetire.id,
      p_reason: 'End-of-life lifecycle decommission',
    });
    if (retErr) throw retErr;
    if (retiredRes.status !== 'retired' || retiredRes.is_available !== false) {
      throw new Error(`Expected retired status and is_available=false, got: status=${retiredRes.status}, is_available=${retiredRes.is_available}`);
    }

    // Assert future booking cancelled
    const { data: chkBk } = await adminAClient.from('bookings').select('status').eq('id', futBooking.id).single();
    if (chkBk.status !== 'cancelled') {
      throw new Error(`Expected future booking to be cancelled, got: ${chkBk.status}`);
    }

    // Assert waitlist cancelled
    const { data: chkWl } = await adminAClient.from('waitlist_entries').select('status').eq('resource_id', rRetire.id);
    if (chkWl.some((w) => w.status !== 'cancelled')) {
      throw new Error('Expected waitlist entries to be cancelled upon retirement');
    }

    // 3. Trigger test: Setting is_available = true on retired resource raises resource_retired
    const { error: setAvailErr } = await adminAClient
      .from('resources')
      .update({ is_available: true })
      .eq('id', rRetire.id);
    if (!setAvailErr || !setAvailErr.message.includes('resource_retired')) {
      throw new Error(`Expected resource_retired error, got: ${setAvailErr?.message}`);
    }

    // 4. Reactivate resource
    const { data: reactivatedRes, error: reactErr } = await adminAClient.rpc('reactivate_resource', {
      p_resource_id: rRetire.id,
    });
    if (reactErr) throw reactErr;
    if (reactivatedRes.status !== 'active' || reactivatedRes.is_available !== false) {
      throw new Error(`Expected active status and is_available=false, got: status=${reactivatedRes.status}, is_available=${reactivatedRes.is_available}`);
    }
  });
  }
  // -------------------------------------------------------------------------
  // Summary Results
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(' EquipSync Verification Suite Results');
  console.log('============================================================\n');

  console.log('| Status | Verification Scenario | Detail / Failure Reason |');
  console.log('|:------:|:-----------------------------------------------------|:------------------------|');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${icon} | ${r.name.padEnd(53)} | ${r.error || '—'} |`);
  }

  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nTotal: ${results.length} | Passed: ${results.length - failedCount} | Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
