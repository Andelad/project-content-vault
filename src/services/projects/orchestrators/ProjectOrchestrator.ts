/**
 * Project Orchestrator
 * 
 * Coordinates project domain rules with milestone management and external systems.
 * Handles complex project workflows that involve multiple entities.
 * 
 * ✅ Coordinates project and milestone entities
 * ✅ Handles project-milestone relationship logic
 * ✅ Manages project lifecycle workflows
 */

import { Project, Milestone } from '@/types/core';
import { ProjectEntity, ProjectBudgetAnalysis } from '../../core/domain/ProjectEntity';
import { MilestoneEntity } from '../../core/domain/MilestoneEntity';

export interface ProjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProjectMilestoneAnalysis {
  projectBudget: ProjectBudgetAnalysis;
  milestoneCount: number;
  regularMilestones: number;
  recurringMilestones: number;
  hasOverBudgetMilestones: boolean;
  hasDateConflicts: boolean;
  suggestions: string[];
}

export interface ProjectCreationRequest {
  name: string;
  client: string;
  startDate: Date;
  endDate?: Date;
  estimatedHours: number;
  continuous?: boolean;
  color: string;
  groupId: string;
  rowId: string;
  notes?: string;
  icon?: string;
}

export interface ProjectUpdateRequest {
  id: string;
  name?: string;
  client?: string;
  startDate?: Date;
  endDate?: Date;
  estimatedHours?: number;
  continuous?: boolean;
  color?: string;
  notes?: string;
  icon?: string;
}

/**
 * Project Orchestrator
 * Handles project business workflows and project-milestone coordination
 */
export class ProjectOrchestrator {

  /**
   * Validate project creation with milestone considerations
   */
  static validateProjectCreation(
    request: ProjectCreationRequest,
    existingMilestones: Milestone[] = []
  ): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate project time constraints
    const timeValidation = ProjectEntity.validateProjectTime(
      request.estimatedHours,
      existingMilestones
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // Validate project dates
    const dateValidation = ProjectEntity.validateProjectDates(
      request.startDate,
      request.endDate,
      request.continuous
    );
    errors.push(...dateValidation.errors);

    // Business rule: Validate name requirements
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!request.client || request.client.trim().length === 0) {
      errors.push('Client name is required');
    }

    // Business rule: Validate estimated hours range
    if (request.estimatedHours <= 0) {
      errors.push('Estimated hours must be greater than 0');
    }

    if (request.estimatedHours > 10000) {
      warnings.push('Project estimated hours is very large (>10,000 hours)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate project updates with impact analysis
   */
  static validateProjectUpdate(
    request: ProjectUpdateRequest,
    currentProject: Project,
    currentMilestones: Milestone[]
  ): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create updated project for validation
    const updatedProject: Project = {
      ...currentProject,
      ...request
    };

    // Validate updated dates if changed
    if (request.startDate !== undefined || request.endDate !== undefined || request.continuous !== undefined) {
      const dateValidation = ProjectEntity.validateProjectDates(
        updatedProject.startDate,
        updatedProject.endDate,
        updatedProject.continuous
      );
      errors.push(...dateValidation.errors);

      // Check milestone date compatibility
      const incompatibleMilestones = currentMilestones.filter(m => 
        !ProjectEntity.isDateWithinProject(m.dueDate, updatedProject)
      );

      if (incompatibleMilestones.length > 0) {
        errors.push(`${incompatibleMilestones.length} milestone(s) would fall outside the updated project timeframe`);
      }
    }

    // Validate budget changes
    if (request.estimatedHours !== undefined) {
      const budgetAnalysis = ProjectEntity.analyzeBudget(updatedProject, currentMilestones);
      
      if (budgetAnalysis.isOverBudget) {
        errors.push(`Reducing budget would result in ${budgetAnalysis.overageHours}h over-allocation`);
      }

      if (request.estimatedHours < currentProject.estimatedHours) {
        warnings.push(`Reducing project budget from ${currentProject.estimatedHours}h to ${request.estimatedHours}h`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Analyze project-milestone relationship health
   */
  static analyzeProjectMilestones(
    project: Project,
    milestones: Milestone[]
  ): ProjectMilestoneAnalysis {
    const projectBudget = ProjectEntity.analyzeBudget(project, milestones);
    const regularMilestones = milestones.filter(m => MilestoneEntity.isRegularMilestone(m)).length;
    const recurringMilestones = milestones.filter(m => MilestoneEntity.isRecurringMilestone(m)).length;
    
    // Check for over-budget milestones
    const hasOverBudgetMilestones = milestones.some(m => 
      m.timeAllocation > project.estimatedHours
    );

    // Check for date conflicts
    const hasDateConflicts = this.checkMilestoneDateConflicts(milestones);

    // Generate suggestions
    const suggestions: string[] = [];
    
    if (projectBudget.isOverBudget) {
      suggestions.push(`Consider increasing project budget by ${projectBudget.overageHours}h or reducing milestone allocations`);
    }

    if (milestones.length === 0) {
      suggestions.push('Consider adding milestones to track project progress');
    }

    if (projectBudget.utilizationPercent < 50) {
      suggestions.push('Project has significant unallocated budget - consider adding more milestones');
    }

    if (hasDateConflicts) {
      suggestions.push('Resolve milestone date conflicts');
    }

    return {
      projectBudget,
      milestoneCount: milestones.length,
      regularMilestones,
      recurringMilestones,
      hasOverBudgetMilestones,
      hasDateConflicts,
      suggestions
    };
  }

  /**
   * Calculate project budget adjustments needed for milestone compatibility
   */
  static calculateBudgetAdjustment(
    project: Project,
    milestones: Milestone[],
    targetUtilization: number = 0.9 // 90% utilization target
  ): {
    currentBudget: number;
    suggestedBudget: number;
    adjustmentNeeded: number;
    reason: string;
  } {
    const totalAllocated = ProjectEntity.calculateTotalMilestoneAllocation(milestones);
    const currentBudget = project.estimatedHours;
    
    let suggestedBudget = currentBudget;
    let reason = 'No adjustment needed';

    if (totalAllocated > currentBudget) {
      // Over-allocated: need to increase budget
      suggestedBudget = Math.ceil(totalAllocated / targetUtilization);
      reason = 'Increase needed to accommodate milestone allocations';
    } else if (totalAllocated < currentBudget * 0.5) {
      // Significantly under-allocated: could reduce budget
      suggestedBudget = Math.ceil(totalAllocated / targetUtilization);
      reason = 'Potential reduction due to low milestone utilization';
    }

    return {
      currentBudget,
      suggestedBudget,
      adjustmentNeeded: suggestedBudget - currentBudget,
      reason
    };
  }

  /**
   * Check for milestone date conflicts
   */
  private static checkMilestoneDateConflicts(milestones: Milestone[]): boolean {
    const dateMap = new Map<string, number>();
    
    for (const milestone of milestones) {
      const dateKey = milestone.dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const count = dateMap.get(dateKey) || 0;
      dateMap.set(dateKey, count + 1);
      
      if (count > 0) {
        return true; // Found a conflict
      }
    }
    
    return false;
  }

  /**
   * Generate project status summary
   */
  static generateProjectStatus(
    project: Project,
    milestones: Milestone[]
  ): {
    status: 'healthy' | 'warning' | 'critical';
    summary: string;
    details: string[];
  } {
    const analysis = this.analyzeProjectMilestones(project, milestones);
    const details: string[] = [];
    
    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (analysis.projectBudget.isOverBudget) {
      status = 'critical';
      details.push(`Over budget by ${analysis.projectBudget.overageHours}h`);
    }
    
    if (analysis.hasDateConflicts) {
      status = status === 'critical' ? 'critical' : 'warning';
      details.push('Milestone date conflicts detected');
    }
    
    if (analysis.projectBudget.utilizationPercent > 95) {
      status = status === 'critical' ? 'critical' : 'warning';
      details.push('Very high budget utilization (>95%)');
    }
    
    if (analysis.milestoneCount === 0) {
      status = status === 'critical' ? 'critical' : 'warning';
      details.push('No milestones defined');
    }

    // Generate summary
    let summary = '';
    switch (status) {
      case 'healthy':
        summary = `Project is well-configured with ${analysis.milestoneCount} milestone(s) and ${analysis.projectBudget.utilizationPercent.toFixed(1)}% budget utilization`;
        break;
      case 'warning':
        summary = `Project needs attention: ${details.length} issue(s) detected`;
        break;
      case 'critical':
        summary = `Project has critical issues requiring immediate attention`;
        break;
    }

    return {
      status,
      summary,
      details
    };
  }

  /**
   * Prepare project for creation (business logic preparation)
   */
  static prepareProjectForCreation(request: ProjectCreationRequest): ProjectCreationRequest {
    return {
      ...request,
      name: request.name.trim(),
      client: request.client.trim(),
      notes: request.notes?.trim(),
      estimatedHours: Math.max(0, request.estimatedHours),
      icon: request.icon || 'folder'
    };
  }
}
