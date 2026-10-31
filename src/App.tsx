import { Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from '@/pages/Landing';
import { SignIn } from '@/pages/SignIn';
import { Register } from '@/pages/Register';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { MyBookings } from '@/pages/MyBookings';
import { DisputeResolution } from '@/pages/DisputeResolution';
import { InstitutionDashboard } from '@/pages/InstitutionDashboard';
import { UserDashboard } from '@/pages/UserDashboard';
import { ResourceManagement } from '@/pages/ResourceManagement';
import { Discover } from '@/pages/Discover';
import { BookingCustody } from '@/pages/BookingCustody';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { PublicRoute } from '@/components/layout/PublicRoute';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/providers/AuthProvider';

function AppRedirect() {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
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
          <Route
            path="/login"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<Navigate to="/forgot-password" replace />} />
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
          <Route path="institution/disputes" element={<DisputeResolution />} />
          <Route path="user" element={<UserDashboard />} />
          <Route path="discover" element={<Discover />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="bookings/:id" element={<BookingCustody />} />
          {/* Legacy path redirects within /app */}
          <Route path="dashboard" element={<AppRedirect />} />
          <Route path="my-bookings" element={<Navigate to="/app/bookings" replace />} />
          <Route path="catalog" element={<Navigate to="/app/discover" replace />} />
          {/* Nested /app catch-all: redirects to user dashboard, never to "/" */}
          <Route path="*" element={<AppRedirect />} />
        </Route>

        {/* 404 Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster position="top-right" richColors closeButton />
    </>
  );
}

export default App;
