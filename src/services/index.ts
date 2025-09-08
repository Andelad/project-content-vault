/**
 * 🏗️ AI-Optimized Services Architecture - Central Index
 * SINGLE SOURCE OF TRUTH for all service imports
 * 
 * 🚨 ARCHITECTURAL RULES:
 * ❌ DON'T add calculations to: Components, Hooks, Utils
 * ✅ DO import from: @/services (this barrel export only)
 * ✅ Logic Flow: Components → Unified Services → Orchestrators → Validators + Calculations + Repositories
 *
 * 📁 Current Architecture Layers:
 * ├── unified/           # Main API - Components import from here
 * ├── orchestrators/     # Workflow coordination  
 * ├── calculations/      # Pure business calculations
 * ├── validators/        # Business rules validation
 * ├── repositories/      # Data access layer
 * ├── ui/               # View-specific positioning & layout
 * ├── infrastructure/   # Technical utilities (caching, colors, dates)
 * ├── performance/      # Performance optimization & monitoring
 * └── legacy/           # Migration safety (temporary)
 */

// 🎯 Core Architecture Layers (New Structure)
export * from './unified';           // Main API - UnifiedProjectService, UnifiedMilestoneService, etc.
export * from './orchestrators';     // Workflow coordination - ProjectOrchestrator, TimeTrackingOrchestrator
export * from './calculations';      // Pure business calculations - projectCalculations, timeCalculations
export * from './validators';        // Business rules - ProjectValidator, TimeTrackingValidator  
// export * from './repositories';      // Data access - ProjectRepository, MilestoneRepository (conflicts with orchestrators)
export * from './ui';               // View positioning - TimelinePositioning, TimelineViewport, CalendarLayout
export * from './infrastructure';   // Technical utilities - calculationCache, colorCalculations
export * from './performance';      // Performance optimization - dragPerformanceService, cachePerformanceService

// 🚧 Legacy Services (Temporary - During Migration)
// These will be removed once migration to new architecture is complete
export { HeightCalculationService } from './legacy/timeline/HeightCalculationService';
export { TimelinePositioningService } from './legacy/timeline/TimelinePositioningService';
export { ProjectCalculationService } from './legacy/projects/ProjectCalculationService';
export { WorkHourCalculationService } from './legacy/work-hours/WorkHourCalculationService';

// 🔧 Additional Temporary Exports (Remove after migration)
// Timeline positioning functions (frequently used)
export { 
  calculateOccupiedHolidayIndices, 
  convertMousePositionToIndex, 
  convertIndicesToDates, 
  calculateMinimumHoverOverlaySize 
} from './legacy/timeline/timelinePositionService';

// 🎯 Unified Services (Main API Layer)
export { TimeTrackerCalculationService } from './unified/UnifiedTimeTrackerService';
export { UnifiedMilestoneService } from './unified/UnifiedMilestoneService';
export { CalendarIntegrationService, type ImportResult } from './unified/UnifiedCalendarService';
export { transformFullCalendarToCalendarEvent } from './unified/UnifiedEventTransformService';
export { clearTimelineCache, generateWorkHoursForDate, calculateAvailabilityReduction, calculateProjectWorkingDays } from './unified/UnifiedEventWorkHourService';

// 🔧 Frequently Used Functions (Stable API)
export { 
  expandHolidayDates,
  expandHolidayDatesDetailed,
  getHolidayForDate,
  getHolidaysInRangeDetailed,
  countHolidayDaysInRange
} from './calculations/holidayCalculations';
export { getBaseFullCalendarConfig, getEventStylingConfig } from './ui/FullCalendarConfig';
export { throttledDragUpdate as throttleDragUpdate } from './performance/dragPerformanceService';

// 📊 Calculation Functions (Business Logic)
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
} from './calculations/milestoneCalculations';

// 🚧 Legacy Layer (Migration in Progress)
// ⚠️ TODO: Migrate these to new architecture layers above
// These exports maintain backward compatibility during the migration process
// Once migration is complete, all functionality will be available through the new layers

// Essential legacy services still needed by components
export { WorkHoursValidationService } from './legacy/timeline/TimelineBusinessLogicService';
export { WeeklyCapacityCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
export { MilestoneManagementService } from './legacy/milestones/milestoneManagementService';
export { TimelineViewportService } from './legacy/timeline/timelineViewportService';
export { HolidayCalculationService } from './legacy/timeline/HolidayCalculationService';
export { ProjectValidationService } from './legacy/projects/ProjectValidationService';
export { TimelineCalculationService } from './legacy/timeline/TimelineCalculationService';

// Legacy calculation functions (to be migrated)
export { calculateTimeFromPosition, calculateDurationMinutes } from './legacy/work-hours/workHourCreationService';
export { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from './legacy/work-hours/workHourCapacityService';
export { calculateProjectDuration, calculateProjectTimeMetrics } from './legacy/projects/projectProgressService';
export { formatDuration, calculateEventDurationOnDateLegacy } from './legacy/events/eventDurationService';
export { memoizedGetProjectTimeAllocation, calculateEventStyle, getProjectTimeAllocation } from './legacy/events/eventWorkHourIntegrationService';
export { isPlannedTimeCompleted } from './legacy/events/plannedTimeCompletionService';
export { calculateOverlapActions, findOverlappingEvents } from './legacy/events/eventOverlapService';
export { processEventOverlaps, calculateElapsedTime, createTimeRange, type EventSplitResult } from './legacy/events/eventSplittingService';

// Additional legacy exports (organized by domain)
export { getEffectiveProjectStatus } from './legacy/projects/projectStatusService';
export { calculateDayTotalHours } from './legacy/settings/calculations/workSlotCalculations';
export { calculateWeekTotalHours, generateDefaultWorkSchedule } from './legacy/settings/calculations/scheduleCalculations';
export { generateTimeOptions } from './legacy/settings/calculations/timeCalculations';
export { calculateRecurringMilestoneCount, calculateRecurringTotalAllocation, detectRecurringPattern } from './legacy/milestones/recurringMilestoneService';
export { getMilestoneSegmentForDate, calculateMilestoneInterval, calculateMilestoneSegments, type MilestoneSegment } from './legacy/milestones/milestoneUtilitiesService';
export { ProjectWorkingDaysService } from './legacy/projects/projectWorkingDaysService';
export { aggregateEventDurationsByDate, calculateEventDurationOnDate } from './legacy/events/eventDurationService';
export { MilestoneCalculationService } from './legacy/milestones/milestoneCalculationService';
export { analyzeProjectProgress, type ProjectProgressAnalysis } from './legacy/projects/projectProgressGraphService';
export { wouldOverlapHolidays, isHolidayDateCapacity } from './legacy/work-hours/workHourCapacityService';
export { CommittedHoursCalculationService, ProjectDaysCalculationService, ProjectMetricsCalculationService, WorkHoursCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
export { calculateAvailabilityCircleSize, getMinimumCircleDimensions } from './legacy/timeline/AvailabilityCircleSizingService';
export { ProjectCalculationService as CoreProjectCalculationService } from './legacy/projects/ProjectCalculationService';
export { calculateFutureCommitments, calculateWeeklyCapacity } from './legacy/insights/insightsCalculationService';
export { calculateDaysDelta, createSmoothDragAnimation, debounceDragUpdate, type SmoothAnimationConfig } from './legacy/events/dragCalculationService';
export { formatTimeForDisplay, formatDurationFromHours } from './legacy/work-hours/workHourCreationService';
export { handleWorkHourCreationStart, handleWorkHourCreationMove, handleWorkHourCreationComplete } from './legacy/work-hours/workHourCreationService';
export { getWorkHourOverlapInfo, generateWorkHourPreviewStyle, formatDurationPreview, getWorkHourCreationCursor, shouldAllowWorkHourCreation, type WorkHourCreateState } from './legacy/work-hours/workHourCreationService';
export { type PositionCalculation } from './legacy/timeline/TimelinePositioningService';
export { type ComprehensiveProjectTimeMetrics } from './legacy/projects/projectProgressService';
export { calculateScrollbarPosition, calculateScrollbarClickTarget, calculateScrollbarDragTarget, calculateScrollEasing, calculateAnimationDuration } from './legacy/timeline/timelinePositionService';
export { createNewWorkSlot, updateWorkSlot } from './legacy/settings/calculations/workSlotCalculations';
export { formatWorkSlotDurationDisplay } from './legacy/work-hours/workHourCreationService';
export { analyzeWorkSchedule } from './legacy/settings/calculations/scheduleCalculations';
export { checkProjectOverlap, adjustProjectDatesForDrag, type ConflictDetectionResult, type DateAdjustmentResult, type Project, detectLiveDragConflicts, resolveDragConflicts } from './legacy/projects/projectOverlapService';

/**
 * 🎯 AI Development Guidelines:
 * 
 * ✅ For NEW features: Use the new architecture layers above (unified/, orchestrators/, etc.)
 * ✅ For EXISTING features: Import from this barrel export only: @/services
 * ❌ Never import directly from legacy/ paths - use this index instead
 * ❌ Never create new files in legacy/ - use the new architecture
 * 
 * Migration Status: ~70% complete
 * Next: Migrate remaining legacy services to unified/orchestrator pattern
 */
