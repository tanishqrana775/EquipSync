import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMyContext } from '../lib/api/rpc';
import { User, UserRole } from '../lib/types';
import { mockUsers } from '../lib/mock/users';
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

const isMockMode = import.meta.env.VITE_USE_MOCKS === 'true';

function mapProfileToUser(
  profile: ProfileRow | null,
  session: Session | null,
  fallbackRole: UserRole,
  institutionName: string | null
): User {
  if (!profile || !session) {
    return mockUsers[fallbackRole];
  }

  const role: UserRole = profile.role === 'institution_admin' ? 'institution' : 'user';
  return {
    id: profile.id,
    name: profile.full_name || session.user.email?.split('@')[0] || 'Campus Member',
    email: session.user.email || '',
    role,
    department: institutionName || profile.user_type || 'Campus Facility',
    campusId: profile.id.slice(0, 8).toUpperCase(),
    avatar: profile.avatar_url || '',
    isVerified: profile.verification_status === 'verified',
    joinedDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Recent',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [institution, setInstitution] = useState<InstitutionRow | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [verifiedQualificationIds, setVerifiedQualificationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(!isMockMode);

  // Fallback demo role for mock mode or manual demo switching
  const [demoRole, setDemoRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('campusshare_demo_role');
    return saved === 'institution' || saved === 'user' ? saved : 'institution';
  });

  const loadUserContext = useCallback(async (currentSession: Session | null) => {
    if (isMockMode || !currentSession) {
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
      // If get_my_context fails or user has no profile yet, do not break the app
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
    if (isMockMode) {
      setLoading(false);
      return;
    }

    // Initial session load
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      void loadUserContext(s);
    });

    // Listen to auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void loadUserContext(s);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserContext]);

  const signOut = useCallback(async () => {
    if (!isMockMode) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setProfile(null);
    setInstitution(null);
    setInstitutionName(null);
    setVerifiedQualificationIds([]);
  }, []);

  const setRole = (newRole: UserRole) => {
    setDemoRole(newRole);
    localStorage.setItem('campusshare_demo_role', newRole);
  };

  const switchRole = () => {
    setRole(effectiveRole === 'institution' ? 'user' : 'institution');
  };

  // Determine effective role: real profile role takes precedence over demo role
  const effectiveRole: UserRole = profile
    ? profile.role === 'institution_admin'
      ? 'institution'
      : 'user'
    : demoRole;

  const isVerified = profile ? profile.verification_status === 'verified' : true;
  const isAuthenticated = isMockMode ? true : session !== null;
  const user = mapProfileToUser(profile, session, effectiveRole, institutionName);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        institution,
        institutionName,
        verifiedQualificationIds,
        user,
        role: effectiveRole,
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
