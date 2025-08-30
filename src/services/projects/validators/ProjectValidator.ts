/**
 * Project Validator
 * 
 * Handles complex validation rules that require coordination between
 * project domain entities and external data (repository access).
 * 
 * ✅ Coordinates domain rules with data access
 * ✅ Handles complex project validation scenarios
 * ✅ Provides detailed validation results for project operations
 */

import { Project, Milestone } from '@/types/core';
import { ProjectEntity } from '../../core/domain/ProjectEntity';
import { MilestoneEntity } from '../../core/domain/MilestoneEntity';

export interface ProjectValidationContext {
  existingProjects: Project[];
  projectMilestones: Milestone[];
  repository?: any; // Future: IProjectRepository
}

export interface DetailedProjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  context: {
    budgetAnalysis?: {
      currentUtilization: number;
      milestoneCount: number;
      avgMilestoneAllocation: number;
    };
    timelineAnalysis?: {
      duration: number;
      density: number;
      criticalPath: string[];
    };
    projectHealth?: {
      overallStatus: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
  };
}

export interface CreateProjectValidationRequest {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  status?: string;
}

export interface UpdateProjectValidationRequest {
  id: string;
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  estimatedHours?: number;
  status?: string;
}

/**
 * Project Validator
 * 
 * Provides comprehensive validation by coordinating domain rules
 * with repository data and complex business scenarios.
 */
export class ProjectValidator {

  /**
   * Validate project creation with comprehensive checks
   */
  static validateProjectCreation(
    request: CreateProjectValidationRequest,
    context: ProjectValidationContext
  ): DetailedProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Domain-level validations using ProjectEntity
    const dateValidation = ProjectEntity.validateProjectDates(
      request.startDate,
      request.endDate,
      false // Assuming non-continuous for creation validation
    );
    errors.push(...dateValidation.errors);

    const timeValidation = ProjectEntity.validateProjectTime(
      request.estimatedHours,
      [] // No milestones yet for new project
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // Name validation
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (request.name && request.name.length > 200) {
      warnings.push('Project name is very long (>200 characters)');
    }

    // Check for duplicate names
    const duplicateName = context.existingProjects.find(
      p => p.name.toLowerCase() === request.name.toLowerCase()
    );
    if (duplicateName) {
      errors.push('A project with this name already exists');
    }

    // Description validation
    if (request.description && request.description.length > 1000) {
      warnings.push('Project description is very long (>1000 characters)');
    }

    // Timeline analysis - use duration calculation helper
    const duration = request.endDate && request.startDate ? 
      Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    if (duration < 1) {
      warnings.push('Very short project duration (less than 1 day)');
    }

    if (duration > 365) {
      warnings.push('Very long project duration (more than 1 year)');
      suggestions.push('Consider breaking this into smaller projects or phases');
    }

    // Budget analysis
    const hoursPerDay = request.estimatedHours / duration;
    if (hoursPerDay > 12) {
      warnings.push(`High intensity project (${hoursPerDay.toFixed(1)} hours/day)`);
      suggestions.push('Consider extending the timeline or reducing scope');
    }

    if (hoursPerDay < 0.5) {
      warnings.push(`Low intensity project (${hoursPerDay.toFixed(1)} hours/day)`);
      suggestions.push('Consider shortening the timeline for better focus');
    }

    // Suggestions based on analysis
    if (request.estimatedHours < 8) {
      suggestions.push('Consider if this project might be better as a task or milestone');
    }

    if (context.existingProjects.length === 0) {
      suggestions.push('This is your first project - consider starting with a smaller scope');
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
        timelineAnalysis: {
          duration,
          density: hoursPerDay,
          criticalPath: [] // Future: Calculate critical path
        },
        projectHealth: {
          overallStatus,
          issues: [...errors, ...warnings]
        }
      }
    };
  }

  /**
   * Validate project update with impact analysis
   */
  static validateProjectUpdate(
    request: UpdateProjectValidationRequest,
    context: ProjectValidationContext
  ): DetailedProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Find the project being updated
    const currentProject = context.existingProjects.find(p => p.id === request.id);
    if (!currentProject) {
      return {
        isValid: false,
        errors: ['Project not found'],
        warnings: [],
        suggestions: [],
        context: {}
      };
    }

    // Validate date changes if provided
    if (request.startDate !== undefined || request.endDate !== undefined) {
      const newStartDate = request.startDate || currentProject.startDate;
      const newEndDate = request.endDate || currentProject.endDate;

      const dateValidation = ProjectEntity.validateProjectDates(newStartDate, newEndDate);
      errors.push(...dateValidation.errors);

      // Check impact on existing milestones
      const milestonesOutOfRange = context.projectMilestones.filter(milestone => 
        milestone.dueDate < newStartDate || milestone.dueDate > newEndDate
      );

      if (milestonesOutOfRange.length > 0) {
        errors.push(`${milestonesOutOfRange.length} milestone(s) would fall outside the new project dates`);
        suggestions.push('Update or remove conflicting milestones before changing project dates');
      }

      // Check for significant timeline changes
      const currentDuration = ProjectEntity.calculateProjectDuration(currentProject);
      
      // Create temporary project for duration calculation
      const tempProject = { ...currentProject, startDate: newStartDate, endDate: newEndDate };
      const newDuration = ProjectEntity.calculateProjectDuration(tempProject);
      const durationChange = Math.abs(newDuration - currentDuration);
      const changePercent = currentDuration > 0 ? (durationChange / currentDuration) * 100 : 0;

      if (changePercent > 50) {
        warnings.push(`Significant timeline change: ${changePercent.toFixed(1)}%`);
      }
    }

    // Validate budget changes
    if (request.estimatedHours !== undefined) {
      const timeValidation = ProjectEntity.validateProjectTime(
        request.estimatedHours,
        context.projectMilestones
      );
      errors.push(...timeValidation.errors);

      // Check impact on milestone allocations
      const currentAllocation = ProjectEntity.calculateTotalMilestoneAllocation(context.projectMilestones);
      
      if (request.estimatedHours < currentAllocation) {
        errors.push(`New budget (${request.estimatedHours}h) is less than current milestone allocation (${currentAllocation}h)`);
        suggestions.push('Reduce milestone allocations before decreasing project budget');
      }

      // Check for significant budget changes
      const currentBudget = currentProject.estimatedHours;
      const change = Math.abs(request.estimatedHours - currentBudget);
      const changePercent = currentBudget > 0 ? (change / currentBudget) * 100 : 0;

      if (changePercent > 30) {
        warnings.push(`Significant budget change: ${changePercent.toFixed(1)}%`);
      }
    }

    // Name validation
    if (request.name !== undefined) {
      if (!request.name || request.name.trim().length === 0) {
        errors.push('Project name cannot be empty');
      }

      if (request.name && request.name.length > 200) {
        warnings.push('Project name is very long (>200 characters)');
      }

      // Check for duplicate names (excluding current project)
      const duplicateName = context.existingProjects.find(
        p => p.id !== request.id && p.name.toLowerCase() === request.name.toLowerCase()
      );
      if (duplicateName) {
        errors.push('A project with this name already exists');
      }
    }

    // Status validation
    if (request.status !== undefined) {
      const validStatuses = ['active', 'completed', 'paused', 'cancelled'];
      if (!validStatuses.includes(request.status)) {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Check status transition logic
      if (request.status === 'completed' && context.projectMilestones.length === 0) {
        warnings.push('Completing a project with no milestones');
        suggestions.push('Consider adding milestones to track project completion');
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
   * Validate project deletion
   */
  static validateProjectDeletion(
    projectId: string,
    context: ProjectValidationContext
  ): DetailedProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const project = context.existingProjects.find(p => p.id === projectId);
    if (!project) {
      return {
        isValid: false,
        errors: ['Project not found'],
        warnings: [],
        suggestions: [],
        context: {}
      };
    }

    // Check for milestones
    if (context.projectMilestones.length > 0) {
      warnings.push(`Project has ${context.projectMilestones.length} milestone(s)`);
      suggestions.push('Consider archiving the project instead of deleting');
    }

    // Check project status
    if (project.status === 'current') {
      warnings.push('Deleting an active project');
      suggestions.push('Consider marking the project as archived first');
    }

    // Check if it's a large project
    if (project.estimatedHours > 100) {
      warnings.push(`Deleting a large project (${project.estimatedHours}h)`);
      suggestions.push('Consider if project data should be archived for reference');
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
   * Validate project milestone compatibility
   */
  static validateProjectMilestoneCompatibility(
    project: Project,
    milestones: Milestone[]
  ): DetailedProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Use domain entities for validation
    const budgetAnalysis = ProjectEntity.analyzeBudget(project, milestones);
    
    if (budgetAnalysis.isOverBudget) {
      errors.push(`Milestone allocation exceeds project budget by ${budgetAnalysis.overageHours}h`);
    }

    if (budgetAnalysis.utilizationPercent > 80) {
      warnings.push(`High budget utilization: ${budgetAnalysis.utilizationPercent.toFixed(1)}%`);
    }

    // Check milestone date ranges
    const milestonesOutOfRange = milestones.filter(milestone => 
      milestone.dueDate < project.startDate || milestone.dueDate > project.endDate
    );

    if (milestonesOutOfRange.length > 0) {
      errors.push(`${milestonesOutOfRange.length} milestone(s) fall outside project dates`);
    }

    // Analyze milestone distribution
    const duration = ProjectEntity.calculateProjectDuration(project);
    if (!duration) return { isValid: true, errors: [], warnings: [], suggestions: [], context: {} };
    const density = milestones.length / Math.max(1, duration / 7); // milestones per week
    
    if (density > 3) {
      warnings.push(`High milestone density: ${density.toFixed(1)} per week`);
      suggestions.push('Consider consolidating some milestones');
    }

    if (density < 0.1 && duration > 14) {
      warnings.push('Very few milestones for project duration');
      suggestions.push('Consider adding more milestones to track progress');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        budgetAnalysis: {
          currentUtilization: budgetAnalysis.utilizationPercent,
          milestoneCount: milestones.length,
          avgMilestoneAllocation: milestones.length > 0 ? 
            budgetAnalysis.totalAllocatedHours / milestones.length : 0
        },
        timelineAnalysis: {
          duration,
          density,
          criticalPath: [] // Future: Calculate critical path
        }
      }
    };
  }
}
