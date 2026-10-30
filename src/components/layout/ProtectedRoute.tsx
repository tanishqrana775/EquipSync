import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { UserRole } from '@/lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { role, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If specific role required, can either redirect or allow flexible demo preview
  if (allowedRoles && !allowedRoles.includes(role)) {
    // In Phase 1 demo mode, we redirect to the current role's natural home
    const target = role === 'institution' ? '/app/institution' : '/app/user';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
