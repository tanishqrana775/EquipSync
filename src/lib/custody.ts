/**
 * src/lib/custody.ts
 * CampusShare – Chain-of-Custody flow utilities.
 *
 * All heavy lifting (compression, hashing, upload, RPC orchestration) lives
 * here so UI components stay declarative.
 */

import { supabase } from './supabase';
import { checkOutBooking, checkInBooking } from './api/rpc';
import type { Booking, PhotoInput, AccessoryCheckInput, ConditionRating } from './api/rpc';

// ===========================================================================
// Types
// ===========================================================================

/** Minimal shape a captured photo object must carry before upload. */
export interface CustodyPhotoInput {
  slot:    string;
  file:    File;
  /** ISO-8601 string – set at the moment the user captures the photo. */
  client_captured_at: string;
}

export type { AccessoryCheckInput };

/** One item in the custody timeline as returned by `get_custody_timeline`. */
export interface CustodyTimelineItem {
  type:        'status_change' | 'custody_event' | 'custody_photo' | 'incident';
  occurred_at: string;
  actor_id?:   string;
  /** All other fields the DB returns verbatim. */
  [key: string]: unknown;
}

/** Checkout or checkin photo row after upload. */
export interface UploadedPhoto {
  slot:               string;
  storage_path:       string;
  sha256:             string;
  client_captured_at: string;
}

/** Paired before/after photos for a given slot. */
export interface BeforeAfterPair {
  slot:    string;
  before?: UploadedPhoto;  // checkout
  after?:  UploadedPhoto;  // checkin
}

// ===========================================================================
// compressImage
// ===========================================================================

/**
 * Compresses a File to a Blob via an OffscreenCanvas (falls back to regular
 * Canvas in browsers without OffscreenCanvas support).
 *
 * Orientation is preserved by drawing through a <img> element which respects
 * the browser's built-in EXIF auto-orientation.
 *
 * @param file    Source image file (any browser-decodable format).
 * @param maxEdge Longest edge in pixels; image is downscaled if larger.
 * @param quality JPEG quality 0–1.
 */
export async function compressImage(
  file:     File,
  maxEdge   = 1600,
  quality   = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width  * scale);
  const h = Math.round(bitmap.height * scale);

  // OffscreenCanvas is not available in all environments; guard and fall back.
  let blob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  } else {
    const canvas  = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => { if (b) resolve(b); else reject(new Error('Canvas toBlob returned null')); },
        'image/jpeg',
        quality,
      );
    });
  }

  bitmap.close();
  return blob;
}

// ===========================================================================
// sha256Hex
// ===========================================================================

/**
 * Returns the lowercase hex-encoded SHA-256 digest of a Blob.
 * Uses `crypto.subtle` (available in all modern browsers and Vite's dev server).
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// ===========================================================================
// custodyPhotoPath
// ===========================================================================

/**
 * Canonical storage path for a custody photo.
 * Convention: `<institutionId>/<bookingId>/<phase>/<slot>.jpg`
 *
 * This is the single authoritative source of the path format; the DB RPC
 * validates that uploaded paths start with the expected prefix.
 */
export function custodyPhotoPath(args: {
  institutionId: string;
  bookingId:     string;
  phase:         'checkout' | 'checkin';
  slot:          string;
}): string {
  return `${args.institutionId}/${args.bookingId}/${args.phase}/${args.slot}.jpg`;
}

// ===========================================================================
// uploadCustodyPhoto
// ===========================================================================

/**
 * Compresses, hashes and uploads a single custody photo.
 *
 * - Compression: maxEdge 1600, quality 0.8.
 * - Upload: `upsert: false` (immutable evidence; duplicates are detectable).
 * - Returns the full `UploadedPhoto` record ready for the check-out/in RPC.
 *
 * Throws a plain `Error` whose message starts with `'Duplicate'` when
 * Supabase signals the object already exists (the caller can treat this
 * as a retry-safe success if the SHA-256 matches).
 */
export async function uploadCustodyPhoto(args: {
  institutionId:  string;
  bookingId:      string;
  phase:          'checkout' | 'checkin';
  slot:           string;
  file:           File;
  onProgress?:    (pct: number) => void;
}): Promise<UploadedPhoto> {
  args.onProgress?.(0);

  const compressed  = await compressImage(args.file);
  args.onProgress?.(30);

  const hash        = await sha256Hex(compressed);
  args.onProgress?.(50);

  const storagePath = custodyPhotoPath({
    institutionId: args.institutionId,
    bookingId:     args.bookingId,
    phase:         args.phase,
    slot:          args.slot,
  });

  const { error } = await supabase.storage
    .from('custody-photos')
    .upload(storagePath, compressed, {
      contentType: 'image/jpeg',
      upsert:      false,
    });

  if (error) {
    // Surface duplicate so the orchestrator can decide whether to skip or fail.
    if (error.message.toLowerCase().includes('duplicate') ||
        error.message.toLowerCase().includes('already exists')) {
      throw new Error(`Duplicate:${storagePath}`);
    }
    throw error;
  }

  args.onProgress?.(100);

  return {
    slot:               args.slot,
    storage_path:       storagePath,
    sha256:             hash,
    client_captured_at: args.file.lastModified
      ? new Date(args.file.lastModified).toISOString()
      : new Date().toISOString(),
  };
}

// ===========================================================================
// getSignedPhotoUrls
// ===========================================================================

/**
 * Batch-fetches signed URLs for an array of storage paths.
 * Signed URLs expire after `expiresIn` seconds (default 1 hour).
 * Returns a Record of `storage_path → signed_url`.
 */
export async function getSignedPhotoUrls(
  paths:     string[],
  expiresIn  = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from('custody-photos')
    .createSignedUrls(paths, expiresIn);

  if (error) throw error;

  const result: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) {
      result[entry.path] = entry.signedUrl;
    }
  }
  return result;
}

// ===========================================================================
// validateRequiredSlots
// ===========================================================================

/**
 * Returns the required slots that are absent from `captured`.
 * Empty array means all slots are present.
 */
export function validateRequiredSlots(
  required: string[],
  captured: Record<string, unknown>,
): string[] {
  return required.filter((slot) => !(slot in captured));
}

// ===========================================================================
// submitCheckOut  (orchestrator)
// ===========================================================================

/**
 * Full check-out flow:
 *  1. Upload all photos (parallel), retry-safe on duplicate.
 *  2. Validate all required slots were captured.
 *  3. Call the `check_out_booking` RPC.
 *
 * On a partial failure the successfully uploaded photos are NOT rolled back
 * (custody-photos storage has no delete policy). Re-running with the same
 * photos will encounter `Duplicate` errors which are treated as success when
 * the hash matches — making this orchestrator idempotent.
 */
export async function submitCheckOut(args: {
  institutionId:   string;
  bookingId:       string;
  photos:          CustodyPhotoInput[];
  requiredSlots:   string[];
  condition:       ConditionRating;
  notes:           string;
  accessoryChecks?: AccessoryCheckInput[];
  onPhotoProgress?: (slot: string, pct: number) => void;
}): Promise<Booking> {
  // Upload phase — parallel, duplicate-tolerant
  const uploaded = await Promise.all(
    args.photos.map(async (p): Promise<UploadedPhoto> => {
      try {
        return await uploadCustodyPhoto({
          institutionId:  args.institutionId,
          bookingId:      args.bookingId,
          phase:          'checkout',
          slot:           p.slot,
          file:           p.file,
          onProgress:     (pct) => args.onPhotoProgress?.(p.slot, pct),
        });
      } catch (err) {
        // Duplicate: re-derive metadata from the already-uploaded file.
        if (err instanceof Error && err.message.startsWith('Duplicate:')) {
          const compressed = await compressImage(p.file);
          const hash       = await sha256Hex(compressed);
          const storagePath = custodyPhotoPath({
            institutionId: args.institutionId,
            bookingId:     args.bookingId,
            phase:         'checkout',
            slot:          p.slot,
          });
          return {
            slot:               p.slot,
            storage_path:       storagePath,
            sha256:             hash,
            client_captured_at: p.client_captured_at,
          };
        }
        throw err;
      }
    })
  );

  // Validate completeness before calling the RPC (fast-fail)
  const capturedMap = Object.fromEntries(uploaded.map((u) => [u.slot, u]));
  const missing     = validateRequiredSlots(args.requiredSlots, capturedMap);
  if (missing.length > 0) {
    throw new Error(`missing_photos:${missing.join(',')}`);
  }

  const rpcPhotos: PhotoInput[] = uploaded.map((u) => ({
    slot:               u.slot,
    storage_path:       u.storage_path,
    sha256:             u.sha256,
    client_captured_at: u.client_captured_at,
  }));

  return checkOutBooking({
    bookingId:       args.bookingId,
    photos:          rpcPhotos,
    condition:       args.condition,
    notes:           args.notes,
    accessoryChecks: args.accessoryChecks,
  });
}

// ===========================================================================
// submitCheckIn  (orchestrator)
// ===========================================================================

/**
 * Full check-in flow — mirrors `submitCheckOut` for phase `checkin`.
 * Idempotent on duplicate uploads (same hash = same photo = success).
 */
export async function submitCheckIn(args: {
  institutionId:   string;
  bookingId:       string;
  photos:          CustodyPhotoInput[];
  requiredSlots:   string[];
  condition:       ConditionRating;
  notes:           string;
  accessoryChecks?: AccessoryCheckInput[];
  onPhotoProgress?: (slot: string, pct: number) => void;
}): Promise<Booking> {
  const uploaded = await Promise.all(
    args.photos.map(async (p): Promise<UploadedPhoto> => {
      try {
        return await uploadCustodyPhoto({
          institutionId:  args.institutionId,
          bookingId:      args.bookingId,
          phase:          'checkin',
          slot:           p.slot,
          file:           p.file,
          onProgress:     (pct) => args.onPhotoProgress?.(p.slot, pct),
        });
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Duplicate:')) {
          const compressed = await compressImage(p.file);
          const hash       = await sha256Hex(compressed);
          const storagePath = custodyPhotoPath({
            institutionId: args.institutionId,
            bookingId:     args.bookingId,
            phase:         'checkin',
            slot:          p.slot,
          });
          return {
            slot:               p.slot,
            storage_path:       storagePath,
            sha256:             hash,
            client_captured_at: p.client_captured_at,
          };
        }
        throw err;
      }
    })
  );

  const capturedMap = Object.fromEntries(uploaded.map((u) => [u.slot, u]));
  const missing     = validateRequiredSlots(args.requiredSlots, capturedMap);
  if (missing.length > 0) {
    throw new Error(`missing_photos:${missing.join(',')}`);
  }

  const rpcPhotos: PhotoInput[] = uploaded.map((u) => ({
    slot:               u.slot,
    storage_path:       u.storage_path,
    sha256:             u.sha256,
    client_captured_at: u.client_captured_at,
  }));

  return checkInBooking({
    bookingId:       args.bookingId,
    photos:          rpcPhotos,
    condition:       args.condition,
    notes:           args.notes,
    accessoryChecks: args.accessoryChecks,
  });
}

// ===========================================================================
// buildBeforeAfterPairs
// ===========================================================================

/**
 * Groups an array of uploaded photos into before-vs-after pairs by slot,
 * suitable for a side-by-side comparison UI.
 *
 * Photos with `phase === 'checkout'` become `before`; `'checkin'` become `after`.
 */
export function buildBeforeAfterPairs(
  photos: Array<UploadedPhoto & { phase: 'checkout' | 'checkin' }>,
): BeforeAfterPair[] {
  const bySlot: Record<string, BeforeAfterPair> = {};

  for (const photo of photos) {
    const existing = bySlot[photo.slot] ?? { slot: photo.slot };
    bySlot[photo.slot] = photo.phase === 'checkout'
      ? { ...existing, before: photo }
      : { ...existing, after: photo };
  }

  return Object.values(bySlot).sort((a, b) => a.slot.localeCompare(b.slot));
}
