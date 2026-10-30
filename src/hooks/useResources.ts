import { useState, useEffect, useCallback } from 'react';
import { Resource } from '../lib/types';
import { mockResources } from '../lib/mock/resources';

export function useResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate network latency (250ms)
      await new Promise((resolve) => setTimeout(resolve, 250));
      setResources(mockResources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const getResourceById = useCallback(
    (id: string): Resource | undefined => {
      return resources.find((r) => r.id === id);
    },
    [resources]
  );

  return {
    resources,
    loading,
    error,
    refetch: fetchResources,
    getResourceById,
  };
}
