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
import { 
  UnifiedMilestoneEntity, 
  UnifiedProjectEntity,
  MilestoneBudgetValidation,
  MilestoneTimeValidation,
  MilestoneDateValidation
} from '../unified';
import { milestoneRepository } from '../repositories/MilestoneRepository';
import type { SyncResult } from '../repositories/IBaseRepository';

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
    const timeValidation = UnifiedMilestoneEntity.validateMilestoneTime(
      request.timeAllocation,
      project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // Date validation using domain rules
    const dateValidation = UnifiedMilestoneEntity.validateMilestoneDate(
      request.dueDate,
      project.startDate,
      project.endDate,
      existingMilestones
    );
    errors.push(...dateValidation.errors);

    // Budget validation using domain rules
    const budgetValidation = UnifiedMilestoneEntity.wouldExceedBudget(
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
      const timeValidation = UnifiedMilestoneEntity.validateMilestoneTime(
        request.timeAllocation,
        project.estimatedHours
      );
      errors.push(...timeValidation.errors);
      warnings.push(...timeValidation.warnings);

      // Check budget impact
      const budgetValidation = UnifiedMilestoneEntity.wouldUpdateExceedBudget(
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
      const dateValidation = UnifiedMilestoneEntity.validateMilestoneDate(
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
    const currentBudgetUsage = UnifiedProjectEntity.calculateTotalMilestoneAllocation(milestones);
    
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
    const suggestedBudget = UnifiedProjectEntity.suggestMilestoneBudget(project, requestedCount);
    
    // For time-limited projects, distribute dates evenly
    if (UnifiedProjectEntity.isTimeLimitedProject(project)) {
      const projectDuration = UnifiedProjectEntity.calculateProjectDuration(project);
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
    if (UnifiedMilestoneEntity.isRecurringMilestone(milestone)) {
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

  /**
   * Analyze milestone budget allocation
   * Used by: Milestone budget analysis, project budget validation
   * Migrated from legacy MilestoneManagementService
   */
  static analyzeMilestoneBudget(
    milestones: (Milestone | { timeAllocation: number })[],
    projectEstimatedHours: number,
    recurringAllocation: number = 0
  ): {
    totalRegularAllocation: number;
    totalRecurringAllocation: number;
    totalAllocation: number;
    isOverBudget: boolean;
    budgetUtilization: number;
    suggestedBudget: number;
    remainingBudget: number;
  } {
    const totalRegularAllocation = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    const totalRecurringAllocation = recurringAllocation;
    const totalAllocation = totalRegularAllocation + totalRecurringAllocation;
    
    // Calculate budget utilization as percentage (0-100)
    const budgetUtilization = projectEstimatedHours > 0 ? 
      (totalAllocation / projectEstimatedHours) * 100 : 0;
    
    return {
      totalRegularAllocation,
      totalRecurringAllocation,
      totalAllocation,
      isOverBudget: budgetUtilization > 100,
      budgetUtilization: budgetUtilization / 100, // Convert to decimal for compatibility
      suggestedBudget: budgetUtilization > 100 ? 
        Math.ceil(totalAllocation * 1.2) : projectEstimatedHours,
      remainingBudget: Math.max(0, projectEstimatedHours - totalAllocation)
    };
  }

  // =====================================================================================
  // REPOSITORY-BASED MILESTONE WORKFLOWS
  // =====================================================================================

  /**
   * Create milestone with validation and repository persistence
   * Coordinates domain validation with data persistence
   */
  static async createMilestone(
    request: CreateMilestoneRequest,
    project: Project
  ): Promise<MilestoneCreationResult> {
    try {
      // Get existing milestones for validation
      const existingMilestones = await milestoneRepository.findByProjectId(project.id);
      
      // Validate creation request using domain rules
      const validationResult = this.validateMilestoneCreation(request, project, existingMilestones);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        };
      }

      // Get next order index
      const nextOrder = request.order ?? await milestoneRepository.getNextOrderIndex(project.id);

      // Create milestone with repository
      const milestone = await milestoneRepository.create({
        name: request.name,
        dueDate: request.dueDate,
        timeAllocation: request.timeAllocation,
        projectId: request.projectId,
        order: nextOrder,
        userId: 'default-user' // TODO: Get from auth context
      });

      return {
        success: true,
        milestone,
        warnings: validationResult.warnings
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Failed to create milestone: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Update milestone with validation and repository persistence
   * Coordinates domain validation with data persistence
   */
  static async updateMilestone(
    request: UpdateMilestoneRequest,
    project: Project
  ): Promise<MilestoneCreationResult> {
    try {
      // Get existing milestone
      const existingMilestone = await milestoneRepository.findById(request.id);
      if (!existingMilestone) {
        return {
          success: false,
          errors: ['Milestone not found']
        };
      }

      // Get other milestones for validation
      const allMilestones = await milestoneRepository.findByProjectId(project.id);
      const otherMilestones = allMilestones.filter(m => m.id !== request.id);
      
      // Validate update request using domain rules
      const validationResult = this.validateMilestoneUpdate(request, project, allMilestones);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        };
      }

      // Update milestone with repository
      const milestone = await milestoneRepository.update(request.id, {
        name: request.name,
        dueDate: request.dueDate,
        timeAllocation: request.timeAllocation,
        order: request.order
      });

      return {
        success: true,
        milestone,
        warnings: validationResult.warnings
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Failed to update milestone: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Delete milestone with repository persistence and cleanup
   */
  static async deleteMilestone(milestoneId: string): Promise<{success: boolean; error?: string}> {
    try {
      const deleted = await milestoneRepository.delete(milestoneId);
      return { success: deleted };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get project milestones with repository caching
   */
  static async getProjectMilestones(projectId: string): Promise<Milestone[]> {
    return milestoneRepository.findByProjectId(projectId);
  }

  /**
   * Reorder project milestones with repository persistence
   */
  static async reorderMilestones(
    projectId: string, 
    milestoneOrders: Array<{id: string; order: number}>
  ): Promise<{success: boolean; error?: string}> {
    try {
      await milestoneRepository.reorderMilestones(projectId, milestoneOrders);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get milestone analytics for project
   */
  static async getMilestoneAnalytics(projectId: string): Promise<{
    statistics: any;
    progress: any;
    success: boolean;
    error?: string;
  }> {
    try {
      const [statistics, progress] = await Promise.all([
        milestoneRepository.getMilestoneStatistics(projectId),
        milestoneRepository.getMilestoneProgress(projectId)
      ]);

      return {
        statistics,
        progress,
        success: true
      };
    } catch (error) {
      return {
        statistics: null,
        progress: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Bulk create milestones with validation
   */
  static async bulkCreateMilestones(
    milestones: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>[],
    project: Project
  ): Promise<{success: boolean; milestones?: Milestone[]; errors?: string[]}> {
    try {
      // Get existing milestones for validation
      const existingMilestones = await milestoneRepository.findByProjectId(project.id);
      
      // Validate each milestone
      const validationErrors: string[] = [];
      for (const milestone of milestones) {
        const validationResult = this.validateMilestoneCreation(
          {
            name: milestone.name,
            dueDate: milestone.dueDate,
            timeAllocation: milestone.timeAllocation,
            projectId: milestone.projectId,
            order: milestone.order
          },
          project,
          existingMilestones
        );
        
        if (!validationResult.isValid) {
          validationErrors.push(...validationResult.errors);
        }
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          errors: validationErrors
        };
      }

      // Create milestones in bulk
      const created = await milestoneRepository.bulkCreateMilestones(milestones);

      return {
        success: true,
        milestones: created
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Failed to bulk create milestones: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Sync milestone data with external systems
   */
  static async syncMilestoneData(): Promise<SyncResult> {
    try {
      // TODO: Implement external sync logic
      return {
        success: true,
        syncedCount: 0,
        conflictCount: 0,
        errors: [],
        conflicts: [],
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        syncedCount: 0,
        conflictCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        conflicts: [],
        duration: 0
      };
    }
  }

  /**
   * Repository health check and diagnostics
   */
  static async validateMilestoneRepository(): Promise<{isHealthy: boolean; issues: string[]}> {
    return milestoneRepository.validateRepositoryHealth();
  }
}
