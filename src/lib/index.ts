// Barrel export for all lib utilities
// Note: Some utilities have naming conflicts, import specific functions when needed

// Date utilities
export * from './dateUtils';
export * from './timeCalculations';

// Drag and performance
export * from './dragPerformance';
export { 
  calculateDaysDelta, 
  createSmoothAnimation, 
  throttle,
  // debounce is also exported from performanceUtils - use specific imports
} from './dragUtils';

// Event and work hours
export * from './eventWorkHourUtils';
export * from './workHoursUtils';
export * from './workSlotOverlapUtils';

// Performance and optimization
export * from './memoization';
export { 
  trackMemoryUsage,
  debounce,
  performanceMonitor 
} from './performanceUtils';

// Project utilities
export * from './projectOverlapUtils';
export * from './projectUtils';
export { 
  calculateProjectTimeMetrics,
  recalculateProjectMetrics,
  // Note: calculatePlannedTimeForDate conflicts with eventWorkHourUtils
} from './projectCalculations';
export type { ProjectTimeMetrics } from './projectCalculations';

// Timeline and positioning
export * from './timelinePositioning';
export * from './viewportUtils';

// Milestones
export * from './milestoneSegmentUtils';
export * from './milestoneUtils';

// Midnight events
export * from './midnightEventUtils';

// General utilities
export * from './utils';
