/**
 * src/pages/ForgotPassword.tsx
 * EquipSync – Hosts the 3-Step Password Recovery Wizard.
 * Normally logged-in users visiting while not in recovery mode are redirected to their dashboard.
 */

import { Navigate } from 'react-router-dom';
import { PasswordRecoveryWizard } from '@/features/auth/PasswordRecoveryWizard';
import { useAuth } from '@/providers/AuthProvider';
import { isRecoveryMode } from '@/lib/auth';

export function ForgotPassword() {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // A normally logged-in user (not in recovery mode) visiting at step 1 is redirected to their dashboard
  if (isAuthenticated && !isRecoveryMode()) {
    const target = role === 'institution' ? '/app/institution' : '/app/user';
    return <Navigate to={target} replace />;
  }

  return <PasswordRecoveryWizard mode="page" />;
}

export default ForgotPassword;
