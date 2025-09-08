/**
 * Calculations Services Index
 * All mathematical computations and business logic calculations
 */

// Date calculations - core date/time functions
export * from './dateCalculations';

// Holiday calculations
export * from './holidayCalculations';

// Milestone calculations  
export * from './milestoneCalculations';

// Planner calculations
export * from './plannerCalculations';

// Project calculations - excluding conflicting exports
export {
  calculateAutoEstimateWorkingDays,
  calculateAutoEstimateHoursPerDay,
  DurationFormattingService
} from './projectCalculations';

// Project overlap calculations
export * from './projectOverlapCalculations';

// Time calculations
export * from './timeCalculations';

// Time tracking calculations
export * from './timeTrackingCalculations';

// Timeline calculations - migrated from TimelineCalculationService
export * from './timelineCalculations';

// Calendar insight calculations
export * from './calendarInsightCalculations';
