// Legacy Milestones Services
// milestoneCalculationService migrated to calculations/milestoneCalculations.ts
export * from './milestoneManagementService';

// Explicit re-exports to resolve naming conflicts
export type { MilestoneValidationResult, LegacyMilestone, RecurringPattern } from '../../calculations/milestoneCalculations';
export type { RecurringMilestoneConfig } from '../../calculations/milestoneCalculations';
