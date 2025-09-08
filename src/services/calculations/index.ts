/**
 * Calculations Services Index
 * All mathematical computations and business logic calculations
 */

// Availability calculations
export * from './availabilityCalculations';

// Completion calculations
export * from './completionCalculations';

// Date calculations - core date/time functions
export * from './dateCalculations';

// Event calculations
export * from './eventCalculations';

// Event overlap calculations
export * from './eventOverlapCalculations';

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

// Project status calculations
export * from './projectStatusCalculations';

// Time calculations
export * from './timeCalculations';

// Time tracking calculations
export * from './timeTrackingCalculations';

// Timeline calculations - migrated from TimelineCalculationService
export * from './timelineCalculations';

// Calendar insight calculations
export * from './calendarInsightCalculations';
