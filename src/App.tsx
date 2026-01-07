import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContextProviders } from './contexts/ContextProviders';
import { Toaster } from './components/shadcn/toaster';
import { ErrorBoundary } from './components/debug/ErrorBoundary';

// Pages
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';

// Layout
import { MainAppLayout } from './components/layout/MainAppLayout';

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
