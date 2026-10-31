/**
 * src/hooks/useResources.ts
 * EquipSync – TanStack Query hook for resources and catalog management.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { Resource } from '../lib/types';
import { mapDbResourceToUi } from '../lib/api/mappers';
import { retireResourceRpc, reactivateResourceRpc } from '../lib/api/rpc';
import { toastError } from '../lib/errors';
import { toast } from 'sonner';
import type { Database } from '../lib/database.types';

export interface ResourceFilters {
  searchTerm?: string;
  category?: string;
  kind?: string;
  availableOnly?: boolean;
  eligibleOnly?: boolean;
}

export function useResources(filters?: ResourceFilters) {
  const queryClient = useQueryClient();
  const { profile, verifiedQualificationIds, user } = useAuth();
  const institutionId = profile?.institution_id;

  // Fetch full resource catalog scoped strictly to caller's institution
  const {
    data: rawResources = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['resources', institutionId, user?.id],
    queryFn: async () => {
      if (!institutionId) {
        return [];
      }
      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          eligibility_rules(*),
          resource_accessories(*),
          resource_availability_windows(*),
          resource_required_qualifications(
            qualification_id,
            qualifications(name)
          )
        `)
        .eq('institution_id', institutionId)
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!institutionId,
  });

  // Map to UI types
  const allResources: Resource[] = useMemo(() => {
    return rawResources.map((r) => mapDbResourceToUi(r as never));
  }, [rawResources]);

  // Client-side filtering & eligibility calculation
  const resources: Resource[] = useMemo(() => {
    return allResources.filter((r) => {
      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matches =
          r.title.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.location.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (filters?.category && filters.category !== 'All') {
        if (r.category !== filters.category) return false;
      }
      if (filters?.availableOnly && r.status !== 'available') {
        return false;
      }
      if (filters?.eligibleOnly && profile) {
        const raw = rawResources.find((rawR) => rawR.id === r.id);
        if (raw?.eligibility_rules) {
          const rules = raw.eligibility_rules;
          if (
            rules.allowed_user_types &&
            profile.user_type &&
            !rules.allowed_user_types.includes(profile.user_type)
          ) {
            return false;
          }
        }
        if (raw?.resource_required_qualifications) {
          const reqs = raw.resource_required_qualifications.map((rq) => rq.qualification_id);
          const hasAll = reqs.every((qId) => verifiedQualificationIds.includes(qId));
          if (!hasAll) return false;
        }
      }
      return true;
    });
  }, [allResources, rawResources, filters, profile, verifiedQualificationIds]);

  const getResourceById = useCallback(
    (id: string): Resource | undefined => {
      return allResources.find((r) => r.id === id);
    },
    [allResources]
  );

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  // Toggle availability (optimistic)
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const { error } = await supabase
        .from('resources')
        .update({ is_available: isAvailable })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: ['resources', institutionId, user?.id] });
      const previous = queryClient.getQueryData(['resources', institutionId, user?.id]);
      queryClient.setQueryData(['resources', institutionId, user?.id], (old: typeof rawResources = []) =>
        old.map((r) => (r.id === id ? { ...r, is_available: isAvailable } : r))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['resources', institutionId, user?.id], context.previous);
      }
      toastError(err, 'Failed to update resource availability');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources', institutionId, user?.id] });
      toast.success('Resource status updated');
    },
  });

  // Create resource
  const createResourceMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      kind: Database['public']['Enums']['resource_kind'];
      category?: string;
      description?: string;
      location?: string;
      asset_tag?: string;
      required_photo_slots?: string[];
      institutionId?: string;
      image_path?: string;
      id?: string;
    }) => {
      const targetInstId = input.institutionId || institutionId;
      if (!targetInstId) throw new Error('No organization associated with this user');

      const payload: Database['public']['Tables']['resources']['Insert'] = {
        institution_id: targetInstId,
        name: input.name,
        kind: input.kind,
        category: input.category || null,
        description: input.description || null,
        location: input.location || null,
        asset_tag: input.asset_tag || null,
        required_photo_slots: input.required_photo_slots || ['front', 'back', 'left', 'right'],
        image_path: input.image_path || null,
      };

      if (input.id) {
        payload.id = input.id;
      }

      const { data, error } = await supabase
        .from('resources')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource created successfully');
    },
    onError: (err) => {
      toastError(err, 'Failed to create resource');
    },
  });

  // Update resource
  const updateResourceMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Database['public']['Tables']['resources']['Update']> & { id: string }) => {
      const { data, error } = await supabase
        .from('resources')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource details saved');
    },
    onError: (err) => {
      toastError(err, 'Failed to update resource');
    },
  });

  // Retire resource via RPC
  const retireResourceMutation = useMutation({
    mutationFn: async (args: string | { id: string; reason?: string }) => {
      const id = typeof args === 'string' ? args : args.id;
      const reason = typeof args === 'string' ? undefined : args.reason;
      return await retireResourceRpc(id, reason);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource marked as retired');
    },
    onError: (err) => {
      toastError(err, 'Failed to retire resource');
    },
  });

  // Reactivate resource via RPC
  const reactivateResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await reactivateResourceRpc(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource reactivated successfully');
    },
    onError: (err) => {
      toastError(err, 'Failed to reactivate resource');
    },
  });

  // Save eligibility rules
  const saveEligibilityRulesMutation = useMutation({
    mutationFn: async ({
      resourceId,
      ...rules
    }: Partial<Database['public']['Tables']['eligibility_rules']['Insert']> & { resourceId: string }) => {
      const { error } = await supabase.from('eligibility_rules').upsert({
        resource_id: resourceId,
        ...rules,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Eligibility rules updated');
    },
    onError: (err) => {
      toastError(err, 'Failed to save eligibility rules');
    },
  });

  // Save accessories
  const saveAccessoriesMutation = useMutation({
    mutationFn: async ({
      resourceId,
      accessories,
    }: {
      resourceId: string;
      accessories: Array<{ name: string; required: boolean }>;
    }) => {
      await supabase.from('resource_accessories').delete().eq('resource_id', resourceId);
      if (accessories.length > 0) {
        const { error } = await supabase.from('resource_accessories').insert(
          accessories.map((a) => ({
            resource_id: resourceId,
            name: a.name,
            required: a.required,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Accessories updated');
    },
    onError: (err) => {
      toastError(err, 'Failed to save accessories');
    },
  });

  // Save availability windows
  const saveAvailabilityWindowsMutation = useMutation({
    mutationFn: async ({
      resourceId,
      windows,
    }: {
      resourceId: string;
      windows: Array<{ weekday: number; start_time: string; end_time: string }>;
    }) => {
      await supabase.from('resource_availability_windows').delete().eq('resource_id', resourceId);
      if (windows.length > 0) {
        const { error } = await supabase.from('resource_availability_windows').insert(
          windows.map((w) => ({
            resource_id: resourceId,
            weekday: w.weekday,
            start_time: w.start_time,
            end_time: w.end_time,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Availability windows updated');
    },
    onError: (err) => {
      toastError(err, 'Failed to save availability windows');
    },
  });

  // Upload resource image: '<institution_id>/<resource_id>/<filename>'
  const uploadResourceImage = useCallback(
    async (resourceId: string, file: File): Promise<string> => {
      if (!institutionId) throw new Error('No organization ID found');
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${institutionId}/${resourceId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from('resource-images').upload(path, file, {
        upsert: true,
      });
      if (error) throw error;

      await updateResourceMutation.mutateAsync({ id: resourceId, image_path: path });
      return path;
    },
    [institutionId, updateResourceMutation]
  );

  // Upload evidence: '<institution_id>/<resource_id>/<filename>'
  const uploadEvidence = useCallback(
    async (resourceId: string, file: File, note?: string): Promise<string> => {
      if (!institutionId) throw new Error('No organization ID found');
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${institutionId}/${resourceId}/evidence_${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from('resource-evidence').upload(path, file, {
        upsert: false,
      });
      if (error) throw error;

      await supabase.from('resource_evidence').insert({
        resource_id: resourceId,
        storage_path: path,
        note: note || null,
        uploaded_by: user.id,
      });

      toast.success('Compliance evidence uploaded');
      return path;
    },
    [institutionId, user.id]
  );

  return {
    resources,
    loading: institutionId ? loading : false,
    hasInstitution: !!institutionId,
    error: queryError instanceof Error ? queryError.message : null,
    refetch,
    getResourceById,
    // Mutations
    createResource: createResourceMutation.mutateAsync,
    updateResource: updateResourceMutation.mutateAsync,
    toggleAvailability: (id: string, isAvailable: boolean) =>
      toggleAvailabilityMutation.mutateAsync({ id, isAvailable }),
    retireResource: retireResourceMutation.mutateAsync,
    reactivateResource: reactivateResourceMutation.mutateAsync,
    saveEligibilityRules: saveEligibilityRulesMutation.mutateAsync,
    saveAccessories: saveAccessoriesMutation.mutateAsync,
    saveAvailabilityWindows: saveAvailabilityWindowsMutation.mutateAsync,
    uploadResourceImage,
    uploadEvidence,
  };
}
