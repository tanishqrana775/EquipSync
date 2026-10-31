/**
 * src/features/custody/QrCameraView.tsx
 * EquipSync – Camera stream reader using html5-qrcode.
 * Isolated module loaded lazily to preserve initial bundle size.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export interface QrCameraViewProps {
  containerId: string;
  onScan: (decodedText: string) => void;
  onStop: () => void;
}

export default function QrCameraView({
  containerId,
  onScan,
  onStop,
}: QrCameraViewProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let mounted = true;

    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('Camera access requires an HTTPS connection.');
      return;
    }

    const html5QrCode = new Html5Qrcode(containerId);
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (mounted) onScan(decodedText);
        },
        () => {
          // Normal frame scan skip
        }
      )
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setError('Camera access was denied. Please allow camera permissions in your browser.');
        } else {
          setError('Unable to initialize camera video stream.');
        }
      });

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {
            // Safe ignore on unmount
          });
      }
    };
  }, [containerId, onScan]);

  return (
    <div className="space-y-3 p-3">
      {error && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div id={containerId} className="w-full min-h-[260px] overflow-hidden rounded-xl bg-black" />
      <div className="flex justify-center pt-1">
        <Button size="sm" variant="outline" onClick={onStop} className="text-xs">
          Stop Camera
        </Button>
      </div>
    </div>
  );
}
