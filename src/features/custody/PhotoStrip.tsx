/**
 * src/features/custody/PhotoStrip.tsx
 * EquipSync – Cryptographic Custody Photo Strip & Lightbox.
 * Displays photo thumbnails with signed URLs, short SHA-256 chips,
 * Lightbox Dialog, and client-side SHA-256 integrity verification.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  ZoomIn,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { getSignedPhotoUrls, sha256Hex } from '@/lib/custody';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface PhotoRecord {
  slot: string;
  storage_path: string;
  sha256?: string;
  created_at?: string;
}

interface PhotoStripProps {
  photos: PhotoRecord[];
  bucket?: string;
  title?: string;
  className?: string;
}

export function PhotoStrip({
  photos = [],
  bucket = 'custody-photos',
  title,
  className,
}: PhotoStripProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoRecord | null>(null);

  // Status map of verified photos: storage_path -> 'valid' | 'invalid' | 'verifying'
  const [verifiedStatus, setVerifiedStatus] = useState<Record<string, 'valid' | 'invalid' | 'verifying'>>({});

  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const paths = photos.map((p) => p.storage_path).filter(Boolean);
    if (paths.length === 0) return;

    let mounted = true;
    setLoadingUrls(true);

    void getSignedPhotoUrls(paths, 3600, bucket)
      .then((urls) => {
        if (mounted) setSignedUrls(urls);
      })
      .catch((err) => {
        console.error('Failed to load signed photo URLs', err);
      })
      .finally(() => {
        if (mounted) setLoadingUrls(false);
      });

    return () => {
      mounted = false;
    };
  }, [photos, bucket]);

  const verifySinglePhoto = async (photo: PhotoRecord) => {
    const url = signedUrls[photo.storage_path];
    if (!url || !photo.sha256) {
      toast.error('Cannot verify photo without signed URL and hash');
      return;
    }

    try {
      setVerifiedStatus((prev) => ({ ...prev, [photo.storage_path]: 'verifying' }));
      const res = await fetch(url);
      const blob = await res.blob();
      const computedHash = await sha256Hex(blob);

      const isValid = computedHash.toLowerCase() === photo.sha256.toLowerCase();
      setVerifiedStatus((prev) => ({
        ...prev,
        [photo.storage_path]: isValid ? 'valid' : 'invalid',
      }));

      if (isValid) {
        toast.success(`Integrity verified for ${photo.slot} photo`);
      } else {
        toast.error(`Tamper alert: SHA-256 hash mismatch on ${photo.slot} photo!`);
      }
    } catch {
      setVerifiedStatus((prev) => ({ ...prev, [photo.storage_path]: 'invalid' }));
      toast.error('Failed to download photo for verification');
    }
  };

  const verifyAllPhotos = async () => {
    toast.info('Verifying SHA-256 hashes for all photos...');
    for (const p of photos) {
      if (p.storage_path) {
        await verifySinglePhoto(p);
      }
    }
  };

  if (!photos || photos.length === 0) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
        No photographic evidence recorded for this phase.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      <div className="flex items-center justify-between text-xs">
        {title && <span className="font-semibold text-foreground">{title}</span>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={verifyAllPhotos}
          className="h-7 text-[11px] gap-1 font-semibold ml-auto"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Verify all</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {photos.map((photo) => {
          const url = signedUrls[photo.storage_path];
          const shortHash = photo.sha256 ? `${photo.sha256.slice(0, 6)}...${photo.sha256.slice(-4)}` : null;
          const status = verifiedStatus[photo.storage_path];

          return (
            <div
              key={photo.storage_path || photo.slot}
              className="group relative rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col justify-between"
            >
              {/* Image Preview Box */}
              <div
                onClick={() => setLightboxPhoto(photo)}
                className="relative aspect-video w-full bg-muted cursor-pointer overflow-hidden flex items-center justify-center"
              >
                {url ? (
                  <img
                    src={url}
                    alt={photo.slot}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex items-center justify-center p-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                  <ZoomIn className="h-4 w-4" />
                  <span>Enlarge</span>
                </div>
                <div className="absolute top-1.5 left-1.5">
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 px-1 bg-black/60 text-white border-0">
                    {photo.slot}
                  </Badge>
                </div>
              </div>

              {/* Hash and Verify Button */}
              <div className="p-2 space-y-1.5 text-xs bg-muted/20 border-t border-border/50">
                {shortHash && (
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span title={photo.sha256}>SHA: {shortHash}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (photo.sha256) {
                          navigator.clipboard?.writeText(photo.sha256);
                          toast.success('SHA-256 hash copied to clipboard');
                        }
                      }}
                      className="hover:text-foreground"
                      title="Copy full SHA-256 hash"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={status === 'verifying'}
                  onClick={() => verifySinglePhoto(photo)}
                  className={`w-full h-6 text-[10px] font-semibold gap-1 p-0 ${
                    status === 'valid'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : status === 'invalid'
                      ? 'text-destructive font-bold'
                      : 'text-primary'
                  }`}
                >
                  {status === 'verifying' ? (
                    <>
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      <span>Hashing...</span>
                    </>
                  ) : status === 'valid' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Verified</span>
                    </>
                  ) : status === 'invalid' ? (
                    <>
                      <ShieldAlert className="h-3 w-3 text-destructive" />
                      <span>Mismatch!</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3 w-3" />
                      <span>Verify integrity</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Dialog */}
      {lightboxPhoto && (
        <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
          <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-card/95 border-border/80">
            <DialogHeader className="p-4 border-b border-border/60">
              <DialogTitle className="text-sm font-bold flex items-center justify-between">
                <span>Photographic Evidence: {lightboxPhoto.slot.toUpperCase()} View</span>
                {lightboxPhoto.created_at && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {new Date(lightboxPhoto.created_at).toLocaleString()}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="relative aspect-video w-full bg-black/90 flex items-center justify-center overflow-hidden">
              {signedUrls[lightboxPhoto.storage_path] && (
                <img
                  src={signedUrls[lightboxPhoto.storage_path]}
                  alt={lightboxPhoto.slot}
                  className="max-h-[75vh] w-full object-contain"
                />
              )}
            </div>

            {lightboxPhoto.sha256 && (
              <div className="p-4 bg-muted/30 border-t border-border/60 space-y-1 text-xs">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  Cryptographic SHA-256 Digest
                </span>
                <div className="flex items-center justify-between p-2 rounded-lg bg-background font-mono text-[11px] break-all border border-border/80">
                  <span>{lightboxPhoto.sha256}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (lightboxPhoto.sha256) {
                        navigator.clipboard?.writeText(lightboxPhoto.sha256);
                        toast.success('SHA-256 hash copied to clipboard');
                      }
                    }}
                    className="h-6 w-6 p-0 ml-2 shrink-0"
                    title="Copy full hash"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default PhotoStrip;
