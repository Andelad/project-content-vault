// Projects services
export * from './DurationFormattingService';
export * from './ProjectCalculationService';
export * from './projectProgressCalculationService';
export { analyzeProjectProgress } from './projectProgressGraphService';
export { calculateEventDurationHours as calculateProgressEventDurationHours, calculateProjectTimeMetrics, type ComprehensiveProjectTimeMetrics } from './projectProgressService';
export * from './projectStatusService';
export * from './projectWorkingDaysService';
export * from './projectOverlapService';
export * from './ProjectValidationService';