import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Auth system
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import DiscoverPage from './pages/DiscoverPage';
import LancesPage from './pages/LancesPage';

// Admin pages (lazy-loaded)
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminEstablishmentsPage = lazy(() => import('./pages/admin/AdminEstablishmentsPage'));
const AdminEstablishmentDetailPage = lazy(() => import('./pages/admin/AdminEstablishmentDetailPage'));
const AdminPlayersPage = lazy(() => import('./pages/admin/AdminPlayersPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage'));
const AdminSecurityPage = lazy(() => import('./pages/admin/AdminSecurityPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminTenantsPage = lazy(() => import('./pages/admin/AdminTenantsPage'));

// Legacy routes
import SystemSelectPage from './pages/SystemSelectPage';
import TenantSelectBySystemPage from './pages/TenantSelectBySystemPage';
import LoginPage from './pages/LoginPage';

type TenantTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
};

function applyTheme(theme: TenantTheme | null) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primaryColor) root.style.setProperty('--tenant-primary', theme.primaryColor);
  if (theme.secondaryColor) root.style.setProperty('--tenant-secondary', theme.secondaryColor);
  if (theme.accentColor) root.style.setProperty('--tenant-accent', theme.accentColor);
  if (theme.backgroundColor) root.style.setProperty('--tenant-bg', theme.backgroundColor);
}

function AdminFallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const raw = localStorage.getItem('tenant_theme');
    if (!raw) return;
    try {
      applyTheme(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthProvider>
      <Routes>
        {/* Auth */}
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/profile"
          element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
        />
        <Route path="/discover/:slug" element={<DiscoverPage />} />
        <Route
          path="/lances"
          element={<ProtectedRoute><LancesPage /></ProtectedRoute>}
        />

        {/* Admin Global */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <Suspense fallback={<AdminFallback />}>
                <AdminLayout />
              </Suspense>
            </ProtectedAdminRoute>
          }
        >
          <Route index element={<Suspense fallback={<AdminFallback />}><AdminDashboardPage /></Suspense>} />
          <Route path="establishments" element={<Suspense fallback={<AdminFallback />}><AdminEstablishmentsPage /></Suspense>} />
          <Route path="establishments/:id" element={<Suspense fallback={<AdminFallback />}><AdminEstablishmentDetailPage /></Suspense>} />
          <Route path="players" element={<Suspense fallback={<AdminFallback />}><AdminPlayersPage /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<AdminFallback />}><AdminUsersPage /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={<AdminFallback />}><AdminBillingPage /></Suspense>} />
          <Route path="security" element={<Suspense fallback={<AdminFallback />}><AdminSecurityPage /></Suspense>} />
          <Route path="audit" element={<Suspense fallback={<AdminFallback />}><AdminAuditPage /></Suspense>} />
          <Route path="tenants" element={<Suspense fallback={<AdminFallback />}><AdminTenantsPage /></Suspense>} />
        </Route>

        {/* Legacy routes */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/legacy" element={<SystemSelectPage />} />
        <Route path="/select-tenant/:systemSlug" element={<TenantSelectBySystemPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/super-admin" element={<Navigate to="/admin/tenants" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </AuthProvider>
  );
}
