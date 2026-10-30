import { ActivityItem, NotificationItem, DashboardStats } from '../types';

export const mockActivities: ActivityItem[] = [
  {
    id: 'act-001',
    actor: 'Elena Rostova',
    actorRole: 'Gear Locker Custodian',
    action: 'verified physical handover of',
    target: 'Sony FX3 Cinema Kit (#MED-CAM-008)',
    timestamp: '14 minutes ago',
    type: 'custody',
  },
  {
    id: 'act-002',
    actor: 'Liam Gallagher',
    actorRole: 'Computer Science',
    action: 'submitted reservation request for',
    target: 'MacBook Pro 16" M3 Max',
    timestamp: '1 hour ago',
    type: 'booking',
  },
  {
    id: 'act-003',
    actor: 'Prof. David Vance',
    actorRole: 'EE Department Chair',
    action: 'approved laboratory checkout for',
    target: 'Rigol Digital Oscilloscope Bench #14',
    timestamp: '3 hours ago',
    type: 'booking',
  },
  {
    id: 'act-004',
    actor: 'Facilities Automated System',
    actorRole: 'Building Ops',
    action: 'completed post-event inspection for',
    target: 'Ada Lovelace Auditorium',
    timestamp: '5 hours ago',
    type: 'resource',
  },
  {
    id: 'act-005',
    actor: 'Sarah Chen',
    actorRole: 'Robotics Team',
    action: 'successfully checked in & returned',
    target: 'Precision Radar Gun Kit',
    timestamp: 'Yesterday',
    type: 'custody',
  },
];

export const mockNotifications: NotificationItem[] = [
  {
    id: 'notif-01',
    title: 'Handover Completed',
    description: 'Sony Alpha FX3 Cinema Camera Kit is now in your active custody. Return due Nov 3, 18:00.',
    timestamp: '14 mins ago',
    read: false,
    type: 'custody',
    link: '/app/bookings/bk-2024-001',
  },
  {
    id: 'notif-02',
    title: 'Booking Approved',
    description: 'Your request for MacBook Pro 16" M3 Max has been approved by Dr. Michael Chang.',
    timestamp: '2 hours ago',
    read: false,
    type: 'booking',
    link: '/app/bookings/bk-2024-002',
  },
  {
    id: 'notif-03',
    title: 'Return Reminder',
    description: 'Rigol Oscilloscope check-in inspection passed with zero defect reports.',
    timestamp: '1 day ago',
    read: true,
    type: 'reminder',
    link: '/app/bookings/bk-2024-004',
  },
  {
    id: 'notif-04',
    title: 'System Notice',
    description: 'CampusShare scheduled maintenance will run Sunday 02:00-03:00 UTC.',
    timestamp: '2 days ago',
    read: true,
    type: 'alert',
  },
];

export const mockInstitutionStats: DashboardStats = {
  totalResources: 47,
  activeBookings: 18,
  availableResources: 29,
  utilisationRate: 74,
  pendingApprovals: 5,
  overdueReturns: 0,
};

export const mockUserStats = {
  activeBorrowings: 1,
  upcomingReservations: 2,
  completedHandovers: 14,
  reputationScore: 99.4,
};
