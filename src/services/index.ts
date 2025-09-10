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
// TimelinePositioningService migrated to ui/TimelinePositioning.ts
// ProjectCalculationService migrated to UnifiedProjectService
export { WorkHourCalculationService } from './calculations/workHourCalculations';

// 🔧 Additional Temporary Exports (Remove after migration)
// Timeline positioning functions (frequently used)
// Timeline positioning functions moved to ui/TimelinePositioning.ts

// 🎯 Unified Services (Main API Layer)
export { TimeTrackerCalculationService } from './unified/UnifiedTimeTrackerService';
export { UnifiedMilestoneService } from './unified/UnifiedMilestoneService';
export { CalendarIntegrationService, type ImportResult } from './unified/UnifiedCalendarService';
export { transformFullCalendarToCalendarEvent } from './unified/UnifiedEventTransformService';
export { clearTimelineCache, generateWorkHoursForDate, calculateAvailabilityReduction, calculateProjectWorkingDays } from './unified/UnifiedEventWorkHourService';
// Project progress analysis (legacy compatibility)
export { 
  analyzeProjectProgressLegacy as analyzeProjectProgress,
  type ProgressGraphCalculationOptions,
  type ProgressDataPoint,
  type ProjectProgressAnalysis as ProjectProgressAnalysisLegacy
} from './unified/UnifiedProjectProgressService';

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

// Modern calculation services (replacing legacy timeline business logic)
// These functions are now available directly as exports from their respective calculation modules

// MilestoneManagementService migrated to unified/UnifiedMilestoneService.ts + orchestrators/MilestoneOrchestrator.ts
// TimelineCalculationService migrated to calculations/timelineCalculations.ts

// New architecture services - maintain backward compatibility
export { TimelineViewport, TimelineViewport as TimelineViewportService } from './ui/TimelineViewport';
export { ProjectValidator, ProjectValidator as ProjectValidationService } from './validators/ProjectValidator';

// Legacy calculation functions (to be migrated)
export { calculateTimeFromPosition } from './calculations/workHourCalculations';
export { 
  calculateDurationMinutes,
  normalizeToMidnight,
  normalizeToEndOfDay,
  isSameDay,
  isValidDate,
  isBusinessDay,
  isBusinessHour,
  isWorkingDay
} from './calculations/dateCalculations';
export {
  getCurrentTimezone,
  convertToTimezone,
  getTimezoneOffset,
  isDaylightSavingTime
} from './calculations/timeCalculations';

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

export { 
  formatTimeHoursMinutes,
  formatDuration,
  formatDurationFromMinutes,
  formatDurationFromHours,
  formatDurationPreview
} from '@/utils/timeFormatUtils';

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
} from './calculations/eventCalculations';

// Import the new function to create legacy wrapper
import { calculateEventDurationOnDate as calculateEventDurationOnDateNew } from './calculations/eventCalculations';

// Legacy wrapper - maintains old function signature
export function calculateEventDurationOnDateLegacy(event: any, targetDate: Date): number {
  return calculateEventDurationOnDateNew({ event, targetDate });
}
export { calculateWorkHourCapacity, getWorkHoursCapacityForPeriod } from './calculations/capacityCalculations';
export { calculateProjectDuration, calculateProjectTimeMetrics, buildPlannedTimeMap, getPlannedTimeUpToDate, generateProgressDataPoints, calculateProjectVelocity, estimateProjectCompletionDate } from './calculations/projectOperations';
export { isProjectFullyCompletedOnDate, calculatePlannedTimeCompletionStats } from './calculations/analyticsCalculations';
export { memoizedGetProjectTimeAllocation, calculateEventStyle, getProjectTimeAllocation } from './unified/UnifiedEventWorkHourService';
export { processEventOverlaps, calculateElapsedTime, createTimeRange, validateEventForSplit, type EventSplitResult, type Event, type TimeRange } from './validators/eventValidations';

// Additional legacy exports (organized by domain)
export { 
  calculateProjectStatus, 
  determineProjectStatus, 
  getEffectiveProjectStatus, 
  organizeProjectsByStatus
} from './calculations/projectOperations';
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
// Milestone calculation functions from modern service
export { getMilestoneSegmentForDate, calculateMilestoneInterval, calculateMilestoneSegments, getEstimatedHoursForDate, getMilestoneForDate, getMilestonesInDateRange, type MilestoneSegment } from './calculations/milestoneCalculations';
export { type MilestoneValidationResult, type FlexibleMilestone, type RecurringPattern } from './calculations/milestoneCalculations';
// Legacy project progress analysis - migrated to unified service with compatibility wrapper
export { wouldOverlapHolidays, isHolidayDateCapacity, calculateCommittedHoursForDate, hasWorkHoursConfigured, dayHasWorkHoursConfigured } from './calculations/capacityCalculations';
export { calculateProjectDays, calculateWorkHoursTotal, calculateDayWorkHours, calculateTotalDayWorkHours } from './calculations/timelineCalculations';
export { calculateDailyCapacity } from './calculations/analyticsCalculations';
export { calculateProjectTimeMetrics as calculateLegacyProjectMetrics } from './calculations/projectOperations';
// CoreProjectCalculationService migrated to UnifiedProjectService
export { 
  calculateFutureCommitments, 
  calculateWeeklyCapacity,
  getCurrentProjects,
  getRelevantEventsForPeriod,
  calculateTotalTrackedHours,
  generateWeeklyUtilizationReport
} from './calculations/analyticsCalculations';
export { calculateDaysDelta, createSmoothDragAnimation, debounceDragUpdate, type SmoothAnimationConfig } from './calculations/dragCalculations';
export { formatTimeForDisplay } from './calculations/workHourCalculations';
export { handleWorkHourCreationStart, handleWorkHourCreationMove, handleWorkHourCreationComplete } from './calculations/workHourCalculations';
export { getWorkHourOverlapInfo, generateWorkHourPreviewStyle, getWorkHourCreationCursor, shouldAllowWorkHourCreation, type WorkHourCreateState } from './calculations/workHourCalculations';
// PositionCalculation type migrated to ui/TimelinePositioning.ts
export { type ComprehensiveProjectTimeMetrics, type ProjectEvent as ProgressProjectEvent } from './calculations/projectOperations';
// Timeline positioning now handled by ui/TimelinePositioning.ts
// All UI positioning functions consolidated there
export { formatWorkSlotDurationDisplay } from './calculations/workHourCalculations';
export { checkProjectOverlap, adjustProjectDatesForDrag, detectLiveDragConflicts, resolveDragConflicts, datesOverlap, calculateOverlapPercentage, type ConflictDetectionResult, type DateAdjustmentResult, type Project } from './calculations/projectOperations';

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

import { CalculationCacheService, WorkingDayCache } from './infrastructure';
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
export function useCachedWorkingDayChecker(
  weeklyWorkHours: any,
  holidays: any[]
) {
  return React.useCallback((date: Date) => {
    return WorkingDayCache.isWorkingDay(
      date,
      weeklyWorkHours,
      holidays,
      // Embedded working day logic - preserving original behavior
      (date: Date, weeklyWorkHours: any, holidays: any[]) => {
        // Normalize date to avoid time component issues
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        // Check holidays first (fastest rejection)
        const isHoliday = holidays.some((holiday: any) => {
          const startDate = new Date(holiday.startDate);
          const endDate = new Date(holiday.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          return checkDate >= startDate && checkDate <= endDate;
        });

        if (isHoliday) return false;

        // Check work hours for this day of week
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[checkDate.getDay()];
        const workSlots = weeklyWorkHours[dayName] || [];

        // Sum total work hours for this day
        const totalHours = Array.isArray(workSlots)
          ? workSlots.reduce((sum: number, slot: any) => sum + (slot.duration || 0), 0)
          : 0;

        return totalHours > 0;
      }
    );
  }, [weeklyWorkHours, holidays]);
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
