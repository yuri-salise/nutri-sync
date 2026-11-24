import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout, PageSpinner } from './components/layout/Layout';
import { DialogProvider } from './components/common/DialogProvider';

// Each page is its own chunk: the browser downloads a page's code (and heavy libraries
// such as Leaflet for maps) only when that page is opened.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const LoginPage = page(() => import('./pages/LoginPage'), 'LoginPage');
const RegisterPage = page(() => import('./pages/RegisterPage'), 'RegisterPage');
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const WorkoutLoggerPage = page(() => import('./pages/WorkoutLoggerPage'), 'WorkoutLoggerPage');
const RunTrackerPage = page(() => import('./pages/RunTrackerPage'), 'RunTrackerPage');
const ActivityDetailPage = page(() => import('./pages/ActivityDetailPage'), 'ActivityDetailPage');
const RagNutritionScannerPage = page(
  () => import('./pages/RagNutritionScannerPage'),
  'RagNutritionScannerPage'
);
const NutritionLogPage = page(() => import('./pages/NutritionLogPage'), 'NutritionLogPage');
const CommunityFeedPage = page(() => import('./pages/CommunityFeedPage'), 'CommunityFeedPage');
const AdminAuditPage = page(() => import('./pages/AdminAuditPage'), 'AdminAuditPage');

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, token, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <DialogProvider>
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated Layout Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="workouts" element={<WorkoutLoggerPage />} />
            <Route path="exercises" element={<Navigate to="/workouts" replace />} />
            <Route path="record" element={<RunTrackerPage />} />
            <Route path="record/:id" element={<ActivityDetailPage />} />
            <Route path="runs" element={<Navigate to="/record" replace />} />
            <Route path="scanner" element={<RagNutritionScannerPage />} />
            <Route path="nutrition" element={<NutritionLogPage />} />
            <Route path="community" element={<CommunityFeedPage />} />

            {/* Coach / Admin Only Route (Requirement B4, F5) */}
            <Route
              path="admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminAuditPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </DialogProvider>
    </AuthProvider>
  );
};

export default App;
