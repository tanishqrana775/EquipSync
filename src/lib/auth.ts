/**
 * src/lib/auth.ts
 * CampusShare – Authentication helpers.
 *
 * All auth operations go through supabase-js; the service-role key is
 * never used here. The `handle_new_user` trigger on auth.users creates
 * the matching profile row automatically.
 */

import type { Provider, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase, unwrap } from './supabase';
import type { Database } from './database.types';

// ---------------------------------------------------------------------------
// Derived row types from the generated schema
// ---------------------------------------------------------------------------
export type Profile      = Database['public']['Tables']['profiles']['Row'];
export interface Institution {
  id: string;
  name: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Sign-up: institution admin (creates institution + admin profile)
// ---------------------------------------------------------------------------
export interface SignUpInstitutionArgs {
  email:           string;
  password:        string;
  fullName:        string;
  institutionName: string;
  institutionType: string;
  emailDomain?:    string;
  address?:        string;
}

/**
 * Registers a new institution admin account.
 * The `handle_new_user` trigger reads `raw_user_meta_data` and creates
 * the institution + a verified institution_admin profile automatically.
 */
export async function signUpInstitution(args: SignUpInstitutionArgs) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const emailRedirectTo = `${origin}/login?verified=1`;
  return unwrap(
    await supabase.auth.signUp({
      email:    args.email,
      password: args.password,
      options: {
        emailRedirectTo,
        data: {
          role:             'institution_admin',
          full_name:         args.fullName,
          institution_name:  args.institutionName,
          institution_type:  args.institutionType,
          email_domain:      args.emailDomain ?? null,
          address:           args.address ?? null,
        },
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Sign-up: member
// ---------------------------------------------------------------------------
export interface SignUpMemberArgs {
  email:         string;
  password:      string;
  fullName:      string;
  userType:      Database['public']['Enums']['user_type'];
  institutionId: string;
}

/**
 * Registers a new member. The `handle_new_user` trigger creates a
 * 'pending' profile linked to the existing institution.
 */
export async function signUpMember(args: SignUpMemberArgs) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const emailRedirectTo = `${origin}/login?verified=1`;
  return unwrap(
    await supabase.auth.signUp({
      email:    args.email,
      password: args.password,
      options: {
        emailRedirectTo,
        data: {
          role:           'member',
          full_name:       args.fullName,
          user_type:       args.userType,
          institution_id:  args.institutionId,
        },
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Sign in (email / password)
// ---------------------------------------------------------------------------
export async function signIn(email: string, password: string): Promise<Session> {
  const res = unwrap<{ session: Session | null; user: unknown }>(
    await supabase.auth.signInWithPassword({ email, password })
  );
  if (!res.session) {
    // Email unconfirmed or invalid credentials returned no session
    throw new Error('No session returned – check your email for a confirmation link.');
  }
  return res.session;
}

// ---------------------------------------------------------------------------
// OAuth sign-in (Google, GitHub, …)
// ---------------------------------------------------------------------------
export async function signInWithOAuth(provider: Provider): Promise<void> {
  unwrap(
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  );
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOut(): Promise<void> {
  unwrap(await supabase.auth.signOut());
}


// ---------------------------------------------------------------------------
// Email verification & Password recovery
// ---------------------------------------------------------------------------

export async function resendVerification(email: string): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const emailRedirectTo = `${origin}/login?verified=1`;
  unwrap(
    await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    })
  );
}

export async function sendPasswordReset(email: string): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  unwrap(
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/update-password`,
    })
  );
}

export async function updatePassword(password: string): Promise<void> {
  unwrap(
    await supabase.auth.updateUser({ password })
  );
}
// ---------------------------------------------------------------------------
// Current user profile
// ---------------------------------------------------------------------------

/**
 * Returns the full profile row for the signed-in user.
 * Relies on `profiles` RLS: users can always select their own row.
 */
export async function getMyProfile(): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  const profile = unwrap<Profile>(
    await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
  );
  if (!profile) throw new Error('not_found');
  return profile;
}

// ---------------------------------------------------------------------------
// Institution directory (readable by anon + authenticated via the view)
// ---------------------------------------------------------------------------

/**
 * Searches institutions for the registration form via the SECURITY DEFINER RPC.
 */
export async function searchInstitutions(query: string): Promise<Institution[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }
  const rows = unwrap<Institution[]>(
    await supabase.rpc('search_institutions', { p_query: trimmed })
  );
  return rows ?? [];
}

// ---------------------------------------------------------------------------
// Auth state change subscription
// ---------------------------------------------------------------------------

type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

/**
 * Subscribes to auth state changes. Returns the unsubscribe function.
 *
 * @example
 * const unsub = onAuthChange((event, session) => { ... });
 * // later:
 * unsub();
 */
export function onAuthChange(cb: AuthChangeCallback): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(cb);
  return () => subscription.unsubscribe();
}
