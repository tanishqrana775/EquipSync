/**
 * Supabase Client Configuration
 * Prepared for future backend integration.
 * In Phase 1, the app uses simulated asynchronous mock data hooks.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
}

export const supabaseConfig: SupabaseClientConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

// Lightweight Supabase client placeholder for Phase 1
// In Phase 2/3, `@supabase/supabase-js` createClient will be plugged in directly here.
export const supabase = {
  url: supabaseUrl,
  isConfigured: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: (table: string) => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  }),
};

export default supabase;
