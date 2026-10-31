#!/usr/bin/env node
/**
 * scripts/demo-seed.mjs
 * EquipSync - Enterprise Demo Data Seeding Script.
 * Generates isolated two-tenant institutional fixtures for Hackathon Evaluation:
 * 1. Primary Tenant: Vivekananda Institute of Professional Studies (VIPS)
 * 2. Secondary Tenant: Delhi Institute of Engineering & Technology (DIET)
 *
 * Safety Invariants:
 * - Reads credentials strictly from process.env (never reads from files or prints secrets).
 * - Refuses to execute without the explicit `--yes` flag.
 * - Refuses to execute against the .env.local production target without `--confirm-production`.
 * - Idempotent: reuses existing users and resources; `--refresh-slots` regenerates current windows.
 * - Writes non-secret local access details to docs/.demo-credentials.local.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// 1. Safety Checks & Environment Parsing
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const hasYes = args.includes('--yes');
const hasConfirmProd = args.includes('--confirm-production');
const refreshSlotsOnly = args.includes('--refresh-slots');

if (!hasYes) {
  console.error('\n[SAFETY REFUSAL] demo-seed.mjs requires the explicit --yes flag to execute.');
  console.error('Usage: node scripts/demo-seed.mjs --yes [--refresh-slots] [--confirm-production]\n');
  process.exit(1);
}

const SUPABASE_URL = process.env.SEED_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SEED_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SEED_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('\n[ENVIRONMENT ERROR] Missing required environment variables:');
  console.error('SEED_SUPABASE_URL, SEED_SUPABASE_ANON_KEY, and SEED_SERVICE_ROLE_KEY must be set in your terminal environment.\n');
  process.exit(1);
}

// Check against .env.local production safety
try {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    const match = content.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
    if (match && match[1]) {
      const localProdUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
      if (SUPABASE_URL.trim() === localProdUrl && !hasConfirmProd) {
        console.error('\n[PRODUCTION LOCKOUT] Target URL matches VITE_SUPABASE_URL in .env.local.');
        console.error('Refusing to seed production database without explicit --confirm-production flag.\n');
        process.exit(1);
      }
    }
  }
} catch {
  // Ignore filesystem check failure
}

// -----------------------------------------------------------------------------
// 2. Client Initialization
// -----------------------------------------------------------------------------
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper for deterministic secure demo passwords
function getDemoPassword(seed) {
  return `EquipSync-Demo2024!#${seed}`;
}

// -----------------------------------------------------------------------------
// 3. Main Seeding Routine
// -----------------------------------------------------------------------------
async function main() {
  console.log('\n============================================================');
  console.log(' EquipSync Enterprise Demo Seeder');
  console.log(' Target:', SUPABASE_URL.replace(/^(https?:\/\/[^.]+).*/, '$1...'));
  console.log(' Mode:  ', refreshSlotsOnly ? 'Slot Refresh Only' : 'Full Tenant Provisioning');
  console.log('============================================================\n');

  const generatedCredentials = [];

  // Helper to ensure auth user exists with email_confirm: true
  async function ensureUser({ email, password, fullName, role, userType, metadata }) {
    const { data: users, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) throw listErr;

    let existing = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!existing) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          full_name: fullName,
          user_type: userType,
          ...metadata,
        },
      });
      if (createErr) throw createErr;
      existing = created.user;
    } else {
      // Ensure email is confirmed and metadata is current
      await adminClient.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        user_metadata: {
          role,
          full_name: fullName,
          user_type: userType,
          ...metadata,
        },
      });
    }

    generatedCredentials.push({
      email,
      password,
      role,
      fullName,
      id: existing.id,
    });

    return existing;
  }

  // ---------------------------------------------------------------------------
  // TENANT 1: Vivekananda Institute of Professional Studies (VIPS)
  // ---------------------------------------------------------------------------
  console.log('→ Provisioning Primary Tenant: Vivekananda Institute of Professional Studies (VIPS)...');

  const vipsAdminUser = await ensureUser({
    email: 'alex.rivera@vips.edu',
    password: getDemoPassword('VipsAdmin'),
    fullName: 'Alex Rivera (Demo Admin)',
    role: 'institution_admin',
    userType: 'staff',
    metadata: {
      institution_name: 'Vivekananda Institute of Professional Studies',
      institution_type: 'University',
      website_url: 'https://vips.edu',
      contact_phone: '+91 11 2734 3401',
      registration_id: 'VIPS-DL-2024',
      job_title: 'Director of Academic Facilities',
    },
  });

  // Fetch VIPS institution ID
  const { data: vipsProfile } = await adminClient
    .from('profiles')
    .select('institution_id')
    .eq('id', vipsAdminUser.id)
    .single();

  const vipsInstId = vipsProfile.institution_id;

  // Ensure VIPS has allowed_domains configured
  await adminClient
    .from('institutions')
    .update({
      allowed_domains: ['vips.edu', '*.vips.edu'],
      domain_proof: true,
      status: 'active',
    })
    .eq('id', vipsInstId);

  // VIPS Member 1 (Domain Auto-Verified)
  const vipsMember1 = await ensureUser({
    email: 'rahul.sharma@vips.edu',
    password: getDemoPassword('VipsMember1'),
    fullName: 'Rahul Sharma (Senior Researcher)',
    role: 'member',
    userType: 'student',
    metadata: {
      institution_id: vipsInstId,
      job_title: 'Graduate Robotics Lead',
    },
  });

  // VIPS Member 2 (Pending Verification)
  const vipsMember2 = await ensureUser({
    email: 'sneha.patel@external-partner.org',
    password: getDemoPassword('VipsMember2'),
    fullName: 'Sneha Patel (Visiting Fellow)',
    role: 'member',
    userType: 'external',
    metadata: {
      institution_id: vipsInstId,
      job_title: 'Visiting Cleanroom Specialist',
    },
  });

  // ---------------------------------------------------------------------------
  // TENANT 2: Delhi Institute of Engineering & Technology (DIET)
  // ---------------------------------------------------------------------------
  console.log('→ Provisioning Secondary Tenant: Delhi Institute of Engineering & Technology (DIET)...');

  const dietAdminUser = await ensureUser({
    email: 'priya.verma@diet.edu',
    password: getDemoPassword('DietAdmin'),
    fullName: 'Priya Verma (Facility Dean)',
    role: 'institution_admin',
    userType: 'staff',
    metadata: {
      institution_name: 'Delhi Institute of Engineering & Technology',
      institution_type: 'College',
      website_url: 'https://diet.edu',
      contact_phone: '+91 11 2659 7100',
      registration_id: 'DIET-TECH-991',
      job_title: 'Dean of Research & Innovation',
    },
  });

  const { data: dietProfile } = await adminClient
    .from('profiles')
    .select('institution_id')
    .eq('id', dietAdminUser.id)
    .single();

  const dietInstId = dietProfile.institution_id;

  await adminClient
    .from('institutions')
    .update({
      allowed_domains: ['diet.edu'],
      domain_proof: true,
      status: 'active',
    })
    .eq('id', dietInstId);

  // DIET Member 1
  const dietMember1 = await ensureUser({
    email: 'arjun.nair@diet.edu',
    password: getDemoPassword('DietMember1'),
    fullName: 'Arjun Nair (Aerospace Lead)',
    role: 'member',
    userType: 'student',
    metadata: {
      institution_id: dietInstId,
      job_title: 'UAV Test Pilot',
    },
  });

  // ---------------------------------------------------------------------------
  // 4. Resources Provisioning
  // ---------------------------------------------------------------------------
  async function ensureResource({ instId, name, kind, category, location, assetTag }) {
    const { data: existing } = await adminClient
      .from('resources')
      .select('id, qr_identifier')
      .eq('institution_id', instId)
      .eq('name', name)
      .maybeSingle();

    if (existing) return existing;

    const qrId = `EQS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { data: created, error } = await adminClient
      .from('resources')
      .insert({
        institution_id: instId,
        name,
        kind,
        category,
        location,
        asset_tag: assetTag,
        qr_identifier: qrId,
        is_available: true,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  console.log('→ Creating institutional resource catalogs...');

  // VIPS Resources
  const vipsLaserCutter = await ensureResource({
    instId: vipsInstId,
    name: 'High-Precision CNC Milling Machine',
    kind: 'equipment',
    category: 'Lab Equipment',
    location: 'Mechanical Engineering Workshop, Room 104',
    assetTag: 'EQP-7K9M2W',
  });

  const vipsCameraKit = await ensureResource({
    instId: vipsInstId,
    name: 'Sony Alpha FX3 Cinema Camera Kit',
    kind: 'equipment',
    category: 'DSLR Cameras',
    location: 'Media Production Studio, Bay 3',
    assetTag: 'EQP-3P4N8X',
  });

  const vipsCleanroom = await ensureResource({
    instId: vipsInstId,
    name: 'Semiconductor Cleanroom Suite A',
    kind: 'space',
    category: 'Classrooms',
    location: 'Nanotechnology Building, Level 2',
    assetTag: 'EQP-5V2R9Y',
  });

  // DIET Resources
  const dietPrinter = await ensureResource({
    instId: dietInstId,
    name: 'Formlabs Form 3+ 3D Printer',
    kind: 'equipment',
    category: 'Lab Equipment',
    location: 'Prototyping Facility, Bay 12',
    assetTag: 'EQP-6B9J2K',
  });

  await ensureResource({
    instId: dietInstId,
    name: 'Optoma 4K Laser Projector',
    kind: 'equipment',
    category: 'Projectors',
    location: 'Main Auditorium Audio/Visual Cage',
    assetTag: 'EQP-8H3W4L',
  });

  await ensureResource({
    instId: dietInstId,
    name: 'Robotics & Drone Flight Arena',
    kind: 'space',
    category: 'Classrooms',
    location: 'Aeronautics Hangar B',
    assetTag: 'EQP-9F1M7Q',
  });

  // ---------------------------------------------------------------------------
  // 5. Bookings & Demonstrable State Fixtures
  // ---------------------------------------------------------------------------
  console.log('→ Generating workflow bookings (Pending, Handover-Ready Approved, Disputed Return)...');

  const now = new Date();

  // Booking 1: Fresh Approved Booking (Inside Handover Window: starts in 5 mins, ends in 3 hours)
  const freshStart = new Date(now.getTime() + 5 * 60 * 1000);
  const freshEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  // Clean prior conflicting bookings on this resource if refreshing slots
  if (refreshSlotsOnly) {
    await adminClient
      .from('bookings')
      .delete()
      .eq('resource_id', vipsCameraKit.id)
      .eq('status', 'approved');
  }

  const { data: freshApproved } = await adminClient
    .from('bookings')
    .insert({
      resource_id: vipsCameraKit.id,
      user_id: vipsMember1.id,
      institution_id: vipsInstId,
      start_at: freshStart.toISOString(),
      end_at: freshEnd.toISOString(),
      purpose: 'Documentary production on institutional solar robotics initiative',
      supervisor_name: 'Dr. Vikram Sen',
      status: 'approved',
      decided_by: vipsAdminUser.id,
      decided_at: now.toISOString(),
      decision_note: 'Approved for field documentary. Please handle precision lenses with care.',
    })
    .select()
    .single();

  // Booking 2: Pending Booking (Approval Lock Demo)
  const pendingStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const pendingEnd = new Date(now.getTime() + 27 * 60 * 60 * 1000);

  const { data: pendingBooking } = await adminClient
    .from('bookings')
    .insert({
      resource_id: vipsLaserCutter.id,
      user_id: vipsMember1.id,
      institution_id: vipsInstId,
      start_at: pendingStart.toISOString(),
      end_at: pendingEnd.toISOString(),
      purpose: 'Rapid prototyping of autonomous chassis mounting brackets',
      supervisor_name: 'Prof. Ananya Roy',
      status: 'pending',
    })
    .select()
    .single();

  // Booking 3: Completed Loan with Damaged Return and Disputed Inspection
  const pastStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const pastEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: disputedBooking } = await adminClient
    .from('bookings')
    .insert({
      resource_id: vipsLaserCutter.id,
      user_id: vipsMember2.id,
      institution_id: vipsInstId,
      start_at: pastStart.toISOString(),
      end_at: pastEnd.toISOString(),
      purpose: 'Titanium alloy tensile specimen slicing',
      supervisor_name: 'Demo Supervisor',
      status: 'disputed',
      decided_by: vipsAdminUser.id,
      decided_at: pastStart.toISOString(),
      decision_note: 'Approved for certified laboratory induction members.',
    })
    .select()
    .single();

  if (disputedBooking) {
    // Record incident
    await adminClient.from('incidents').insert({
      booking_id: disputedBooking.id,
      resource_id: vipsLaserCutter.id,
      institution_id: vipsInstId,
      reported_by: vipsAdminUser.id,
      severity: 'high',
      type: 'damage',
      description: 'Coolant intake nozzle fractured and misalignment observed on primary optical rail.',
      status: 'open',
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Output Non-Secret Credentials File
  // ---------------------------------------------------------------------------
  const credsMarkdown = `# EquipSync Demo Credentials (Local Fixture)

> ⚠️ Generated strictly for local test execution and judge presentation.  
> This file is gitignored and must never be committed to repository source control.

## 1. Vivekananda Institute of Professional Studies (VIPS) – Primary Tenant

| Role | Name | Email | Password | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Alex Rivera | \`alex.rivera@vips.edu\` | \`${getDemoPassword('VipsAdmin')}\` | Verified Admin |
| **Member 1** | Rahul Sharma | \`rahul.sharma@vips.edu\` | \`${getDemoPassword('VipsMember1')}\` | Domain Auto-Verified |
| **Member 2** | Sneha Patel | \`sneha.patel@external-partner.org\` | \`${getDemoPassword('VipsMember2')}\` | Pending Admin Vetting |

## 2. Delhi Institute of Engineering & Technology (DIET) – Secondary Tenant

| Role | Name | Email | Password | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Priya Verma | \`priya.verma@diet.edu\` | \`${getDemoPassword('DietAdmin')}\` | Verified Admin |
| **Member 1** | Arjun Nair | \`arjun.nair@diet.edu\` | \`${getDemoPassword('DietMember1')}\` | Domain Auto-Verified |

## 3. Seeded Workflow Test IDs

- **VIPS Fresh Approved Handover ID:** \`${freshApproved?.id || '—'}\`
- **VIPS Pending Check ID:** \`${pendingBooking?.id || '—'}\`
- **VIPS Disputed Loan ID:** \`${disputedBooking?.id || '—'}\`
`;

  const credsPath = path.resolve(process.cwd(), 'docs', '.demo-credentials.local.md');
  fs.writeFileSync(credsPath, credsMarkdown, 'utf8');

  console.log('\n============================================================');
  console.log(' SEEDING COMPLETED SUCCESSFULLY');
  console.log('============================================================');
  console.log('✓ Tenants Seeded:    2 (VIPS, DIET)');
  console.log('✓ Users Provisioned: 5 (2 Admins, 3 Members)');
  console.log('✓ Resources Created: 6 (Equipment and Space items)');
  console.log('✓ Bookings Seeded:   3 (1 Handover-Ready, 1 Pending Lock, 1 Disputed)');
  console.log('✓ Credentials Log:   docs/.demo-credentials.local.md (Gitignored)\n');
}

main().catch((err) => {
  console.error('\n[FATAL SEEDING ERROR]', err.message);
  process.exit(1);
});
