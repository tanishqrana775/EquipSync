/**
 * src/hooks/useBookings.ts
 * EquipSync – TanStack Query hook for bookings, waitlists, and slot releases.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { Booking } from '../lib/types';
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

export function useBookings(filters?: BookingFilters) {
  const queryClient = useQueryClient();
  const { role, profile, user } = useAuth();
  const institutionId = profile?.institution_id;
  const userId = user?.id;

  const isInstitutionView = filters?.institutionWide ?? role === 'institution';

  // Fetch bookings strictly scoped by tenant
  const {
    data: rawBookings = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['bookings', isInstitutionView ? 'institution' : 'user', institutionId, userId],
    queryFn: async () => {
      if (!institutionId) {
        return [];
      }

      let query = supabase
        .from('bookings')
        .select(`
          *,
          resources(name, kind, category, image_path),
          profiles(full_name, user_type, avatar_url)
        `)
        .eq('institution_id', institutionId);

      if (!isInstitutionView) {
        if (!userId) return [];
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('start_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!institutionId && (isInstitutionView || !!userId),
  });

  // Map to UI Bookings
  const allBookings: Booking[] = useMemo(() => {
    return rawBookings.map((b) => mapDbBookingToUi(b as never));
  }, [rawBookings]);

  // Filtered bookings
  const bookings: Booking[] = useMemo(() => {
    if (!filters?.status || filters.status === 'All') return allBookings;
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
  // Waitlist query (scoped to caller via definer RPC)
  // -------------------------------------------------------------------------
  const { data: waitlist = [], refetch: refetchWaitlist } = useQuery<WaitlistEntryWithPosition[]>({
    queryKey: ['my_waitlist', institutionId, userId],
    queryFn: async () => {
      if (!userId || !institutionId) return [];
      return await rpcMyWaitlist();
    },
    enabled: !!institutionId && !!userId && role === 'user',
  });

  // -------------------------------------------------------------------------
  // Open released slots query (scoped by institution_id)
  // -------------------------------------------------------------------------
  const { data: releasedSlots = [], refetch: refetchSlots } = useQuery<ReleasedSlot[]>({
    queryKey: ['released_slots', institutionId, userId],
    queryFn: async () => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from('released_slots')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'open')
        .order('start_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!institutionId,
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
          : 'Reservation submitted for review'
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
      toast.success('Slot released to organization members');
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
      toast.success('Joined priority waitlist queue');
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
    loading: institutionId ? loading : false,
    hasInstitution: !!institutionId,
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
