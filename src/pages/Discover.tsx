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
import { Resource } from '@/lib/types';
import { toast } from 'sonner';

export function Discover() {
  const { resources, loading } = useResources();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

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

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesSearch =
        res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' || res.category === selectedCategory;
      const matchesAvailable = !onlyAvailable || res.status === 'available';

      return matchesSearch && matchesCategory && matchesAvailable;
    });
  }, [resources, searchTerm, selectedCategory, onlyAvailable]);

  const handleReserveDemo = (res: Resource) => {
    toast.success(`Reservation submitted for ${res.title}`, {
      description: 'Your booking has been queued for faculty review.',
    });
    setSelectedResource(null);
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
          <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-2xl">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img
                src={selectedResource.imageUrl}
                alt={selectedResource.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <StatusBadge status={selectedResource.status} />
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {selectedResource.category}
                </span>
                <DialogTitle className="text-xl font-bold text-foreground mt-0.5">
                  {selectedResource.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {selectedResource.description}
                </DialogDescription>
              </div>

              {/* Location & Custodian */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Location</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-primary" />
                    {selectedResource.location}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Custodian</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <Building className="h-3 w-3 text-emerald-600" />
                    {selectedResource.custodianName}
                  </span>
                </div>
              </div>

              {/* Requirements & Clearance */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Access Requirements:
                </span>
                <RequirementBadges
                  requirements={selectedResource.requirements}
                  requiresApproval={selectedResource.requiresFacultyApproval}
                  depositRequired={selectedResource.depositRequired}
                />
              </div>

              {/* Technical Specifications */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Specifications:
                </span>
                <div className="rounded-xl border border-border/80 divide-y divide-border/60 text-xs">
                  {Object.entries(selectedResource.specifications).map(([key, val]) => (
                    <div key={key} className="flex justify-between p-2">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 pt-0 gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedResource(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => handleReserveDemo(selectedResource)}
                className="font-semibold gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Reserve for Checkout</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
