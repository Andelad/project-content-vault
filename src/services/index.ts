/**
 * Central Services Index
 * Feature-based service organization with barrel exports
 * 
 * 🚨 ARCHITECTURAL RULE: ALL CALCULATIONS MUST USE THESE SERVICES
 * 
 * ❌ DON'T add calculations to:
 *    - Components (render logic only)
 *    - Hooks (state management only) 
 *    - Utils (use these services instead)
 *
 * ✅ Feature-organized services:
 */

// Feature-based service exports
export * from './events';
export * from './insights';
export * from './milestones';
export * from './performance';
export * from './plannerV2';
export * from './projects';
export * from './settings';
export * from './timeline';
// export * from './work-hours'; // Commented out to avoid duplicate exports
export * from './tracker';

// Explicit exports from work-hours to avoid conflicts
export {
  WorkHourCalculationService,
  calculateWorkHourCapacity,
  getWorkHoursCapacityForPeriod,
  calculateWorkHourUtilization,
  isDayOverbooked,
  analyzeUtilizationEfficiency,
  calculateWorkHourCapacityWithHolidays,
  performCapacityPlanning,
  generateCapacityRecommendations,
  calculateAvailabilityReduction,
  calculateOvertimePlannedHours,
  calculateTotalPlannedHours,
  calculateOtherTime,
  generateWorkHoursForDate,
  calculateProjectWorkingDays,
  getProjectTimeAllocation,
  // Work hour creation functions
  handleWorkHourCreationStart,
  handleWorkHourCreationMove,
  handleWorkHourCreationComplete,
  getWorkHourOverlapInfo,
  generateWorkHourPreviewStyle,
  formatDurationPreview,
  getWorkHourCreationCursor,
  shouldAllowWorkHourCreation,
  type WorkHourCreateState
} from './work-hours';

// Core cross-cutting services (explicit to avoid ProjectCalculationService conflict)
export {
  ColorCalculationService,
  DateCalculationService
} from './core';

// Timeline services
export { TimelineViewportService } from './timeline';
export { HeightCalculationService } from './timeline';

// Explicit export of ProjectCalculationService from core (not from projects)
export { ProjectCalculationService } from './core';

// Project overlap service
export * from './projects/projectOverlapService';

// Explicit exports for missing services
export { CalendarIntegrationService, type ImportResult } from './calendar/calendarIntegration';
export { TimeAllocationService } from './timeline/TimeAllocationService';
export { expandHolidayDates } from './calendar/dateRangeService';
export { calculateDailyTotals } from './calendar/calendarInsightService';

