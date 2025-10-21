/**
 * Calculations Services Index
 * All mathematical computations and business logic calculations
 * 
 * Organized by domain:
 * - events/       Event and holiday calculations
 * - insights/     Analytics and planner insights
 * - projects/     Project, milestone, and day estimate calculations
 * - general/      Date, time, and settings calculations
 * - availability/ Work hours, availability, and capacity calculations
 * - tracking/     Time tracking calculations
 */

// ===== EVENTS =====
export * from './events/eventCalculations';
export * from './events/holidayCalculations';

// ===== INSIGHTS =====
export * from './insights/analyticsCalculations';
// Note: plannerInsights and plannerInsightCalculations have overlapping exports
// Using plannerInsightCalculations as the primary source
export * from './insights/plannerInsightCalculations';

// ===== PROJECTS =====
export * from './projects/dayEstimateCalculations';
// Note: milestoneCalculations has calculateProjectWorkingDays which is also in capacityCalculations
// Using capacityCalculations as primary source for calculateProjectWorkingDays
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
  findMilestoneGap,
  calculateRecurringMilestoneCount,
  calculateRecurringTotalAllocation,
  detectRecurringPattern,
  generateRecurringMilestoneDates,
  getMilestoneSegmentForDate,
  calculateMilestoneSegments,
  calculateBudgetAdjustment,
  type MilestoneSegment
} from './projects/milestoneCalculations';
export * from './projects/projectEntityCalculations';
export {
  calculateAutoEstimateWorkingDays,
  calculateAutoEstimateHoursPerDay,
  calculateTotalWorkingDays,
  DurationFormattingService
} from './projects/projectCalculations';

// ===== GENERAL =====
export * from './general/dateCalculations';  // Primary source for datesOverlap
export * from './general/timeCalculations';  // Primary source for getWeekStart, getCurrentWeekStart
export * from './general/settingsCalculations';

// ===== GROUPS =====
export * from './groups/groupCalculations';

// ===== AVAILABILITY =====
export * from './availability/availabilityCalculations';
// Note: capacityCalculations has calculateOtherTime, calculateOvertimePlannedHours, calculateTotalPlannedHours
// which are also in UnifiedEventWorkHourService (unified layer is primary source)
export {
  type WorkHourCapacity,
  type UtilizationMetrics,
  type CapacityPlanningResult,
  type HolidayOverlapAnalysis,
  CAPACITY_MANAGEMENT_CONFIG,
  calculateWorkHourCapacity,
  calculateTimeOverlap,
  eventOverlapsWorkHours,
  getWorkHoursCapacityForPeriod,
  calculateWorkHourUtilization,
  isDayOverbooked,
  analyzeUtilizationEfficiency,
  isHolidayDateCapacity,
  calculateWorkHourCapacityWithHolidays,
  wouldOverlapHolidays,
  getOverlappingHolidays,
  analyzeHolidayOverlap,
  performCapacityPlanning,
  generateCapacityRecommendations,
  calculateAvailabilityReduction,
  generateWorkHoursForDate,
  calculateProjectWorkingDays,
  getProjectTimeAllocation,
  calculateCommittedHoursForDate,
  hasWorkHoursConfigured,
  dayHasWorkHoursConfigured
} from './availability/capacityCalculations';
// Note: workHourCalculations re-exports getWeekStart/getCurrentWeekStart from timeCalculations
export {
  WorkHourCalculationService,
  calculateWorkHourDuration,
  createWorkHour,
  updateWorkHourWithDuration,
  generateWorkHoursFromSettings,
  mergeWorkHoursWithOverrides,
  canModifyWorkHour,
  validateWorkHour,
  createWeekOverrideManager,
  createDeletionOverride,
  createUpdateOverride,
  resetWorkHourState,
  WORK_HOUR_CONSTANTS,
  calculateTimeFromPosition,
  handleWorkHourCreationStart,
  handleWorkHourCreationMove,
  handleWorkHourCreationComplete,
  getWorkHourOverlapInfo,
  generateWorkHourPreviewStyle,
  getWorkHourCreationCursor,
  shouldAllowWorkHourCreation,
  formatWorkSlotDurationDisplay,
  type WeekOverrideManager,
  type WorkHourGenerationParams,
  type WorkHourMergeParams,
  type TimeCalculationParams,
  type WorkHourCreateState
} from './availability/workHourCalculations';

// ===== TRACKING =====
export * from './tracking/timeTrackingCalculations';
