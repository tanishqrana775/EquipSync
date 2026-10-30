/**
 * src/hooks/useInstitutionStats.ts
 * CampusShare – TanStack Query hook for administrative statistics, fleet utilisation & audit logs.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { DashboardStats, ActivityItem } from '../lib/types';
import { mockInstitutionStats, mockActivities } from '../lib/mock/activity';
import { institutionStats as rpcInstitutionStats, verifyMember as rpcVerifyMember } from '../lib/api/rpc';
import { mapDbAuditLogToActivity } from '../lib/api/mappers';
import { toastError } from '../lib/errors';
import { toast } from 'sonner';
import type { Database } from '../lib/database.types';

const isMock = import.meta.env.VITE_USE_MOCKS === 'true';

export interface UtilisationRow {
  resource_id: string;
  resource_name?: string;
  institution_id: string;
  booked_minutes_30d: number;
  available_minutes_30d: number;
  utilisation_pct: number;
  is_underutilised: boolean;
}

export function useInstitutionStats() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const institutionId = profile?.institution_id;

  // 1. Institution Stats RPC
  const {
    data: rpcStats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['institution_stats', institutionId],
    queryFn: async () => {
      if (isMock || !institutionId) return null;
      return await rpcInstitutionStats(institutionId);
    },
    enabled: !isMock && !!institutionId,
  });

  // 2. Resource Utilisation View
  const {
    data: utilisation = [],
    isLoading: utilLoading,
    refetch: refetchUtil,
  } = useQuery<UtilisationRow[]>({
    queryKey: ['resource_utilisation', institutionId],
    queryFn: async () => {
      if (isMock || !institutionId) return [];
      const { data, error } = await supabase
        .from('resource_utilisation')
        .select(`
          resource_id,
          institution_id,
          booked_minutes_30d,
          available_minutes_30d,
          utilisation_pct,
          is_underutilised
        `)
        .eq('institution_id', institutionId);

      if (error) throw error;
      return (data as UtilisationRow[]) ?? [];
    },
    enabled: !isMock && !!institutionId,
  });

  // 3. Pending Verification Members
  const {
    data: pendingMembers = [],
    isLoading: membersLoading,
    refetch: refetchMembers,
  } = useQuery<Database['public']['Tables']['profiles']['Row'][]>({
    queryKey: ['pending_members', institutionId],
    queryFn: async () => {
      if (isMock || !institutionId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !isMock && !!institutionId,
  });

  // 4. Recent Audit Log (Activity Feed)
  const {
    data: rawAuditLogs = [],
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['recent_audit_log', institutionId],
    queryFn: async () => {
      if (isMock || !institutionId) return [];
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !isMock && !!institutionId,
  });

  // Map to UI ActivityItem
  const activity: ActivityItem[] = useMemo(() => {
    if (isMock) return mockActivities;
    return rawAuditLogs.map(mapDbAuditLogToActivity);
  }, [rawAuditLogs]);

  // Derived underutilised list (< 30% utilization)
  const underutilised = useMemo(() => {
    return utilisation.filter((u) => u.is_underutilised);
  }, [utilisation]);

  // Map to UI DashboardStats shape expected by components
  const stats: DashboardStats = useMemo(() => {
    if (isMock || !rpcStats) return mockInstitutionStats;
    const total = rpcStats.total_resources || 0;
    const inUse = rpcStats.in_use_now || 0;
    const avail = Math.max(0, total - inUse);
    const avgUtil =
      utilisation.length > 0
        ? Math.round(
            utilisation.reduce((acc, curr) => acc + (curr.utilisation_pct || 0), 0) /
              utilisation.length
          )
        : total > 0
        ? Math.round((inUse / total) * 100)
        : 0;

    return {
      totalResources: total,
      activeBookings: inUse,
      availableResources: avail,
      utilisationRate: avgUtil,
      pendingApprovals: rpcStats.pending_approvals || 0,
      overdueReturns: 0,
    };
  }, [rpcStats, utilisation]);

  // Verify Member mutation
  const verifyMemberMutation = useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      return await rpcVerifyMember({ userId, approve });
    },
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['pending_members', institutionId] });
      toast.success(vars.approve ? 'Member account verified' : 'Member verification rejected');
    },
    onError: (err) => {
      toastError(err, 'Failed to update member status');
    },
  });

  const refetch = async () => {
    await Promise.all([refetchStats(), refetchUtil(), refetchMembers(), refetchAudit()]);
  };

  const loading = isMock ? false : statsLoading || utilLoading || membersLoading || auditLoading;

  return {
    stats,
    rawStats: rpcStats,
    utilisation,
    underutilised,
    pendingMembers,
    activity,
    loading,
    error: statsError instanceof Error ? statsError.message : null,
    refetch,
    verifyMember: (userId: string, approve: boolean) =>
      verifyMemberMutation.mutateAsync({ userId, approve }),
  };
}
