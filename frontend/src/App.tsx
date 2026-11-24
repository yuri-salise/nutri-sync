import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { DialogProvider } from './components/common/DialogProvider';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const WorkoutLoggerPage = lazy(() => import('./pages/WorkoutLoggerPage').then((m) => ({ default: m.WorkoutLoggerPage })));
const RunTrackerPage = lazy(() => import('./pages/RunTrackerPage').then((m) => ({ default: m.RunTrackerPage })));
const RagNutritionScannerPage = lazy(() => import('./pages/RagNutritionScannerPage').then((m) => ({ default: m.RagNutritionScannerPage })));
const NutritionLogPage = lazy(() => import('./pages/NutritionLogPage').then((m) => ({ default: m.NutritionLogPage })));
const CommunityFeedPage = lazy(() => import('./pages/CommunityFeedPage').then((m) => ({ default: m.CommunityFeedPage })));
const AdminAuditPage = lazy(() => import('./pages/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));

const Spinner = () => (
  <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-label="Loading">
    <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, token, role, loading } = useAuth();

  if (loading) {
    return (
      <Spinner />
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
        <Suspense fallback={<Spinner />}>
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
