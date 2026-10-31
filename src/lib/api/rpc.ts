/**
 * src/lib/api/rpc.ts
 * CampusShare – Typed wrappers for every Supabase RPC + realtime subscriptions.
 *
 * Every function calls `unwrap()` so callers get a `CampusShareError` with a
 * machine-readable `.code` on failure. No raw Supabase errors escape this layer.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, unwrap } from '../supabase';
import type { Database } from '../database.types';

// ---------------------------------------------------------------------------
// Convenience row types
// ---------------------------------------------------------------------------
export type Booking         = Database['public']['Tables']['bookings']['Row'];
export type WaitlistEntry   = Database['public']['Tables']['waitlist_entries']['Row'];
export type Incident        = Database['public']['Tables']['incidents']['Row'];
export type Notification    = Database['public']['Tables']['notifications']['Row'];
export type ReleasedSlot    = Database['public']['Tables']['released_slots']['Row'];

export type ConditionRating = Database['public']['Enums']['condition_rating'];
export type IncidentSeverity = Database['public']['Enums']['incident_severity'];

// Photo input passed to check-out / check-in RPCs
export interface PhotoInput {
  slot:               string;
  storage_path:       string;
  sha256:             string;
  client_captured_at: string; // ISO-8601 timestamptz string
}

// Accessory check item
export interface AccessoryCheckInput {
  accessory_id: string;
  name:         string;
  state:        'present' | 'missing' | 'damaged';
  note?:        string;
}

// ---------------------------------------------------------------------------
// Waitlist entry with position (returned by my_waitlist RPC)
// ---------------------------------------------------------------------------
export interface WaitlistEntryWithPosition extends Omit<WaitlistEntry, never> {
  position: number | null;
}

// ---------------------------------------------------------------------------
// Institution stats (returned by institution_stats RPC)
// ---------------------------------------------------------------------------
export interface InstitutionStats {
  total_resources:   number;
  in_use_now:        number;
  unused_30d:        number;
  pending_approvals: number;
}

// ---------------------------------------------------------------------------
// Custody timeline item (arbitrary JSON from get_custody_timeline RPC)
// ---------------------------------------------------------------------------
export interface CustodyTimelineItem {
  type:         'status_change' | 'custody_event' | 'custody_photo' | 'incident';
  occurred_at:  string;
  actor_id?:    string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// request_booking
// ---------------------------------------------------------------------------
export async function requestBooking(args: {
  resourceId:     string;
  start:          string;
  end:            string;
  purpose:        string;
  supervisorName?: string;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('request_booking', {
      p_resource_id:     args.resourceId,
      p_start:           args.start,
      p_end:             args.end,
      p_purpose:         args.purpose,
      p_supervisor_name: args.supervisorName ?? undefined,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// decide_booking  (admin)
// ---------------------------------------------------------------------------
export async function decideBooking(args: {
  bookingId: string;
  approve:   boolean;
  note?:     string;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('decide_booking', {
      p_booking_id: args.bookingId,
      p_approve:    args.approve,
      p_note:       args.note ?? undefined,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// cancel_booking  (owner)
// ---------------------------------------------------------------------------
export async function cancelBooking(bookingId: string): Promise<Booking> {
  return unwrap(
    await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// admin_cancel_booking (admin, approved bookings before start)
// ---------------------------------------------------------------------------
export async function adminCancelBooking(args: {
  bookingId: string;
  note?: string | null;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('admin_cancel_booking', {
      p_booking_id: args.bookingId,
      p_note: args.note ?? null,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// release_booking  (owner, approved only)
// ---------------------------------------------------------------------------
export async function releaseBooking(bookingId: string): Promise<Booking> {
  return unwrap(
    await supabase.rpc('release_booking', { p_booking_id: bookingId })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// claim_released_slot  (verified member)
// ---------------------------------------------------------------------------
export async function claimReleasedSlot(slotId: string): Promise<Booking> {
  return unwrap(
    await supabase.rpc('claim_released_slot', { p_slot_id: slotId })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// join_waitlist
// ---------------------------------------------------------------------------
export async function joinWaitlist(args: {
  resourceId: string;
  start:      string;
  end:        string;
}): Promise<WaitlistEntry> {
  return unwrap(
    await supabase.rpc('join_waitlist', {
      p_resource_id: args.resourceId,
      p_start:       args.start,
      p_end:         args.end,
    })
  ) as WaitlistEntry;
}

// ---------------------------------------------------------------------------
// leave_waitlist
// ---------------------------------------------------------------------------
export async function leaveWaitlist(entryId: string): Promise<void> {
  unwrap(
    await supabase.rpc('leave_waitlist', { p_entry_id: entryId })
  );
}

// ---------------------------------------------------------------------------
// my_waitlist  (returns entries + FIFO position)
// ---------------------------------------------------------------------------
export async function myWaitlist(): Promise<WaitlistEntryWithPosition[]> {
  const rows = unwrap(
    await supabase.rpc('my_waitlist')
  );
  // RPC returns rows; each row shape is validated at the DB boundary.
  // We map to our typed interface using field presence narrowing.
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (
      row !== null &&
      typeof row === 'object' &&
      'id' in row
    ) {
      return row as WaitlistEntryWithPosition;
    }
    throw new Error('my_waitlist: unexpected row shape');
  });
}

// ---------------------------------------------------------------------------
// verify_member  (admin)
// ---------------------------------------------------------------------------
export async function verifyMember(args: {
  userId:  string;
  approve: boolean;
}): Promise<Database['public']['Tables']['profiles']['Row']> {
  return unwrap(
    await supabase.rpc('verify_member', {
      p_user_id: args.userId,
      p_approve: args.approve,
    })
  ) as Database['public']['Tables']['profiles']['Row'];
}

// ---------------------------------------------------------------------------
// verify_qualification  (admin)
// ---------------------------------------------------------------------------
export async function verifyQualification(args: {
  userId:          string;
  qualificationId: string;
  approve:         boolean;
}): Promise<Database['public']['Tables']['user_qualifications']['Row']> {
  return unwrap(
    await supabase.rpc('verify_qualification', {
      p_user_id:          args.userId,
      p_qualification_id: args.qualificationId,
      p_approve:          args.approve,
    })
  ) as Database['public']['Tables']['user_qualifications']['Row'];
}

// ---------------------------------------------------------------------------
// check_out_booking  (owner)
// ---------------------------------------------------------------------------
export async function checkOutBooking(args: {
  bookingId:       string;
  photos:          PhotoInput[];
  condition:       ConditionRating;
  notes:           string;
  accessoryChecks?: AccessoryCheckInput[];
  qrIdentifier:    string;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('check_out_booking', {
      p_booking_id:       args.bookingId,
      p_photos:           args.photos as unknown as Database['public']['Tables']['custody_events']['Row']['accessory_checks'],
      p_condition:        args.condition,
      p_notes:            args.notes,
      p_accessory_checks: (args.accessoryChecks ?? []) as unknown as Database['public']['Tables']['custody_events']['Row']['accessory_checks'],
      p_qr_identifier:    args.qrIdentifier,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// check_in_booking  (owner)
// ---------------------------------------------------------------------------
export async function checkInBooking(args: {
  bookingId:       string;
  photos:          PhotoInput[];
  condition:       ConditionRating;
  notes:           string;
  accessoryChecks?: AccessoryCheckInput[];
  qrIdentifier:    string;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('check_in_booking', {
      p_booking_id:       args.bookingId,
      p_photos:           args.photos as unknown as Database['public']['Tables']['custody_events']['Row']['accessory_checks'],
      p_condition:        args.condition,
      p_notes:            args.notes,
      p_accessory_checks: (args.accessoryChecks ?? []) as unknown as Database['public']['Tables']['custody_events']['Row']['accessory_checks'],
      p_qr_identifier:    args.qrIdentifier,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// inspect_return  (admin)
// ---------------------------------------------------------------------------
export async function inspectReturn(args: {
  bookingId:        string;
  condition:        ConditionRating;
  accessoryChecks?: AccessoryCheckInput[];
  notes?:           string;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('inspect_return', {
      p_booking_id:       args.bookingId,
      p_condition:        args.condition,
      p_accessory_checks: (args.accessoryChecks ?? []) as unknown as Database['public']['Tables']['custody_events']['Row']['accessory_checks'],
      p_notes:            args.notes ?? undefined,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// verify_asset_qr  (borrower)
// ---------------------------------------------------------------------------
export async function verifyAssetQr(args: {
  bookingId: string;
  qr:        string;
  phase:     'checkout' | 'return';
}): Promise<boolean> {
  return unwrap(
    await supabase.rpc('verify_asset_qr', {
      p_booking_id: args.bookingId,
      p_qr:         args.qr,
      p_phase:      args.phase,
    })
  ) as boolean;
}

// ---------------------------------------------------------------------------
// start_checkout & start_return (borrower)
// ---------------------------------------------------------------------------
export async function startCheckout(bookingId: string): Promise<void> {
  unwrap(await supabase.rpc('start_checkout', { p_booking_id: bookingId }));
}

export async function startReturn(bookingId: string): Promise<void> {
  unwrap(await supabase.rpc('start_return', { p_booking_id: bookingId }));
}

// ---------------------------------------------------------------------------
// resolve_dispute (admin)
// ---------------------------------------------------------------------------
export async function resolveDispute(args: {
  bookingId:  string;
  resolution: 'borrower_responsible' | 'no_fault' | 'shared_responsibility';
  notes:      string;
}): Promise<Booking> {
  return unwrap(
    await supabase.rpc('resolve_dispute', {
      p_booking_id:  args.bookingId,
      p_resolution:  args.resolution,
      p_notes:       args.notes,
    })
  ) as Booking;
}

// ---------------------------------------------------------------------------
// regenerate_resource_qr (admin)
// ---------------------------------------------------------------------------
export async function regenerateResourceQr(resourceId: string): Promise<string> {
  return unwrap(
    await supabase.rpc('regenerate_resource_qr', {
      p_resource_id: resourceId,
    })
  ) as string;
}

// ---------------------------------------------------------------------------
// ensure_category (admin)
// ---------------------------------------------------------------------------
export async function ensureCategory(name: string): Promise<string> {
  return unwrap(
    await supabase.rpc('ensure_category', {
      p_name: name,
    })
  ) as string;
}

// ---------------------------------------------------------------------------
// retire_resource (admin)
// ---------------------------------------------------------------------------
export async function retireResourceRpc(
  resourceId: string,
  reason?: string
): Promise<Database['public']['Tables']['resources']['Row']> {
  return unwrap(
    await supabase.rpc('retire_resource', {
      p_resource_id: resourceId,
      p_reason: reason ?? null,
    })
  ) as Database['public']['Tables']['resources']['Row'];
}

// ---------------------------------------------------------------------------
// reactivate_resource (admin)
// ---------------------------------------------------------------------------
export async function reactivateResourceRpc(
  resourceId: string
): Promise<Database['public']['Tables']['resources']['Row']> {
  return unwrap(
    await supabase.rpc('reactivate_resource', {
      p_resource_id: resourceId,
    })
  ) as Database['public']['Tables']['resources']['Row'];
}

// ---------------------------------------------------------------------------
// Domain Verification RPCs
// ---------------------------------------------------------------------------

export async function getMyOrgDomains(): Promise<string[]> {
  const data = unwrap<string[]>(
    await supabase.rpc('get_my_org_domains')
  );
  return data ?? [];
}

export async function setAllowedDomains(
  domains: string[]
): Promise<{ domains: string[]; newly_verified: number }> {
  const data = unwrap<{ domains: string[]; newly_verified: number }>(
    await supabase.rpc('set_allowed_domains', {
      p_domains: domains,
    })
  );
  return data;
}

export async function matchOrganizationByEmail(
  email: string
): Promise<{ id: string; name: string } | null> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) return null;
  try {
    const rows = unwrap<Array<{ id: string; name: string }>>(
      await supabase.rpc('match_organization_by_email', {
        p_email: trimmed,
      })
    );
    if (rows && rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Custody Hub RPCs
// ---------------------------------------------------------------------------

export interface ResolvedAssetQr {
  resource_id: string;
  name: string;
  asset_tag: string;
  status: string;
  actions: Array<{ type: 'checkout' | 'return'; booking_id: string }>;
  blocked?: Array<{ booking_id: string; reason: string }>;
  can_audit: boolean;
}

export async function resolveAssetQr(qr: string): Promise<ResolvedAssetQr> {
  return unwrap(
    await supabase.rpc('resolve_asset_qr', { p_qr: qr })
  ) as ResolvedAssetQr;
}

export async function recordAssetAuditRpc(args: {
  resourceId: string;
  qr: string;
  photos: PhotoInput[];
  condition: ConditionRating;
  accessoryChecks?: AccessoryCheckInput[];
  notes?: string;
}): Promise<Database['public']['Tables']['asset_audits']['Row']> {
  return unwrap(
    await supabase.rpc('record_asset_audit', {
      p_resource_id: args.resourceId,
      p_qr: args.qr,
      p_photos: args.photos as unknown as Database['public']['Tables']['asset_audits']['Row']['photos'],
      p_condition: args.condition,
      p_accessory_checks: (args.accessoryChecks ?? []) as unknown as Database['public']['Tables']['asset_audits']['Row']['accessory_checks'],
      p_notes: args.notes ?? null,
    })
  ) as Database['public']['Tables']['asset_audits']['Row'];
}

export async function getCustodyChainRpc(args: {
  resourceId: string;
  limit?: number;
  before?: string;
}): Promise<any[]> {
  return unwrap(
    await supabase.rpc('get_custody_chain', {
      p_resource_id: args.resourceId,
      p_limit: args.limit ?? 50,
      p_before: args.before ?? null,
    })
  ) as any[];
}

export async function searchCustodyAuditRpc(args: {
  query?: string;
  resourceId?: string;
  userId?: string;
  eventTypes?: string[];
  from?: string;
  to?: string;
  flaggedOnly?: boolean;
  limit?: number;
  before?: number;
}): Promise<any[]> {
  return unwrap(
    await supabase.rpc('search_custody_audit', {
      p_query: args.query ?? null,
      p_resource_id: args.resourceId ?? null,
      p_user_id: args.userId ?? null,
      p_event_types: args.eventTypes ?? null,
      p_from: args.from ?? null,
      p_to: args.to ?? null,
      p_flagged_only: args.flaggedOnly ?? false,
      p_limit: args.limit ?? 50,
      p_before: args.before ?? null,
    })
  ) as any[];
}

export async function getMyCustodySummaryRpc(): Promise<{
  active_holdings: any[];
  loan_history: any[];
}> {
  return unwrap(
    await supabase.rpc('get_my_custody_summary')
  ) as {
    active_holdings: any[];
    loan_history: any[];
  };
}

// ---------------------------------------------------------------------------
// report_incident  (participant)
// ---------------------------------------------------------------------------
export async function reportIncident(args: {
  bookingId:   string;
  severity:    IncidentSeverity;
  type:        'damage' | 'missing_accessory' | 'other';
  description: string;
}): Promise<Incident> {
  return unwrap(
    await supabase.rpc('report_incident', {
      p_booking_id: args.bookingId,
      p_severity:   args.severity,
      p_type:       args.type,
      p_description: args.description,
    })
  ) as Incident;
}

// ---------------------------------------------------------------------------
// resolve_incident  (admin)
// ---------------------------------------------------------------------------
export async function resolveIncident(incidentId: string): Promise<Incident> {
  return unwrap(
    await supabase.rpc('resolve_incident', { p_incident_id: incidentId })
  ) as Incident;
}

// ---------------------------------------------------------------------------
// get_custody_timeline  (participant or admin)
// ---------------------------------------------------------------------------
export async function getCustodyTimeline(bookingId: string): Promise<CustodyTimelineItem[]> {
  const raw = unwrap(
    await supabase.rpc('get_custody_timeline', { p_booking_id: bookingId })
  );
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (item !== null && typeof item === 'object' && 'type' in item) {
      return item as CustodyTimelineItem;
    }
    throw new Error('get_custody_timeline: unexpected item shape');
  });
}

// ---------------------------------------------------------------------------
// institution_stats  (admin)
// ---------------------------------------------------------------------------
export async function institutionStats(institutionId: string): Promise<InstitutionStats> {
  const raw = unwrap(
    await supabase.rpc('institution_stats', { p_institution_id: institutionId })
  );
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'total_resources' in raw &&
    'in_use_now'      in raw &&
    'unused_30d'      in raw &&
    'pending_approvals' in raw
  ) {
    const candidate = raw as Record<string, unknown>;
    return {
      total_resources:   Number(candidate.total_resources ?? 0),
      in_use_now:        Number(candidate.in_use_now ?? 0),
      unused_30d:        Number(candidate.unused_30d ?? 0),
      pending_approvals: Number(candidate.pending_approvals ?? 0),
    };
  }
  throw new Error('institution_stats: unexpected response shape');
}

export interface PublicStats {
  institutions: number;
  resources: number;
}

export async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_public_stats');
    if (error || !data || typeof data !== 'object') return null;
    const candidate = data as Record<string, unknown>;
    return {
      institutions: Number(candidate.institutions ?? 0),
      resources: Number(candidate.resources ?? 0),
    };
  } catch {
    return null;
  }
}

export interface InstitutionSearchResult {
  id: string;
  name: string;
  type: string;
}

export async function searchInstitutions(query: string): Promise<InstitutionSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }
  const rows = unwrap<InstitutionSearchResult[]>(
    await supabase.rpc('search_institutions', { p_query: trimmed })
  );
  return rows ?? [];
}

// ---------------------------------------------------------------------------
// Context & Institution RPCs
// ---------------------------------------------------------------------------

export interface UserContext {
  profile: Database['public']['Tables']['profiles']['Row'];
  institution_id: string | null;
  institution_name: string | null;
  institution: Database['public']['Tables']['institutions']['Row'] | null;
  verified_qualification_ids: string[];
}

export async function getMyContext(): Promise<UserContext> {
  const raw = unwrap(
    await supabase.rpc('get_my_context')
  );
  if (raw !== null && typeof raw === 'object' && 'profile' in raw) {
    const candidate = raw as Record<string, unknown>;
    const profile = candidate.profile as Database['public']['Tables']['profiles']['Row'];
    const institutionId = typeof candidate.institution_id === 'string' ? candidate.institution_id : null;
    const institutionName = typeof candidate.institution_name === 'string' ? candidate.institution_name : null;
    const institution = candidate.institution && typeof candidate.institution === 'object'
      ? candidate.institution as Database['public']['Tables']['institutions']['Row']
      : null;
    const verifiedQualificationIds = Array.isArray(candidate.verified_qualification_ids)
      ? candidate.verified_qualification_ids.filter((id): id is string => typeof id === 'string')
      : [];

    return {
      profile,
      institution_id: institutionId,
      institution_name: institutionName,
      institution,
      verified_qualification_ids: verifiedQualificationIds,
    };
  }
  throw new Error('get_my_context: invalid context structure returned');
}

export async function setMemberInstitution(
  institutionId: string
): Promise<Database['public']['Tables']['profiles']['Row']> {
  return unwrap(
    await supabase.rpc('set_member_institution', { p_institution_id: institutionId })
  );
}

// ---------------------------------------------------------------------------
// Realtime: notifications
// ---------------------------------------------------------------------------

/**
 * Subscribes to INSERT events on the `notifications` table for `userId`.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId:  string,
  cb:      (notification: Notification) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on<Notification>(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => cb(payload.new),
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ---------------------------------------------------------------------------
// Realtime: bookings
// ---------------------------------------------------------------------------

/** Filter options for booking subscriptions. */
export type BookingRealtimeFilter =
  | { kind: 'user';        userId:        string }
  | { kind: 'institution'; institutionId: string };

/**
 * Subscribes to INSERT and UPDATE events on `bookings`.
 * Pass `kind: 'user'` for a borrower view, `kind: 'institution'` for an admin view.
 * Returns an unsubscribe function.
 */
export function subscribeToBookings(
  filter: BookingRealtimeFilter,
  cb:     (booking: Booking) => void,
): () => void {
  const channelName =
    filter.kind === 'user'
      ? `bookings:user:${filter.userId}`
      : `bookings:inst:${filter.institutionId}`;

  const pgFilter =
    filter.kind === 'user'
      ? `user_id=eq.${filter.userId}`
      : `institution_id=eq.${filter.institutionId}`;

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on<Booking>(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'bookings',
        filter: pgFilter,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        cb(payload.new);
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ---------------------------------------------------------------------------
// Realtime: released_slots  (open slots feed for a member's institution)
// ---------------------------------------------------------------------------

/**
 * Subscribes to new open released slots for an institution.
 * Returns an unsubscribe function.
 */
export function subscribeToReleasedSlots(
  institutionId: string,
  cb:            (slot: ReleasedSlot) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`released_slots:${institutionId}`)
    .on<ReleasedSlot>(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'released_slots',
        filter: `institution_id=eq.${institutionId}`,
      },
      (payload) => cb(payload.new),
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
