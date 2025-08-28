// Events services
export * from './dragCalculationService';
export * from './eventDurationService';
export * from './eventOverlapService';
export { calculateDurationHours as calculateSplitDurationHours } from './eventSplittingService';
export {
  processEventOverlaps,
  calculateElapsedTime,
  createTimeRange,
  type EventSplitResult
} from './eventSplittingService';
export * from './eventWorkHourIntegrationService';
export * from './timelineDragCoordinatorService';