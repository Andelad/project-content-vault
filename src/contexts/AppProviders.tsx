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

/**
 * Hook to use multiple contexts at once.
 * This is a convenience hook for components that need multiple contexts.
 */
export function useAppContexts() {
  // Note: Only import these when needed to avoid circular dependencies
  const { useProjectContext } = require('./ProjectContext');
  const { usePlannerContext } = require('./PlannerContext');
  const { useTimelineContext } = require('./TimelineContext');
  const { useSettingsContext } = require('./SettingsContext');

  return {
    project: useProjectContext(),
    planner: usePlannerContext(),
    timeline: useTimelineContext(),
    settings: useSettingsContext(),
  };
}
