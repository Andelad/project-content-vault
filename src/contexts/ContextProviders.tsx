import React from 'react';
import { ProjectProvider } from './ProjectContext';
import { PlannerProvider } from './PlannerContext';
import { TimelineProvider } from './TimelineContext';
import { SettingsProvider } from './SettingsContext';

interface ContextProvidersProps {
  children: React.ReactNode;
}

/**
 * Composition component that wraps the app with all context providers.
 * Provides a single wrapper for all application state management contexts.
 */
export function ContextProviders({ children }: ContextProvidersProps) {
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

// Legacy export for backward compatibility
export const AppProviders = ContextProviders;

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
