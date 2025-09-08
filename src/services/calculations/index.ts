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

// Drag calculations - timeline interaction logic
export * from './dragCalculations';

// Event calculations
export * from './eventCalculations';

// Event overlap calculations
export * from './eventOverlapCalculations';

// Holiday calculations
export * from './holidayCalculations';

// Insight calculations
export * from './insightCalculations';

// Milestone calculations  
export * from './milestoneCalculations';

// Planner calculations
export * from './plannerCalculations';

// Project calculations - excluding conflicting exports
export {
  calculateAutoEstimateWorkingDays,
  calculateAutoEstimateHoursPerDay,
  calculateTotalWorkingDays,
  DurationFormattingService
} from './projectCalculations';

// Project overlap calculations - explicit exports to avoid conflicts
export {
  checkProjectOverlap,
  detectLiveDragConflicts,
  resolveDragConflicts,
  findNearestAvailableSlot,
  adjustProjectDatesForDrag,
  calculateOverlapPercentage
} from './projectOverlapCalculations';

export type {
  ConflictDetectionResult,
  DateAdjustmentResult
} from './projectOverlapCalculations';

// Project status calculations
export * from './projectStatusCalculations';

// Settings calculations
export * from './settingsCalculations';

// Time calculations
export * from './timeCalculations';

// Time tracking calculations
export * from './timeTrackingCalculations';

// Timeline calculations - migrated from TimelineCalculationService
export * from './timelineCalculations';

// Timeline position calculations - migrated from timelinePositionService
export * from './timelinePositionCalculations';

// Project progress calculations - migrated from projectProgressService
export * from './projectProgressCalculations';

// Calendar insight calculations
export * from './calendarInsightCalculations';
