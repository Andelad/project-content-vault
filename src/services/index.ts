/**
 * Central Services Index
 * Single Source of Truth Architecture - matches Architectural Guide
 * 
 * 🚨 ARCHITECTURAL RULE: ALL CALCULATIONS MUST USE THESE SERVICES
 * 
 * ❌ DON'T add calculations to:
 *    - Components (render logic only)
 *    - Hooks (state management only) 
 *    - Utils (use these services instead)
 *
 * ✅ Architectural layers (matching guide):
 */

// Core infrastructure - working (includes calculateDurationHours and other core utilities)
export * from './core';

// Specific legacy exports that components need (temporary during migration)
export { HeightCalculationService } from './legacy/timeline/HeightCalculationService';
export { TimelinePositioningService } from './legacy/timeline/TimelinePositioningService';
export { ProjectCalculationService } from './legacy/projects/ProjectCalculationService';
export { WorkHourCalculationService } from './legacy/work-hours/WorkHourCalculationService';

// Unified services that components need
export { TimeTrackerCalculationService } from './unified/UnifiedTimeTrackerService';

// Timeline positioning functions (frequently used)
export { 
  calculateOccupiedHolidayIndices, 
  convertMousePositionToIndex, 
  convertIndicesToDates, 
  calculateMinimumHoverOverlaySize 
} from './legacy/timeline/timelinePositionService';

// Work hours functions from creation service
export { calculateTimeFromPosition } from './legacy/work-hours/workHourCreationService';
export { calculateDurationMinutes } from './legacy/work-hours/workHourCreationService';
export { calculateWorkHourCapacity } from './legacy/work-hours/workHourCapacityService';

// Project functions frequently used
export { calculateProjectDuration } from './legacy/projects/projectProgressService';
export { calculateProjectTimeMetrics } from './legacy/projects/projectProgressService';
export { ProjectWorkingDaysService } from './legacy/projects/projectWorkingDaysService';

// Event-related functions  
export { formatDuration, calculateEventDurationOnDateLegacy } from './legacy/events/eventDurationService';
export { memoizedGetProjectTimeAllocation, calculateEventStyle, getProjectTimeAllocation } from './legacy/events/eventWorkHourIntegrationService';
export { isPlannedTimeCompleted } from './legacy/events/plannedTimeCompletionService';
export { calculateOverlapActions, findOverlappingEvents } from './legacy/events/eventOverlapService';
export { processEventOverlaps, calculateElapsedTime, createTimeRange, type EventSplitResult } from './legacy/events/eventSplittingService';

// Milestones functions
export { getMilestoneSegmentForDate, type MilestoneSegment } from './legacy/milestones/milestoneUtilitiesService';

// Milestone calculations
export {
  calculateTotalAllocation,
  calculateBudgetUtilization,
  calculateRemainingBudget,
  calculateOverageAmount,
  calculateMilestoneDensity,
  calculateAverageMilestoneAllocation,
  calculateAllocationDistribution,
  calculateOptimalMilestoneSpacing,
  calculateBusinessDaySpacing,
  calculateTimelinePressure,
  calculateMilestoneVelocity,
  calculateSuggestedMilestoneBudget,
  sortMilestonesByDate,
  findMilestoneGap
} from './core/calculations/milestoneCalculations';

// Timeline functions 
export { WorkHoursValidationService } from './legacy/timeline/TimelineBusinessLogicService';

// UI functions
export { getBaseFullCalendarConfig, getEventStylingConfig } from './ui/FullCalendarConfig';

// Unified functions
export { transformFullCalendarToCalendarEvent } from './unified/UnifiedEventTransformService';
export { clearTimelineCache } from './unified/UnifiedEventWorkHourService';
export { generateWorkHoursForDate } from './unified/UnifiedEventWorkHourService';
export { calculateAvailabilityReduction } from './unified/UnifiedEventWorkHourService';
export { calculateProjectWorkingDays } from './unified/UnifiedEventWorkHourService';

// Additional missing exports for components (only existing ones)
export { WeeklyCapacityCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
export { expandHolidayDates } from './core/calculations/holidayCalculations';
export { MilestoneManagementService } from './legacy/milestones/milestoneManagementService';
export { UnifiedMilestoneService } from './unified/UnifiedMilestoneService';

// Work hours related exports
export { getWorkHoursCapacityForPeriod } from './legacy/work-hours/workHourCapacityService';

// Timeline related exports
export { TimelineViewportService } from './legacy/timeline/timelineViewportService';
export { HolidayCalculationService } from './legacy/timeline/HolidayCalculationService';
export { ProjectValidationService } from './legacy/projects/ProjectValidationService';

// Project related exports
export { getEffectiveProjectStatus } from './legacy/projects/projectStatusService';

// Settings related exports (from calculations)
export { calculateDayTotalHours } from './legacy/settings/calculations/workSlotCalculations';
export { calculateWeekTotalHours } from './legacy/settings/calculations/scheduleCalculations';
export { generateTimeOptions } from './legacy/settings/calculations/timeCalculations';
export { generateDefaultWorkSchedule } from './legacy/settings/calculations/scheduleCalculations';

// Milestone related exports
export { calculateRecurringMilestoneCount } from './legacy/milestones/recurringMilestoneService';
export { calculateRecurringTotalAllocation } from './legacy/milestones/recurringMilestoneService';
export { detectRecurringPattern } from './legacy/milestones/recurringMilestoneService';
export { calculateMilestoneInterval } from './legacy/milestones/milestoneUtilitiesService';
export { calculateMilestoneSegments } from './legacy/milestones/milestoneUtilitiesService';

// Event related exports
export { aggregateEventDurationsByDate } from './legacy/events/eventDurationService';
export { calculateEventDurationOnDate } from './legacy/events/eventDurationService';

// Timeline calculation exports
export { TimelineCalculationService } from './legacy/timeline/TimelineCalculationService';
export { ProjectDaysCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
export { ProjectMetricsCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
export { WorkHoursCalculationService } from './legacy/timeline/TimelineBusinessLogicService';

// Timeline bar exports
export { isHolidayDateCapacity } from './legacy/work-hours/workHourCapacityService';

// Availability circles exports
export { calculateAvailabilityCircleSize } from './legacy/timeline/AvailabilityCircleSizingService';

// Reports view exports
export { ProjectCalculationService as CoreProjectCalculationService } from './legacy/projects/ProjectCalculationService';

// Timeline view exports
export { throttledDragUpdate as throttleDragUpdate } from './core/performance/dragPerformanceService';

// Work hours component exports
export { handleWorkHourCreationStart } from './legacy/work-hours/workHourCreationService';
export { handleWorkHourCreationMove } from './legacy/work-hours/workHourCreationService';
export { handleWorkHourCreationComplete } from './legacy/work-hours/workHourCreationService';
export { formatTimeForDisplay } from './legacy/work-hours/workHourCreationService';
export { formatDurationFromHours } from './legacy/work-hours/workHourCreationService';

// Context exports
// export { PlannerV2CalculationService } from './legacy/projects/ProjectCalculationService';

// Orchestrators - All workflow coordination
export * from './orchestrators';

// TODO: Add back these exports once we fix the module resolution issues:
// export * from './validators';
// export * from './repositories';
// export * from './ui';
// Unified services (complete export)
export * from './unified';
// Additional explicit exports for entities
export { UnifiedProjectEntity, UnifiedMilestoneEntity } from './unified';
// export * from './legacy/events';
// export * from './legacy/insights';
// export * from './legacy/milestones';
// export * from './legacy/projects';
// export * from './legacy/settings';
// export * from './legacy/timeline';
// export * from './legacy/work-hours';

// NEW MISSING EXPORTS - Adding systematically
// Calendar integration
export { CalendarIntegrationService, type ImportResult } from './unified/UnifiedCalendarService';

// Work schedule functions - corrected paths
export { formatWorkSlotDurationDisplay } from './legacy/work-hours/workHourCreationService';
export { createNewWorkSlot } from './legacy/settings/calculations/workSlotCalculations';
export { updateWorkSlot } from './legacy/settings/calculations/workSlotCalculations';
export { analyzeWorkSchedule } from './legacy/settings/calculations/scheduleCalculations';

// Timeline scrollbar functions
export { calculateScrollbarPosition } from './legacy/timeline/timelinePositionService';
export { calculateScrollbarClickTarget } from './legacy/timeline/timelinePositionService';
export { calculateScrollbarDragTarget } from './legacy/timeline/timelinePositionService';
export { calculateScrollEasing } from './legacy/timeline/timelinePositionService';
export { calculateAnimationDuration } from './legacy/timeline/timelinePositionService';

// Timeline bar functions - TODO: Create these services
// export { generateWorkHoursForDate } from './legacy/work-hours/workHourGenerationService';
// export { calculateMilestoneSegments } from './legacy/milestones/milestoneCalculationService';

// Availability circles functions
// export { calculateAvailabilityCircleSize } from './legacy/timeline/AvailabilityCircleSizingService';
// export { calculateAvailabilityReduction } from './legacy/timeline/AvailabilityCircleSizingService';
// export { generateWorkHoursForDate as generateWorkHoursForDateCircles } from './legacy/work-hours/workHourGenerationService';
export { calculateOvertimePlannedHours } from './legacy/work-hours/workHourCapacityService';
export { calculateTotalPlannedHours } from './legacy/work-hours/workHourCapacityService';
export { calculateOtherTime } from './legacy/work-hours/workHourCapacityService';
// export { calculateProjectWorkingDays } from './legacy/projects/projectWorkingDaysService';
export { getMinimumCircleDimensions } from './legacy/timeline/AvailabilityCircleSizingService';

// Work hours calculation service
// export { WorkHoursCalculationService } from './legacy/work-hours/WorkHourCalculationService';

// Reports functions
export { calculateFutureCommitments } from './legacy/insights/insightsCalculationService';
export { calculateWeeklyCapacity } from './legacy/insights/insightsCalculationService';

// Timeline view functions
export { calculateDaysDelta } from './legacy/events/dragCalculationService';
export { createSmoothDragAnimation } from './legacy/events/dragCalculationService';
export { debounceDragUpdate } from './legacy/events/dragCalculationService';
export { type SmoothAnimationConfig } from './legacy/events/dragCalculationService';

// Project overlap functions
export { checkProjectOverlap, adjustProjectDatesForDrag } from './legacy/projects/projectOverlapService';
export { type Project, type ConflictDetectionResult, type DateAdjustmentResult } from './legacy/projects/projectOverlapService';
export { detectLiveDragConflicts, resolveDragConflicts } from './legacy/projects/projectOverlapService';

// Work hours creator functions
export { getWorkHourOverlapInfo } from './legacy/work-hours/workHourCreationService';
export { generateWorkHourPreviewStyle } from './legacy/work-hours/workHourCreationService';
export { formatDurationPreview } from './legacy/work-hours/workHourCreationService';
export { getWorkHourCreationCursor } from './legacy/work-hours/workHourCreationService';
export { shouldAllowWorkHourCreation } from './legacy/work-hours/workHourCreationService';
export { type WorkHourCreateState } from './legacy/work-hours/workHourCreationService';

// Timeline positioning
export { type PositionCalculation } from './legacy/timeline/TimelinePositioningService';

// Project progress
export { type ComprehensiveProjectTimeMetrics } from './legacy/projects/projectProgressService';
export { type ProjectProgressAnalysis } from './legacy/projects/projectProgressGraphService';
export { analyzeProjectProgress } from './legacy/projects/projectProgressGraphService';

// Milestone calculation service
export { MilestoneCalculationService } from './legacy/milestones/milestoneCalculationService';

// Planner calculation service
export { PlannerV2CalculationService } from './core/calculations/plannerCalculations';

// Unified calendar service - TODO: Create this service
// export { UnifiedCalendarService } from './unified/UnifiedCalendarService';

// Holiday overlap check
export { wouldOverlapHolidays } from './legacy/work-hours/workHourCapacityService';

// Committed hours calculation
export { CommittedHoursCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
