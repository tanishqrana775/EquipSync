/**
 * src/hooks/useNotifications.ts
 * EquipSync – TanStack Query hook with tenant-scoped realtime notifications.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { NotificationItem } from '../lib/types';
import { mapDbNotificationToUi } from '../lib/api/mappers';
import { subscribeToNotifications, subscribeToBookings } from '../lib/api/rpc';
import { toastError } from '../lib/errors';
import { toast } from 'sonner';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const institutionId = profile?.institution_id;

  const {
    data: rawNotifications = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['notifications', institutionId, userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const notifications: NotificationItem[] = useMemo(() => {
    return rawNotifications.map(mapDbNotificationToUi);
  }, [rawNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Realtime subscription strictly filtered by authenticated user and tenant
  useEffect(() => {
    if (!userId) return;

    // Listen to new notifications for this user
    const unsubNotif = subscribeToNotifications(userId, (notif) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', institutionId, userId] });
      toast.info(notif.title, {
        description: notif.body,
      });
    });

    // Listen to booking changes for this user or institution
    const filter =
      profile?.role === 'institution_admin' && institutionId
        ? { kind: 'institution' as const, institutionId }
        : { kind: 'user' as const, userId };

    const unsubBooking = subscribeToBookings(filter, () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['custody_booking'] });
    });

    return () => {
      unsubNotif();
      unsubBooking();
    };
  }, [userId, profile?.role, institutionId, queryClient]);

  // Mark single as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', institutionId, userId] });
    },
    onError: (err) => {
      toastError(err, 'Failed to update notification');
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', institutionId, userId] });
      toast.success('All notifications marked as read');
    },
    onError: (err) => {
      toastError(err, 'Failed to mark notifications as read');
    },
  });

  const markAsRead = useCallback(
    (id: string) => {
      void markAsReadMutation.mutateAsync(id);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    void markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

  return {
    notifications,
    unreadCount,
    loading: userId ? loading : false,
    error: queryError instanceof Error ? queryError.message : null,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
