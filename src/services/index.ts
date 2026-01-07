/**
 * 🏗️ AI-Optimized Services Architecture - Central Index
 * SINGLE SOURCE OF TRUTH for all service imports
 * 
 * 🚨 ARCHITECTURAL RULES:
 * ❌ DON'T add calculations to: Components, Hooks, Utils
 * ✅ DO import from: @/services (this barrel export only)
 * ✅ Logic Flow: Components → Orchestrators → domain/rules/
 *
 * 📁 Current Architecture Layers:
 * ├── orchestrators/     # Workflow coordination  
 * ├── data/              # Data access & persistence
 * └── (legacy exports from other layers below)
 */

// 🎯 Core Service Layers
// Export orchestrators
export { ProjectOrchestrator } from './orchestrators/ProjectOrchestrator';
export type { ProjectValidationResult, ProjectMilestoneAnalysis, ProjectCreationRequest, ProjectCreationResult, ProjectMilestone, ProjectCreationWithMilestonesRequest, ProjectUpdateRequest } from './orchestrators/ProjectOrchestrator';
export * from './orchestrators/PhaseOrchestrator';
export * from './orchestrators/CalendarEventOrchestrator';
export * from './orchestrators/SettingsOrchestrator';
export * from './orchestrators/GroupOrchestrator';
export * from './orchestrators/PlannerViewOrchestrator';
export * from './orchestrators/recurringEventsOrchestrator';

// Export data layer
export * from './data';             // Data transformation & aggregation

// 🔄 Re-export from other top-level folders for backward compatibility
export * from '@/ui';                      // View positioning & UI helpers
export * from '@/infrastructure/caching';  // Performance optimization
export * from '@/infrastructure/ErrorHandlingService';  // Centralized error handling

// 🚧 Legacy Services (Temporary - During Migration)
// These will be removed once migration to new architecture is complete
// TimelinePositioningService migrated to ui/TimelinePositioning.ts
// ProjectCalculationService migrated to domain/rules/
export { WorkHourCalculationService } from '@/domain/rules/availability/WorkHourGeneration';

// 🔧 Additional Temporary Exports (Remove after migration)
// Timeline positioning functions (frequently used)
// Timeline positioning functions moved to ui/TimelinePositioning.ts

// 🎯 Unified Services (Main API Layer - LEGACY, being phased out)

// Time tracking - migrated to domain/rules/timeTracking and orchestrators
export type { SearchResult, TrackingEventData } from '@/domain/rules/time-tracking/TimeTrackerHelpers';
export type { TrackingState } from '@/infrastructure/TimeTrackerStorage';

// Event-Work Hour integration - migrated to calculations/availability/eventWorkHourIntegration
export { 
  clearTimelineCache, 
  generateWorkHoursForDate, 
  calculateAvailabilityReduction, 
  calculateProjectWorkingDays,
  memoizedGetProjectTimeAllocation,
  calculateEventStyle,
  getProjectTimeAllocation
} from '@/domain/rules/availability/EventWorkHourIntegration';

// Event transformations - migrated to ui/EventTransformations
export { 
  prepareEventsForFullCalendar,
  transformCalendarEventToFullCalendar,
  transformWorkHourToFullCalendar,
  transformFullCalendarToCalendarEvent
} from '@/ui/EventTransformations';

// 🔧 Frequently Used Functions (Stable API)
export { 
  expandHolidayDates,
  expandHolidayDatesDetailed,
  getHolidayForDate,
  getHolidaysInRangeDetailed,
  countHolidayDaysInRange
} from '@/domain/rules/holidays/HolidayCalculations';
// FullCalendar configuration - migrated to ui/FullCalendarConfig
export { 
  getBaseFullCalendarConfig, 
  getEventStylingConfig,
  getBusinessHoursConfig,
  filterEventsByLayerVisibility,
  getResponsiveDayCount,
  isMobileViewport,
  isTabletViewport,
  type LayerVisibility,
  type BusinessHoursConfig,
  type CalendarView,
  type ViewportSize
} from '@/ui/FullCalendarConfig';
export { throttledDragUpdate as throttleDragUpdate } from '@/infrastructure/caching/dragPerformanceService';

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
} from '@/domain/rules/phases/PhaseBudget';

// 🚧 Legacy Layer (Migration in Progress)
// ⚠️ TODO: Migrate these to new architecture layers above
// These exports maintain backward compatibility during the migration process
// Once migration is complete, all functionality will be available through the new layers

// Modern calculation services (replacing legacy timeline business logic)
// These functions are now available directly as exports from their respective calculation modules

// MilestoneManagementService migrated to unified/UnifiedPhaseService.ts + orchestrators/MilestoneOrchestrator.ts
// TimelineCalculationService migrated to calculations/timelineCalculations.ts

// New architecture services - maintain backward compatibility
export { TimelineViewport, TimelineViewport as TimelineViewportService } from '@/ui/TimelineViewportService';

// ================================================================================

// Legacy calculation functions (to be migrated)
export { calculateTimeFromPosition } from '@/ui/workHourInteraction';
export { 
  calculateDurationMinutes,
  normalizeToMidnight,
  normalizeToEndOfDay,
  isSameDay,
  isValidDate,
  isBusinessDay,
  isBusinessHour,
  isWorkingDay,
  addDaysToDate,
  addHoursToDate,
  // New pure date calculation functions
  isToday,
  isTodayInWeek,
  formatWeekDateRange,
  groupDatesByMonth,
  getDayOfWeek,
  getDayName,
  generateDateRange,
  isDateInArray
} from '@/utils/dateCalculations';
export {
  getCurrentTimezone,
  convertToTimezone,
  getTimezoneOffset,
  isDaylightSavingTime
} from '@/utils/timeCalculations';

// Legacy event calculation wrappers for backward compatibility
// ===================================
// STANDARDIZED DATE/TIME FORMATTING
// ===================================

// Primary date/time formatting - import from utils (single source of truth)
export { 
  formatDate, 
  formatDateShort, 
  formatDateLong,
  formatDateWithYear,
  formatMonthYear,
  formatMonthLongYear,
  formatWeekdayDate,
  formatMonth,
  formatMonthLong, 
  formatDay,
  formatDateRange,
  formatProjectDateRange,
  formatChartDate,
  formatTooltipDate,
  formatDateForInput,
  formatTimeRange,
  isSameDate,
  APP_LOCALE
} from '@/utils/dateFormatUtils';

// ===================================
// TIME FORMATTING - SINGLE SOURCE OF TRUTH
// ===================================

export { 
  formatDuration,
  formatDurationFromMinutes
} from '@/utils/dateCalculations';

// ===================================
// EVENT CALCULATIONS
// ===================================

export {
  aggregateEventDurationsByDate,
  calculateEventDurationOnDate,
  calculateEventTotalDuration,
  calculateLiveTrackingDuration,
  EVENT_DURATION_CONSTANTS as DURATION_CONSTANTS,
  generateRecurringEvents,
  validateRecurringConfig
} from '@/domain/rules/events/EventCalculations';

// Import the new function to create legacy wrapper
import { calculateEventDurationOnDate as calculateEventDurationOnDateNew } from '@/domain/rules/events/EventCalculations';

// Legacy wrapper - maintains old function signature
export function calculateEventDurationOnDateLegacy(event: CalendarEvent, targetDate: Date): number {
  return calculateEventDurationOnDateNew({ event, targetDate });
}
export { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod, calculateTotalPlannedHours, calculateOtherTime, calculateOvertimePlannedHours } from '@/domain/rules/availability/CapacityAnalysis';
export { calculateProjectDuration, calculateProjectTimeMetrics, buildPlannedTimeMap, getPlannedTimeUpToDate, generateProgressDataPoints, calculateProjectVelocity, estimateProjectCompletionDate } from '@/domain/rules/projects/ProjectMetrics';
export { isProjectFullyCompletedOnDate, calculatePlannedTimeCompletionStats } from '@/domain/rules/insights/AnalyticsCalculations';
export { processEventOverlaps, calculateElapsedTime, createTimeRange, validateEventForSplit, type EventSplitResult, type Event, type TimeRange } from '@/domain/rules/events/EventSplitting';

// Additional legacy exports (organized by domain)
export { 
  calculateProjectStatus, 
  determineProjectStatus, 
  getEffectiveProjectStatus, 
  organizeProjectsByStatus
} from '@/domain/rules/projects/ProjectMetrics';
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
} from '@/utils/settingsCalculations';
export { 
  calculateRecurringPhaseCount, 
  calculateRecurringTotalAllocation, 
  detectRecurringPattern,
  generateRecurringPhaseDates,
  getMilestoneSegmentForDate,
  calculateMilestoneSegments,
  type MilestoneSegment
} from '@/domain/rules/phases/PhaseBudget';
// Legacy project progress analysis - migrated to unified service with compatibility wrapper
export { wouldOverlapHolidays, isHolidayDateCapacity, calculateCommittedHoursForDate, hasWorkHoursConfigured, dayHasWorkHoursConfigured } from '@/domain/rules/availability/CapacityAnalysis';
export { calculateProjectDays } from '@/ui/ProjectBarPositioning';
export { calculateWorkHoursTotal, calculateDayWorkHours, calculateTotalDayWorkHours } from '@/domain/rules/availability/WorkHourGeneration';
export { calculateDailyCapacity } from '@/domain/rules/insights/AnalyticsCalculations';
export { calculateProjectTimeMetrics as calculateLegacyProjectMetrics } from '@/domain/rules/projects/ProjectMetrics';
// CoreProjectCalculationService migrated to UnifiedProjectService
export { 
  calculateFutureCommitments, 
  calculateWeeklyCapacity,
  getCurrentProjects,
  getRelevantEventsForPeriod,
  calculateTotalTrackedHours,
  generateWeeklyUtilizationReport
} from '@/domain/rules/insights/AnalyticsCalculations';
export { 
  calculateDaysDelta, 
  createSmoothDragAnimation, 
  debounceDragUpdate, 
  initializeHolidayDragState,
  type SmoothAnimationConfig 
} from '@/ui/DragPositioning';
export { handleWorkHourCreationStart, handleWorkHourCreationMove, handleWorkHourCreationComplete } from '@/ui/workHourInteraction';
export { getWorkHourOverlapInfo, generateWorkHourPreviewStyle, getWorkHourCreationCursor, shouldAllowWorkHourCreation, type WorkHourCreateState } from '@/ui/workHourInteraction';
// PositionCalculation type migrated to ui/TimelinePositioning.ts
export { type ComprehensiveProjectTimeMetrics, type ProjectEvent as ProgressProjectEvent } from '@/domain/rules/projects/ProjectMetrics';
// Timeline positioning now handled by ui/TimelinePositioning.ts
// All UI positioning functions consolidated there
export { formatWorkSlotDurationDisplay } from '@/ui/workHourInteraction';
export { checkProjectOverlap, adjustProjectDatesForDrag, detectLiveDragConflicts, resolveDragConflicts, datesOverlap, calculateOverlapPercentage, type ConflictDetectionResult, type DateAdjustmentResult, type Project } from '@/domain/rules/projects/ProjectMetrics';

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

// 🔄 Compatibility Wrappers for Migrated /lib Functionality
// These provide the same interface as the old /lib files but use the new services architecture

import { CalculationCacheService, WorkingDayCache } from '@/infrastructure/caching';
import * as React from 'react';
import type { CalendarEvent, Holiday, Settings, WorkSlot } from '@/types';

/**
 * Working day cache compatibility - migrated from /lib/workingDayCache
 */
export const workingDayStats = {
  getStats: () => {
    const stats = WorkingDayCache.getWorkingDayStats();
    return {
      totalChecks: stats.checks,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.checks > 0 ? (stats.hits / stats.checks * 100).toFixed(1) : '0',
      cacheSize: 'N/A' // Cache size is managed internally
    };
  },
  
  logStats: () => {
    const stats = workingDayStats.getStats();
    // Stats available for debugging if needed
  },
  
  clear: () => {
    WorkingDayCache.clearWorkingDayCache();
  }
};

/**
 * Cached working day checker hook - migrated from /lib/workingDayCache
 */
type WeeklyWorkHours = Settings['weeklyWorkHours'];
const DAY_NAMES: Array<keyof WeeklyWorkHours> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function createWorkingDayChecker(
  weeklyWorkHours: WeeklyWorkHours | undefined,
  holidays: Holiday[]
) {
  return (date: Date) => {
    return WorkingDayCache.isWorkingDay(
      date,
      weeklyWorkHours,
      holidays,
      (dateArg: Date, weeklyWorkHoursArg: WeeklyWorkHours | undefined, holidaysArg: Holiday[]) => {
        const checkDate = new Date(dateArg);
        checkDate.setHours(0, 0, 0, 0);

        const isHoliday = holidaysArg.some((holiday) => {
          const startDate = new Date(holiday.startDate);
          const endDate = new Date(holiday.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          return checkDate >= startDate && checkDate <= endDate;
        });

        if (isHoliday) return false;

        const dayName = DAY_NAMES[checkDate.getDay()];
        const workSlots = weeklyWorkHoursArg?.[dayName] ?? [];

        const totalHours = Array.isArray(workSlots)
          ? workSlots.reduce((sum: number, slot: WorkSlot) => sum + (slot.duration || 0), 0)
          : 0;

        return totalHours > 0;
      }
    );
  };
}

export function useCachedWorkingDayChecker(
  weeklyWorkHours: WeeklyWorkHours | undefined,
  holidays: Holiday[]
) {
  return React.useMemo(() => createWorkingDayChecker(weeklyWorkHours, holidays), [weeklyWorkHours, holidays]);
}

/**
 * Milestone cache compatibility - migrated from /lib/milestoneCache
 */
export const milestoneStats = {
  getStats: () => {
    const stats = CalculationCacheService.getMilestoneStats();
    return {
      totalChecks: stats.checks,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.checks > 0 ? (stats.hits / stats.checks * 100).toFixed(1) : '0',
      cacheSize: 'N/A' // Cache size is managed internally
    };
  },
  
  logStats: () => {
    const stats = milestoneStats.getStats();
    // Stats available for debugging if needed
  }
};


// Additional time/duration utilities
export { formatTimeForValidation } from '@/utils/timeCalculations';
export { calculateDurationHours, isWeekendDate } from '@/utils/dateCalculations';
export { DurationFormattingService } from '@/domain/rules/projects/ProjectBudget';

// Capacity and availability functions
export { 
  calculateHabitTimeWithinWorkSlots,
  calculatePlannedTimeNotOverlappingHabits,
  calculateNetAvailability
} from '@/domain/rules/availability/CapacityAnalysis';

// Aliases for renamed functions
export { calculateTotalWorkingDays } from '@/domain/rules/projects/ProjectBudget';
export { calculateDailyProjectHours } from '@/domain/rules/availability/DailyMetrics';

// Project budget and estimation
export { 
  calculateAutoEstimateHoursPerDay,
  calculateAutoEstimateWorkingDays
} from '@/domain/rules/projects/ProjectBudget';

// Event overlap handling
export { 
  calculateOverlapActions,
  findOverlappingEvents
} from '@/domain/rules/events/EventCalculations';

// Phase budget adjustments
export { calculateBudgetAdjustment } from '@/domain/rules/phases/PhaseBudget';

// Group statistics
export { calculateGroupStatistics } from '@/domain/rules/groups/GroupCalculations';

// Pixel/date conversions
export { calculateDaysDeltaFromPixels } from '@/utils/dateCalculations';

// Timeline calculations
export { calculateTimelineRows } from '@/domain/rules/timeline/TimelineRowCalculations';
export { calculateProjectDayEstimates } from '@/domain/rules/projects/DayEstimate';
