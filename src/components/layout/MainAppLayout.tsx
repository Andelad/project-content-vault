import React, { Suspense, useState, useEffect } from 'react';
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
const SettingsView = React.lazy(() => import('../settings/SettingsView').then(module => ({ default: module.SettingsView })));

// Loading component for lazy-loaded views - modern circle segments spinner
const ViewLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="flex flex-col items-center space-y-3">
      <div className="relative w-10 h-10">
        {/* Circle segments spinner with rounded caps */}
        <svg className="animate-spin" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="31.4 94.2"
          />
        </svg>
      </div>
      <div className="text-sm text-gray-600">Loading...</div>
    </div>
  </div>
);

export function MainAppLayout() {
  const { currentView, mainSidebarCollapsed } = useTimelineContext();
  const { isTimeTracking } = useSettingsContext();
  const { lastAction } = usePlannerContext();
  const [isTrackerExpanded, setIsTrackerExpanded] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Use favicon hook to monitor global time tracking state
  useFavicon(isTimeTracking);
  
  // Detect mobile and tablet sizes
  useEffect(() => {
    const checkSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsTablet(mobile);
      // Auto-collapse on resize to desktop
      if (!mobile) {
        setIsTrackerExpanded(false);
      }
    };
    
    checkSize();
    window.addEventListener('resize', checkSize);
    
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const getViewTitle = () => {
    switch (currentView) {
      case 'timeline': return 'Timeline';
      case 'calendar': return 'Planner';
      case 'insights': return 'Insights';
      case 'projects': return 'Overview';
      case 'profile': return 'Profile';
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
      case 'settings':
        return <SettingsView />;
      default:
        return <PlannerView />; // Default to planner
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fcfcfc]">
      <div 
        className="fixed left-0 bottom-0 z-30 transition-all duration-500 ease-out"
        style={{
          top: isTablet && isTrackerExpanded ? '84px' : '0',
        }}
      >
        <Sidebar />
      </div>
      <div 
        className="flex-1 overflow-hidden flex flex-col transition-all duration-300"
        style={{
          marginLeft: isMobile ? '0' : (mainSidebarCollapsed ? '64px' : '192px'), // 0 on mobile, w-16 = 64px, w-48 = 192px
        }}
      >
        <div 
          className="transition-all duration-500 ease-out"
          style={{
            paddingTop: isTablet && isTrackerExpanded ? '84px' : '0',
          }}
        >
          <AppHeader 
            currentView={currentView}
            viewTitle={getViewTitle()}
            lastAction={lastAction}
            isTrackerExpanded={isTrackerExpanded}
            onToggleTracker={() => setIsTrackerExpanded(!isTrackerExpanded)}
          />
          <div className="overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
            <Suspense fallback={<ViewLoader />}>
              {renderCurrentView()}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
