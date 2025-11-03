// Timeline feature components
// Main timeline components
export { TimelineView } from '../views/TimelineView';

// Timeline sub-components
export { HolidayBar } from './HolidayBar';
export { TimelineBar } from './TimelineBar';
export { TimelineDateHeaders } from './TimelineDateHeaders';
export { TimelineGrid } from './TimelineGrid';
export { TimelineOverlays } from './TimelineOverlays';
export { TimelineToolbar } from './TimelineToolbar';

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
// ✅ TimelineOverlays.tsx - column markers, weekend/holiday calculations delegated (merged with TimelineColumnMarkers)
