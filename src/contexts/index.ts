// Export all context providers and hooks
export { ProjectProvider, useProjectContext } from './ProjectContext';
export { PlannerProvider, usePlannerContext } from './PlannerContext';
export { TimelineProvider, useTimelineContext } from './TimelineContext';
export { SettingsProvider, useSettingsContext } from './SettingsContext';

// Legacy exports for gradual migration
export { AppProvider, useApp } from './AppContext';
export { AppStateProvider, useAppState } from './AppStateContext';
export { AppActionsProvider, useAppActions } from './AppActionsContext';
export { AuthProvider, useAuth } from './AuthContext';

// Type exports
export type { Project, Group, Row, Milestone } from '@/types/core';
