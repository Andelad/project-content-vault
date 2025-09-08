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
export * from './calculations';      // Pure business calculations - projectCalculations, timeCalculations, dragCalculations
export * from './validators';        // Business rules - ProjectValidator, TimeTrackingValidator  
// export * from './repositories';      // Data access - ProjectRepository, MilestoneRepository (conflicts with orchestrators)
export * from './ui';               // View positioning - TimelinePositioning, TimelineViewport, CalendarLayout
export * from './infrastructure';   // Technical utilities - calculationCache, colorCalculations
export * from './performance';      // Performance optimization - dragPerformanceService, cachePerformanceService

// 🚧 Legacy Services (Temporary - During Migration)
// These will be removed once migration to new architecture is complete
export { TimelinePositioningService } from './legacy/timeline/TimelinePositioningService';
// ProjectCalculationService migrated to UnifiedProjectService
export { WorkHourCalculationService } from './calculations/workHourCalculations';

// 🔧 Additional Temporary Exports (Remove after migration)
// Timeline positioning functions (frequently used)
export { 
  calculateOccupiedHolidayIndices, 
  convertMousePositionToIndex, 
  convertIndicesToDates, 
  calculateMinimumHoverOverlaySize 
} from './calculations/timelinePositionCalculations';

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
export { TimelineCalculationService } from './legacy/timeline/TimelineCalculationService';

// New architecture services - maintain backward compatibility
export { TimelineViewport, TimelineViewport as TimelineViewportService } from './ui/TimelineViewport';
export { ProjectValidator, ProjectValidator as ProjectValidationService } from './validators/ProjectValidator';

// Legacy calculation functions (to be migrated)
export { calculateTimeFromPosition, calculateDurationMinutes } from './calculations/workHourCalculations';

// Legacy event calculation wrappers for backward compatibility
export {
  aggregateEventDurationsByDate,
  calculateEventDurationOnDate,
  formatEventDuration as formatDuration,
  calculateEventTotalDuration,
  calculateLiveTrackingDuration,
  EVENT_DURATION_CONSTANTS as DURATION_CONSTANTS
} from './calculations/eventCalculations';

// Import the new function to create legacy wrapper
import { calculateEventDurationOnDate as calculateEventDurationOnDateNew } from './calculations/eventCalculations';

// Legacy wrapper - maintains old function signature
export function calculateEventDurationOnDateLegacy(event: any, targetDate: Date): number {
  return calculateEventDurationOnDateNew({ event, targetDate });
}
export { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from './calculations/capacityCalculations';
export { calculateProjectDuration, calculateProjectTimeMetrics, buildPlannedTimeMap, getPlannedTimeUpToDate, generateProgressDataPoints, calculateProjectVelocity, estimateProjectCompletionDate } from './calculations/projectProgressCalculations';
export { memoizedGetProjectTimeAllocation, calculateEventStyle, getProjectTimeAllocation } from './legacy/events/eventWorkHourIntegrationService';
export { processEventOverlaps, calculateElapsedTime, createTimeRange, validateEventForSplit, type EventSplitResult, type Event, type TimeRange } from './validators/eventValidations';

// Additional legacy exports (organized by domain)
export { 
  calculateProjectStatus,
  formatProjectDateRange,
  determineProjectStatus,
  getEffectiveProjectStatus,
  organizeProjectsByStatus
} from './calculations/projectStatusCalculations';
export { 
  calculateDayTotalHours,
  calculateWeekTotalHours,
  generateDefaultWorkSchedule,
  generateTimeOptions,
  calculateWorkSlotDuration,
  calculateSlotOverlapMinutes,
  createNewWorkSlot,
  updateWorkSlot,
  validateWorkSchedule
} from './calculations/settingsCalculations';
export { 
  calculateRecurringMilestoneCount, 
  calculateRecurringTotalAllocation, 
  detectRecurringPattern,
  generateRecurringMilestoneDates
} from './calculations/milestoneCalculations';
export { getMilestoneSegmentForDate, calculateMilestoneInterval, calculateMilestoneSegments, getEstimatedHoursForDate, getMilestoneForDate, getMilestonesInDateRange, type MilestoneSegment } from './calculations/milestoneCalculations';
export { MilestoneCalculationService, type MilestoneValidationResult, type LegacyMilestone, type RecurringPattern } from './calculations/milestoneCalculations';
export { analyzeProjectProgress, type ProjectProgressAnalysis } from './legacy/projects/projectProgressGraphService';
export { wouldOverlapHolidays, isHolidayDateCapacity } from './calculations/capacityCalculations';
export { CommittedHoursCalculationService, ProjectDaysCalculationService, ProjectMetricsCalculationService, WorkHoursCalculationService } from './legacy/timeline/TimelineBusinessLogicService';
// CoreProjectCalculationService migrated to UnifiedProjectService
export { 
  calculateFutureCommitments, 
  calculateWeeklyCapacity,
  getCurrentProjects,
  getRelevantEventsForPeriod,
  calculateTrackedHours,
  generateWeeklyUtilizationReport
} from './calculations/insightCalculations';
export { calculateDaysDelta, createSmoothDragAnimation, debounceDragUpdate, type SmoothAnimationConfig } from './calculations/dragCalculations';
export { formatTimeForDisplay, formatDurationFromHours } from './calculations/workHourCalculations';
export { handleWorkHourCreationStart, handleWorkHourCreationMove, handleWorkHourCreationComplete } from './calculations/workHourCalculations';
export { getWorkHourOverlapInfo, generateWorkHourPreviewStyle, formatDurationPreview, getWorkHourCreationCursor, shouldAllowWorkHourCreation, type WorkHourCreateState } from './calculations/workHourCalculations';
export { type PositionCalculation } from './legacy/timeline/TimelinePositioningService';
export { type ComprehensiveProjectTimeMetrics, type ProgressProject, type ProjectEvent as ProgressProjectEvent } from './calculations/projectProgressCalculations';
export { 
  calculateTimelinePositions, 
  calculateScrollbarPosition, 
  calculateScrollbarClickTarget, 
  calculateScrollbarDragTarget, 
  calculateScrollEasing, 
  calculateAnimationDuration,
  calculateMouseToTimelineIndex,
  calculateHolidayPosition,
  calculateCenterScrollPosition,
  type TimelinePositionCalculation,
  type ScrollbarCalculation,
  type ScrollAnimationConfig,
  type HolidayPositionCalculation,
  type MouseToIndexConversion
} from './calculations/timelinePositionCalculations';
export { formatWorkSlotDurationDisplay } from './calculations/workHourCalculations';
export { checkProjectOverlap, adjustProjectDatesForDrag, detectLiveDragConflicts, resolveDragConflicts, datesOverlap, calculateOverlapPercentage, type ConflictDetectionResult, type DateAdjustmentResult, type Project } from './calculations/projectOverlapCalculations';

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
