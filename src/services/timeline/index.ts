// Timeline services - only import from existing files
export * from '../core/orchestrators/TimeAllocationOrchestrator'; // Re-export from canonical location

// Legacy services - maintain backward compatibility
export * from './legacy/HeightCalculationService';
export * from './legacy/HolidayCalculationService';
export * from './legacy/AvailabilityCircleSizingService';
export * from './legacy/timelineViewportService';
export * from './legacy/timelinePositionService'; // Export positioning functions
export { TimelinePositioningService } from './legacy/TimelinePositioningService';
export { TimelineCalculationService } from './legacy/TimelineCalculationService';
export { 
  ProjectDaysCalculationService, 
  ProjectMetricsCalculationService,
  WeeklyCapacityCalculationService,
  WorkHoursCalculationService,
  CommittedHoursCalculationService,
  WorkHoursValidationService
} from './legacy/TimelineBusinessLogicService';