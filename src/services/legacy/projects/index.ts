// Legacy Projects Services
export * from './ProjectCalculationService';
export * from './ProjectValidationService';
export * from './projectOverlapService';
export * from './projectProgressCalculationService';
export * from './projectProgressGraphService';
export * from './projectProgressService';
export * from './projectWorkingDaysService';

// Explicit re-exports to resolve naming conflicts
export type { ProgressDataPoint, ProgressTrends, ProgressVariance, ProjectProgressAnalysis } from './projectProgressGraphService';
export { analyzeProjectProgress, calculateCompletedTimeUpToDate, calculateMilestoneBasedProgress, calculateProgressTrends, calculateProgressVariance, generateLinearProgressData, generateMilestoneBasedProgressData } from './projectProgressGraphService';
export type { Project } from './projectOverlapService';
export type { ProgressCalculationOptions } from './projectProgressService';
export { buildPlannedTimeMap, getPlannedTimeUpToDate } from './projectProgressService';
