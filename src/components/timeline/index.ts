// Timeline feature components
// Main timeline components
export { TimelineView } from '../TimelineView';
export { ProjectTimeline } from './ProjectTimeline';

// Timeline sub-components
export { AddGroupRow } from './AddGroupRow';
export { AddProjectRow } from './AddProjectRow';
export { AddRowComponent } from './AddRowComponent';
export { AvailabilitySidebar } from './AvailabilitySidebar';
export { DragPerformanceMonitor } from './DragPerformanceMonitor';
export { DraggableGroupRow } from './DraggableGroupRow';
export { DraggableRowComponent } from './DraggableRowComponent';
export { HoverableDateCell } from './HoverableDateCell';
export { HoverableTimelineScrollbar } from './HoverableTimelineScrollbar';
export { RowScrollIndicator } from './RowScrollIndicator';
export { SmartHoverAddHolidayBar } from './SmartHoverAddHolidayBar';
export { TimelineBar } from './TimelineBar';
export { TimelineColumnMarkers } from './TimelineColumnMarkers';
export { TimelineDateHeaders } from './TimelineDateHeaders';
export { TimelineHeader } from './TimelineHeader';
export { TimelineScrollbar } from './TimelineScrollbar';
export { TimelineSidebar } from './TimelineSidebar';
export { UnifiedAvailabilityCircles } from './UnifiedAvailabilityCircles';

// Note: Excluded empty/deprecated files:
// - DraggableHolidayBar.tsx (deprecated, functionality moved to AddProjectRow)
// - HolidayOverlay.tsx (empty)
// - TodayColumnOverlay.tsx (empty)
// - StickyScrollIndicators.tsx (empty)
// - WeekendOverlay.tsx (duplicate of TimelineColumnMarkers, removed)
// - Project-related components moved to projects feature:
//   - DraggableProjectRow, ProjectIconIndicator, ProjectMilestones,
//     SmartHoverAddProjectBar, HoverAddProjectBar, StickyRightProjectIndicator
