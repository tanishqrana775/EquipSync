import { Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from '@/pages/Landing';
import { SignIn } from '@/pages/SignIn';
import { Register } from '@/pages/Register';
import { InstitutionDashboard } from '@/pages/InstitutionDashboard';
import { UserDashboard } from '@/pages/UserDashboard';
import { ResourceManagement } from '@/pages/ResourceManagement';
import { Discover } from '@/pages/Discover';
import { BookingCustody } from '@/pages/BookingCustody';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/providers/AuthProvider';

function AppRedirect() {
  const { role } = useAuth();
  return <Navigate to={role === 'institution' ? '/app/institution' : '/app/user'} replace />;
}

export function App() {
  return (
    <>
      <Routes>
        {/* Public Marketing Route */}
        <Route path="/" element={<Landing />} />

        {/* Authentication Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Application Dashboard Routes (Protected by AppShell) */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<AppRedirect />} />
          <Route path="institution" element={<InstitutionDashboard />} />
          <Route path="institution/resources" element={<ResourceManagement />} />
          <Route path="user" element={<UserDashboard />} />
          <Route path="discover" element={<Discover />} />
          <Route path="bookings/:id" element={<BookingCustody />} />
        </Route>

        {/* 404 Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster position="top-right" richColors closeButton />
    </>
  );
}

export default App;
