// Projects services - Domain-driven architecture
export { ProjectOrchestrator } from './ProjectOrchestrator';
export { ProjectValidator } from './ProjectValidator';
export { 
  type IProjectRepository,
  MockProjectRepository 
} from './ProjectRepository';

// Legacy services - For backward compatibility (🗑️ DELETE AFTER MIGRATION)
export * from './ProjectCalculations';
export * from './legacy/ProjectCalculationService';
export * from './legacy/projectProgressCalculationService';
export { analyzeProjectProgress } from './legacy/projectProgressGraphService';
export { calculateEventDurationHours as calculateProgressEventDurationHours, calculateProjectTimeMetrics, type ComprehensiveProjectTimeMetrics } from './legacy/projectProgressService';
export * from './legacy/projectStatusService';
export * from './legacy/projectWorkingDaysService';
// Export selected functions from overlap service to avoid datesOverlap conflict
export { 
  checkProjectOverlap,
  detectLiveDragConflicts,
  resolveDragConflicts,
  findNearestAvailableSlot,
  adjustProjectDatesForDrag,
  type ConflictDetectionResult,
  type DateAdjustmentResult
} from './legacy/projectOverlapService';
export * from './legacy/ProjectValidationService';