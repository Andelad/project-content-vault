/**
 * Milestone Orchestrator
 * 
 * Coordinates milestone domain rules with external systems and complex workflows.
 * This is where milestone business logic lives - the "how" of milestone operations.
 * 
 * ✅ Can import domain entities and external services
 * ✅ Handles async operations and side effects
 * ✅ Coordinates multiple domain entities
 * ✅ Makes decisions based on external data
 */

import { Milestone, Project } from '@/types/core';
import { MilestoneEntity, MilestoneBudgetValidation, MilestoneTimeValidation, MilestoneDateValidation } from '../../core/domain/MilestoneEntity';
import { ProjectEntity } from '../../core/domain/ProjectEntity';

export interface CreateMilestoneRequest {
  name: string;
  timeAllocation: number;
  dueDate: Date;
  projectId: string;
  order?: number;
}

export interface UpdateMilestoneRequest {
  id: string;
  name?: string;
  timeAllocation?: number;
  dueDate?: Date;
  order?: number;
}

export interface MilestoneOperationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  budgetValidation?: MilestoneBudgetValidation;
  timeValidation?: MilestoneTimeValidation;
  dateValidation?: MilestoneDateValidation;
}

export interface MilestoneCreationResult {
  success: boolean;
  milestone?: Milestone;
  errors?: string[];
  warnings?: string[];
}

export interface BudgetImpactAnalysis {
  currentBudgetUsage: number;
  newBudgetUsage: number;
  budgetChange: number;
  wouldExceedBudget: boolean;
  remainingBudget: number;
  utilizationPercent: number;
}

/**
 * Milestone Orchestrator
 * Handles milestone business workflows and coordinates domain rules
 */
export class MilestoneOrchestrator {
  
  /**
   * Validate milestone creation request
   */
  static validateMilestoneCreation(
    request: CreateMilestoneRequest,
    project: Project,
    existingMilestones: Milestone[]
  ): MilestoneOperationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Time validation using domain rules
    const timeValidation = MilestoneEntity.validateMilestoneTime(
      request.timeAllocation,
      project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // Date validation using domain rules
    const dateValidation = MilestoneEntity.validateMilestoneDate(
      request.dueDate,
      project.startDate,
      project.endDate,
      existingMilestones
    );
    errors.push(...dateValidation.errors);

    // Budget validation using domain rules
    const budgetValidation = MilestoneEntity.wouldExceedBudget(
      existingMilestones,
      request.timeAllocation,
      project.estimatedHours
    );
    if (!budgetValidation.isValid) {
      errors.push(`Adding this milestone would exceed project budget by ${budgetValidation.overageAmount}h`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      budgetValidation,
      timeValidation,
      dateValidation
    };
  }

  /**
   * Validate milestone update request
   */
  static validateMilestoneUpdate(
    request: UpdateMilestoneRequest,
    project: Project,
    existingMilestones: Milestone[]
  ): MilestoneOperationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Find the milestone being updated
    const currentMilestone = existingMilestones.find(m => m.id === request.id);
    if (!currentMilestone) {
      errors.push('Milestone not found');
      return { isValid: false, errors, warnings };
    }

    // Validate time allocation if being updated
    if (request.timeAllocation !== undefined) {
      const timeValidation = MilestoneEntity.validateMilestoneTime(
        request.timeAllocation,
        project.estimatedHours
      );
      errors.push(...timeValidation.errors);
      warnings.push(...timeValidation.warnings);

      // Check budget impact
      const budgetValidation = MilestoneEntity.wouldUpdateExceedBudget(
        existingMilestones,
        request.id,
        request.timeAllocation,
        project.estimatedHours
      );
      if (!budgetValidation.isValid) {
        errors.push(`Updating this milestone would exceed project budget by ${budgetValidation.overageAmount}h`);
      }
    }

    // Validate date if being updated
    if (request.dueDate !== undefined) {
      const dateValidation = MilestoneEntity.validateMilestoneDate(
        request.dueDate,
        project.startDate,
        project.endDate,
        existingMilestones,
        request.id // Exclude current milestone from conflict check
      );
      errors.push(...dateValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Analyze budget impact of milestone changes
   */
  static analyzeBudgetImpact(
    milestones: Milestone[],
    project: Project,
    milestoneId?: string,
    newTimeAllocation?: number
  ): BudgetImpactAnalysis {
    const currentBudgetUsage = ProjectEntity.calculateTotalMilestoneAllocation(milestones);
    
    let newBudgetUsage = currentBudgetUsage;
    if (milestoneId && newTimeAllocation !== undefined) {
      // Calculate new usage with updated milestone
      const currentMilestone = milestones.find(m => m.id === milestoneId);
      const currentAllocation = currentMilestone?.timeAllocation || 0;
      newBudgetUsage = currentBudgetUsage - currentAllocation + newTimeAllocation;
    } else if (newTimeAllocation !== undefined) {
      // Adding new milestone
      newBudgetUsage = currentBudgetUsage + newTimeAllocation;
    }

    const budgetChange = newBudgetUsage - currentBudgetUsage;
    const wouldExceedBudget = newBudgetUsage > project.estimatedHours;
    const remainingBudget = project.estimatedHours - newBudgetUsage;
    const utilizationPercent = project.estimatedHours > 0 ? 
      (newBudgetUsage / project.estimatedHours) * 100 : 0;

    return {
      currentBudgetUsage,
      newBudgetUsage,
      budgetChange,
      wouldExceedBudget,
      remainingBudget,
      utilizationPercent
    };
  }

  /**
   * Calculate next milestone order
   */
  static calculateNextOrder(existingMilestones: Milestone[]): number {
    if (existingMilestones.length === 0) return 1;
    
    const maxOrder = Math.max(...existingMilestones.map(m => m.order || 0));
    return maxOrder + 1;
  }

  /**
   * Generate milestone suggestions based on project
   */
  static generateMilestoneSuggestions(
    project: Project,
    requestedCount: number
  ): Partial<CreateMilestoneRequest>[] {
    if (requestedCount <= 0) return [];

    const suggestions: Partial<CreateMilestoneRequest>[] = [];
    const suggestedBudget = ProjectEntity.suggestMilestoneBudget(project, requestedCount);
    
    // For time-limited projects, distribute dates evenly
    if (ProjectEntity.isTimeLimitedProject(project)) {
      const projectDuration = ProjectEntity.calculateProjectDuration(project);
      if (projectDuration) {
        const intervalDays = Math.floor(projectDuration / (requestedCount + 1));
        
        for (let i = 1; i <= requestedCount; i++) {
          const dueDate = new Date(project.startDate);
          dueDate.setDate(dueDate.getDate() + (intervalDays * i));
          
          suggestions.push({
            name: `Milestone ${i}`,
            timeAllocation: suggestedBudget,
            dueDate,
            projectId: project.id,
            order: i
          });
        }
      }
    } else {
      // For continuous projects, suggest milestones starting from project start
      for (let i = 1; i <= requestedCount; i++) {
        const dueDate = new Date(project.startDate);
        dueDate.setDate(dueDate.getDate() + (7 * i)); // Weekly intervals
        
        suggestions.push({
          name: `Milestone ${i}`,
          timeAllocation: suggestedBudget,
          dueDate,
          projectId: project.id,
          order: i
        });
      }
    }

    return suggestions;
  }

  /**
   * Check if milestone can be safely deleted
   */
  static canDeleteMilestone(
    milestone: Milestone,
    project: Project
  ): { canDelete: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check if it's a recurring milestone
    if (MilestoneEntity.isRecurringMilestone(milestone)) {
      warnings.push('This appears to be part of a recurring milestone series');
    }

    // Check if it's a significant portion of the budget
    const budgetPercent = (milestone.timeAllocation / project.estimatedHours) * 100;
    if (budgetPercent > 25) {
      warnings.push(`This milestone represents ${budgetPercent.toFixed(1)}% of the project budget`);
    }

    // Check if it's in the past (would need date context from calling code)
    // This could be enhanced with additional business rules

    return {
      canDelete: true, // Generally allow deletion but with warnings
      warnings
    };
  }

  /**
   * Prepare milestone for creation (business logic preparation)
   */
  static prepareMilestoneForCreation(
    request: CreateMilestoneRequest,
    existingMilestones: Milestone[]
  ): CreateMilestoneRequest {
    return {
      ...request,
      order: request.order || this.calculateNextOrder(existingMilestones),
      name: request.name.trim(),
      timeAllocation: Math.max(0, request.timeAllocation) // Ensure non-negative
    };
  }

  /**
   * Format milestone validation errors for user display
   */
  static formatValidationErrors(result: MilestoneOperationResult): string[] {
    const formattedErrors: string[] = [];

    result.errors.forEach(error => {
      formattedErrors.push(error);
    });

    // Add formatted budget information if available
    if (result.budgetValidation && !result.budgetValidation.isValid) {
      formattedErrors.push(
        `Budget Impact: ${result.budgetValidation.formattedTotal} (${result.budgetValidation.budgetUtilization.toFixed(1)}% utilization)`
      );
    }

    return formattedErrors;
  }

  /**
   * Format milestone validation warnings for user display
   */
  static formatValidationWarnings(result: MilestoneOperationResult): string[] {
    return result.warnings;
  }
}
