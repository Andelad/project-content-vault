/**
 * Calculations Services Index
 * All mathematical computations and business logic calculations
 */

// Availability calculations
export * from './availabilityCalculations';

// Analytics calculations (consolidation of insights + completion)
export * from './analyticsCalculations';

// Date calculations - core date/time functions
export * from './dateCalculations';

// Drag calculations - pure timeline interaction calculations
export * from './dragCalculations';

// Event calculations (includes event overlap functionality)
export * from './eventCalculations';

// Holiday calculations
export * from './holidayCalculations';

// Milestone calculations  
export * from './milestoneCalculations';

// Planner calculations
export * from './plannerInsights';

// Project calculations - excluding conflicting exports
export {
  calculateAutoEstimateWorkingDays,
  calculateAutoEstimateHoursPerDay,
  calculateTotalWorkingDays,
  DurationFormattingService
} from './projectCalculations';

// Project operations - consolidated progress, status, conflicts, and drag operations
export * from './projectOperations';

// Settings calculations
export * from './settingsCalculations';

// Time calculations
export * from './timeCalculations';

// Time tracking calculations
export * from './timeTrackingCalculations';

// Timeline calculations - migrated from TimelineCalculationService
export * from './timelineCalculations';

// Timeline position calculations - migrated from timelinePositionService
export * from './timelinePositioning';
