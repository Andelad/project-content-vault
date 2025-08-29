import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProviders } from '@/contexts/AppProviders';
import { useProjectContext } from '@/contexts/ProjectContext';
import { usePlannerContext } from '@/contexts/PlannerContext';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { Sidebar } from '@/components/layout';
import { ProjectDetailModal } from '@/components';
import { HolidayModal } from '@/components/modals/HolidayModal';
import { ErrorBoundary } from '@/components/debug/ErrorBoundary';
import { DevToolsWrapper } from '@/components/debug/DevTools';
import { useFavicon } from '@/hooks/useFavicon';
import LandingPage from '@/pages/LandingPage';

// Lazy load view components for better performance
const TimelineView = lazy(() => import('@/components/views').then(module => ({ default: module.TimelineView })));
const PlannerView = lazy(() => import('@/components/views').then(module => ({ default: module.PlannerView })));
const PlannerV2View = lazy(() => import('@/components/views').then(module => ({ default: module.PlannerV2View })));
const ProjectsView = lazy(() => import('@/components').then(module => ({ default: module.ProjectsView })));
const InsightsView = lazy(() => import('@/components').then(module => ({ default: module.InsightsView })));
const SettingsView = lazy(() => import('@/components').then(module => ({ default: module.SettingsView })));
const ProfileView = lazy(() => import('@/components/views').then(module => ({ default: module.ProfileView })));
const Auth = lazy(() => import('@/pages/Auth'));

// Import the EventDetailModal
import { EventDetailModal } from '@/components/modals/EventDetailModal';

const queryClient = new QueryClient();

function LoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedContent() {
  // Use specific contexts instead of monolithic useApp
  const { currentView } = useTimelineContext();
  const { 
    selectedProjectId, 
    setSelectedProjectId, 
    creatingNewProject, 
    setCreatingNewProject
  } = useProjectContext();
  const { 
    creatingNewHoliday, 
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId,
    selectedEventId,
    setSelectedEventId,
    creatingNewEvent,
    setCreatingNewEvent,
    ensureRecurringEvents
  } = usePlannerContext();
  const { isTimeTracking } = useSettingsContext();

  const { signOut, user } = useAuth();
  
  // Use the favicon hook to change favicon based on time tracking state
  useFavicon(isTimeTracking);

  // Ensure recurring events are maintained when switching to calendar view
  useEffect(() => {
    if (currentView === 'calendar') {
      ensureRecurringEvents();
    }
  }, [currentView, ensureRecurringEvents]);

  const renderView = () => {
    // Pass key directly instead of spreading to avoid React warnings
    switch (currentView) {
      case 'projects':
        return <ProjectsView key={currentView} />;
      case 'timeline':
        return <TimelineView key={currentView} />;
      case 'calendar':
        return <PlannerView key={currentView} />;
      case 'plannerV2':
        return <PlannerV2View key={currentView} />;
      case 'insights':
        return <InsightsView key={currentView} />;
      case 'settings':
        return <SettingsView key={currentView} />;
      case 'profile':
        return <ProfileView key={currentView} />;
      default:
        return <ProjectsView key={currentView} />;
    }
  };

  return (
    <div className="flex bg-background h-screen w-full">
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
      
      <div className="flex-1 bg-background light-scrollbar overflow-auto">
        
        <ErrorBoundary 
          showDetails={true}
          fallback={
            <div className="flex-1 flex items-center justify-center bg-background h-full">
              <div className="text-center">
                <p className="text-muted-foreground">Unable to load this view. Please try refreshing the page.</p>
              </div>
            </div>
          }
        >
          <Suspense fallback={<LoadingFallback />}>
            {renderView()}
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Global Modals with Error Boundaries */}
      <ErrorBoundary>
        <ProjectDetailModal
          key="edit-modal"
          isOpen={!!selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          projectId={selectedProjectId || ''}
        />

        <ProjectDetailModal
          key="create-modal"
          isOpen={!!creatingNewProject}
          onClose={() => setCreatingNewProject(null)}
          groupId={creatingNewProject?.groupId || ''}
          rowId={creatingNewProject?.rowId}
        />

        <EventDetailModal
          key="edit-event-modal"
          isOpen={!!selectedEventId}
          onClose={() => setSelectedEventId(null)}
          eventId={selectedEventId || ''}
        />

        <EventDetailModal
          key="create-event-modal"
          isOpen={!!creatingNewEvent}
          onClose={() => setCreatingNewEvent(null)}
          defaultStartTime={creatingNewEvent?.startTime}
          defaultEndTime={creatingNewEvent?.endTime}
        />

        <HolidayModal
          isOpen={!!creatingNewHoliday}
          onClose={() => setCreatingNewHoliday(null)}
          defaultStartDate={creatingNewHoliday?.startDate}
          defaultEndDate={creatingNewHoliday?.endDate}
        />

        <HolidayModal
          isOpen={!!editingHolidayId}
          onClose={() => setEditingHolidayId(null)}
          holidayId={editingHolidayId || undefined}
        />
      </ErrorBoundary>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');

  if (loading) {
    return <LoadingFallback />;
  }

  // Show landing page for root route
  if (location.pathname === '/') {
    return <LandingPage />;
  }

  // Show auth page for /auth route
  if (location.pathname === '/auth') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Auth />
      </Suspense>
    );
  }

  // For app routes, require authentication
  if (isAppRoute && !user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Auth />
      </Suspense>
    );
  }

  // For app routes with authenticated user
  if (isAppRoute && user) {
    return (
      <AppProviders>
        <DevToolsWrapper>
          <AuthenticatedContent />
        </DevToolsWrapper>
      </AppProviders>
    );
  }

  // Fallback - redirect to appropriate page
  return <LandingPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
