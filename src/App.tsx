import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './presentation/app/contexts/AuthContext';
import { ContextProviders } from './presentation/app/contexts/ContextProviders';
import { Toaster } from './presentation/app/components/shadcn/toaster';
import { ErrorBoundary } from './presentation/app/components/debug/ErrorBoundary';

// Pages
import LandingPage from './presentation/website/pages/LandingPage';
import Auth from './presentation/website/pages/Auth';
import NotFound from './presentation/website/pages/NotFound';

// Layout
import { MainAppLayout } from './presentation/app/components/layout/MainAppLayout';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? <Navigate to="/app" replace /> : <LandingPage />
        }
      />
      <Route
        path="/auth"
        element={
          user ? <Navigate to="/app" replace /> : <Auth />
        }
      />
      <Route
        path="/app"
        element={
          user ? (
            <ContextProviders>
              <MainAppLayout />
            </ContextProviders>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
          <Toaster />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
