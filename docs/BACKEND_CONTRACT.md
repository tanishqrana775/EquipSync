# CampusShare – Backend Contract

> **Audience:** Frontend developers consuming the Supabase backend.  
> **Stack:** Supabase (Postgres 15) · supabase-js v2 · Vite + React + TypeScript  
> **Last updated:** see git history

---

## 1. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Project URL, e.g. `https://xyzabc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Public anon key (JWT) |

Both are validated at startup in `src/lib/supabase.ts`; the app throws a descriptive error if either is absent. **Never set `SUPABASE_SERVICE_ROLE_KEY` in the frontend.**

Copy `.env.example` to `.env.local` and fill in your project values.

---

## 2. Type Generation

After running migrations, regenerate the TypeScript types:

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

The `Database` type is imported by `supabase.ts`, `auth.ts`, and `rpc.ts`.

---

## 3. Auth Metadata (sign-up payload)

The `handle_new_user` trigger reads `raw_user_meta_data` from the Supabase Auth user record.

### Institution admin sign-up

```ts
// Passed via supabase.auth.signUp({ options: { data: { ... } } })
{
  role:             'institution_admin',  // literal — trigger checks this
  full_name:        string,
  institution_name: string,               // triggers institution creation
  institution_type: string,               // e.g. 'university'
  email_domain:     string | null,        // optional, stored on institutions
  address:          string | null,
}
```

Result: institution row created, profile row created with `role='institution_admin'` and `verification_status='verified'`.

### Member sign-up

```ts
{
  role:           'member',              // or any other value — coerced to 'member'
  full_name:      string,
  user_type:      'student' | 'staff' | 'external',
  institution_id: string,               // UUID; must exist, else exception raised
}
```

Result: profile row created with `role='member'` and `verification_status='pending'`. The member cannot book until an admin calls `verify_member`.

---

## 4. Table-by-Table Read Queries

All reads go through the typed Supabase client. RLS enforces row visibility automatically.

### `institutions` / `institution_directory`
```ts
// Registration form: read from public view (anon-accessible)
supabase.from('institution_directory').select('id, name, type').order('name')

// Profile page: read own institution
supabase.from('institutions').select('*').eq('id', institutionId).single()
```

### `profiles`
```ts
// Own profile (used in useAuth)
supabase.from('profiles').select('*').eq('id', userId).single()

// Admin: list all members of institution
supabase.from('profiles')
  .select('*')
  .eq('institution_id', institutionId)
  .eq('role', 'member')
  .order('full_name')
```

### `resources`
```ts
// Discovery (cross-institution, paginated)
supabase.from('resources')
  .select(`
    *,
    eligibility_rules(*),
    resource_accessories(*),
    resource_availability_windows(*),
    resource_required_qualifications(qualification_id, qualifications(name))
  `)
  .eq('status', 'active')
  .order('name')

// Single resource detail
supabase.from('resources').select('...').eq('id', resourceId).single()

// Admin: own institution resources
supabase.from('resources')
  .select('...join...')
  .eq('institution_id', institutionId)
```

### `bookings`
```ts
// Member: my bookings (all statuses)
supabase.from('bookings')
  .select('*, resources(name, kind, image_path)')
  .eq('user_id', userId)
  .order('start_at', { ascending: false })

// Admin: institution bookings with pending filter
supabase.from('bookings')
  .select('*, profiles(full_name), resources(name)')
  .eq('institution_id', institutionId)
  .eq('status', 'pending')
  .order('created_at')
```

### `waitlist_entries`
```ts
// Use the my_waitlist() RPC instead of direct query (gives correct position)
import { myWaitlist } from 'src/lib/api/rpc'
const entries = await myWaitlist()
```

### `released_slots`
```ts
// Open slots visible to verified members of same institution
supabase.from('released_slots')
  .select('*, resources(name, kind, image_path)')
  .eq('institution_id', institutionId)
  .eq('status', 'open')
  .order('start_at')
```

### `notifications`
```ts
supabase.from('notifications')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50)

// Mark read
supabase.from('notifications')
  .update({ read_at: new Date().toISOString() })
  .eq('id', notificationId)
```

### `custody_events` / `custody_photos`
```ts
// Prefer the get_custody_timeline RPC for the full ordered timeline
import { getCustodyTimeline } from 'src/lib/api/rpc'
const timeline = await getCustodyTimeline(bookingId)
```

### `incidents`
```ts
supabase.from('incidents')
  .select('*')
  .eq('booking_id', bookingId)
  .order('created_at')
```

### `resource_utilisation` view
```ts
supabase.from('resource_utilisation')
  .select('*')
  .eq('institution_id', institutionId)
  .order('utilisation_pct')
```

### `audit_log` (admin only)
```ts
supabase.from('audit_log')
  .select('*')
  .eq('institution_id', institutionId)
  .order('created_at', { ascending: false })
  .limit(200)
```

---

## 5. RPC Signatures & Example Calls

All RPCs are wrapped in `src/lib/api/rpc.ts`. Call the typed wrapper, not `supabase.rpc()` directly.

### `requestBooking`
```ts
const booking = await requestBooking({
  resourceId:     '...uuid...',
  start:          '2026-11-01T09:00:00+00:00',
  end:            '2026-11-01T12:00:00+00:00',
  purpose:        'Research photography session',
  supervisorName: undefined,          // required when resource.requires_supervision = true
});
```

### `decideBooking` (admin)
```ts
const booking = await decideBooking({ bookingId, approve: true, note: 'Approved.' });
const booking = await decideBooking({ bookingId, approve: false, note: 'Dates unavailable.' });
```

### `cancelBooking` (owner)
```ts
const booking = await cancelBooking(bookingId);
```

### `releaseBooking` (owner, status must be `approved`)
```ts
const booking = await releaseBooking(bookingId);
// A released_slots row is created; matching waitlist entries are set to 'offered'.
```

### `claimReleasedSlot` (verified member)
```ts
const booking = await claimReleasedSlot(slotId);
```

### `joinWaitlist` / `leaveWaitlist`
```ts
const entry = await joinWaitlist({ resourceId, start, end });
await leaveWaitlist(entryId);
const myEntries = await myWaitlist(); // includes position field
```

### `verifyMember` / `verifyQualification` (admin)
```ts
const profile = await verifyMember({ userId, approve: true });
const uq      = await verifyQualification({ userId, qualificationId, approve: false });
```

### `checkOutBooking` (owner, booking must be `approved`)
```ts
// Use the submitCheckOut orchestrator in src/lib/custody.ts — handles compression + upload
const booking = await submitCheckOut({
  institutionId,
  bookingId,
  photos: [
    { slot: 'front', file: frontFile, client_captured_at: new Date().toISOString() },
    { slot: 'back',  file: backFile,  client_captured_at: new Date().toISOString() },
    // ... all required slots
  ],
  requiredSlots: ['front', 'back', 'left', 'right'],
  condition:     'good',
  notes:         'All accessories present.',
  accessoryChecks: [
    { accessory_id: '...', name: 'Battery', state: 'present', note: undefined },
  ],
});
```

### `checkInBooking` (owner, booking must be `checked_out`)
```ts
const booking = await submitCheckIn({ ...same shape as checkOut... });
// If condition is 'damaged' or 'missing_parts', an incident is auto-created.
```

### `inspectReturn` (admin, booking must be `returned`)
```ts
const booking = await inspectReturn({ bookingId, accept: true,  notes: 'Good condition.' });
const booking = await inspectReturn({ bookingId, accept: false, notes: 'Scratch on lens.' });
// reject → status becomes 'disputed', an incident is created, borrower is notified.
```

### `reportIncident`
```ts
const incident = await reportIncident({
  bookingId,
  severity:    'high',
  type:        'damage',
  description: 'Screen cracked on return.',
});
```

### `resolveIncident` (admin)
```ts
const incident = await resolveIncident(incidentId);
```

### `getCustodyTimeline`
```ts
const timeline = await getCustodyTimeline(bookingId);
// Returns CustodyTimelineItem[] ordered by occurred_at.
// Each item has a `type` discriminant: 'status_change' | 'custody_event' | 'custody_photo' | 'incident'
```

### `institutionStats` (admin)
```ts
const stats = await institutionStats(institutionId);
// { total_resources, in_use_now, unused_30d, pending_approvals }
```

---

## 6. Error Code → UI Message Table

All `CampusShareError` instances have `.code` and optionally `.reason` (the part after the first colon).

| Code | `.reason` | Suggested UI message |
|---|---|---|
| `not_authenticated` | — | "Please sign in to continue." |
| `forbidden` | — | "You don't have permission to do this." |
| `not_verified` | — | "Your account is pending verification by your institution." |
| `invalid_institution` | — | "Institution not found. Check the institution ID or sign up as an admin." |
| `resource_unavailable` | — | "This resource is not currently available for booking." |
| `not_eligible` | `user_type_not_allowed` | "Your account type is not permitted to book this resource." |
| `not_eligible` | `exceeds_max_duration` | "Requested duration exceeds the maximum allowed for this resource." |
| `not_eligible` | `insufficient_lead_time` | "Bookings must be made further in advance for this resource." |
| `not_eligible` | `supervisor_required` | "A supervisor name is required for this resource." |
| `not_eligible` | `missing_qualifications:<names>` | "You need the following qualifications: `reason`." |
| `slot_taken` | — | "This time slot has just been taken. Please choose different dates." |
| `invalid_state` | — | "This action is not allowed in the booking's current state." |
| `outside_window` | — | "Check-out is only allowed within 15 minutes of the booking start and before the end time." |
| `missing_photos` | `<slot,slot>` | "Please capture the following photo slots before continuing: `reason`." |
| `not_found` | — | "The requested item could not be found." |

**Parsing pattern (already in `unwrap`):**
```ts
catch (err) {
  if (err instanceof CampusShareError) {
    switch (err.code) {
      case 'not_verified':   return toast.error('Account pending verification');
      case 'slot_taken':     return toast.error('Time slot just taken — pick new dates');
      case 'not_eligible':   return toast.error(`Not eligible: ${err.reason}`);
      case 'missing_photos': return setMissingSlots(err.reason?.split(',') ?? []);
      default:               return toast.error(err.message);
    }
  }
}
```

---

## 7. Storage Buckets & Path Conventions

| Bucket | Public | Max size | MIME types |
|---|---|---|---|
| `resource-images` | ✅ | 5 MB | jpeg, png, webp |
| `custody-photos` | ❌ | 5 MB | jpeg, png, webp |
| `resource-evidence` | ❌ | 5 MB | jpeg, png, webp, pdf |
| `qualification-docs` | ❌ | 5 MB | jpeg, png, webp, pdf |

### Path conventions

```
resource-images:    <institution_id>/<resource_id>/<filename>
custody-photos:     <institution_id>/<booking_id>/<phase>/<slot>.jpg
resource-evidence:  <institution_id>/<resource_id>/<filename>
qualification-docs: <institution_id>/<user_id>/<filename>
```

`custodyPhotoPath()` in `src/lib/custody.ts` is the single source of truth for the custody path format. The DB RPC validates that uploaded paths start with `<institution_id>/<booking_id>/<phase>/`.

### Signing private URLs

```ts
import { getSignedPhotoUrls } from 'src/lib/custody'
const urls = await getSignedPhotoUrls(paths, 3600)
// urls is Record<string, string> — path → signed URL
const url = urls[storagePath]
```

---

## 8. Realtime Channels

| Channel function | Table | Events | Filter |
|---|---|---|---|
| `subscribeToNotifications(userId, cb)` | `notifications` | INSERT | `user_id = userId` |
| `subscribeToBookings({ kind:'user', userId }, cb)` | `bookings` | INSERT + UPDATE | `user_id = userId` |
| `subscribeToBookings({ kind:'institution', institutionId }, cb)` | `bookings` | INSERT + UPDATE | `institution_id = institutionId` |
| `subscribeToReleasedSlots(institutionId, cb)` | `released_slots` | INSERT | `institution_id = institutionId` |

All subscription functions return an **unsubscribe function** — call it in the hook's cleanup effect:

```ts
useEffect(() => {
  const unsub = subscribeToNotifications(userId, (n) => setNotifications(prev => [n, ...prev]));
  return unsub;
}, [userId]);
```

---

## 9. Frontend Hook → Query / RPC Mapping

### `useResources`

| UI need | Query / RPC |
|---|---|
| Resource list (Discover page) | `supabase.from('resources').select('*, eligibility_rules(*), resource_accessories(*), resource_availability_windows(*), resource_required_qualifications(qualification_id, qualifications(name))').eq('status','active')` |
| Single resource detail | same query + `.eq('id', id).single()` |
| Admin: own institution resources | add `.eq('institution_id', institutionId)` |
| Utilisation chart | `supabase.from('resource_utilisation').select('*').eq('institution_id', institutionId)` |
| Underutilised list | same + `.eq('is_underutilised', true)` |

### `useBookings`

| UI need | Query / RPC |
|---|---|
| Member: my bookings | `supabase.from('bookings').select('*, resources(name,kind,image_path)').eq('user_id', userId).order('start_at', { ascending: false })` |
| Admin: all institution bookings | `.eq('institution_id', institutionId)` |
| Admin: pending only | add `.eq('status', 'pending')` |
| Approve / reject | `decideBooking(...)` |
| Cancel | `cancelBooking(bookingId)` |
| Release slot | `releaseBooking(bookingId)` |
| Live updates | `subscribeToBookings(filter, cb)` |

### `useCustody`

| UI need | Query / RPC |
|---|---|
| Full custody timeline | `getCustodyTimeline(bookingId)` |
| Check-out flow | `submitCheckOut(...)` from `src/lib/custody.ts` |
| Check-in flow | `submitCheckIn(...)` from `src/lib/custody.ts` |
| Admin inspect return | `inspectReturn({ bookingId, accept, notes })` |
| Before/after photo grid | `buildBeforeAfterPairs(photos)` → `getSignedPhotoUrls(paths)` |
| Report incident | `reportIncident(...)` |

### `useNotifications`

| UI need | Query / RPC |
|---|---|
| Initial load | `supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)` |
| Unread count | `notifications.filter(n => !n.read_at).length` |
| Mark read | `supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)` |
| Mark all read | same `.in('id', ids)` |
| Live new notifications | `subscribeToNotifications(userId, cb)` |

### Dashboard stat cards (`institution_stats`)

```ts
const stats = await institutionStats(institutionId)
// stats.total_resources  → "Total Resources" card
// stats.in_use_now       → "In Use Now" card
// stats.unused_30d       → "Unused (30 d)" card
// stats.pending_approvals → "Pending Approvals" card (badge)
```

### Utilisation chart

```ts
const rows = await supabase
  .from('resource_utilisation')
  .select('resource_id, booked_minutes_30d, available_minutes_30d, utilisation_pct, is_underutilised')
  .eq('institution_id', institutionId)
// Feed into a Recharts BarChart keyed by resource_id; join with resources(name) for labels.
```

### Underutilised resource list

```ts
const rows = await supabase
  .from('resource_utilisation')
  .select('resource_id, utilisation_pct')
  .eq('institution_id', institutionId)
  .eq('is_underutilised', true)
  .order('utilisation_pct')
// Show as a ranked list with UtilisationBar component.
```

---

## 10. Running Migrations & Seed

```bash
# Link to your Supabase project (once)
npx supabase link --project-ref <your-project-ref>

# Push migrations in order (0001 → 0002 → 0003)
npx supabase db push

# Optionally apply seed data (demo institution + 10 resources)
npx supabase db execute --file supabase/seed.sql

# Regenerate types
npx supabase gen types typescript --local > src/lib/database.types.ts
```

For local development:

```bash
npx supabase start
# Use the printed local URL and anon key in .env.local
npx supabase db reset   # runs all migrations + seed automatically
```

---

## 11. Install Supabase JS

The dependency is **not yet in `package.json`**. Add it before running the frontend:

```bash
npm install @supabase/supabase-js
```
