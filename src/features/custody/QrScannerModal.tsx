/**
 * src/features/custody/QrScannerModal.tsx
 * EquipSync – QR code verification widget for checkout and return flows.
 * Uses lazy-loaded camera scanner with manual tag entry fallback.
 */

import React, { useState, Suspense } from 'react';
import { Camera, CheckCircle2, AlertCircle, QrCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractQrIdentifier } from '@/lib/custody';
import { verifyAssetQr } from '@/lib/api/rpc';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

// Lazy-load camera stream component so main bundle does not include scanner weight
const QrCameraView = React.lazy(() => import('./QrCameraView'));

export interface QrScannerModalProps {
  bookingId: string;
  phase: 'checkout' | 'return';
  expectedQr?: string;
  onVerified: (qr: string) => void;
  className?: string;
}

export function QrScannerModal({
  bookingId,
  phase,
  expectedQr,
  onVerified,
  className,
}: QrScannerModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [verifiedQr, setVerifiedQr] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  const scannerContainerId = `qr-reader-${bookingId}`;

  const handleVerify = async (rawQr: string) => {
    const cleaned = extractQrIdentifier(rawQr);
    if (!cleaned) {
      toast.error('Please enter a valid asset QR code');
      return;
    }

    try {
      setIsVerifying(true);
      setMismatchError(null);
      const isMatch = await verifyAssetQr({
        bookingId,
        qr: cleaned,
        phase,
      });

      if (isMatch) {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(100); } catch { /* ignore */ }
        }
        setVerifiedQr(cleaned);
        toast.success('Asset QR verified successfully');
        onVerified(cleaned);
        setScannerActive(false);
      } else {
        setMismatchError('Scanned QR does not match this asset. Please verify the physical equipment tag.');
      }
    } catch (err: unknown) {
      toastError(err, 'Failed to verify QR identifier');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {verifiedQr ? (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold block">Asset Tag Verified</span>
              <span className="font-mono text-[11px] opacity-90">{verifiedQr}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setVerifiedQr(null);
              setManualInput('');
            }}
            className="h-7 text-[11px] hover:bg-emerald-500/20"
          >
            Re-scan
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted/40 text-center">
            {scannerActive ? (
              <Suspense
                fallback={
                  <div className="p-12 flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>Loading camera module...</span>
                  </div>
                }
              >
                <QrCameraView
                  containerId={scannerContainerId}
                  onScan={(text) => void handleVerify(text)}
                  onStop={() => setScannerActive(false)}
                />
              </Suspense>
            ) : (
              <div className="p-8 space-y-3 flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Scan Physical Equipment Tag</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Align your camera with the QR code on the item.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={isVerifying}
                  onClick={() => setScannerActive(true)}
                  className="gap-2 font-semibold shadow-xs"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Camera Scanner</span>
                </Button>
              </div>
            )}
          </div>

          {mismatchError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{mismatchError}</span>
            </div>
          )}

          {/* Manual Entry Fallback */}
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5">
            <label className="text-xs font-semibold text-foreground block">
              Manual Tag Entry Fallback:
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. EQS-A1B2C3D4E5"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleVerify(manualInput);
                  }
                }}
                className="font-mono text-xs uppercase"
              />
              <Button
                type="button"
                size="sm"
                disabled={!manualInput.trim() || isVerifying}
                onClick={() => handleVerify(manualInput)}
                className="font-semibold shrink-0"
              >
                {isVerifying ? 'Checking...' : 'Verify Tag'}
              </Button>
            </div>
            {expectedQr && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Asset tag expected on equipment: <strong>{expectedQr}</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
