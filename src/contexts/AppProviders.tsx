import React from 'react';
import { ProjectProvider } from './ProjectContext';
import { PlannerProvider } from './PlannerContext';
import { TimelineProvider } from './TimelineContext';
import { SettingsProvider } from './SettingsContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Composition component that wraps the app with all new context providers.
 * This replaces the monolithic AppProvider for better separation of concerns.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SettingsProvider>
      <TimelineProvider>
        <PlannerProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </PlannerProvider>
      </TimelineProvider>
    </SettingsProvider>
  );
}

import { useProjectContext } from './ProjectContext';
import { usePlannerContext } from './PlannerContext';
import { useTimelineContext } from './TimelineContext';
import { useSettingsContext } from './SettingsContext';

/**
 * Hook to use multiple contexts at once.
 * This is a convenience hook for components that need multiple contexts.
 */
export function useAppContexts() {

  return {
    project: useProjectContext(),
    planner: usePlannerContext(),
    timeline: useTimelineContext(),
    settings: useSettingsContext(),
  };
}
