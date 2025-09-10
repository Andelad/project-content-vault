import React, { Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useFavicon } from '../../hooks/useFavicon';

// Lazy load views for better performance
const PlannerView = React.lazy(() => import('../views/PlannerView').then(module => ({ default: module.PlannerView })));
const TimelineView = React.lazy(() => import('../views/TimelineView').then(module => ({ default: module.TimelineView })));
const ProjectsView = React.lazy(() => import('../views/ProjectsView').then(module => ({ default: module.ProjectsView })));
const InsightsView = React.lazy(() => import('../views/InsightsView').then(module => ({ default: module.InsightsView })));
const ProfileView = React.lazy(() => import('../views/ProfileView').then(module => ({ default: module.ProfileView })));

// Loading component for lazy-loaded views
const ViewLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="flex flex-col items-center space-y-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <div className="text-sm text-gray-600">Loading...</div>
    </div>
  </div>
);

export function MainAppLayout() {
  const { currentView } = useTimelineContext();
  const { isTimeTracking } = useSettingsContext();
  
  // Use favicon hook to monitor global time tracking state
  useFavicon(isTimeTracking);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'timeline':
        return <TimelineView />;
      case 'calendar':
        return <PlannerView />;
      case 'insights':
        return <InsightsView />;
      case 'projects':
        return <ProjectsView />;
      case 'profile':
        return <ProfileView />;
      case 'settings':
        return <div className="p-6">Settings View - Coming Soon</div>;
      default:
        return <PlannerView />; // Default to planner
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<ViewLoader />}>
          {renderCurrentView()}
        </Suspense>
      </div>
    </div>
  );
}
