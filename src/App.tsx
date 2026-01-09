import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './presentation/contexts/AuthContext';
import { ContextProviders } from './presentation/contexts/ContextProviders';
import { Toaster } from './presentation/components/shadcn/toaster';
import { ErrorBoundary } from './presentation/components/debug/ErrorBoundary';
import { ErrorHandlingService } from './infrastructure/errors/ErrorHandlingService';
import { toast } from './presentation/hooks/ui/use-toast';

// Initialize ErrorHandlingService with toast function to avoid circular dependencies
ErrorHandlingService.setToastFunction(toast);

// Pages
import LandingPage from './website/pages/LandingPage';
import Auth from './website/pages/Auth';
import NotFound from './website/pages/NotFound';

// Layout
import { MainAppLayout } from './presentation/components/layout/MainAppLayout';


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
