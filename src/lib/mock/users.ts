import { User } from '../types';

export const mockUsers: Record<'institution' | 'user', User> = {
  institution: {
    id: 'usr_inst_01',
    name: 'Prof. David Vance',
    email: 'd.vance@stanford.edu',
    role: 'institution',
    department: 'Department of Electrical Engineering & CS',
    campusId: 'FAC-8821',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isVerified: true,
    joinedDate: 'August 2021',
    phone: '+1 (555) 349-2041',
  },
  user: {
    id: 'usr_stud_01',
    name: 'Sarah Chen',
    email: 'sarah.chen@student.stanford.edu',
    role: 'user',
    department: 'School of Design & Robotics',
    campusId: 'STU-49102',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    rating: 4.95,
    isVerified: true,
    joinedDate: 'September 2023',
    phone: '+1 (555) 782-9901',
  },
};
