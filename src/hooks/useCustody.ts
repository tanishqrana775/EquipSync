import { useState, useEffect, useCallback } from 'react';
import { CustodyRecord } from '../lib/types';
import { mockCustodyRecords } from '../lib/mock/custody';

export function useCustody(id?: string) {
  const [custody, setCustody] = useState<CustodyRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustody = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!id) {
        // Return first default mock record if no id provided
        const defaultKey = Object.keys(mockCustodyRecords)[0];
        setCustody(mockCustodyRecords[defaultKey]);
        return;
      }

      // Match by custody record id or booking id
      const matched =
        mockCustodyRecords[id] ||
        Object.values(mockCustodyRecords).find((r) => r.bookingId === id);

      if (matched) {
        setCustody(matched);
      } else {
        // Fallback to first record for seamless demo preview
        setCustody(mockCustodyRecords['cust-rec-001']);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chain of custody');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustody();
  }, [fetchCustody]);

  return {
    custody,
    loading,
    error,
    refetch: fetchCustody,
  };
}
