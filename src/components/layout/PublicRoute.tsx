/**
 * src/components/layout/PublicRoute.tsx
 * EquipSync – Route wrapper preventing authenticated users from accessing public auth pages.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="surface p-8 max-w-sm w-full text-center rounded-2xl border border-border/80 shadow-lg space-y-4">
          <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Verifying security session...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const target = role === 'institution' ? '/app/institution' : '/app/user';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
