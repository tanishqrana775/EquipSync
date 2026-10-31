/**
 * src/hooks/useCustody.ts
 * EquipSync – TanStack Query hook for custody tracking, inspections & verification.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { CustodyRecord } from '../lib/types';
import { buildCustodyRecordFromBooking } from '../lib/api/mappers';
import {
  getCustodyTimeline,
  inspectReturn as rpcInspectReturn,
  reportIncident as rpcReportIncident,
  resolveDispute as rpcResolveDispute,
  CustodyTimelineItem,
  IncidentSeverity,
} from '../lib/api/rpc';
import {
  submitCheckOut as orchSubmitCheckOut,
  submitCheckIn as orchSubmitCheckIn,
  getSignedPhotoUrls,
  CustodyPhotoInput,
  AccessoryCheckInput,
} from '../lib/custody';
import { toastError } from '../lib/errors';
import { toast } from 'sonner';
import type { Database } from '../lib/database.types';

export function useCustody(bookingId?: string) {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const institutionId = profile?.institution_id;
  const userId = user?.id;

  // Load booking with resource and borrower
  const {
    data: bookingData,
    isLoading: bookingLoading,
    error: bookingError,
    refetch: refetchBooking,
  } = useQuery({
    queryKey: ['custody_booking', bookingId, institutionId, userId],
    queryFn: async () => {
      if (!bookingId) return null;
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          resources(
            id, name, kind, category, image_path, required_photo_slots, qr_identifier,
            resource_accessories(id, name, required)
          ),
          profiles(id, full_name, user_type, avatar_url)
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId,
  });

  // Load custody events
  const { data: events = [] } = useQuery({
    queryKey: ['custody_events', bookingId, institutionId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('custody_events')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!bookingId,
  });

  // Load custody photos
  const { data: photos = [] } = useQuery({
    queryKey: ['custody_photos', bookingId, institutionId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('custody_photos')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!bookingId,
  });

  // Fetch signed URLs for custody photos
  const { data: signedUrls = {} } = useQuery<Record<string, string>>({
    queryKey: ['custody_signed_urls', bookingId, photos],
    queryFn: async () => {
      if (photos.length === 0) return {};
      const paths = photos.map((p) => p.storage_path);
      return await getSignedPhotoUrls(paths, 3600);
    },
    enabled: photos.length > 0,
    staleTime: 1000 * 60 * 30, // 30 mins
  });

  // Load incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ['custody_incidents', bookingId, institutionId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!bookingId,
  });

  // Load timeline via definer RPC
  const { data: timeline = [] } = useQuery<CustodyTimelineItem[]>({
    queryKey: ['custody_timeline', bookingId, institutionId],
    queryFn: async () => {
      if (!bookingId) return [];
      return await getCustodyTimeline(bookingId);
    },
    enabled: !!bookingId,
  });

  // Map to CustodyRecord for backward compatibility with UI
  const custody: CustodyRecord | null = useMemo(() => {
    if (!bookingData) return null;
    return buildCustodyRecordFromBooking(bookingData as never, timeline as never);
  }, [bookingData, timeline]);

  // Derived metadata from resource
  const requiredPhotoSlots: string[] = useMemo(() => {
    if (bookingData?.resources?.required_photo_slots) {
      return bookingData.resources.required_photo_slots;
    }
    return ['front', 'back', 'left', 'right'];
  }, [bookingData]);

  const accessories = useMemo(() => {
    return bookingData?.resources?.resource_accessories ?? [];
  }, [bookingData]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const checkOutMutation = useMutation({
    mutationFn: async (args: {
      photos: CustodyPhotoInput[];
      condition: Database['public']['Enums']['condition_rating'];
      notes: string;
      accessoryChecks?: AccessoryCheckInput[];
      qrIdentifier: string;
      onProgress?: (slot: string, pct: number) => void;
    }) => {
      if (!bookingData) throw new Error('Booking record not loaded');
      return await orchSubmitCheckOut({
        institutionId: bookingData.institution_id,
        bookingId: bookingData.id,
        photos: args.photos,
        requiredSlots: requiredPhotoSlots,
        condition: args.condition,
        notes: args.notes,
        accessoryChecks: args.accessoryChecks,
        qrIdentifier: args.qrIdentifier,
        onPhotoProgress: args.onProgress,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custody_booking', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_photos', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_events', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_timeline', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Check-out completed! Equipment custody transferred.');
    },
    onError: (err) => {
      toastError(err, 'Check-out failed');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (args: {
      photos: CustodyPhotoInput[];
      condition: Database['public']['Enums']['condition_rating'];
      notes: string;
      accessoryChecks?: AccessoryCheckInput[];
      qrIdentifier: string;
      onProgress?: (slot: string, pct: number) => void;
    }) => {
      if (!bookingData) throw new Error('Booking record not loaded');
      return await orchSubmitCheckIn({
        institutionId: bookingData.institution_id,
        bookingId: bookingData.id,
        photos: args.photos,
        requiredSlots: requiredPhotoSlots,
        condition: args.condition,
        notes: args.notes,
        accessoryChecks: args.accessoryChecks,
        qrIdentifier: args.qrIdentifier,
        onPhotoProgress: args.onProgress,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custody_booking', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_photos', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_events', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_timeline', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_incidents', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Check-in submitted! Awaiting administrator return inspection.');
    },
    onError: (err) => {
      toastError(err, 'Check-in failed');
    },
  });

  const inspectReturnMutation = useMutation({
    mutationFn: async (args: {
      condition: Database['public']['Enums']['condition_rating'];
      accessoryChecks?: AccessoryCheckInput[];
      notes?: string;
    }) => {
      if (!bookingId) throw new Error('No booking specified');
      return await rpcInspectReturn({
        bookingId,
        condition: args.condition,
        accessoryChecks: args.accessoryChecks,
        notes: args.notes,
      });
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['custody_booking', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_events', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_timeline', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(
        res.status === 'closed'
          ? 'Return accepted and booking closed'
          : 'Return disputed and incident opened'
      );
    },
    onError: (err) => {
      toastError(err, 'Failed to inspect return');
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async (args: {
      resolution: 'borrower_responsible' | 'no_fault' | 'shared_responsibility';
      notes: string;
    }) => {
      if (!bookingId) throw new Error('No booking specified');
      return await rpcResolveDispute({
        bookingId,
        resolution: args.resolution,
        notes: args.notes,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custody_booking', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_timeline', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Dispute resolved and booking closed.');
    },
    onError: (err) => {
      toastError(err, 'Failed to resolve dispute');
    },
  });

  const reportIncidentMutation = useMutation({
    mutationFn: async (args: {
      severity: IncidentSeverity;
      type: 'damage' | 'missing_accessory' | 'other';
      description: string;
    }) => {
      if (!bookingId) throw new Error('No booking specified');
      return await rpcReportIncident({
        bookingId,
        severity: args.severity,
        type: args.type,
        description: args.description,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custody_incidents', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['custody_timeline', bookingId] });
      toast.success('Incident report submitted to department administrator');
    },
    onError: (err) => {
      toastError(err, 'Failed to submit incident report');
    },
  });

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchBooking(),
      queryClient.invalidateQueries({ queryKey: ['custody_events', bookingId] }),
      queryClient.invalidateQueries({ queryKey: ['custody_photos', bookingId] }),
      queryClient.invalidateQueries({ queryKey: ['custody_timeline', bookingId] }),
    ]);
  }, [bookingId, queryClient, refetchBooking]);

  return {
    custody,
    booking: bookingData,
    requiredPhotoSlots,
    accessories,
    photos,
    signedPhotoUrls: signedUrls,
    events,
    incidents,
    timeline,
    loading: bookingLoading,
    error: bookingError instanceof Error ? bookingError.message : null,
    refetch,
    // Mutations
    submitCheckOut: checkOutMutation.mutateAsync,
    submitCheckIn: checkInMutation.mutateAsync,
    inspectReturn: inspectReturnMutation.mutateAsync,
    resolveDispute: resolveDisputeMutation.mutateAsync,
    reportIncident: reportIncidentMutation.mutateAsync,
  };
}
