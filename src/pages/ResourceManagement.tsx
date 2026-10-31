/**
 * src/pages/ResourceManagement.tsx
 * EquipSync – Equipment & Space Inventory Management.
 * Includes lifecycle action menus by status, automated EQP- Tag ID generation,
 * dynamic category Combobox with ensure_category RPC, and centered print portal.
 */

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  MoreHorizontal,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  RotateCcw,
  Edit2,
  Wrench,
  ChevronsUpDown,
  Upload,
  X,
  QrCode,
  Printer,
  Download,
  RefreshCw,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import { useResources } from '@/hooks/useResources';
import { useAuth } from '@/providers/AuthProvider';
import { compressImage } from '@/lib/custody';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { regenerateResourceQr, ensureCategory } from '@/lib/api/rpc';
import { Resource } from '@/lib/types';
import '@/styles/print.css';

const PRESET_CATEGORIES = [
  'Laptops',
  'DSLR Cameras',
  'Lab Equipment',
  'Seminar Halls',
  'Projectors',
  'Classrooms',
  'Sports Equipment',
  'Academic Books',
];

function generateAssetTag(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[randomBytes[i] % 32];
  }
  return `EQP-${suffix}`;
}

export function ResourceManagement() {
  const {
    resources,
    loading,
    createResource,
    updateResource,
    toggleAvailability,
    retireResource,
    reactivateResource,
  } = useResources();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // New asset form inputs
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Lab Equipment');
  const [newTagId, setNewTagId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Combobox state for add dialog
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

  // Modals state
  const [qrModalResource, setQrModalResource] = useState<Resource | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [retireModalResource, setRetireModalResource] = useState<Resource | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [isRetiring, setIsRetiring] = useState(false);

  const [reactivateModalResource, setReactivateModalResource] = useState<Resource | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  const [editModalResource, setEditModalResource] = useState<Resource | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Query tenant custom categories
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['resource_categories', profile?.institution_id],
    queryFn: async () => {
      if (!profile?.institution_id) return [];
      const { data, error } = await supabase
        .from('resource_categories')
        .select('name')
        .order('name');
      if (error) throw error;
      return data.map((d) => d.name);
    },
    enabled: !!profile?.institution_id,
  });

  // Dynamic categories with counts from tenant data
  const dynamicCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of resources) {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
    }
    for (const c of dbCategories) {
      if (!(c in counts)) counts[c] = 0;
    }
    const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return [
      { name: 'All', count: resources.length },
      ...sorted.map((name) => ({ name, count: counts[name] })),
    ];
  }, [resources, dbCategories]);

  // Combined list for the Category Combobox
  const customCategoriesList = useMemo(() => {
    const set = new Set<string>();
    for (const c of dbCategories) {
      if (!PRESET_CATEGORIES.some((p) => p.toLowerCase() === c.toLowerCase())) {
        set.add(c);
      }
    }
    for (const r of resources) {
      if (r.category && !PRESET_CATEGORIES.some((p) => p.toLowerCase() === r.category.toLowerCase())) {
        set.add(r.category);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dbCategories, resources]);

  const handleImageSelect = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5 MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const openAddDialog = () => {
    setNewTitle('');
    setNewCategory('Lab Equipment');
    setNewTagId(generateAssetTag());
    setNewLocation('');
    setNewDescription('');
    setImageFile(null);
    setImagePreview(null);
    setCategoryQuery('');
    setAddDialogOpen(true);
  };

  const handleCreateAsset = async () => {
    if (!newTitle.trim()) {
      toast.error('Please enter an asset title');
      return;
    }
    try {
      setIsCreating(true);
      const newResourceId = crypto.randomUUID();
      let storagePath: string | undefined = undefined;

      if (imageFile && profile?.institution_id) {
        const compressedBlob = await compressImage(imageFile, 1200, 0.85);
        const fileId = crypto.randomUUID();
        storagePath = `${profile.institution_id}/${newResourceId}/${fileId}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('resource-images')
          .upload(storagePath, compressedBlob, { contentType: 'image/jpeg', upsert: true });
        if (upErr) throw upErr;
      }

      // Retry up to 3 times on tag collision
      let created = false;
      let currentTag = newTagId || generateAssetTag();
      let attempts = 0;

      while (!created && attempts < 3) {
        try {
          await createResource({
            id: newResourceId,
            name: newTitle.trim(),
            kind: 'equipment',
            category: newCategory,
            asset_tag: currentTag,
            location: newLocation.trim() || undefined,
            description: newDescription.trim() || undefined,
            image_path: storagePath,
          });
          created = true;
        } catch (err: unknown) {
          const msg = String(err && typeof err === 'object' && 'message' in err ? (err as { message?: unknown }).message : err);
          if ((msg.includes('duplicate') || msg.includes('unique') || msg.includes('asset_tag')) && attempts < 2) {
            attempts++;
            currentTag = generateAssetTag();
            setNewTagId(currentTag);
            continue;
          }
          throw err;
        }
      }

      setAddDialogOpen(false);
      toast.success('Resource created successfully');
    } catch (err: unknown) {
      toastError(err, 'Failed to create resource');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (res: Resource) => {
    setEditModalResource(res);
    setEditTitle(res.title);
    setEditCategory(res.category);
    setEditLocation(res.location === '-' ? '' : res.location);
    setEditDescription(res.description === '-' ? '' : res.description);
  };

  const handleSaveEdit = async () => {
    if (!editModalResource) return;
    try {
      setIsSavingEdit(true);
      const isRetired = editModalResource.status === 'retired';
      await updateResource({
        id: editModalResource.id,
        name: isRetired ? undefined : editTitle.trim(),
        category: isRetired ? undefined : editCategory.trim(),
        location: isRetired ? undefined : editLocation.trim(),
        description: editDescription.trim(),
      });
      setEditModalResource(null);
      toast.success('Resource details saved');
    } catch (err: unknown) {
      toastError(err, 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesSearch =
        res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.tagId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' ||
        res.category.toLowerCase() === selectedCategory.toLowerCase();
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
        if (row.original.status === 'retired') {
          return <span className="text-xs font-medium text-muted-foreground">Retired</span>;
        }
        return (
          <span className="text-xs font-semibold text-foreground">
            {row.original.status === 'available' ? 'Available' : 'Unavailable'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const res = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>

              {/* ACTIVE actions */}
              {res.status !== 'retired' && res.status !== 'maintenance' && (
                <>
                  <DropdownMenuItem
                    onClick={() => openEditDialog(res)}
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleAvailability(res.id, !(res.is_available ?? res.availableQuantity > 0))}
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{(res.is_available ?? res.availableQuantity > 0) ? 'Mark Unavailable' : 'Mark Available'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateResource({ id: res.id, status: 'maintenance', is_available: false })}
                    className="text-xs cursor-pointer gap-1.5 text-amber-600 dark:text-amber-400"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Set under maintenance</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setRetireModalResource(res);
                      setRetireReason('');
                    }}
                    className="text-xs cursor-pointer gap-1.5 text-destructive"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Retire</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setQrModalResource(res)}
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>QR label</span>
                  </DropdownMenuItem>
                </>
              )}

              {/* MAINTENANCE actions */}
              {res.status === 'maintenance' && (
                <>
                  <DropdownMenuItem
                    onClick={() => openEditDialog(res)}
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateResource({ id: res.id, status: 'active', is_available: false })}
                    className="text-xs cursor-pointer gap-1.5 text-emerald-600 dark:text-emerald-400"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Mark active</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setRetireModalResource(res);
                      setRetireReason('');
                    }}
                    className="text-xs cursor-pointer gap-1.5 text-destructive"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Retire</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setQrModalResource(res)}
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>QR label</span>
                  </DropdownMenuItem>
                </>
              )}

              {/* RETIRED actions */}
              {res.status === 'retired' && (
                <>
                  <DropdownMenuItem
                    onClick={() => openEditDialog(res)}
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit details</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setReactivateModalResource(res)}
                    className="text-xs cursor-pointer gap-1.5 text-emerald-600 dark:text-emerald-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reactivate</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const trimmedCategorySearch = categoryQuery.trim();
  const showCreateOption =
    trimmedCategorySearch.length > 0 &&
    trimmedCategorySearch.length <= 40 &&
    !PRESET_CATEGORIES.some((p) => p.toLowerCase() === trimmedCategorySearch.toLowerCase()) &&
    !customCategoriesList.some((c) => c.toLowerCase() === trimmedCategorySearch.toLowerCase());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Asset Management"
        title="Resource Inventory"
        description="Comprehensive registry of shared electronics, tools, instrumentation, and spaces."
      >
        <Button size="sm" onClick={openAddDialog} className="gap-2 font-semibold shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Register New Asset</span>
        </Button>
      </PageHeader>

      {/* Register Asset Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Register Resource
            </DialogTitle>
            <DialogDescription className="text-xs">
              Asset will be catalogued and made visible to eligible organization members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Asset Title</label>
              <Input
                placeholder="Name of the equipment or space"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Category Combobox */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Category</label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between text-xs h-9 font-normal"
                    >
                      <span className="truncate">{newCategory || 'Select category'}</span>
                      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search category..."
                        value={categoryQuery}
                        onValueChange={setCategoryQuery}
                        className="h-8 text-xs"
                      />
                      <CommandList>
                        <CommandEmpty className="p-2 text-xs text-muted-foreground">
                          No category found.
                        </CommandEmpty>
                        <CommandGroup heading="Presets">
                          {PRESET_CATEGORIES.map((cat) => (
                            <CommandItem
                              key={cat}
                              value={cat}
                              onSelect={() => {
                                setNewCategory(cat);
                                setComboboxOpen(false);
                              }}
                              className="text-xs"
                            >
                              <Check
                                className={`mr-2 h-3.5 w-3.5 ${
                                  newCategory === cat ? 'opacity-100' : 'opacity-0'
                                }`}
                              />
                              {cat}
                            </CommandItem>
                          ))}
                        </CommandGroup>

                        {customCategoriesList.length > 0 && (
                          <CommandGroup heading="Organization Categories">
                            {customCategoriesList.map((cat) => (
                              <CommandItem
                                key={cat}
                                value={cat}
                                onSelect={() => {
                                  setNewCategory(cat);
                                  setComboboxOpen(false);
                                }}
                                className="text-xs"
                              >
                                <Check
                                  className={`mr-2 h-3.5 w-3.5 ${
                                    newCategory === cat ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                                {cat}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}

                        {showCreateOption && (
                          <CommandGroup heading="New Category">
                            <CommandItem
                              onSelect={async () => {
                                try {
                                  const canonical = await ensureCategory(trimmedCategorySearch);
                                  setNewCategory(canonical);
                                  setComboboxOpen(false);
                                  setCategoryQuery('');
                                  void queryClient.invalidateQueries({
                                    queryKey: ['resource_categories', profile?.institution_id],
                                  });
                                  toast.success(`Category "${canonical}" saved`);
                                } catch (err) {
                                  toastError(err, 'Failed to create category');
                                }
                              }}
                              className="text-xs text-primary font-medium gap-1.5 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Create category: &quot;{trimmedCategorySearch}&quot;</span>
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-[10px] text-muted-foreground">Pick one or create your own</p>
              </div>

              {/* Tag ID with Lock and Copy */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <span>Tag ID</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">Assigned automatically</span>
                </div>
                <div className="relative">
                  <Input
                    readOnly
                    value={newTagId}
                    className="bg-muted/50 font-mono text-xs pr-8 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(newTagId);
                      toast.success('Tag ID copied to clipboard');
                    }}
                    className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="Copy Tag ID"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Location / Placement</label>
              <Input
                placeholder="Building, room or shelf"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Technical Details / Notes (Optional)</label>
              <Textarea
                placeholder="Technical details, access instructions, or restrictions"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Image Upload Widget */}
            <div className="space-y-1 pt-1">
              <label className="font-semibold text-foreground">Resource Photo (Optional, Max 5MB)</label>
              {imagePreview ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/80 bg-muted">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => handleImageSelect(null)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-lg shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-border/80 rounded-xl p-4 cursor-pointer hover:bg-muted/40 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-[11px] font-medium text-foreground">Click to upload photo</span>
                  <span className="text-[10px] text-muted-foreground">JPEG, PNG, WebP up to 5MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateAsset}
              disabled={isCreating}
              className="font-semibold"
            >
              {isCreating ? 'Registering...' : 'Register Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search and Category Filter Toolbar */}
      <div className="space-y-3">
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

        {/* Dynamic Category Chips with Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="text-muted-foreground flex items-center gap-1 font-semibold pr-1 shrink-0">
            <Filter className="h-3 w-3" /> Category:
          </span>
          {dynamicCategories.map(({ name, count }) => (
            <button
              key={name}
              onClick={() => setSelectedCategory(name)}
              className={`rounded-lg px-2.5 py-1 font-medium transition-all shrink-0 ${
                selectedCategory === name
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {name} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* TanStack Data Table */}
      <DataTable
        columns={columns}
        data={filteredResources}
        pageSize={8}
        emptyMessage="No equipment resources matched your filter criteria."
      />

      {/* QR Label Dialog */}
      {qrModalResource && (
        <Dialog open={!!qrModalResource} onOpenChange={(open) => !open && setQrModalResource(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                <span>Physical Asset Tag Label</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Print or download the scannable QR label for {qrModalResource.title}.
              </DialogDescription>
            </DialogHeader>

            {/* Printable QR Card or Missing Warning */}
            {qrModalResource.qrIdentifier ? (
              <div
                id="qr-print-area"
                className="p-6 bg-white rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center space-y-3 text-black my-2 shadow-xs"
              >
                <h3 className="text-sm font-bold text-center tracking-tight text-gray-900">
                  {qrModalResource.title}
                </h3>
                <div className="p-2 bg-white rounded-xl shadow-xs">
                  <QRCodeSVG
                    id="qr-svg-label"
                    value={qrModalResource.qrIdentifier}
                    size={240}
                    level="H"
                    includeMargin
                  />
                </div>
                <span className="font-mono text-xs font-black tracking-widest text-gray-800">
                  {qrModalResource.qrIdentifier}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                  {qrModalResource.tagId} • {qrModalResource.location}
                </span>
              </div>
            ) : (
              <div className="p-6 bg-muted/40 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center space-y-2 text-center my-4">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <p className="text-sm font-semibold text-foreground">
                  This resource has no QR identifier yet
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Click "Regenerate QR" below to assign an encrypted physical tracking tag.
                </p>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRegenerating}
                    className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate QR</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Asset QR Tag?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs leading-relaxed">
                      Warning: Any previously printed QR labels for this equipment will permanently stop working. The new identifier must be printed and attached.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          setIsRegenerating(true);
                          const newQr = await regenerateResourceQr(qrModalResource.id);
                          setQrModalResource({ ...qrModalResource, qrIdentifier: newQr });
                          toast.success('New QR identifier generated');
                        } catch (err: unknown) {
                          const errMsg =
                            err && typeof err === 'object' && 'message' in err
                              ? String((err as { message?: unknown }).message)
                              : String(err);
                          if (errMsg.includes('schema cache') || errMsg.includes('Could not find the function')) {
                            toast.error('The backend is missing a recent update. Contact the administrator.');
                          } else {
                            toastError(err, 'Failed to regenerate QR');
                          }
                        } finally {
                          setIsRegenerating(false);
                        }
                      }}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                    >
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!qrModalResource.qrIdentifier}
                  onClick={() => {
                    const svg = document.getElementById('qr-svg-label');
                    if (!svg) return;
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      ctx?.drawImage(img, 0, 0, 512, 512);
                      const a = document.createElement('a');
                      a.download = `${qrModalResource.tagId}_qr.png`;
                      a.href = canvas.toDataURL('image/png');
                      a.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                  }}
                  className="text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>PNG</span>
                </Button>
                <Button
                  size="sm"
                  disabled={!qrModalResource.qrIdentifier}
                  onClick={() => window.print()}
                  className="text-xs font-semibold gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Label</span>
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dedicated Print Portal into document.body */}
      {qrModalResource && qrModalResource.qrIdentifier && createPortal(
        <div id="qr-print-portal" aria-hidden="true">
          <div className="w-[360px] p-8 bg-white rounded-2xl border-2 border-black flex flex-col items-center justify-center space-y-3 text-black text-center shadow-none">
            <h2 className="text-base font-bold tracking-tight text-black">
              {qrModalResource.title}
            </h2>
            <div className="p-2 bg-white">
              <QRCodeSVG
                value={qrModalResource.qrIdentifier}
                size={220}
                level="H"
                includeMargin
              />
            </div>
            <span className="font-mono text-sm font-black tracking-widest text-black">
              {qrModalResource.qrIdentifier}
            </span>
            <span className="text-xs text-gray-700 uppercase tracking-wider font-semibold">
              {qrModalResource.tagId} • {qrModalResource.location}
            </span>
          </div>
        </div>,
        document.body
      )}

      {/* Retire Resource AlertDialog */}
      {retireModalResource && (
        <AlertDialog open={!!retireModalResource} onOpenChange={(open) => !open && setRetireModalResource(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Retire Resource</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs space-y-2">
                <span>
                  Retiring <strong>{retireModalResource.title}</strong> ({retireModalResource.tagId}) will immediately cancel all pending and future approved reservations, cancel waitlist entries, and notify affected members.
                </span>
                <span className="block font-medium text-destructive pt-1">
                  This action cannot be taken if the equipment is currently in custody or has an unresolved dispute.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5 py-2">
              <label className="text-xs font-semibold text-foreground block">
                Reason for retirement <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="e.g. Decommissioned due to age; parts no longer serviceable"
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value)}
                className="text-xs min-h-[70px]"
                required
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRetiring}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!retireReason.trim() || isRetiring}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!retireReason.trim()) return;
                  try {
                    setIsRetiring(true);
                    await retireResource({ id: retireModalResource.id, reason: retireReason.trim() });
                    setRetireModalResource(null);
                    setRetireReason('');
                  } catch (err: unknown) {
                    toastError(err, 'Failed to retire resource');
                  } finally {
                    setIsRetiring(false);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
              >
                {isRetiring ? 'Retiring...' : 'Retire Resource'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Reactivate Resource AlertDialog */}
      {reactivateModalResource && (
        <AlertDialog open={!!reactivateModalResource} onOpenChange={(open) => !open && setReactivateModalResource(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-emerald-500" />
                <span>Reactivate Resource</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                Reactivate <strong>{reactivateModalResource.title}</strong>? It will return to Active status in an initial Unavailable state until staff verify its condition and mark it available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isReactivating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isReactivating}
                onClick={async () => {
                  try {
                    setIsReactivating(true);
                    await reactivateResource(reactivateModalResource.id);
                    setReactivateModalResource(null);
                  } catch (err: unknown) {
                    toastError(err, 'Failed to reactivate resource');
                  } finally {
                    setIsReactivating(false);
                  }
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {isReactivating ? 'Reactivating...' : 'Reactivate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit Resource Dialog */}
      {editModalResource && (
        <Dialog open={!!editModalResource} onOpenChange={(open) => !open && setEditModalResource(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {editModalResource.status === 'retired' ? 'Edit Retired Resource Details' : 'Edit Resource'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editModalResource.status === 'retired'
                  ? 'Core inventory fields are locked for retired equipment. You may update operational notes below.'
                  : 'Update asset specifications, room placement, or notes.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Asset Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={editModalResource.status === 'retired'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Category</label>
                  <Input
                    value={editCategory}
                    disabled={editModalResource.status === 'retired'}
                    onChange={(e) => setEditCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3 text-muted-foreground" /> Tag ID
                  </label>
                  <Input
                    readOnly
                    disabled
                    value={editModalResource.tagId}
                    className="font-mono bg-muted/60"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Location / Room</label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  disabled={editModalResource.status === 'retired'}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Description / Operational Notes</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-xs min-h-[70px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEditModalResource(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="font-semibold"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
