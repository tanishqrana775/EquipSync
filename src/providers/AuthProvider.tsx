import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../lib/types';
import { mockUsers } from '../lib/mock/users';

interface AuthContextType {
  user: User;
  role: UserRole;
  setRole: (role: UserRole) => void;
  switchRole: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('campusshare_demo_role');
    return saved === 'institution' || saved === 'user' ? saved : 'institution';
  });

  const [user, setUser] = useState<User>(mockUsers[role]);

  useEffect(() => {
    localStorage.setItem('campusshare_demo_role', role);
    setUser(mockUsers[role]);
  }, [role]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
  };

  const switchRole = () => {
    setRoleState((prev) => (prev === 'institution' ? 'user' : 'institution'));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        setRole,
        switchRole,
        isAuthenticated: true,
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
