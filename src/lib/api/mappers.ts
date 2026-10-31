/**
 * src/lib/api/mappers.ts
 * CampusShare – Adapters converting Supabase database rows into UI types.
 *
 * Keeps frontend components and pages untouched by returning the exact
 * shapes defined in src/lib/types.ts.
 */

import { supabase } from '../supabase';
import {
  Resource,
  ResourceCategory,
  ResourceStatus,
  Booking,
  BookingStatus,
  NotificationItem,
  ActivityItem,
  CustodyRecord,
  CustodyStep,
  CustodyStage,
} from '../types';
import type { Database } from '../database.types';

type DbResource = Database['public']['Tables']['resources']['Row'] & {
  institutions?: { name: string } | null;
  eligibility_rules?: Database['public']['Tables']['eligibility_rules']['Row'] | null;
  resource_accessories?: Database['public']['Tables']['resource_accessories']['Row'][];
  resource_availability_windows?: Database['public']['Tables']['resource_availability_windows']['Row'][];
  resource_required_qualifications?: {
    qualification_id: string;
    qualifications?: { name: string } | null;
  }[];
};

type DbBooking = Database['public']['Tables']['bookings']['Row'] & {
  resources?: {
    name: string;
    kind: string;
    category: string | null;
    image_path: string | null;
  } | null;
  profiles?: {
    full_name: string;
    user_type: string | null;
    avatar_url: string | null;
  } | null;
};

type DbNotification = Database['public']['Tables']['notifications']['Row'];
type DbAuditLog = Database['public']['Tables']['audit_log']['Row'];

export function getResourceImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = supabase.storage.from('resource-images').getPublicUrl(path);
  return data?.publicUrl || '';
}

export function resolveStorageUrl(path: string | null | undefined, bucket = 'resource-images'): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || '';
}
export function formatTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Resource Mapper
// ---------------------------------------------------------------------------
export function mapDbResourceToUi(row: DbResource, utilisationPct?: number): Resource {
  const rules = row.eligibility_rules;
  const accessories = row.resource_accessories || [];
  const reqQuals = (row.resource_required_qualifications || [])
    .map((rq) => rq.qualifications?.name)
    .filter((name): name is string => typeof name === 'string');

  const loc = row.location || '-';
  const locParts = loc.split('–').map((s) => s.trim());
  const building = locParts[0] || '-';
  const room = locParts[1] || '-';

  let status: ResourceStatus = 'available';
  if (row.status === 'retired') {
    status = 'retired';
  } else if (row.status === 'maintenance') {
    status = 'maintenance';
  } else if (!row.is_available) {
    status = 'unavailable';
  }

  const specs: Record<string, string> = {};
  if (row.asset_tag) specs['Asset Tag'] = row.asset_tag;
  if (row.kind) specs['Type'] = row.kind.toUpperCase();
  if (rules?.max_duration_minutes) {
    specs['Max Duration'] = `${Math.round(rules.max_duration_minutes / 60)} hours`;
  }
  if (accessories.length > 0) {
    specs['Accessories'] = accessories.map((a) => a.name).join(', ');
  }

  const orgName = row.institutions?.name || '-';

  return {
    id: row.id,
    title: row.name,
    category: (row.category as ResourceCategory) || 'Lab Equipment',
    description: row.description || '-',
    location: loc,
    building,
    room,
    ownerDepartment: orgName,
    custodianName: orgName,
    custodianEmail: '-',
    status,
    condition: '-',
    imageUrl: resolveStorageUrl(row.image_path, 'resource-images'),
    serialNumber: row.asset_tag || '-',
    tagId: row.asset_tag || row.id.slice(0, 8).toUpperCase(),
    qrIdentifier: row.qr_identifier || '',
    maxBookingDurationHours: rules?.max_duration_minutes ? Math.round(rules.max_duration_minutes / 60) : 24,
    requiresFacultyApproval: rules?.requires_approval ?? true,
    depositRequired: false,
    requirements: reqQuals,
    totalQuantity: 1,
    availableQuantity: row.is_available ? 1 : 0,
    utilisationRate: utilisationPct !== undefined ? Math.round(utilisationPct) : 0,
    specifications: specs,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Booking Mapper
// ---------------------------------------------------------------------------
export function mapDbBookingToUi(b: DbBooking): Booking {
  let status: BookingStatus = 'pending';
  const now = new Date();
  const end = new Date(b.end_at);

  switch (b.status) {
    case 'pending':
      status = 'pending';
      break;
    case 'approved':
      status = 'approved';
      break;
    case 'checked_out':
      status = now > end ? 'overdue' : 'active';
      break;
    case 'returned':
    case 'closed':
      status = 'completed';
      break;
    case 'cancelled':
    case 'released':
    case 'rejected':
      status = 'cancelled';
      break;
    case 'disputed':
      status = 'active';
      break;
    default:
      status = 'pending';
  }

  return {
    id: b.id,
    resourceId: b.resource_id,
    resourceTitle: b.resources?.name || 'Campus Resource',
    resourceCategory: (b.resources?.category as ResourceCategory) || 'Lab Equipment',
    resourceImage: resolveStorageUrl(b.resources?.image_path, 'resource-images'),
    userId: b.user_id,
    userName: b.profiles?.full_name || 'Campus User',
    userEmail: '',
    userDepartment: b.profiles?.user_type ? b.profiles.user_type.toUpperCase() : 'Student',
    startTime: b.start_at,
    endTime: b.end_at,
    purpose: b.purpose || 'Academic research & project work',
    status,
    handoverCode: `HC-${b.id.slice(0, 4).toUpperCase()}`,
    returnCode: `RT-${b.id.slice(-4).toUpperCase()}`,
    chainOfCustodyId: b.id,
    createdAt: b.created_at,
  };
}

// ---------------------------------------------------------------------------
// Notification Mapper
// ---------------------------------------------------------------------------
export function mapDbNotificationToUi(n: DbNotification): NotificationItem {
  let type: 'booking' | 'reminder' | 'custody' | 'alert' = 'booking';
  if (n.type.includes('incident') || n.type.includes('dispute') || n.type.includes('rejected')) {
    type = 'alert';
  } else if (n.type.includes('custody') || n.type.includes('return')) {
    type = 'custody';
  } else if (n.type.includes('slot') || n.type.includes('available')) {
    type = 'reminder';
  }

  return {
    id: n.id,
    title: n.title,
    description: n.body,
    timestamp: formatTimeAgo(n.created_at),
    read: n.read_at !== null,
    type,
    link: n.link || undefined,
  };
}

// ---------------------------------------------------------------------------
// Audit Log / Activity Mapper
// ---------------------------------------------------------------------------
export function mapDbAuditLogToActivity(log: DbAuditLog): ActivityItem {
  let type: 'booking' | 'custody' | 'resource' | 'alert' = 'booking';
  if (log.entity_type === 'custody_events' || log.entity_type === 'custody_photos') {
    type = 'custody';
  } else if (log.entity_type === 'resources') {
    type = 'resource';
  } else if (log.entity_type === 'incidents') {
    type = 'alert';
  }

  let actionText = log.action;
  if (log.metadata && typeof log.metadata === 'object' && 'new_status' in log.metadata) {
    const candidate = log.metadata as Record<string, unknown>;
    actionText = `updated status to ${String(candidate.new_status)}`;
  }

  return {
    id: `act-${log.id}`,
    actor: 'Campus Member',
    actorRole: 'Authorized User',
    action: actionText,
    target: `${log.entity_type} #${String(log.entity_id || '').slice(0, 8)}`,
    timestamp: formatTimeAgo(log.created_at),
    type,
  };
}

// ---------------------------------------------------------------------------
// Custody Record Mapper
// ---------------------------------------------------------------------------
export function buildCustodyRecordFromBooking(
  booking: DbBooking,
  rawTimeline?: Array<Record<string, unknown>>
): CustodyRecord {
  const steps: CustodyStep[] = [];

  // Stage 1: Booking Requested
  steps.push({
    id: `step-req-${booking.id}`,
    stage: 'Booking Requested',
    status: 'completed',
    timestamp: formatTimeAgo(booking.created_at),
    actorName: booking.profiles?.full_name || 'Borrower',
    actorRole: 'Campus Member',
    notes: booking.purpose || 'Reservation submitted',
  });

  // Stage 2: Department Approved
  const isApprovedOrLater = ['approved', 'checked_out', 'returned', 'closed', 'disputed'].includes(booking.status);
  steps.push({
    id: `step-app-${booking.id}`,
    stage: 'Department Approved',
    status: isApprovedOrLater ? 'completed' : booking.status === 'pending' ? 'current' : 'upcoming',
    timestamp: booking.decided_at ? formatTimeAgo(booking.decided_at) : undefined,
    actorName: 'Faculty Administrator',
    actorRole: 'Authorised Approver',
    notes: booking.decision_note || (isApprovedOrLater ? 'Clearance granted for reservation window.' : 'Pending review.'),
  });

  // Stage 3: Check-out Handover
  const isCheckedOutOrLater = ['checked_out', 'returned', 'closed', 'disputed'].includes(booking.status);
  steps.push({
    id: `step-out-${booking.id}`,
    stage: 'Check-out Handover',
    status: isCheckedOutOrLater ? 'completed' : booking.status === 'approved' ? 'current' : 'upcoming',
    actorName: booking.profiles?.full_name || 'Borrower',
    actorRole: 'Borrower & Custodian',
    verifiedWithCode: isCheckedOutOrLater,
    notes: isCheckedOutOrLater ? 'Cryptographic condition photos verified and accepted.' : 'Awaiting physical collection.',
  });

  // Stage 4: Active Custody
  const isActive = booking.status === 'checked_out';
  steps.push({
    id: `step-act-${booking.id}`,
    stage: 'Active Custody',
    status: isActive ? 'current' : ['returned', 'closed'].includes(booking.status) ? 'completed' : 'upcoming',
    actorName: booking.profiles?.full_name || 'Borrower',
    actorRole: 'In Custody',
    notes: isActive ? 'Gear currently in authorized possession.' : undefined,
  });

  // Stage 5: Check-in Inspection
  const isReturnedOrLater = ['returned', 'closed', 'disputed'].includes(booking.status);
  steps.push({
    id: `step-in-${booking.id}`,
    stage: 'Check-in Inspection',
    status: isReturnedOrLater ? (booking.status === 'returned' ? 'current' : 'completed') : 'upcoming',
    actorName: 'Lab Supervisor',
    actorRole: 'Inspection Officer',
    notes: isReturnedOrLater ? 'Multi-point return inspection performed.' : 'Pending return.',
  });

  // Stage 6: Returned & Restocked
  const isClosed = booking.status === 'closed';
  steps.push({
    id: `step-close-${booking.id}`,
    stage: 'Returned & Restocked',
    status: isClosed ? 'completed' : booking.status === 'disputed' ? 'current' : 'upcoming',
    actorName: 'Inventory Controller',
    actorRole: 'Central Depository',
    notes: isClosed ? 'Asset restocked into available catalog.' : booking.status === 'disputed' ? 'Custody dispute under administrative review.' : undefined,
  });

  let custodyStatus: 'safe' | 'transferred' | 'overdue' | 'disputed' = 'safe';
  if (booking.status === 'disputed') {
    custodyStatus = 'disputed';
  } else if (booking.status === 'checked_out' && new Date() > new Date(booking.end_at)) {
    custodyStatus = 'overdue';
  } else if (booking.status === 'checked_out') {
    custodyStatus = 'transferred';
  }

  return {
    id: `cust-${booking.id.slice(0, 8)}`,
    bookingId: booking.id,
    resourceId: booking.resource_id,
    resourceTitle: booking.resources?.name || 'Campus Resource',
    resourceImage: resolveStorageUrl(booking.resources?.image_path, 'resource-images'),
    borrowerName: booking.profiles?.full_name || 'Campus Member',
    borrowerDepartment: booking.profiles?.user_type?.toUpperCase() || 'STUDENT',
    currentCustodian: booking.status === 'checked_out' ? (booking.profiles?.full_name || 'Borrower') : 'Central Hub',
    custodyStatus,
    steps,
    digitalSignatures: {
      borrower: booking.user_id,
      issuingOfficer: booking.decided_by || undefined,
    },
  };
}
