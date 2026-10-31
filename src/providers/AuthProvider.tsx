/**
 * src/providers/AuthProvider.tsx
 * EquipSync – Supabase Session & Context Provider.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMyContext } from '../lib/api/rpc';
import { User, UserRole } from '../lib/types';
import { queryClient } from '../lib/queryClient';
import type { Database } from '../lib/database.types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type InstitutionRow = Database['public']['Tables']['institutions']['Row'];

interface AuthContextType {
  session: Session | null;
  profile: ProfileRow | null;
  institution: InstitutionRow | null;
  institutionName: string | null;
  verifiedQualificationIds: string[];
  user: User;
  role: UserRole;
  isVerified: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setRole: (role: UserRole) => void;
  switchRole: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ANONYMOUS_USER: User = {
  id: '',
  name: 'EquipSync Member',
  email: '',
  role: 'user',
  department: 'Member',
  campusId: '',
  avatar: '',
  isVerified: false,
  joinedDate: '',
};

function mapProfileToUser(
  profile: ProfileRow | null,
  session: Session | null,
  institutionName: string | null
): User {
  if (!profile || !session) {
    return ANONYMOUS_USER;
  }

  const role: UserRole = profile.role === 'institution_admin' ? 'institution' : 'user';
  return {
    id: profile.id,
    name: profile.full_name || session.user.email?.split('@')[0] || 'Member',
    email: session.user.email || '',
    role,
    department: institutionName || profile.user_type || 'General Organisation',
    campusId: profile.id.slice(0, 8).toUpperCase(),
    avatar: profile.avatar_url || '',
    isVerified: profile.verification_status === 'verified',
    joinedDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Active',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [institution, setInstitution] = useState<InstitutionRow | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [verifiedQualificationIds, setVerifiedQualificationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUserContext = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setProfile(null);
      setInstitution(null);
      setInstitutionName(null);
      setVerifiedQualificationIds([]);
      setLoading(false);
      return;
    }

    try {
      const ctx = await getMyContext();
      setProfile(ctx.profile);
      setInstitution(ctx.institution);
      setInstitutionName(ctx.institution_name);
      setVerifiedQualificationIds(ctx.verified_qualification_ids);
    } catch {
      setProfile(null);
      setInstitution(null);
      setInstitutionName(null);
      setVerifiedQualificationIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    await loadUserContext(s);
  }, [loadUserContext]);

  useEffect(() => {
    // Initial session load
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      void loadUserContext(s);
    });

    // Listen to auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
      setSession((prev) => {
        if (prev?.user?.id && s?.user?.id && prev.user.id !== s.user.id) {
          queryClient.clear();
        }
        return s;
      });
      void loadUserContext(s);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserContext]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on signOut
    }
    queryClient.clear();
    setSession(null);
    setProfile(null);
    setInstitution(null);
    setInstitutionName(null);
    setVerifiedQualificationIds([]);
  }, []);

  const role: UserRole = profile?.role === 'institution_admin' ? 'institution' : 'user';
  const isVerified = profile ? profile.verification_status === 'verified' : false;
  const isAuthenticated = session !== null;
  const user = mapProfileToUser(profile, session, institutionName);

  const setRole = (_newRole: UserRole) => {
    // Role is driven by profile; kept for interface compatibility
  };

  const switchRole = () => {
    // Role is driven by profile; kept for interface compatibility
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        institution,
        institutionName,
        verifiedQualificationIds,
        user,
        role,
        isVerified,
        loading,
        isAuthenticated,
        signOut,
        refresh,
        setRole,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
