import React, { Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useFavicon } from '../../hooks/useFavicon';
import { usePlannerContext } from '../../contexts/PlannerContext';

// Lazy load views for better performance
const PlannerView = React.lazy(() => import('../views/PlannerView').then(module => ({ default: module.PlannerView })));
const TimelineView = React.lazy(() => import('../views/TimelineView').then(module => ({ default: module.TimelineView })));
const ProjectsView = React.lazy(() => import('../views/ProjectsView').then(module => ({ default: module.ProjectsView })));
const InsightsView = React.lazy(() => import('../views/InsightsView').then(module => ({ default: module.InsightsView })));
const ProfileView = React.lazy(() => import('../views/ProfileView').then(module => ({ default: module.ProfileView })));
const FeedbackView = React.lazy(() => import('../views/FeedbackView').then(module => ({ default: module.FeedbackView })));
const SettingsView = React.lazy(() => import('../settings/SettingsView').then(module => ({ default: module.SettingsView })));

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
  const { lastAction } = usePlannerContext();
  
  // Use favicon hook to monitor global time tracking state
  useFavicon(isTimeTracking);

  const getViewTitle = () => {
    switch (currentView) {
      case 'timeline': return 'Timeline';
      case 'calendar': return 'Planner';
      case 'insights': return 'Insights';
      case 'projects': return 'Projects';
      case 'profile': return 'Profile';
      case 'feedback': return 'Feedback';
      case 'settings': return 'Settings';
      default: return 'Planner';
    }
  };

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
      case 'feedback':
        return <FeedbackView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <PlannerView />; // Default to planner
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-hidden flex flex-col">
        <AppHeader 
          currentView={currentView}
          viewTitle={getViewTitle()}
          lastAction={lastAction}
        />
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<ViewLoader />}>
            {renderCurrentView()}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
