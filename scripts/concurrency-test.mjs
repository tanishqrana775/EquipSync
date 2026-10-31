/**
 * scripts/concurrency-test.mjs
 * EquipSync – Multi-Client Concurrency & Race-Condition Verification Tool.
 * Validates transactional locks, slot exclusion constraints, and state transitions
 * under parallel loads.
 *
 * Usage:
 *   node scripts/concurrency-test.mjs
 *   SMOKE_ALLOW_PROD=true node scripts/concurrency-test.mjs
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
// 1. Environment & Safety Guards
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
    console.error('Error: Supabase URL and anon key must be provided.');
    process.exit(1);
  }

  if (envLocalUrl && url === envLocalUrl && process.env.SMOKE_ALLOW_PROD !== 'true') {
    console.error(
      '\n[Guard Abort] Target URL matches VITE_SUPABASE_URL from .env.local.\n' +
      'To run the concurrency test against this project, set SMOKE_ALLOW_PROD=true:\n' +
      '  SMOKE_ALLOW_PROD=true node scripts/concurrency-test.mjs\n'
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
      storageKey: `concurrency_test_${Math.random()}`,
    },
  });
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_SHA256 = crypto.createHash('sha256').update(PNG_1X1).digest('hex');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];

async function runStep(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    const msg = err && typeof err === 'object' ? (err.message || JSON.stringify(err)) : String(err);
    results.push({ name, status: 'FAIL', error: msg });
    console.error(`  [FAIL] ${name} -> ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main Concurrency Test Flow
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n============================================================');
  console.log(' EquipSync Concurrency & Parallel Execution Test');
  console.log(' Target:', url);
  console.log('============================================================\n');

  const runId = Date.now().toString().slice(-6);
  const password = `ConcPass_${runId}!Aa1`;
  const adminClient = makeClient();

  let institutionId = null;
  let adminId = null;
  let resourceId = null;
  let resourceQr = null;
  let accessoryId = null;

  const members = []; // Array of { id, email, client }

  // STEP 0: Admin Signup
  await runStep('Admin signup creates institution', async () => {
    const { data, error } = await adminClient.auth.signUp({
      email: `admin_conc_${runId}@example.com`,
      password,
      options: {
        data: {
          role: 'institution_admin',
          full_name: `Admin Conc ${runId}`,
          institution_name: `zz-conc-${runId}`,
          institution_type: 'University',
        },
      },
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error('Supabase project has "Confirm email" enabled. Disable it to test.');
    }
    adminId = data.user.id;
    await adminClient.auth.setSession(data.session);

    const { data: prof, error: pErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', adminId)
      .single();
    if (pErr) throw pErr;
    institutionId = prof.institution_id;
  });

  // STEP 1: Staggered Signup of 10 Members & Verification
  await runStep('Sign up and verify 10 distinct members in institution (staggered)', async () => {
    for (let i = 1; i <= 10; i++) {
      const client = makeClient();
      const email = `mem_conc_${i}_${runId}@example.com`;
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'member',
            full_name: `Member ${i} ${runId}`,
            user_type: 'student',
            institution_id: institutionId,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        await client.auth.setSession(data.session);
      }
      const userId = data.user.id;
      members.push({ id: userId, email, client });

      // Verify member via admin
      const { error: vErr } = await adminAVerify(adminClient, userId);
      if (vErr) throw vErr;

      // Stagger by 350ms to respect auth burst limits
      await sleep(350);
    }
  });

  async function adminAVerify(admin, uId) {
    return await admin.rpc('verify_member', { p_user_id: uId, p_approve: true });
  }

  // STEP 2: Create Auto-Approved Resource (requires_approval = false)
  await runStep('Admin creates auto-approved resource with QR and accessory', async () => {
    const { data: res, error: rErr } = await adminClient
      .from('resources')
      .insert({
        institution_id: institutionId,
        name: `High-Speed 3D Mill ${runId}`,
        kind: 'equipment',
        category: 'Lab Equipment',
        asset_tag: `TAG-CONC-${runId}`,
        location: 'Machine Shop - Station 1',
        required_photo_slots: ['front', 'back'],
        is_available: true,
      })
      .select()
      .single();
    if (rErr) throw rErr;
    resourceId = res.id;
    resourceQr = res.qr_identifier;

    // Add accessory
    const { data: accs, error: accErr } = await adminClient
      .from('resource_accessories')
      .insert({
        resource_id: resourceId,
        name: 'Endmill Bit Set',
        required: true,
      })
      .select()
      .single();
    if (accErr) throw accErr;
    accessoryId = accs.id;

    // Eligibility rules with requires_approval = false
    const { error: ruleErr } = await adminClient.from('eligibility_rules').insert({
      resource_id: resourceId,
      requires_approval: false,
      requires_supervision: false,
      max_duration_minutes: 1440,
      min_lead_time_minutes: 0,
    });
    if (ruleErr) throw ruleErr;
  });

  const slotStart = new Date(Date.now() + 86400 * 1000).toISOString();
  const slotEnd = new Date(Date.now() + 90000 * 1000).toISOString();
  let winningBookingId = null;
  let winningMember = null;

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST (a): 10 Parallel Bookings for Same Slot
  // Exactly 1 must succeed, exactly 9 must fail with slot_taken
  // -------------------------------------------------------------------------
  await runStep('(a) 10 members request same slot concurrently: exactly 1 succeeds, 9 get slot_taken', async () => {
    const promises = members.map(async (m) => {
      try {
        const { data, error } = await m.client.rpc('request_booking', {
          p_resource_id: resourceId,
          p_start: slotStart,
          p_end: slotEnd,
          p_purpose: `Parallel booking attempt by ${m.email}`,
        });
        return { member: m, data, error };
      } catch (err) {
        return { member: m, data: null, error: err };
      }
    });

    const outcomes = await Promise.all(promises);

    let successes = 0;
    let slotTakenCount = 0;
    const unexpectedErrors = [];

    for (const out of outcomes) {
      if (out.data && out.data.status === 'approved') {
        successes++;
        winningBookingId = out.data.id;
        winningMember = out.member;
      } else if (out.error) {
        const msg = String(out.error.message || out.error);
        if (msg.includes('slot_taken')) {
          slotTakenCount++;
        } else {
          unexpectedErrors.push(`${out.member.email}: ${msg}`);
        }
      }
    }

    if (unexpectedErrors.length > 0) {
      throw new Error(`Unexpected errors during parallel booking: ${unexpectedErrors.join('; ')}`);
    }

    if (successes !== 1 || slotTakenCount !== 9) {
      throw new Error(`Concurrency violation! Successes: ${successes} (expected 1), slot_taken: ${slotTakenCount} (expected 9)`);
    }
  });

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST (b): 10 Parallel Waitlist Joins
  // All 10 members join waitlist concurrently with no unexpected errors
  // -------------------------------------------------------------------------
  await runStep('(b) 10 members join waitlist at once: all succeed with no unexpected errors', async () => {
    const promises = members.map(async (m) => {
      try {
        const { data, error } = await m.client.rpc('join_waitlist', {
          p_resource_id: resourceId,
          p_start: slotStart,
          p_end: slotEnd,
        });
        return { member: m, data, error };
      } catch (err) {
        return { member: m, data: null, error: err };
      }
    });

    const outcomes = await Promise.all(promises);
    const failures = outcomes.filter((o) => o.error);

    if (failures.length > 0) {
      const errMsgs = failures.map((f) => `${f.member.email}: ${f.error.message || f.error}`);
      throw new Error(`Waitlist parallel join failed: ${errMsgs.join('; ')}`);
    }

    const { data: totalEntries, error: qErr } = await adminClient
      .from('waitlist_entries')
      .select('*')
      .eq('resource_id', resourceId);
    if (qErr) throw qErr;

    if (totalEntries.length !== 10) {
      throw new Error(`Expected 10 waitlist entries, found ${totalEntries.length}`);
    }
  });

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST (c): Release Booking & Parallel Slot Claims
  // Winning member releases booking; all 10 members try to claim at once.
  // Exactly 1 succeeds, remaining fail.
  // -------------------------------------------------------------------------
  let newBookingClaimedId = null;

  await runStep('(c) Release booking and 10 members claim released slot at once: exactly 1 succeeds', async () => {
    // 1. Releaser releases
    const { data: rel, error: relErr } = await winningMember.client.rpc('release_booking', {
      p_booking_id: winningBookingId,
    });
    if (relErr) throw relErr;
    if (rel.status !== 'released') throw new Error(`Expected released status, got ${rel.status}`);

    await sleep(600);

    // 2. Query open released slot
    const { data: slots, error: sErr } = await adminClient
      .from('released_slots')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('status', 'open');
    if (sErr) throw sErr;
    if (slots.length === 0) throw new Error('No open released slot available to claim');

    const slotId = slots[0].id;

    // 3. 10 members race to claim the slot
    const promises = members.map(async (m) => {
      try {
        const { data, error } = await m.client.rpc('claim_released_slot', {
          p_slot_id: slotId,
        });
        return { member: m, data, error };
      } catch (err) {
        return { member: m, data: null, error: err };
      }
    });

    const outcomes = await Promise.all(promises);

    let claimSuccesses = 0;
    let expectedFails = 0;
    const errors = [];

    for (const out of outcomes) {
      if (out.data && (out.data.status === 'approved' || out.data.status === 'pending')) {
        claimSuccesses++;
        newBookingClaimedId = out.data.id;
      } else if (out.error) {
        const msg = String(out.error.message || out.error);
        if (msg.includes('invalid_state') || msg.includes('slot_taken')) {
          expectedFails++;
        } else {
          errors.push(`${out.member.email}: ${msg}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Unexpected errors during parallel claim: ${errors.join('; ')}`);
    }

    if (claimSuccesses !== 1) {
      throw new Error(`Race condition! Exactly 1 claim must succeed, got ${claimSuccesses}`);
    }
  });

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST (d): 5 Parallel Check-Ins on Same Booking
  // Exactly 1 succeeds, remaining 4 fail with invalid_state
  // -------------------------------------------------------------------------
  await runStep('(d) 5 parallel check-ins on same booking: exactly 1 succeeds, rest invalid_state', async () => {
    // 1. Prepare booking for check-in: must be checked_out
    // We create a fresh booking in the current window for clean check-in testing
    const nowMs = Date.now();
    const immStart = new Date(nowMs + 5 * 60 * 1000).toISOString();
    const immEnd = new Date(nowMs + 65 * 60 * 1000).toISOString();

    const { data: checkinBk, error: reqErr } = await members[0].client.rpc('request_booking', {
      p_resource_id: resourceId,
      p_start: immStart,
      p_end: immEnd,
      p_purpose: 'Check-in concurrency benchmark',
    });
    if (reqErr) throw reqErr;

    const bId = checkinBk.id;

    // Upload checkout photos and perform check-out
    const pathFront = `${institutionId}/${bId}/checkout/front.jpg`;
    const pathBack = `${institutionId}/${bId}/checkout/back.jpg`;
    await members[0].client.storage.from('custody-photos').upload(pathFront, PNG_1X1, { contentType: 'image/jpeg' });
    await members[0].client.storage.from('custody-photos').upload(pathBack, PNG_1X1, { contentType: 'image/jpeg' });

    const { error: coErr } = await members[0].client.rpc('check_out_booking', {
      p_booking_id: bId,
      p_photos: [
        { slot: 'front', storage_path: pathFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'excellent',
      p_notes: 'Initial checkout',
      p_accessory_checks: [{ accessory_id: accessoryId, name: 'Endmill Bit Set', state: 'present' }],
      p_qr_identifier: resourceQr,
    });
    if (coErr) throw coErr;

    // Upload return photos
    const pathInFront = `${institutionId}/${bId}/checkin/front.jpg`;
    const pathInBack = `${institutionId}/${bId}/checkin/back.jpg`;
    await members[0].client.storage.from('custody-photos').upload(pathInFront, PNG_1X1, { contentType: 'image/jpeg' });
    await members[0].client.storage.from('custody-photos').upload(pathInBack, PNG_1X1, { contentType: 'image/jpeg' });

    // 2. Run 5 concurrent check-in calls on booking bId
    const checkinPayload = {
      p_booking_id: bId,
      p_photos: [
        { slot: 'front', storage_path: pathInFront, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
        { slot: 'back', storage_path: pathInBack, sha256: PNG_SHA256, client_captured_at: new Date().toISOString() },
      ],
      p_condition: 'good',
      p_notes: 'Concurrent return race test',
      p_accessory_checks: [{ accessory_id: accessoryId, name: 'Endmill Bit Set', state: 'present' }],
      p_qr_identifier: resourceQr,
    };

    const parallelAttempts = [1, 2, 3, 4, 5].map(async () => {
      try {
        const { data, error } = await members[0].client.rpc('check_in_booking', checkinPayload);
        return { data, error };
      } catch (err) {
        return { data: null, error: err };
      }
    });

    const checkinOutcomes = await Promise.all(parallelAttempts);

    let checkinSuccesses = 0;
    let invalidStateCount = 0;
    const errors = [];

    for (const out of checkinOutcomes) {
      if (out.data && out.data.status === 'returned') {
        checkinSuccesses++;
      } else if (out.error) {
        const msg = String(out.error.message || out.error);
        if (msg.includes('invalid_state')) {
          invalidStateCount++;
        } else {
          errors.push(msg);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Unexpected errors in concurrent check-in: ${errors.join('; ')}`);
    }

    if (checkinSuccesses !== 1 || invalidStateCount !== 4) {
      throw new Error(`Check-in race condition! Successes: ${checkinSuccesses} (expected 1), invalid_state: ${invalidStateCount} (expected 4)`);
    }
  });

  // -------------------------------------------------------------------------
  // Summary Results Table
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(' Concurrency Test Summary Results');
  console.log('============================================================\n');

  console.log('| Status | Concurrency Scenario | Detail / Failure Reason |');
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
  console.error('Fatal concurrency test failure:', err);
  process.exit(1);
});
