// Legacy Projects Services
// ProjectCalculationService migrated to UnifiedProjectService
export * from './projectProgressGraphService';

// Explicit re-exports to resolve naming conflicts
export type { ProgressDataPoint, ProgressTrends, ProgressVariance, ProjectProgressAnalysis } from './projectProgressGraphService';
export { analyzeProjectProgress, calculateCompletedTimeUpToDate, calculateMilestoneBasedProgress, calculateProgressTrends, calculateProgressVariance, generateLinearProgressData, generateMilestoneBasedProgressData } from './projectProgressGraphService';
