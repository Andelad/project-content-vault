/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { ProjectProvider } from './ProjectContext';
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
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </TimelineProvider>
    </SettingsProvider>
  );
}

// Legacy export for backward compatibility
export const AppProviders = ContextProviders;

import { useProjectContext } from './ProjectContext';
import { useTimelineContext } from './TimelineContext';
import { useSettingsContext } from './SettingsContext';

/**
 * Hook to use multiple contexts at once.
 * This is a convenience hook for components that need multiple contexts.
 */
export function useAppContexts() {
  return {
    project: useProjectContext(),
    timeline: useTimelineContext(),
    settings: useSettingsContext(),
  };
}
