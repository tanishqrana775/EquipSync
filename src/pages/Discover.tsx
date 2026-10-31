import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Building,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ResourceThumb } from '@/components/shared/ResourceThumb';
import { RequirementBadges } from '@/components/shared/RequirementBadges';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { UtilisationBar } from '@/components/shared/UtilisationBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useResources } from '@/hooks/useResources';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/providers/AuthProvider';
import { Resource } from '@/lib/types';
import { EquipSyncError } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

export function Discover() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [onlyEligible, setOnlyEligible] = useState<boolean>(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [requestedUnits, setRequestedUnits] = useState(1);

  // Booking modal state
  const [purpose, setPurpose] = useState('Academic research & project work');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 5, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [bookingState, setBookingState] = useState<'idle' | 'submitting' | 'slot_taken' | 'success'>('idle');

  const { resources, loading } = useResources({
    searchTerm,
    category: selectedCategory,
    availableOnly: onlyAvailable,
    eligibleOnly: onlyEligible,
  });

  const { requestBooking, joinWaitlist } = useBookings();
  const { isVerified, verifiedQualificationIds } = useAuth();

  const categories = [
    'All',
    'Laptops',
    'DSLR Cameras',
    'Lab Equipment',
    'Seminar Halls',
    'Projectors',
    'Classrooms',
    'Sports Equipment',
    'Academic Books',
  ];

  const filteredResources = resources;

  const handleReserve = async (res: Resource) => {
    try {
      setBookingState('submitting');
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate).toISOString();

      const newBk = await requestBooking({
        resourceId: res.id,
        start: startIso,
        end: endIso,
        purpose,
      });

      setBookingState('success');
      if (newBk.status === 'approved') {
        toast.success('Booking auto-approved! Ready for pickup.');
      } else {
        toast.success('Reservation requested! Queued for faculty approval.');
      }
      setTimeout(() => {
        setSelectedResource(null);
        setBookingState('idle');
      }, 1200);
    } catch (err) {
      if (err instanceof EquipSyncError && err.code === 'slot_taken') {
        setBookingState('slot_taken');
        toast.error('This time slot is already booked. You can join the priority waitlist.');
      } else {
        setBookingState('idle');
        toastError(err, 'Failed to reserve resource');
      }
    }
  };

  const handleJoinWaitlist = async () => {
    if (!selectedResource) return;
    try {
      await joinWaitlist({
        resourceId: selectedResource.id,
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
      });
      toast.success('You have been added to the waitlist queue!');
      setSelectedResource(null);
      setBookingState('idle');
    } catch (err) {
      toastError(err, 'Failed to join waitlist');
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resource Discovery"
        title="Campus Equipment Catalog"
        description="Search and reserve computing gear, studio cameras, precision lab instruments, and study spaces across university departments."
      />

      {/* Discovery Filter Controls */}
      <div className="surface p-4 rounded-2xl space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cameras, lab scopes, laptops, classrooms, or halls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs sm:text-sm h-10"
            />
          </div>

          <Button
            variant={onlyAvailable ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className="h-10 text-xs gap-1.5 font-semibold shrink-0"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Available Now Only</span>
          </Button>
        </div>

        {/* Categories Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 font-medium transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Cards Grid */}
      {filteredResources.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No resources found"
          description="Try broadening your search term or selecting 'All' categories to view all equipment."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setSelectedCategory('All');
            setOnlyAvailable(false);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => (
            <ResourceThumb
              key={resource.id}
              resource={resource}
              onClick={() => setSelectedResource(resource)}
            />
          ))}
        </div>
      )}

      {/* Resource Detail & Reservation Modal */}
      {selectedResource && (
        <Dialog
          open={!!selectedResource}
          onOpenChange={(open) => !open && setSelectedResource(null)}
        >
          <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-muted shrink-0">
              <img
                src={selectedResource.imageUrl}
                alt={selectedResource.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <StatusBadge status={selectedResource.status} />
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 pb-16">
              <div>
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary">
                  {selectedResource.category}
                </span>
                <DialogTitle className="text-2xl font-bold text-foreground mt-1">
                  {selectedResource.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {selectedResource.description}
                </DialogDescription>
              </div>

              {/* Location & Custodian */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Location</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    {selectedResource.location}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Custodian</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5 mt-1">
                    <Building className="h-4 w-4 text-emerald-600 shrink-0" />
                    {selectedResource.custodianName}
                  </span>
                </div>
              </div>

              {/* Requirements & Clearance */}
              <div className="space-y-2">
                <span className="text-sm font-semibold text-foreground block">
                  Access Requirements:
                </span>
                <RequirementBadges
                  requirements={selectedResource.requirements}
                  requiresApproval={selectedResource.requiresFacultyApproval}
                  depositRequired={selectedResource.depositRequired}
                />
              </div>

              {/* Technical Specifications */}
              <div className="space-y-2">
                <span className="text-sm font-semibold text-foreground block">
                  Specifications:
                </span>
                <div className="rounded-xl border border-border/80 divide-y divide-border/60 text-sm">
                  {Object.entries(selectedResource.specifications).map(([key, val]) => (
                    <div key={key} className="flex justify-between p-3">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>


              {/* Reservation Form */}
              <div className="space-y-5 pt-4 border-t border-border/60">
                <span className="text-sm font-bold text-foreground block">
                  Reserve Resource
                </span>

                {/* Availability status */}
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl border border-border/50">
                  <div>
                    <span className="text-muted-foreground block text-xs">Availability Status</span>
                    <div className="mt-1.5">
                      <StatusBadge status={selectedResource.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Available Stock</span>
                    <span className="font-bold text-foreground text-base mt-1 block">
                      {selectedResource.availableQuantity || 1} / {selectedResource.totalQuantity || 1} units
                    </span>
                  </div>
                </div>

                {selectedResource.status !== 'available' ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2.5">
                    <Info className="h-5 w-5 shrink-0" />
                    <span>This resource is currently unavailable ({selectedResource.status}). Reservations are disabled until it is returned or restocked.</span>
                  </div>
                ) : (
                  /* Reservation form wired to Backend */
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const date = formData.get('date') as string;
                      const startTime = formData.get('startTime') as string;
                      const endTime = formData.get('endTime') as string;
                      const purposeVal = (formData.get('purpose') as string) || 'Academic research & project work';
                      const supervisorVal = (formData.get('supervisorName') as string) || undefined;

                      if (!date || !startTime || !endTime) {
                        toast.error('Please fill in all fields');
                        return;
                      }

                      const startDateObj = new Date(`${date}T${startTime}`);
                      const endDateObj = new Date(`${date}T${endTime}`);

                      // Handle overnight reservation ranges
                      if (endDateObj <= startDateObj) {
                        endDateObj.setDate(endDateObj.getDate() + 1);
                      }

                      if (startDateObj < new Date()) {
                        toast.error('Invalid time selection', {
                          description: 'Start time cannot be in the past.',
                        });
                        return;
                      }

                      // Convert UI form times into ISO timestamps in user's LOCAL timezone
                      const startTimestamp = startDateObj.toISOString();
                      const endTimestamp = endDateObj.toISOString();

                      try {
                        const newBk = await requestBooking({
                          resourceId: selectedResource.id,
                          start: startTimestamp,
                          end: endTimestamp,
                          purpose: purposeVal,
                          supervisorName: supervisorVal,
                        });
                        
                        toast.success(
                          newBk.status === 'approved'
                            ? 'Reservation Approved! Ready for pickup.'
                            : 'Reservation request submitted for faculty review.'
                        );
                        setSelectedResource(null);
                      } catch (error: unknown) {
                        const isSlotTaken =
                          (error instanceof EquipSyncError && error.code === 'slot_taken') ||
                          (error instanceof Error && error.message.includes('slot_taken'));
                        if (isSlotTaken) {
                          toast.error('This time slot is already booked', {
                            action: {
                              label: 'Join Waitlist',
                              onClick: () => {
                                void joinWaitlist({
                                  resourceId: selectedResource.id,
                                  start: startTimestamp,
                                  end: endTimestamp,
                                });
                                setSelectedResource(null);
                              },
                            },
                          });
                        } else {
                          toastError(error, 'Failed to reserve resource');
                        }
                      }
                    }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1.5">Reservation Date</label>
                        <Input
                          type="date"
                          name="date"
                          required
                          className="w-full text-sm h-10 px-3"
                          defaultValue={new Date().toISOString().split('T')[0]}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1.5">Start Time</label>
                        <Input
                          type="time"
                          name="startTime"
                          required
                          className="w-full text-sm h-10 px-3"
                          defaultValue="09:00"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1.5">End Time</label>
                        <Input
                          type="time"
                          name="endTime"
                          required
                          className="w-full text-sm h-10 px-3"
                          defaultValue="17:00"
                        />
                      </div>
                    </div>

                    {selectedResource.requiresFacultyApproval && (
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1.5">
                          Supervisor Name (Required)
                        </label>
                        <Input
                          name="supervisorName"
                          placeholder="e.g. Dr. Aris Thorne"
                          required
                          className="w-full text-sm h-10 px-3"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1.5">Purpose / Coursework</label>
                      <Input
                        name="purpose"
                        placeholder="Academic coursework, project or research"
                        defaultValue="Academic research & project work"
                        className="w-full text-sm h-10 px-3"
                      />
                    </div>

                    {/* Note: Units left as UI element; ignored by backend unless added to schema later */}
                    <div className={selectedResource.availableQuantity ? "block" : "hidden"}>
                      <label className="text-xs font-semibold text-foreground block mb-1.5">Units Requested</label>
                      <Input
                        type="number"
                        name="units"
                        min="1"
                        max={selectedResource.availableQuantity || 1}
                        value={requestedUnits}
                        onChange={(e) => setRequestedUnits(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-sm h-10 px-3"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={() => setSelectedResource(null)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        size="default" 
                        className="gap-2 font-semibold px-5"
                      >
                        <Calendar className="h-4 w-4" />
                        <span>Submit Reservation Request</span>
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}