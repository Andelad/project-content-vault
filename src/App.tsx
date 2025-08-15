import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ProjectDetailModal } from '@/components/ProjectDetailModal';
import { HolidayModal } from '@/components/HolidayModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DevToolsWrapper } from '@/components/DevTools';

// Lazy load view components for better performance
const TimelineView = lazy(() => import('@/components/TimelineView').then(module => ({ default: module.TimelineView })));
const CalendarView = lazy(() => import('@/components/CalendarView').then(module => ({ default: module.CalendarView })));
const EnhancedCalendarView = lazy(() => import('@/components/EnhancedCalendarView').then(module => ({ default: module.EnhancedCalendarView })));
const ProjectsView = lazy(() => import('@/components/ProjectsView').then(module => ({ default: module.ProjectsView })));
const ReportsView = lazy(() => import('@/components/ReportsView').then(module => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('@/components/SettingsView').then(module => ({ default: module.SettingsView })));
const ProfileView = lazy(() => import('@/components/ProfileView').then(module => ({ default: module.ProfileView })));
const Auth = lazy(() => import('@/pages/Auth'));

// Import the EventDetailModal
import { EventDetailModal } from '@/components/EventDetailModal';

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
  const { 
    currentView, 
    selectedProjectId, 
    setSelectedProjectId, 
    creatingNewProject, 
    setCreatingNewProject, 
    creatingNewHoliday, 
    setCreatingNewHoliday,
    editingHolidayId,
    setEditingHolidayId,
    selectedEventId,
    setSelectedEventId,
    creatingNewEvent,
    setCreatingNewEvent
  } = useApp();

  const { signOut, user } = useAuth();

  const renderView = () => {
    // Pass key directly instead of spreading to avoid React warnings
    switch (currentView) {
      case 'projects':
        return <ProjectsView key={currentView} />;
      case 'timeline':
        return <TimelineView key={currentView} />;
      case 'calendar':
        return <EnhancedCalendarView key={currentView} />;
      case 'reports':
        return <ReportsView key={currentView} />;
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
        {/* Auth status bar */}
        <div className="flex justify-between items-center p-4 border-b bg-background/50 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">
            Signed in as {user?.email}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
        
        <ErrorBoundary fallback={
          <div className="flex-1 flex items-center justify-center bg-background h-full">
            <div className="text-center">
              <p className="text-muted-foreground">Unable to load this view. Please try refreshing the page.</p>
            </div>
          </div>
        }>
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
          rowId={(() => {
            console.log('📋 App.tsx: creatingNewProject:', creatingNewProject);
            console.log('📋 App.tsx: rowId being passed to modal:', creatingNewProject?.rowId);
            return creatingNewProject?.rowId;
          })()}
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

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Auth />
      </Suspense>
    );
  }

  return (
    <AppProvider>
      <DevToolsWrapper>
        <AuthenticatedContent />
      </DevToolsWrapper>
    </AppProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
