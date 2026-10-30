/**
 * src/hooks/useBookings.ts
 * CampusShare – TanStack Query hook for bookings, waitlists, and slot releases.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { Booking } from '../lib/types';
import { mockBookings } from '../lib/mock/bookings';
import { mapDbBookingToUi } from '../lib/api/mappers';
import {
  requestBooking as rpcRequestBooking,
  decideBooking as rpcDecideBooking,
  cancelBooking as rpcCancelBooking,
  releaseBooking as rpcReleaseBooking,
  claimReleasedSlot as rpcClaimReleasedSlot,
  joinWaitlist as rpcJoinWaitlist,
  leaveWaitlist as rpcLeaveWaitlist,
  myWaitlist as rpcMyWaitlist,
  WaitlistEntryWithPosition,
  ReleasedSlot,
} from '../lib/api/rpc';
import { toastError } from '../lib/errors';
import { toast } from 'sonner';

export interface BookingFilters {
  status?: string;
  institutionWide?: boolean;
}

const isMock = import.meta.env.VITE_USE_MOCKS === 'true';

export function useBookings(filters?: BookingFilters) {
  const queryClient = useQueryClient();
  const { role, profile, user } = useAuth();

  const isInstitutionView = filters?.institutionWide ?? role === 'institution';

  // Fetch bookings
  const {
    data: rawBookings = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['bookings', isInstitutionView ? 'institution' : 'user', profile?.institution_id, user?.id],
    queryFn: async () => {
      if (isMock) return [];

      let query = supabase.from('bookings').select(`
        *,
        resources(name, kind, category, image_path),
        profiles(full_name, user_type, avatar_url)
      `);

      if (isInstitutionView && profile?.institution_id) {
        query = query.eq('institution_id', profile.institution_id);
      } else if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('start_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isMock && (!!profile?.institution_id || !!user?.id),
  });

  // Map to UI Bookings
  const allBookings: Booking[] = useMemo(() => {
    if (isMock) return mockBookings;
    return rawBookings.map((b) => mapDbBookingToUi(b as never));
  }, [rawBookings]);

  // Filtered bookings
  const bookings: Booking[] = useMemo(() => {
    if (!filters?.status) return allBookings;
    return allBookings.filter((b) => b.status === filters.status);
  }, [allBookings, filters?.status]);

  // Derived booking subsets
  const pendingApprovals = useMemo(
    () => allBookings.filter((b) => b.status === 'pending'),
    [allBookings]
  );

  const activeUsage = useMemo(
    () => allBookings.filter((b) => b.status === 'active'),
    [allBookings]
  );

  const overdue = useMemo(
    () => allBookings.filter((b) => b.status === 'overdue'),
    [allBookings]
  );

  const history = useMemo(
    () => allBookings.filter((b) => b.status === 'completed' || b.status === 'cancelled'),
    [allBookings]
  );

  const getBookingById = useCallback(
    (id: string): Booking | undefined => {
      return allBookings.find((b) => b.id === id);
    },
    [allBookings]
  );

  // -------------------------------------------------------------------------
  // Waitlist query
  // -------------------------------------------------------------------------
  const { data: waitlist = [], refetch: refetchWaitlist } = useQuery<WaitlistEntryWithPosition[]>({
    queryKey: ['my_waitlist'],
    queryFn: async () => {
      if (isMock) return [];
      return await rpcMyWaitlist();
    },
    enabled: !isMock && role === 'user',
  });

  // -------------------------------------------------------------------------
  // Open released slots query
  // -------------------------------------------------------------------------
  const { data: releasedSlots = [], refetch: refetchSlots } = useQuery<ReleasedSlot[]>({
    queryKey: ['released_slots', profile?.institution_id],
    queryFn: async () => {
      if (isMock || !profile?.institution_id) return [];
      const { data, error } = await supabase
        .from('released_slots')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('status', 'open')
        .order('start_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isMock && !!profile?.institution_id,
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const requestBookingMutation = useMutation({
    mutationFn: rpcRequestBooking,
    onSuccess: (newBk) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(
        newBk.status === 'approved'
          ? 'Booking approved automatically!'
          : 'Booking submitted for review'
      );
    },
    onError: (err) => {
      toastError(err, 'Failed to submit booking request');
    },
  });

  const decideBookingMutation = useMutation({
    mutationFn: rpcDecideBooking,
    onSuccess: (_bk, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(vars.approve ? 'Booking approved' : 'Booking rejected');
    },
    onError: (err) => {
      toastError(err, 'Failed to update booking status');
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: rpcCancelBooking,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking cancelled');
    },
    onError: (err) => {
      toastError(err, 'Failed to cancel booking');
    },
  });

  const releaseBookingMutation = useMutation({
    mutationFn: rpcReleaseBooking,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['released_slots'] });
      toast.success('Slot released to campus community');
    },
    onError: (err) => {
      toastError(err, 'Failed to release booking slot');
    },
  });

  const claimSlotMutation = useMutation({
    mutationFn: rpcClaimReleasedSlot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['released_slots'] });
      toast.success('Released slot claimed successfully!');
    },
    onError: (err) => {
      toastError(err, 'Failed to claim released slot');
    },
  });

  const joinWaitlistMutation = useMutation({
    mutationFn: rpcJoinWaitlist,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my_waitlist'] });
      toast.success('Joined waitlist queue');
    },
    onError: (err) => {
      toastError(err, 'Failed to join waitlist');
    },
  });

  const leaveWaitlistMutation = useMutation({
    mutationFn: rpcLeaveWaitlist,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my_waitlist'] });
      toast.success('Left waitlist');
    },
    onError: (err) => {
      toastError(err, 'Failed to leave waitlist');
    },
  });

  return {
    bookings,
    allBookings,
    pendingApprovals,
    activeUsage,
    overdue,
    history,
    waitlist,
    releasedSlots,
    loading,
    error: queryError instanceof Error ? queryError.message : null,
    refetch: () => {
      void refetch();
      void refetchWaitlist();
      void refetchSlots();
    },
    getBookingById,
    // Mutations
    requestBooking: requestBookingMutation.mutateAsync,
    decideBooking: decideBookingMutation.mutateAsync,
    cancelBooking: cancelBookingMutation.mutateAsync,
    releaseBooking: releaseBookingMutation.mutateAsync,
    claimReleasedSlot: claimSlotMutation.mutateAsync,
    joinWaitlist: joinWaitlistMutation.mutateAsync,
    leaveWaitlist: leaveWaitlistMutation.mutateAsync,
  };
}
