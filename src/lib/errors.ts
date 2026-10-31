/**
 * src/lib/errors.ts
 * CampusShare – Centralised error mapping and toast notification helper.
 *
 * Maps Postgres / Supabase exception codes into human-friendly UI messages.
 */
import { toast } from 'sonner';
import { CampusShareError, EquipSyncError } from './supabase';
export { CampusShareError, EquipSyncError };

const ERROR_MAP: Record<string, string> = {
  not_authenticated: 'Please sign in to continue.',
  forbidden: "You don't have permission to perform this action.",
  not_verified: "Your account is pending verification by your organization's admin.",
  invalid_institution: 'Organization not found. Check the organization ID or sign up as an admin.',
  resource_unavailable: 'This resource is not currently available for booking.',
  slot_taken: 'This time slot has just been taken. Please choose different dates.',
  invalid_state: "This action is not allowed in the booking's current state.",
  outside_window: 'Check-out is only allowed within 15 minutes of the booking start and before the end time.',
  qr_required: 'Scanning or entering the asset QR identifier is required to proceed.',
  qr_mismatch: 'The scanned QR code does not match this equipment. Please verify the physical asset tag.',
  invalid_hash: 'Photo tamper-evidence validation failed. The computed image hash is invalid.',
  accessory_checklist_incomplete: 'Please complete the accessory checklist for every listed component before continuing.',
  notes_required: 'Detailed notes are strictly required when reporting damaged equipment, missing accessories, or flagged returns.',
  query_too_short: 'Please enter at least 3 characters to search organizations.',
  not_found: 'The requested item could not be found.',
  resource_retired: 'This resource has been retired and cannot be marked as available.',
  resource_in_use: 'Cannot retire resource while active checkouts, returns, or disputes are pending.',
  asset_tag_immutable: 'Asset tags cannot be changed once assigned.',
  invalid_category: 'Please enter a valid category name (1 to 40 characters).',
  domain_not_allowed: 'Public email providers (such as Gmail, Outlook, or Yahoo) cannot be used for auto-verification.',
  domain_already_claimed: 'This email domain has already been claimed by another organization.',
  domain_not_provable: 'You can only configure domains matching your confirmed administrator email address or its subdomains.',
  invalid_domain: 'Please enter a valid domain (e.g. example.edu or *.example.edu).',
};

const ELIGIBILITY_REASON_MAP: Record<string, string> = {
  user_type_not_allowed: 'Your account type is not permitted to book this resource.',
  exceeds_max_duration: 'Requested duration exceeds the maximum allowed for this resource.',
  insufficient_lead_time: 'Bookings must be made further in advance for this resource.',
  supervisor_required: 'A supervisor name is required for this resource.',
};

/**
 * Maps any error (CampusShareError, Error, string, unknown) to a friendly message.
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallback;

  if (err instanceof CampusShareError) {
    // Check known codes first
    if (err.code in ERROR_MAP) {
      return ERROR_MAP[err.code];
    }

    // Handle parameterized not_eligible reasons
    if (err.code === 'not_eligible') {
      if (err.reason) {
        if (err.reason.startsWith('missing_qualifications')) {
          const colonIndex = err.reason.indexOf(':');
          const quals = colonIndex !== -1 ? err.reason.slice(colonIndex + 1) : '';
          return quals
            ? `You need the following verified qualifications: ${quals}`
            : 'You are missing required verified qualifications for this resource.';
        }
        if (err.reason in ELIGIBILITY_REASON_MAP) {
          return ELIGIBILITY_REASON_MAP[err.reason];
        }
        return `Not eligible: ${err.reason.replace(/_/g, ' ')}`;
      }
      return 'You are not eligible to book this resource.';
    }

    // Handle missing photos
    if (err.code === 'missing_photos') {
      const slots = err.reason ? err.reason.replace(/,/g, ', ') : 'all required angles';
      return `Please capture the following photo slots before continuing: ${slots}.`;
    }

    return err.message || fallback;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('jwt') || msg.includes('token') || msg.includes('expired')) {
      return 'Your session has expired. Please sign in again.';
    }
    if (msg.includes('duplicate')) {
      return 'This file or entry already exists.';
    }
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  return fallback;
}

/**
 * Displays a toast notification with the friendly error message.
 * Returns the resolved error message string for optional component state.
 */
export function toastError(err: unknown, fallback?: string): string {
  const message = getErrorMessage(err, fallback);
  toast.error(message);
  return message;
}
