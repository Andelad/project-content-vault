// Timeline feature components
// Main timeline components
export { TimelineView } from '../views/TimelineView';
export { ProjectTimeline } from './ProjectTimeline';

// Timeline sub-components
export { AddGroupRow } from './AddGroupRow';
export { AddProjectRow } from './AddProjectRow';
export { DragPerformanceMonitor } from './DragPerformanceMonitor';
export { HoverableDateCell } from './HoverableDateCell';
export { HoverableTimelineScrollbar } from './HoverableTimelineScrollbar';
export { RowScrollIndicator } from './RowScrollIndicator';
export { SmartHoverAddHolidayBar } from './SmartHoverAddHolidayBar';
export { TimelineBar } from './TimelineBar';
export { TimelineColumnMarkers } from './TimelineColumnMarkers';
export { TimelineDateHeaders } from './TimelineDateHeaders';
export { TimelineScrollbar } from './TimelineScrollbar';
export { UnifiedAvailabilityCircles } from './UnifiedAvailabilityCircles';
export { TabbedAvailabilityCard } from './TabbedAvailabilityCard';
export { WorkloadGraph } from './WorkloadGraph';

// Cleaned up - removed empty/deprecated files:
// ✅ Removed: DraggableHolidayBar.tsx (deprecated, functionality moved to AddProjectRow)
// ✅ Removed: HolidayOverlay.tsx (empty)
// ✅ Removed: TodayColumnOverlay.tsx (empty)
// ✅ Removed: StickyScrollIndicators.tsx (empty)
// ✅ Removed: TimelineAvailabilityContent.tsx (empty)
// ✅ Removed: TimelineInteractions.tsx (empty)
// ✅ Removed: TimelineProjectRenderer.tsx (empty)
// ✅ Removed: sections/TimelineContent.tsx (empty)
// ✅ Removed: sections/AvailabilityContent.tsx (empty)
// ✅ Removed: TimelineBar.tsx.backup (backup file)
// ✅ Removed: DraggableRowComponent.tsx.backup (backup file)
// ✅ Removed: DraggableRowComponent.tsx (row-based timeline component, replaced by auto-layout)
// ✅ Removed: AddRowComponent.tsx (row-based timeline component, replaced by auto-layout)
// ✅ Removed: DraggableGroupRow.tsx (row-based timeline component, replaced by auto-layout)
// ✅ Removed: TimelineSidebar.tsx (row-based timeline component, replaced by auto-layout)
// ✅ Removed: TimelineHeader.tsx (row-based timeline component, replaced by auto-layout)
// ✅ Removed: AvailabilitySidebar.tsx (row-based timeline component, replaced by auto-layout)

// Business logic extracted to UnifiedTimelineService:
// ✅ TimelineBar.tsx - major calculations moved to service
// ✅ ProjectTimeline.tsx - project duration calculation delegated
// ✅ UnifiedAvailabilityCircles.tsx - availability calculations delegated  
// ✅ TimelineDateHeaders.tsx - date grouping logic delegated
// ✅ TimelineColumnMarkers.tsx - column marker calculations delegated
