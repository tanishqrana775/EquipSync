export type UserRole = 'institution' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  campusId: string;
  avatar: string;
  rating?: number;
  isVerified: boolean;
  joinedDate: string;
  phone?: string;
}

export type ResourceCategory =
  | 'Laptops'
  | 'Projectors'
  | 'DSLR Cameras'
  | 'Lab Equipment'
  | 'Seminar Halls'
  | 'Classrooms'
  | 'Sports Equipment'
  | 'Academic Books'
  | 'Audio/Visual';

export type ResourceStatus =
  | 'available'
  | 'reserved'
  | 'in-use'
  | 'maintenance'
  | 'unavailable'
  | 'retired'
  | 'active';

export type ResourceCondition =
  | 'excellent'
  | 'good'
  | 'minor_wear'
  | 'minor_damage'
  | 'damaged'
  | 'major_damage'
  | 'missing_parts'
  | 'non_functional'
  | '-';

export const CONDITION_LABELS: Record<ResourceCondition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  minor_wear: 'Minor Wear (Safe)',
  minor_damage: 'Minor Damage',
  damaged: 'Damaged',
  major_damage: 'Major Damage',
  missing_parts: 'Missing Parts',
  non_functional: 'Non-functional',
  '-': '-',
};
export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  description: string;
  location: string;
  building: string;
  room: string;
  ownerDepartment: string;
  custodianName: string;
  custodianEmail: string;
  status: ResourceStatus;
  condition: ResourceCondition;
  imageUrl: string;
  serialNumber: string;
  tagId: string;
  qrIdentifier: string;
  maxBookingDurationHours: number;
  requiresFacultyApproval: boolean;
  depositRequired: boolean;
  requirements: string[];
  totalQuantity: number;
  availableQuantity: number;
  isAvailable?: boolean;
  is_available?: boolean;
  utilisationRate: number; // 0 - 100 percentage
  specifications: Record<string, string>;
  createdAt: string;
}

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'overdue';

export interface Booking {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceCategory: ResourceCategory;
  resourceImage: string;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  handoverCode: string;
  returnCode: string;
  chainOfCustodyId: string;
  createdAt: string;
}

export type CustodyStage =
  | 'Booking Requested'
  | 'Department Approved'
  | 'Check-out Handover'
  | 'Active Custody'
  | 'Check-in Inspection'
  | 'Returned & Restocked';

export interface CustodyStep {
  id: string;
  stage: CustodyStage;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
  actorName?: string;
  actorRole?: string;
  actorAvatar?: string;
  notes?: string;
  verifiedWithCode?: boolean;
  conditionNotes?: string;
}

export interface CustodyRecord {
  id: string;
  bookingId: string;
  resourceId: string;
  resourceTitle: string;
  resourceImage: string;
  borrowerName: string;
  borrowerDepartment: string;
  currentCustodian: string;
  custodyStatus: 'safe' | 'transferred' | 'overdue' | 'disputed';
  steps: CustodyStep[];
  digitalSignatures: {
    borrower?: string;
    issuingOfficer?: string;
    receivingOfficer?: string;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type: 'booking' | 'reminder' | 'custody' | 'alert';
  link?: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  actorRole: string;
  actorAvatar?: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'booking' | 'custody' | 'resource' | 'alert';
}

export interface DashboardStats {
  totalResources: number;
  activeBookings: number;
  availableResources: number;
  utilisationRate: number;
  pendingApprovals: number;
  overdueReturns: number;
}
