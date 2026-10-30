import { useState, useEffect, useCallback } from 'react';
import { Booking } from '../lib/types';
import { mockBookings } from '../lib/mock/bookings';

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      setBookings(mockBookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const getBookingById = useCallback(
    (id: string): Booking | undefined => {
      return bookings.find((b) => b.id === id);
    },
    [bookings]
  );

  return {
    bookings,
    loading,
    error,
    refetch: fetchBookings,
    getBookingById,
  };
}
