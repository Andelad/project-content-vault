/**
 * Milestone Validator
 * 
 * Handles complex validation rules that require coordination between
 * domain entities and external data (repository access).
 * 
 * ✅ Coordinates domain rules with data access
 * ✅ Handles complex validation scenarios
 * ✅ Provides detailed validation results
 */

import { Milestone, Project } from '@/types/core';
import { UnifiedMilestoneEntity, UnifiedProjectEntity } from '../unified';
import { IMilestoneRepository } from '../repositories/MilestoneRepository';

export interface ValidationContext {
  project: Project;
  existingMilestones: Milestone[];
  repository?: IMilestoneRepository;
}

export interface DetailedValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  context: {
    budgetImpact?: {
      currentUtilization: number;
      newUtilization: number;
      remainingBudget: number;
    };
    dateImpact?: {
      conflictingMilestones: Milestone[];
      nearbyMilestones: Milestone[];
    };
    projectHealth?: {
      overallStatus: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
  };
}

export interface CreateMilestoneValidationRequest {
  name: string;
  dueDate: Date;
  timeAllocation: number;
  projectId: string;
}

export interface UpdateMilestoneValidationRequest {
  id: string;
  name?: string;
  dueDate?: Date;
  timeAllocation?: number;
}

/**
 * Milestone Validator
 * 
 * Provides comprehensive validation by coordinating domain rules
 * with repository data and complex business scenarios.
 */
export class MilestoneValidator {

  /**
   * Validate milestone creation with comprehensive checks
   */
  static async validateMilestoneCreation(
    request: CreateMilestoneValidationRequest,
    context: ValidationContext
  ): Promise<DetailedValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Domain-level validations
    const timeValidation = UnifiedMilestoneEntity.validateMilestoneTime(
      request.timeAllocation,
      context.project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    const dateValidation = UnifiedMilestoneEntity.validateMilestoneDate(
      request.dueDate,
      context.project.startDate,
      context.project.endDate,
      context.existingMilestones
    );
    errors.push(...dateValidation.errors);

    // Budget impact analysis
    const budgetValidation = UnifiedMilestoneEntity.wouldExceedBudget(
      context.existingMilestones,
      request.timeAllocation,
      context.project.estimatedHours
    );

    if (!budgetValidation.isValid) {
      errors.push(`Adding this milestone would exceed project budget by ${budgetValidation.overageAmount}h`);
    }

    // Repository-based validations (if available)
    let conflictingMilestones: Milestone[] = [];
    if (context.repository) {
      conflictingMilestones = await context.repository.findConflictingDates(
        request.projectId,
        request.dueDate
      );
      
      if (conflictingMilestones.length > 0) {
        errors.push(`${conflictingMilestones.length} milestone(s) already exist on this date`);
      }
    }

    // Advanced business rule validations
    const projectAnalysis = UnifiedProjectEntity.analyzeBudget(context.project, context.existingMilestones);
    
    if (projectAnalysis.utilizationPercent > 80) {
      warnings.push('Project budget is already highly utilized (>80%)');
    }

    // Name validation
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Milestone name is required');
    }

    if (request.name && request.name.length > 100) {
      warnings.push('Milestone name is very long (>100 characters)');
    }

    // Suggestions based on analysis
    if (request.timeAllocation < 1) {
      suggestions.push('Consider allocating at least 1 hour to this milestone');
    }

    if (budgetValidation.budgetUtilization > 0.9) {
      suggestions.push('Consider reducing milestone allocation or increasing project budget');
    }

    if (context.existingMilestones.length === 0) {
      suggestions.push('This is your first milestone - consider adding more to track project progress');
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (errors.length > 0) {
      overallStatus = 'critical';
    } else if (warnings.length > 0) {
      overallStatus = 'warning';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        budgetImpact: {
          currentUtilization: projectAnalysis.utilizationPercent,
          newUtilization: budgetValidation.budgetUtilization * 100,
          remainingBudget: projectAnalysis.remainingHours - request.timeAllocation
        },
        dateImpact: {
          conflictingMilestones,
          nearbyMilestones: this.findNearbyMilestones(request.dueDate, context.existingMilestones, 7)
        },
        projectHealth: {
          overallStatus,
          issues: [...errors, ...warnings]
        }
      }
    };
  }

  /**
   * Validate milestone update with impact analysis
   */
  static async validateMilestoneUpdate(
    request: UpdateMilestoneValidationRequest,
    context: ValidationContext
  ): Promise<DetailedValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Find the milestone being updated
    const currentMilestone = context.existingMilestones.find(m => m.id === request.id);
    if (!currentMilestone) {
      return {
        isValid: false,
        errors: ['Milestone not found'],
        warnings: [],
        suggestions: [],
        context: {}
      };
    }

    // Validate time allocation changes
    if (request.timeAllocation !== undefined) {
      const budgetValidation = UnifiedMilestoneEntity.wouldUpdateExceedBudget(
        context.existingMilestones,
        request.id,
        request.timeAllocation,
        context.project.estimatedHours
      );

      if (!budgetValidation.isValid) {
        errors.push(`Updating allocation would exceed budget by ${budgetValidation.overageAmount}h`);
      }

      // Check for significant changes
      const currentAllocation = currentMilestone.timeAllocation;
      const change = Math.abs(request.timeAllocation - currentAllocation);
      const changePercent = currentAllocation > 0 ? (change / currentAllocation) * 100 : 0;

      if (changePercent > 50) {
        warnings.push(`Significant allocation change: ${changePercent.toFixed(1)}%`);
      }
    }

    // Validate date changes
    if (request.dueDate !== undefined) {
      const dateValidation = UnifiedMilestoneEntity.validateMilestoneDate(
        request.dueDate,
        context.project.startDate,
        context.project.endDate,
        context.existingMilestones,
        request.id // Exclude current milestone from conflict check
      );
      errors.push(...dateValidation.errors);

      // Check for repository conflicts if available
      if (context.repository) {
        const conflictingMilestones = await context.repository.findConflictingDates(
          context.project.id,
          request.dueDate,
          request.id
        );
        
        if (conflictingMilestones.length > 0) {
          errors.push(`Date conflicts with ${conflictingMilestones.length} other milestone(s)`);
        }
      }
    }

    // Name validation
    if (request.name !== undefined) {
      if (!request.name || request.name.trim().length === 0) {
        errors.push('Milestone name cannot be empty');
      }

      if (request.name && request.name.length > 100) {
        warnings.push('Milestone name is very long (>100 characters)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {}
    };
  }

  /**
   * Validate milestone deletion
   */
  static validateMilestoneDeletion(
    milestoneId: string,
    context: ValidationContext
  ): DetailedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const milestone = context.existingMilestones.find(m => m.id === milestoneId);
    if (!milestone) {
      return {
        isValid: false,
        errors: ['Milestone not found'],
        warnings: [],
        suggestions: [],
        context: {}
      };
    }

    // Check if it's a significant milestone
    const budgetPercent = (milestone.timeAllocation / context.project.estimatedHours) * 100;
    if (budgetPercent > 25) {
      warnings.push(`Deleting milestone with ${budgetPercent.toFixed(1)}% of project budget`);
    }

    // Check if it's a recurring milestone
    if (UnifiedMilestoneEntity.isRecurringMilestone(milestone)) {
      warnings.push('This appears to be part of a recurring milestone series');
      suggestions.push('Consider updating the recurring pattern instead of deleting');
    }

    // Check if it's the last milestone
    if (context.existingMilestones.length === 1) {
      warnings.push('This is the last milestone in the project');
      suggestions.push('Consider adding replacement milestones for progress tracking');
    }

    return {
      isValid: true, // Deletion is generally allowed, but with warnings
      errors,
      warnings,
      suggestions,
      context: {}
    };
  }

  /**
   * Find milestones near a given date
   */
  private static findNearbyMilestones(
    targetDate: Date,
    milestones: Milestone[],
    withinDays: number = 7
  ): Milestone[] {
    return milestones.filter(milestone => {
      const daysDiff = Math.abs(
        (milestone.dueDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff <= withinDays && daysDiff > 0;
    });
  }

  /**
   * Bulk validate multiple milestone operations
   */
  static async validateBulkOperations(
    operations: Array<{
      type: 'create' | 'update' | 'delete';
      data: CreateMilestoneValidationRequest | UpdateMilestoneValidationRequest | string;
    }>,
    context: ValidationContext
  ): Promise<{
    overallValid: boolean;
    results: DetailedValidationResult[];
    summary: {
      totalErrors: number;
      totalWarnings: number;
      criticalIssues: string[];
    };
  }> {
    const results: DetailedValidationResult[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    const criticalIssues: string[] = [];

    for (const operation of operations) {
      let result: DetailedValidationResult;

      switch (operation.type) {
        case 'create':
          result = await this.validateMilestoneCreation(
            operation.data as CreateMilestoneValidationRequest,
            context
          );
          break;
        case 'update':
          result = await this.validateMilestoneUpdate(
            operation.data as UpdateMilestoneValidationRequest,
            context
          );
          break;
        case 'delete':
          result = this.validateMilestoneDeletion(
            operation.data as string,
            context
          );
          break;
        default:
          result = {
            isValid: false,
            errors: ['Unknown operation type'],
            warnings: [],
            suggestions: [],
            context: {}
          };
      }

      results.push(result);
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      if (!result.isValid) {
        criticalIssues.push(...result.errors);
      }
    }

    return {
      overallValid: totalErrors === 0,
      results,
      summary: {
        totalErrors,
        totalWarnings,
        criticalIssues
      }
    };
  }
}
