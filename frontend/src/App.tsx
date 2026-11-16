import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkoutLoggerPage } from './pages/WorkoutLoggerPage';
import { RunTrackerPage } from './pages/RunTrackerPage';
import { RagNutritionScannerPage } from './pages/RagNutritionScannerPage';
import { NutritionLogPage } from './pages/NutritionLogPage';
import { CommunityFeedPage } from './pages/CommunityFeedPage';
import { AdminAuditPage } from './pages/AdminAuditPage';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, token, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
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
      <BrowserRouter>
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
            <Route path="runs" element={<RunTrackerPage />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
