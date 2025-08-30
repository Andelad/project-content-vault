// Events services
export * from './legacy/dragCalculationService';
export * from './legacy/eventDurationService';
export * from './legacy/eventOverlapService';
export { calculateDurationHours as calculateSplitDurationHours } from './legacy/eventSplittingService';
export {
  processEventOverlaps,
  calculateElapsedTime,
  createTimeRange,
  type EventSplitResult,
  splitMidnightCrossingEvents
} from './legacy/eventSplittingService';
export {
  memoizedGetProjectTimeAllocation
} from './eventWorkHourIntegrationService';
export * from './legacy/plannedTimeCompletionService';
export * from './timelineDragCoordinatorService';