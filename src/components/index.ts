/**
 * Components Barrel Export
 * Feature-based component organization
 */

// Feature-specific components
export * from './settings';
export * from './timeline';
export * from './projects';
export * from './insights';

// Known working individual components
export { CalendarImport } from './CalendarImport';
export { CalendarInsightCard } from './CalendarInsightCard';
export { ErrorBoundary } from './ErrorBoundary';
export { EventDetailModal } from './EventDetailModal';
export { HolidayModal } from './HolidayModal';
export { MilestoneManager } from './MilestoneManager';
export { PerformanceStatus } from './PerformanceStatus';
export { PlannerInsightCard } from './PlannerInsightCard';
export { PlannerView } from './PlannerView';
export { ProfileView } from './ProfileView';
export { RecurringDeleteDialog } from './RecurringDeleteDialog';
export { RichTextEditor } from './RichTextEditor';
export { Sidebar } from './Sidebar';
export { TextFormattingToolbar } from './TextFormattingToolbar';
export { TimeTracker } from './TimeTracker';
export { ViewErrorFallback } from './ViewErrorFallback';
export { WorkHourChangeModal } from './WorkHourChangeModal';
export { WorkHourCreationModal } from './WorkHourCreationModal';
export { WorkHourCreator } from './WorkHourCreator';
export { WorkHourScopeDialog } from './WorkHourScopeDialog';

// Default exports (need special handling)
export { default as DebugView } from './DebugView';
export { default as TestContexts } from './TestContexts';
export { default as TestProjectContext } from './TestProjectContext';
