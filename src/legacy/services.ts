/**
 * 🏗️ Services Architecture - Central Index (LEGACY BARREL)
 * 
 * ⚠️ This file provides backward compatibility during the DDD migration.
 * New code should import directly from the DDD layers:
 *   - @/application/orchestrators
 *   - @/application/queries  
 *   - @/infrastructure/database
 *   - @/infrastructure/mappers
 *   - @/infrastructure/errors
 *   - @/presentation/app/services
 */

// 🎯 Core Service Layers - Now in application/
export { ProjectOrchestrator } from '@/application/orchestrators/ProjectOrchestrator';
export type { ProjectValidationResult, ProjectMilestoneAnalysis, ProjectCreationRequest, ProjectCreationResult, ProjectMilestone, ProjectCreationWithMilestonesRequest, ProjectUpdateRequest } from '@/application/orchestrators/ProjectOrchestrator';
export * from '@/application/orchestrators/PhaseOrchestrator';
export * from '@/application/orchestrators/CalendarEventOrchestrator';
export * from '@/application/orchestrators/SettingsOrchestrator';
export * from '@/application/orchestrators/GroupOrchestrator';

// Export data layer - now in application/queries
export * from '@/application/queries';

// 🔄 Re-export from DDD layers for backward compatibility
export * from '@/presentation/app/services';
export * from '@/infrastructure/errors/caching';
export * from '@/infrastructure/errors/ErrorHandlingService';

// 🚧 Legacy Services (Temporary - During Migration)
export { WorkHourCalculationService } from '@/domain/rules/availability/WorkHourGeneration';

// Time tracking types
export type { SearchResult, TrackingEventData } from '@/domain/rules/time-tracking/TimeTrackerHelpers';
export type { TrackingState } from '@/infrastructure/errors/TimeTrackerStorage';

// Event-Work Hour integration
export { 
  clearTimelineCache, 
  generateWorkHoursForDate, 
  calculateAvailabilityReduction, 
  calculateProjectWorkingDays,
  memoizedGetProjectTimeAllocation,
  calculateEventStyle,
  getProjectTimeAllocation
} from '@/domain/rules/availability/EventWorkHourIntegration';

// Event transformations
export { 
  prepareEventsForFullCalendar,
  transformCalendarEventToFullCalendar,
  transformWorkHourToFullCalendar,
  transformFullCalendarToCalendarEvent
} from '@/presentation/app/services/EventTransformations';

// Holiday calculations
export { 
  expandHolidayDates,
  expandHolidayDatesDetailed,
  getHolidayForDate,
  getHolidaysInRangeDetailed,
  countHolidayDaysInRange
} from '@/domain/rules/holidays/HolidayCalculations';

// FullCalendar configuration
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
} from '@/presentation/app/services/FullCalendarConfig';
export { throttledDragUpdate as throttleDragUpdate } from '@/infrastructure/errors/caching/dragPerformanceService';

// Phase calculations
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
} from '@/domain/rules/phases/PhaseCalculations';

// Timeline viewport service
export { TimelineViewport, TimelineViewport as TimelineViewportService } from '@/presentation/app/services/TimelineViewportService';

// Work hour interaction
export { calculateTimeFromPosition } from '@/presentation/app/services/workHourInteraction';

// Date calculations
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
  isToday,
  isTodayInWeek,
  formatWeekDateRange,
  groupDatesByMonth,
  getDayOfWeek,
  getDayName,
  generateDateRange,
  isDateInArray
} from '@/presentation/app/utils/dateCalculations';

// Time calculations
export {
  getCurrentTimezone,
  convertToTimezone,
  getTimezoneOffset,
  isDaylightSavingTime
} from '@/presentation/app/utils/timeCalculations';

// Date formatting
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
} from '@/presentation/app/utils/dateFormatUtils';

// Duration formatting
export { 
  formatDuration,
  formatDurationFromMinutes
} from '@/presentation/app/utils/dateCalculations';

// Event calculations
export {
  aggregateEventDurationsByDate,
  calculateEventDurationOnDate,
  calculateEventTotalDuration,
  calculateLiveTrackingDuration,
  EVENT_DURATION_CONSTANTS as DURATION_CONSTANTS,
  generateRecurringEvents,
  validateRecurringConfig
} from '@/domain/rules/events/EventCalculations';

// Legacy wrapper - maintains old function signature
import { calculateEventDurationOnDate as calculateEventDurationOnDateNew } from '@/domain/rules/events/EventCalculations';
import type { CalendarEvent, Holiday, Settings, WorkSlot } from '@/shared/types';

export function calculateEventDurationOnDateLegacy(event: CalendarEvent, targetDate: Date): number {
  return calculateEventDurationOnDateNew({ event, targetDate });
}

// Capacity analysis
export { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod, calculateTotalPlannedHours, calculateOtherTime, calculateOvertimePlannedHours } from '@/domain/rules/availability/CapacityAnalysis';
export { calculateProjectDuration, calculateProjectTimeMetrics, buildPlannedTimeMap, getPlannedTimeUpToDate, generateProgressDataPoints, calculateProjectVelocity, estimateProjectCompletionDate } from '@/domain/rules/projects/ProjectMetrics';
export { isProjectFullyCompletedOnDate, calculatePlannedTimeCompletionStats } from '@/domain/rules/insights/AnalyticsCalculations';
export { processEventOverlaps, calculateElapsedTime, createTimeRange, validateEventForSplit, type EventSplitResult, type Event, type TimeRange } from '@/domain/rules/events/EventSplitting';

// Project status
export { 
  calculateProjectStatus, 
  determineProjectStatus, 
  getEffectiveProjectStatus, 
  organizeProjectsByStatus
} from '@/domain/rules/projects/ProjectMetrics';

// Settings calculations
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
} from '@/presentation/app/utils/settingsCalculations';

// Phase calculations
export { 
  calculateRecurringPhaseCount, 
  calculateRecurringTotalAllocation, 
  detectRecurringPattern,
  generateRecurringPhaseDates,
  getMilestoneSegmentForDate,
  calculateMilestoneSegments,
  type MilestoneSegment
} from '@/domain/rules/phases/PhaseCalculations';

// Capacity analysis (additional)
export { wouldOverlapHolidays, isHolidayDateCapacity, calculateCommittedHoursForDate, hasWorkHoursConfigured, dayHasWorkHoursConfigured } from '@/domain/rules/availability/CapacityAnalysis';
export { calculateProjectDays } from '@/presentation/app/services/ProjectBarPositioning';
export { calculateWorkHoursTotal, calculateDayWorkHours, calculateTotalDayWorkHours } from '@/domain/rules/availability/WorkHourGeneration';
export { calculateDailyCapacity } from '@/domain/rules/insights/AnalyticsCalculations';
export { calculateProjectTimeMetrics as calculateLegacyProjectMetrics } from '@/domain/rules/projects/ProjectMetrics';

// Analytics calculations
export { 
  calculateFutureCommitments, 
  calculateWeeklyCapacity,
  getCurrentProjects,
  getRelevantEventsForPeriod,
  calculateTotalTrackedHours,
  generateWeeklyUtilizationReport
} from '@/domain/rules/insights/AnalyticsCalculations';

// Drag positioning
export { 
  calculateDaysDelta, 
  createSmoothDragAnimation, 
  debounceDragUpdate, 
  initializeHolidayDragState,
  type SmoothAnimationConfig 
} from '@/presentation/app/services/DragPositioning';

// Work hour interaction
export { handleWorkHourCreationStart, handleWorkHourCreationMove, handleWorkHourCreationComplete } from '@/presentation/app/services/workHourInteraction';
export { getWorkHourOverlapInfo, generateWorkHourPreviewStyle, getWorkHourCreationCursor, shouldAllowWorkHourCreation, type WorkHourCreateState } from '@/presentation/app/services/workHourInteraction';

// Types
export { type ComprehensiveProjectTimeMetrics, type ProjectEvent as ProgressProjectEvent } from '@/domain/rules/projects/ProjectMetrics';

// Work slot formatting
export { formatWorkSlotDurationDisplay } from '@/presentation/app/services/workHourInteraction';

// Project overlap detection
export { checkProjectOverlap, adjustProjectDatesForDrag, detectLiveDragConflicts, resolveDragConflicts, datesOverlap, calculateOverlapPercentage, type ConflictDetectionResult, type DateAdjustmentResult, type Project } from '@/domain/rules/projects/ProjectMetrics';

// 🔄 Compatibility Wrappers for Migrated /lib Functionality
import { CalculationCacheService, WorkingDayCache } from '@/infrastructure/errors/caching';
import * as React from 'react';

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
      cacheSize: 'N/A'
    };
  },
  
  logStats: () => {
    // Stats available for debugging if needed
  },
  
  clear: () => {
    WorkingDayCache.clearWorkingDayCache();
  }
};

/**
 * Cached working day checker hook
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
 * Milestone cache compatibility
 */
export const milestoneStats = {
  getStats: () => {
    const stats = CalculationCacheService.getMilestoneStats();
    return {
      totalChecks: stats.checks,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.checks > 0 ? (stats.hits / stats.checks * 100).toFixed(1) : '0',
      cacheSize: 'N/A'
    };
  },
  
  logStats: () => {
    // Stats available for debugging if needed
  }
};

// Additional time/duration utilities
export { formatTimeForValidation } from '@/presentation/app/utils/timeCalculations';
export { calculateDurationHours, isWeekendDate } from '@/presentation/app/utils/dateCalculations';
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
export { calculateBudgetAdjustment } from '@/domain/rules/phases/PhaseCalculations';

// Group statistics
export { calculateGroupStatistics } from '@/domain/rules/groups/GroupCalculations';

// Pixel/date conversions
export { calculateDaysDeltaFromPixels } from '@/presentation/app/utils/dateCalculations';

// Timeline calculations
export { calculateTimelineRows } from '@/domain/rules/timeline/TimelineRowCalculations';
export { calculateProjectDayEstimates } from '@/domain/rules/projects/DayEstimate';
