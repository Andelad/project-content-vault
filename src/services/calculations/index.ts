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
// Note: Old planner insights files removed - event preparation moved to UnifiedEventTransformService

// ===== PROJECTS =====
export * from './projects/dayEstimateCalculations';
// Note: phaseCalculations has calculateProjectWorkingDays which is also in capacityCalculations
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
  calculateRecurringPhaseCount,
  calculateRecurringTotalAllocation,
  detectRecurringPattern,
  generateRecurringPhaseDates,
  getMilestoneSegmentForDate,
  calculateMilestoneSegments,
  calculateBudgetAdjustment,
  type MilestoneSegment
} from './projects/phaseCalculations';
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

// ===== TIMELINE =====
export * from './timeline/timelineRowCalculations';  // Timeline row arrangement algorithm

// ===== GROUPS =====
export * from './groups/groupCalculations';

// ===== AVAILABILITY =====
export * from './availability/dailyMetrics';  // Daily work hours and availability metrics
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
  dayHasWorkHoursConfigured,
  calculateHabitTimeWithinWorkSlots,
  calculatePlannedTimeNotOverlappingHabits,
  calculateNetAvailability
} from './availability/capacityAnalysis';
// Note: workHourCalculations re-exports getWeekStart/getCurrentWeekStart from timeCalculations
export {
  WorkHourCalculationService,
  calculateWorkHourDuration,
  calculateWorkHoursTotal,
  calculateDayWorkHours,
  calculateTotalDayWorkHours,
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
  type WeekOverrideManager,
  type WorkHourGenerationParams,
  type WorkHourMergeParams
} from './availability/workHourGeneration';

// ===== TRACKING =====
export * from './tracking/timeTrackingCalculations';
