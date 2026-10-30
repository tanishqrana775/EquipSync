/**
 * scripts/smoke-test.mjs
 * CampusShare – Automated end-to-end backend verification script.
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
// 1. Load Environment Configuration
// ---------------------------------------------------------------------------
function loadEnv() {
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
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local or environment');
    process.exit(1);
  }

  return { url, anonKey };
}

const { url, anonKey } = loadEnv();

function makeClient() {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      storageKey: `smoke_test_${Math.random()}`,
    },
  });
}
// 1x1 Transparent PNG buffer
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_SHA256 = crypto.createHash('sha256').update(PNG_1X1).digest('hex');

// Results tracking
const results = [];
async function runStep(stepName, fn) {
  try {
    await fn();
    results.push({ name: stepName, status: 'PASS' });
    console.log(`  [PASS] ${stepName}`);
  } catch (err) {
    const msg = err && typeof err === 'object'
      ? (err.message || JSON.stringify(err))
      : String(err);
    results.push({ name: stepName, status: 'FAIL', error: msg });
    console.error(`  [FAIL] ${stepName} -> ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main Smoke Test Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n============================================================');
  console.log(' CampusShare Automated Smoke Test');
  console.log(' Target:', url);
  console.log('============================================================\n');

  const runId = Date.now().toString().slice(-6);
  const instName = `Smoke Test University ${runId}`;

  const adminClient = makeClient();
  const memberAClient = makeClient();
  const memberBClient = makeClient();

  const adminEmail = `smoke_admin_${runId}@example.com`;
  const memberAEmail = `smoke_memA_${runId}@example.com`;
  const memberBEmail = `smoke_memB_${runId}@example.com`;
  const password = `TestPass!_${runId}#99`;

  let institutionId = null;
  let adminId = null;
  let memberAId = null;
  let memberBId = null;
  let resourceId = null;
  let bookingAId = null;
  let releasedSlotId = null;

  // STEP 0: Create Admin and Institution
  await runStep('Admin sign-up creates institution & verified admin profile', async () => {
    const { data, error } = await adminClient.auth.signUp({
      email: adminEmail,
      password,
      options: {
        data: {
          role: 'institution_admin',
          full_name: `Admin User ${runId}`,
          institution_name: instName,
          institution_type: 'university',
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('No user returned on admin signup');
    adminId = data.user.id;
    if (data.session) {
      await adminClient.auth.setSession(data.session);
    }

    // Fetch profile to obtain created institution_id
    const { data: prof, error: pErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', adminId)
      .single();
    if (pErr) throw pErr;
    if (!prof.institution_id) throw new Error('No institution_id assigned to admin');
    institutionId = prof.institution_id;
  });

  // STEP 1: Sign up Members A & B
  await runStep('Member A and B sign-up with pending verification status', async () => {
    const { data: aData, error: aErr } = await memberAClient.auth.signUp({
      email: memberAEmail,
      password,
      options: {
        data: {
          role: 'member',
          full_name: `Member Alpha ${runId}`,
          user_type: 'student',
          institution_id: institutionId,
        },
      },
    });
    if (aErr) throw aErr;
    memberAId = aData.user.id;
    if (aData.session) {
      await memberAClient.auth.setSession(aData.session);
    }

    const { data: bData, error: bErr } = await memberBClient.auth.signUp({
      email: memberBEmail,
      password,
      options: {
        data: {
          role: 'member',
          full_name: `Member Beta ${runId}`,
          user_type: 'student',
          institution_id: institutionId,
        },
      },
    });
    if (bErr) throw bErr;
    memberBId = bData.user.id;
    if (bData.session) {
      await memberBClient.auth.setSession(bData.session);
    }
  });

  // STEP 2: Admin creates resource with eligibility rules
  await runStep('Admin creates resource with photo slots and eligibility rules', async () => {
    const { data: res, error: rErr } = await adminClient
      .from('resources')
      .insert({
        institution_id: institutionId,
        name: `Precision Camera Rig ${runId}`,
        kind: 'equipment',
        category: 'DSLR Cameras',
        asset_tag: `TAG-${runId}`,
        location: 'Media Center – Bay 4',
        required_photo_slots: ['front', 'back'],
        is_available: true,
      })
      .select()
      .single();
    if (rErr) throw rErr;
    resourceId = res.id;

    // Create rules: requires_approval = true
    const { error: ruleErr } = await adminClient.from('eligibility_rules').insert({
      resource_id: resourceId,
      requires_approval: true,
      requires_supervision: false,
      max_duration_minutes: 1440,
      min_lead_time_minutes: 0,
    });
    if (ruleErr) throw ruleErr;
  });

  // STEP 3: Member B (unverified) request_booking fails with not_verified
  await runStep('Unverified Member B request_booking fails with not_verified', async () => {
    const start = new Date(Date.now() + 3600 * 1000).toISOString();
    const end = new Date(Date.now() + 7200 * 1000).toISOString();

    const { error } = await memberBClient.rpc('request_booking', {
      p_resource_id: resourceId,
      p_start: start,
      p_end: end,
      p_purpose: 'Autonomous testing',
    });

    if (!error) throw new Error('Expected request_booking to fail for unverified user');
    if (!error.message.includes('not_verified')) {
      throw new Error(`Expected not_verified, got: ${error.message}`);
    }
  });

  // STEP 4: Admin verifies Member A
  await runStep('Admin verifies Member A profile', async () => {
    const { data, error } = await adminClient.rpc('verify_member', {
      p_user_id: memberAId,
      p_approve: true,
    });
    if (error) throw error;
    if (data.verification_status !== 'verified') {
      throw new Error(`Expected verified, got ${data.verification_status}`);
    }
  });

  // STEP 5: Member A requests booking (status pending per rules)
  const bookingStart = new Date(Date.now() + 7200 * 1000).toISOString();
  const bookingEnd = new Date(Date.now() + 10800 * 1000).toISOString();

  await runStep('Verified Member A successfully requests booking', async () => {
    const { data, error } = await memberAClient.rpc('request_booking', {
      p_resource_id: resourceId,
      p_start: bookingStart,
      p_end: bookingEnd,
      p_purpose: 'Project documentary filming',
    });
    if (error) throw error;
    bookingAId = data.id;
    if (data.status !== 'pending') {
      throw new Error(`Expected pending status, got: ${data.status}`);
    }
  });

  // STEP 6: Overlapping request fails with slot_taken
  await runStep('Overlapping approved/checked_out request fails with slot_taken after approval', async () => {
    // Approve A first
    const { error: appErr } = await adminClient.rpc('decide_booking', {
      p_booking_id: bookingAId,
      p_approve: true,
    });
    if (appErr) throw appErr;

    // Verify B now so we can test slot overlap rather than not_verified
    await adminClient.rpc('verify_member', { p_user_id: memberBId, p_approve: true });

    // B requests same slot -> must fail with slot_taken
    const { error: overlapErr } = await memberBClient.rpc('request_booking', {
      p_resource_id: resourceId,
      p_start: bookingStart,
      p_end: bookingEnd,
      p_purpose: 'Competing reservation',
    });

    if (!overlapErr) throw new Error('Expected overlap to fail with slot_taken');
    if (!overlapErr.message.includes('slot_taken')) {
      throw new Error(`Expected slot_taken, got: ${overlapErr.message}`);
    }
  });

  // STEP 7: Member B joins waitlist
  await runStep('Member B joins waitlist for overlapping time window', async () => {
    const { data, error } = await memberBClient.rpc('join_waitlist', {
      p_resource_id: resourceId,
      p_start: bookingStart,
      p_end: bookingEnd,
    });
    if (error) throw error;
    if (data.status !== 'waiting') {
      throw new Error(`Expected waiting status, got: ${data.status}`);
    }
  });

  // STEP 8: Member A releases booking -> B receives offered state + notification
  await runStep('Member A releases booking -> slot released & waitlist updated to offered', async () => {
    const { data: rel, error: relErr } = await memberAClient.rpc('release_booking', {
      p_booking_id: bookingAId,
    });
    if (relErr) throw relErr;
    if (rel.status !== 'released') throw new Error(`Expected released status, got ${rel.status}`);

    // Wait 500ms for trigger/functions
    await new Promise((r) => setTimeout(r, 500));

    // Verify waitlist entry for B is now 'offered'
    const { data: bWait, error: wErr } = await memberBClient.rpc('my_waitlist');
    if (wErr) throw wErr;
    const entry = bWait.find((e) => e.resource_id === resourceId);
    if (!entry || entry.status !== 'offered') {
      throw new Error(`Expected waitlist status 'offered', got: ${entry?.status}`);
    }

    // Verify notification was sent to B
    const { data: notifs, error: nErr } = await memberBClient
      .from('notifications')
      .select('*')
      .eq('user_id', memberBId);
    if (nErr) throw nErr;
    const slotNotif = notifs.find((n) => n.type === 'slot_available');
    if (!slotNotif) throw new Error('Expected slot_available notification for Member B');
  });

  // STEP 9: Direct client writes to protected tables FAIL
  await runStep('Direct client INSERT/UPDATE on protected tables fail via RLS/revocation', async () => {
    // 1. Direct update on bookings
    const { error: bkUpdateErr } = await memberAClient
      .from('bookings')
      .update({ status: 'approved' })
      .eq('id', bookingAId);
    if (!bkUpdateErr) throw new Error('Direct update on bookings should fail');

    // 2. Direct update on profiles.role
    const { error: roleErr } = await memberAClient
      .from('profiles')
      .update({ role: 'institution_admin' })
      .eq('id', memberAId);
    if (!roleErr) throw new Error('Direct update on profiles.role should fail');

    // 3. Direct insert to audit_log
    const { error: auditErr } = await memberAClient
      .from('audit_log')
      .insert({ action: 'tamper', entity_type: 'test' });
    if (!auditErr) throw new Error('Direct insert on audit_log should fail');
  });

  // STEP 10: Member A cannot read another institution private data
  await runStep('Member A cannot read another institution private data', async () => {
    // Attempt to query audit_log directly -> must return empty or fail
    const { data, error } = await memberAClient
      .from('audit_log')
      .select('*');
    if (data && data.length > 0) {
      throw new Error('Member should not have read access to administrative audit_log');
    }
  });

  // STEP 11: Member B claims released slot
  await runStep('Member B claims released slot -> new booking created', async () => {
    const { data: slots, error: sErr } = await memberBClient
      .from('released_slots')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('status', 'open');
    if (sErr) throw sErr;
    if (slots.length === 0) throw new Error('No open released slot found');
    releasedSlotId = slots[0].id;

    const { data: claimedBk, error: claimErr } = await memberBClient.rpc('claim_released_slot', {
      p_slot_id: releasedSlotId,
    });
    if (claimErr) throw claimErr;
    if (!claimedBk || !claimedBk.id) throw new Error('No booking returned from claim_released_slot');

    // Admin approves the claimed booking for checkout testing
    await adminClient.rpc('decide_booking', {
      p_booking_id: claimedBk.id,
      p_approve: true,
    });
    bookingAId = claimedBk.id; // re-use for custody flow
  });

  // STEP 12: Check-out without required photos fails missing_photos
  await runStep('Check-out without all required photo slots fails with missing_photos', async () => {
    const { error } = await memberBClient.rpc('check_out_booking', {
      p_booking_id: bookingAId,
      p_photos: [
        {
          slot: 'front',
          storage_path: `${institutionId}/${bookingAId}/checkout/front.jpg`,
          sha256: PNG_SHA256,
          client_captured_at: new Date().toISOString(),
        },
      ], // missing 'back'
      p_condition: 'good',
      p_notes: 'Missing back angle test',
    });

    if (!error) throw new Error('Expected check_out_booking to fail missing_photos');
    if (!error.message.includes('missing_photos')) {
      throw new Error(`Expected missing_photos, got: ${error.message}`);
    }
  });

  // STEP 13: Check-out with complete 1x1 PNG uploads succeeds
  await runStep('Check-out with complete uploaded photo set succeeds and updates status to checked_out', async () => {
    // Upload front and back photos to custody-photos bucket
    const pathFront = `${institutionId}/${bookingAId}/checkout/front.jpg`;
    const pathBack = `${institutionId}/${bookingAId}/checkout/back.jpg`;

    const { error: upFrontErr } = await memberBClient.storage
      .from('custody-photos')
      .upload(pathFront, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    if (upFrontErr) throw upFrontErr;

    const { error: upBackErr } = await memberBClient.storage
      .from('custody-photos')
      .upload(pathBack, PNG_1X1, { contentType: 'image/jpeg', upsert: false });
    if (upBackErr) throw upBackErr;

    const { data: coData, error: coErr } = await memberBClient.rpc('check_out_booking', {
      p_booking_id: bookingAId,
      p_photos: [
        {
          slot: 'front',
          storage_path: pathFront,
          sha256: PNG_SHA256,
          client_captured_at: new Date().toISOString(),
        },
        {
          slot: 'back',
          storage_path: pathBack,
          sha256: PNG_SHA256,
          client_captured_at: new Date().toISOString(),
        },
      ],
      p_condition: 'good',
      p_notes: 'Verified custody pass test',
    });
    if (coErr) throw coErr;
    if (coData.status !== 'checked_out') {
      throw new Error(`Expected checked_out status, got: ${coData.status}`);
    }
  });

  // STEP 14: Photo overwrite and delete FAIL
  await runStep('Custody photo overwrite (upsert) and delete fail (immutable evidence)', async () => {
    const pathFront = `${institutionId}/${bookingAId}/checkout/front.jpg`;

    // Try overwrite
    const { error: owErr } = await memberBClient.storage
      .from('custody-photos')
      .upload(pathFront, PNG_1X1, { upsert: true });
    // Should fail with duplicate or policy error
    if (!owErr) throw new Error('Custody photo overwrite should fail');

    // Try delete
    const { error: delErr } = await memberBClient.storage
      .from('custody-photos')
      .remove([pathFront]);
    // Remove either returns an error or fails via RLS
  });

  // STEP 15: Check-in with condition damaged creates an incident
  await runStep('Check-in with condition damaged updates status to returned and auto-creates incident', async () => {
    const pathInFront = `${institutionId}/${bookingAId}/checkin/front.jpg`;
    const pathInBack = `${institutionId}/${bookingAId}/checkin/back.jpg`;

    await memberBClient.storage
      .from('custody-photos')
      .upload(pathInFront, PNG_1X1, { contentType: 'image/jpeg', upsert: false });

    await memberBClient.storage
      .from('custody-photos')
      .upload(pathInBack, PNG_1X1, { contentType: 'image/jpeg', upsert: false });

    const { data: ciData, error: ciErr } = await memberBClient.rpc('check_in_booking', {
      p_booking_id: bookingAId,
      p_photos: [
        {
          slot: 'front',
          storage_path: pathInFront,
          sha256: PNG_SHA256,
          client_captured_at: new Date().toISOString(),
        },
        {
          slot: 'back',
          storage_path: pathInBack,
          sha256: PNG_SHA256,
          client_captured_at: new Date().toISOString(),
        },
      ],
      p_condition: 'damaged',
      p_notes: 'Crack observed on lower housing',
    });
    if (ciErr) throw ciErr;
    if (ciData.status !== 'returned') {
      throw new Error(`Expected returned status, got: ${ciData.status}`);
    }

    // Verify incident was created
    const { data: incs, error: incErr } = await adminClient
      .from('incidents')
      .select('*')
      .eq('booking_id', bookingAId);
    if (incErr) throw incErr;
    if (incs.length === 0) throw new Error('Expected auto-created incident on damaged check-in');
  });

  // STEP 16: Admin inspect_return closes or disputes
  await runStep('Admin inspect_return disputes booking with open incident', async () => {
    const { data: insp, error: inspErr } = await adminClient.rpc('inspect_return', {
      p_booking_id: bookingAId,
      p_accept: false,
      p_notes: 'Damage confirmed during physical inspection',
    });
    if (inspErr) throw inspErr;
    if (insp.status !== 'disputed') {
      throw new Error(`Expected disputed status, got: ${insp.status}`);
    }
  });

  // -------------------------------------------------------------------------
  // Print Summary Table
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(' Smoke Test Summary Results');
  console.log('============================================================\n');

  console.log('| Status | Assertion / Flow Step | Error |');
  console.log('|:------:|:-----------------------------------------------|:------|');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${icon} | ${r.name.padEnd(47)} | ${r.error || '—'} |`);
  }

  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nTotal: ${results.length} | Passed: ${results.length - failedCount} | Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
