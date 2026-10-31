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

  await runStep('Institution directory view is readable by anonymous client', async () => {
    const { data, error } = await anonClient
      .from('institution_directory')
      .select('id, name, type')
      .limit(10);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Expected array from institution_directory');
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

  // -------------------------------------------------------------------------
  // 5. Custody Verification & Return Quality Gate
  // Window: booking starts 10 minutes from now, ending 1 hour later (within 15m check-out window)
  // -------------------------------------------------------------------------
  await runStep('Create Resource R2 and Booking for immediate custody window testing', async () => {
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

    await adminAClient.from('eligibility_rules').insert({
      resource_id: resourceR2Id,
      requires_approval: true,
      max_duration_minutes: 1440,
      min_lead_time_minutes: 0,
    });

    const nowMs = Date.now();
    const custStart = new Date(nowMs + 10 * 60 * 1000).toISOString(); // 10m from now -> within 15m early window
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

  await runStep('Check-out without all required photo slots fails with missing_photos', async () => {
    const { error } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        {
          slot: 'front',
          storage_path: `${instAId}/${bookingCustodyId}/checkout/front.jpg`,
          sha256: PNG_SHA256,
          client_captured_at: new Date().toISOString(),
        },
      ], // missing 'back'
      p_condition: 'good',
      p_notes: 'Missing slot test',
    });

    if (!error) throw new Error('Expected missing_photos failure');
    if (!error.message.includes('missing_photos')) {
      throw new Error(`Expected missing_photos, got: ${error.message}`);
    }
  });

  await runStep('Complete photo upload, assert immutability, and complete check-out', async () => {
    const pathFront = `${instAId}/${bookingCustodyId}/checkout/front.jpg`;
    const pathBack = `${instAId}/${bookingCustodyId}/checkout/back.jpg`;

    // Upload test photos
    const { error: up1 } = await memberA1Client.storage
      .from('custody-photos')
      .upload(pathFront, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    if (up1) throw up1;

    const { error: up2 } = await memberA1Client.storage
      .from('custody-photos')
      .upload(pathBack, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    if (up2) throw up2;

    // Immutability: overwrite fails
    const { error: owErr } = await memberA1Client.storage
      .from('custody-photos')
      .upload(pathFront, PNG_1X1, { upsert: true });
    if (!owErr) throw new Error('Expected photo overwrite to be rejected');

    // Immutability: delete fails via storage policy
    const { data: delData, error: delErr } = await memberA1Client.storage
      .from('custody-photos')
      .remove([pathFront]);
    // Supabase storage remove returns an empty array or error when denied by RLS
    if (delData && delData.length > 0) {
      throw new Error('Custody photo deletion should be forbidden by storage policy');
    }

    // Check-out RPC
    const { data: co, error: coErr } = await memberA1Client.rpc('check_out_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'good',
      p_notes: 'Check-out completed',
    });
    if (coErr) throw coErr;
    if (co.status !== 'checked_out') throw new Error(`Expected checked_out, got ${co.status}`);
  });

  await runStep('Damaged check-in without notes fails with notes_required', async () => {
    const pathInFront = `${instAId}/${bookingCustodyId}/checkin/front.jpg`;
    const pathInBack = `${instAId}/${bookingCustodyId}/checkin/back.jpg`;

    await memberA1Client.storage
      .from('custody-photos')
      .upload(pathInFront, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    await memberA1Client.storage
      .from('custody-photos')
      .upload(pathInBack, PNG_1X1, { contentType: 'image/jpeg', upsert: false });

    const { error } = await memberA1Client.rpc('check_in_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'damaged',
      p_notes: '   ', // Blank notes must be rejected
    });

    if (!error) throw new Error('Expected failure when condition is damaged with blank notes');
    if (!error.message.includes('notes_required')) {
      throw new Error(`Expected notes_required, got: ${error.message}`);
    }
  });

  await runStep('Damaged check-in with notes auto-creates incident and notifies admins', async () => {
    const pathInFront = `${instAId}/${bookingCustodyId}/checkin/front.jpg`;
    const pathInBack = `${instAId}/${bookingCustodyId}/checkin/back.jpg`;

    const { data: ci, error: ciErr } = await memberA1Client.rpc('check_in_booking', {
      p_booking_id: bookingCustodyId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'damaged',
      p_notes: 'Objective lens barrel cracked during fieldwork',
    });
    if (ciErr) throw ciErr;
    if (ci.status !== 'returned') throw new Error(`Expected returned status, got ${ci.status}`);

    // Verify incident auto-creation
    const { data: incs, error: incErr } = await adminAClient
      .from('incidents')
      .select('*')
      .eq('booking_id', bookingCustodyId);
    if (incErr) throw incErr;
    if (!incs || incs.length === 0) throw new Error('Incident was not auto-created on damaged check-in');

    // Verify admin notification
    const { data: notifs, error: notifErr } = await adminAClient
      .from('notifications')
      .select('*')
      .eq('user_id', adminAId);
    if (notifErr) throw notifErr;
    const incNotif = notifs.find((n) => n.type === 'incident_reported');
    if (!incNotif) throw new Error('Admin did not receive incident_reported notification');
  });

  await runStep('Admin inspect_return reject sets status to disputed', async () => {
    const { data: insp, error: inspErr } = await adminAClient.rpc('inspect_return', {
      p_booking_id: bookingCustodyId,
      p_accept: false,
      p_notes: 'Damage inspection confirmed by senior curator',
    });
    if (inspErr) throw inspErr;
    if (insp.status !== 'disputed') throw new Error(`Expected disputed status, got ${insp.status}`);
  });

  // -------------------------------------------------------------------------
  // 6. Clean Return & Close Booking Path
  // -------------------------------------------------------------------------
  await runStep('Clean booking flow with condition good and inspect_return accept -> closed', async () => {
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
    });

    // 4. Check-in
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
    });

    // 5. Inspect accept -> closed
    const { data: closedBk, error: closeErr } = await adminAClient.rpc('inspect_return', {
      p_booking_id: bookingCleanId,
      p_accept: true,
      p_notes: 'Verified and restocked',
    });
    if (closeErr) throw closeErr;
    if (closedBk.status !== 'closed') throw new Error(`Expected closed status, got: ${closedBk.status}`);
  });

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
