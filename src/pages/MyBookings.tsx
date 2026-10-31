import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Calendar,
  Clock,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { useBookings } from '@/hooks/useBookings';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function MyBookings() {
  const { bookings, cancelBooking, loading } = useBookings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch = b.resourceTitle.toLowerCase().includes(searchTerm.toLowerCase()) || b.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => ['approved', 'active'].includes(b.status)).length,
    rejected: bookings.filter(b => b.status === 'cancelled').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  }), [bookings]);

  const handleCancel = async (id: string) => {
    try {
      await cancelBooking(id);
    } catch {
      // Handled in hook
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Bookings"
        title="Reservation Management"
        description="View your active custody passes, track reservation status, and manage upcoming asset returns."
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Pending', value: stats.pending },
          { label: 'Approved', value: stats.approved },
          { label: 'Rejected', value: stats.rejected },
          { label: 'Completed', value: stats.completed },
        ].map(stat => (
          <div key={stat.label} className="surface p-4 rounded-xl">
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="surface p-4 rounded-2xl flex gap-3">
        <Input
          placeholder="Search bookings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <select
          className="bg-background border rounded-lg px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No bookings found"
          description="You don't have any bookings matching your filters."
          actionLabel="Explore Resources"
          onAction={() => window.location.href = '/app/discover'}
        />
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map(b => (
            <div key={b.id} className="surface p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src={b.resourceImage} alt={b.resourceTitle} className="h-16 w-16 rounded-lg object-cover" />
                <div>
                  <h4 className="font-bold text-sm">{b.resourceTitle}</h4>
                  <p className="text-xs text-muted-foreground">ID: {b.id} • {new Date(b.startTime).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={b.status} />
                {(b.status === 'pending' || b.status === 'approved') && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">Cancel</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleCancel(b.id)}>Confirm Cancellation</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Link to={`/app/bookings/${b.id}`}>
                  <Button variant="outline" size="sm">Details</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
