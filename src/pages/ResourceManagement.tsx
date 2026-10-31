import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
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
import { useAuth } from '@/providers/AuthProvider';
import { compressImage } from '@/lib/custody';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import { Upload, ImageIcon, X, QrCode, Printer, Download, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { regenerateResourceQr } from '@/lib/api/rpc';
import '@/styles/print.css';
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
import { Resource, ResourceCategory } from '@/lib/types';
export function ResourceManagement() {
  const {
    resources,
    loading,
    createResource,
    toggleAvailability,
    retireResource,
    uploadEvidence,
  } = useResources();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // New asset form inputs
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('DSLR Cameras');
  const [newTagId, setNewTagId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [qrModalResource, setQrModalResource] = useState<Resource | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const categories = ['All', 'Laptops', 'DSLR Cameras', 'Lab Equipment', 'Seminar Halls', 'Projectors', 'Classrooms', 'Sports Equipment', 'Academic Books'];

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

      await createResource({
        id: newResourceId,
        name: newTitle,
        kind: 'equipment',
        category: newCategory,
        asset_tag: newTagId || undefined,
        location: newLocation || undefined,
        image_path: storagePath,
      });

      setAddDialogOpen(false);
      setNewTitle('');
      setNewTagId('');
      setNewLocation('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err: unknown) {
      toastError(err, 'Failed to create resource');
    } finally {
      setIsCreating(false);
    }
  };

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
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-foreground">
          {row.original.status === 'available' ? 'Available' : 'Unavailable'}
        </span>
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
              <DropdownMenuItem
                onClick={() => setQrModalResource(row.original)}
                className="text-xs cursor-pointer gap-1.5"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>QR Asset Label</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toggleAvailability(row.original.id, row.original.status !== 'available')}
                className="text-xs cursor-pointer"
              >
                {row.original.status === 'available' ? 'Mark Unavailable' : 'Mark Available'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => retireResource(row.original.id)}
                className="text-xs cursor-pointer text-destructive"
              >
                Retire Asset
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
        description="Comprehensive registry of shared electronics, tools, instrumentation, and spaces."
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
                Register Resource
              </DialogTitle>
              <DialogDescription className="text-xs">
                Asset will be cataloged and made visible to eligible organisation members.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Asset Title</label>
                <Input
                  placeholder="e.g. Panasonic Lumix GH6 Filmmaker Kit"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Category</label>
                  <Input
                    placeholder="DSLR Cameras"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Tag ID</label>
                  <Input
                    placeholder="MED-CAM-019"
                    value={newTagId}
                    onChange={(e) => setNewTagId(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Location / Room</label>
                <Input
                  placeholder="Media Arts Center, Locker #4"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>

              {/* Image Upload Widget with preview */}
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
                disabled={isCreating || !newTitle.trim()}
                onClick={handleCreateAsset}
                className="font-semibold"
              >
                {isCreating ? 'Saving...' : 'Save to Registry'}
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
    </div>
  );
}
