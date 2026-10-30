import { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { UtilisationBar } from '@/components/shared/UtilisationBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResources } from '@/hooks/useResources';
import { Resource, ResourceCategory } from '@/lib/types';

export function ResourceManagement() {
  const { resources } = useResources();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const categories = ['All', 'Laptops', 'DSLR Cameras', 'Lab Equipment', 'Seminar Halls', 'Projectors', 'Classrooms', 'Sports Equipment', 'Academic Books'];

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesSearch =
        res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.tagId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.ownerDepartment.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' || res.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [resources, searchTerm, selectedCategory]);

  const columns: ColumnDef<Resource>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-3 h-8 text-xs font-semibold"
        >
          Resource & Tag
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-3 max-w-[280px]">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
            />
            <div className="truncate">
              <span className="font-semibold text-foreground text-xs truncate block">
                {item.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                {item.tagId} • {item.building}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-foreground">
          {row.original.category}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'availableQuantity',
      header: 'Availability',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="text-xs font-semibold text-foreground">
            {r.availableQuantity} / {r.totalQuantity} units
          </span>
        );
      },
    },
    {
      accessorKey: 'utilisationRate',
      header: 'Utilisation',
      cell: ({ row }) => (
        <div className="w-28">
          <UtilisationBar percentage={row.original.utilisationRate} />
        </div>
      ),
    },
    {
      accessorKey: 'condition',
      header: 'Condition',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] capitalize font-medium">
          {row.original.condition}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
              <DropdownMenuItem className="text-xs cursor-pointer">
                View Inspection Log
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer">
                Edit Specifications
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer text-destructive">
                Mark Maintenance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Asset Management"
        title="Resource Inventory"
        description="Comprehensive campus registry of shared electronics, optics, audio-visual kits, and instructional spaces."
      >
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 font-semibold shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Register New Asset</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Register Campus Resource
              </DialogTitle>
              <DialogDescription className="text-xs">
                Asset will be cataloged and made visible to eligible department students.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Asset Title</label>
                <Input placeholder="e.g. Panasonic Lumix GH6 Filmmaker Kit" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Category</label>
                  <Input placeholder="DSLR Cameras" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Tag ID</label>
                  <Input placeholder="MED-CAM-019" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Location / Room</label>
                <Input placeholder="Media Arts Center, Locker #4" />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setAddDialogOpen(false)}
                className="font-semibold"
              >
                Save to Registry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="surface p-4 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by asset title, tag ID, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="text-muted-foreground flex items-center gap-1 font-semibold pr-1 shrink-0">
            <Filter className="h-3 w-3" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 font-medium transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* TanStack Data Table */}
      <DataTable
        columns={columns}
        data={filteredResources}
        pageSize={8}
        emptyMessage="No campus resources matched your filter criteria."
      />
    </div>
  );
}
