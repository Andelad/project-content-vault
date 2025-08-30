// Milestones services - Domain-driven architecture
export { MilestoneOrchestrator } from './MilestoneOrchestrator';
export { 
  MilestoneValidator,
  type ValidationContext,
  type DetailedValidationResult,
  type CreateMilestoneValidationRequest,
  type UpdateMilestoneValidationRequest
} from './MilestoneValidator';
export { 
  type IMilestoneRepository,
  MockMilestoneRepository 
} from './MilestoneRepository';

// Legacy services - For backward compatibility (🗑️ DELETE AFTER MIGRATION)
export { 
  type GeneratedMilestone,
  type RecurringMilestonePreview,
  MilestoneManagementService
} from './legacy/milestoneManagementService';
export * from './legacy/milestoneUtilitiesService';
export * from './legacy/recurringMilestoneService';
export * from './legacy/milestoneCalculationService';