// Legacy Milestones Services
// milestoneCalculationService migrated to calculations/milestoneCalculations.ts
// milestoneManagementService migrated to unified/UnifiedMilestoneService.ts + orchestrators/MilestoneOrchestrator.ts

// Explicit re-exports to resolve naming conflicts
export type { MilestoneValidationResult, LegacyMilestone, RecurringPattern } from '../../calculations/milestoneCalculations';
export type { RecurringMilestoneConfig } from '../../calculations/milestoneCalculations';
