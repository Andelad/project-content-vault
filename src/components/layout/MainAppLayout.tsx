import React from 'react';
import { Sidebar } from './Sidebar';
import { useTimelineContext } from '../../contexts/TimelineContext';

// Import all views
import { PlannerV2View } from '../views/PlannerV2View';
import { TimelineView } from '../views/TimelineView';
import { ProjectsView } from '../views/ProjectsView';
import { ReportsView } from '../views/ReportsView';
import { ProfileView } from '../views/ProfileView';

export function MainAppLayout() {
  const { currentView } = useTimelineContext();

  const renderCurrentView = () => {
    switch (currentView) {
      case 'timeline':
        return <TimelineView />;
      case 'calendar':
        return <PlannerV2View />;
      case 'insights':
        return <ReportsView />;
      case 'projects':
        return <ProjectsView />;
      case 'profile':
        return <ProfileView />;
      case 'settings':
        return <div className="p-6">Settings View - Coming Soon</div>;
      default:
        return <PlannerV2View />; // Default to planner
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        {renderCurrentView()}
      </div>
    </div>
  );
}
