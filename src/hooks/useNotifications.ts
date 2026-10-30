/**
 * src/hooks/useNotifications.ts
 * CampusShare – TanStack Query hook with realtime updates for campus notifications.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { NotificationItem } from '../lib/types';
import { mockNotifications } from '../lib/mock/activity';
import { mapDbNotificationToUi } from '../lib/api/mappers';
import { subscribeToNotifications, subscribeToBookings } from '../lib/api/rpc';
import { toastError } from '../lib/errors';
import { toast } from 'sonner';

const isMock = import.meta.env.VITE_USE_MOCKS === 'true';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const {
    data: rawNotifications = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (isMock || !user?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !isMock && !!user?.id,
  });

  const notifications: NotificationItem[] = useMemo(() => {
    if (isMock) return mockNotifications;
    return rawNotifications.map(mapDbNotificationToUi);
  }, [rawNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Realtime subscription
  useEffect(() => {
    if (isMock || !user?.id) return;

    // Listen to new notifications
    const unsubNotif = subscribeToNotifications(user.id, (notif) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      toast.info(notif.title, {
        description: notif.body,
      });
    });

    // Listen to booking changes for this user or institution
    const filter =
      profile?.role === 'institution_admin' && profile.institution_id
        ? { kind: 'institution' as const, institutionId: profile.institution_id }
        : { kind: 'user' as const, userId: user.id };

    const unsubBooking = subscribeToBookings(filter, () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['custody_booking'] });
    });

    return () => {
      unsubNotif();
      unsubBooking();
    };
  }, [user?.id, profile?.role, profile?.institution_id, queryClient]);

  // Mark single as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isMock) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: (err) => {
      toastError(err, 'Failed to update notification');
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (isMock || !user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
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
    loading,
    error: queryError instanceof Error ? queryError.message : null,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
