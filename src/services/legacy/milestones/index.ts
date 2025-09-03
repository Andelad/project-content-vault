// Legacy Milestones Services
export * from './milestoneCalculationService';
export * from './milestoneManagementService';
export * from './milestoneUtilitiesService';
export * from './recurringMilestoneService';

// Explicit re-exports to resolve naming conflicts
export type { MilestoneValidationResult } from './milestoneCalculationService';
export type { RecurringMilestoneConfig } from './recurringMilestoneService';
