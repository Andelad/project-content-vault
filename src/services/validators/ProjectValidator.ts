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

import { Project, Milestone, Group, Row } from '@/types/core';
import { ProjectRules, MilestoneRules, RelationshipRules } from '@/domain/rules';

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
  groupId?: string;
  rowId?: string;
  milestones?: Milestone[];
}

// Interfaces migrated from ProjectValidationService
export interface OrphanedProject {
  id: string;
  name: string;
  rowId?: string;
  groupId?: string;
}

export interface MismatchedProject extends OrphanedProject {
  expectedRowId?: string;
  expectedGroupId?: string;
}

export interface ValidationResult {
  orphanedProjects: OrphanedProject[];
  mismatchedProjects: MismatchedProject[];
  totalIssues: number;
  isValid: boolean;
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
   * 
   * Delegates to domain rules (single source of truth) and adds external checks.
   */
  static validateProjectCreation(
    request: CreateProjectValidationRequest,
    context: ProjectValidationContext
  ): DetailedProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // ========================================================================
    // DOMAIN RULE VALIDATION (delegates to ProjectRules)
    // ========================================================================
    
    // Validate dates using domain rules
    const dateValidation = ProjectRules.validateProjectDates(
      request.startDate,
      request.endDate,
      false // Assuming non-continuous for creation validation
    );
    errors.push(...dateValidation.errors);

    // Validate time/budget using domain rules
    const timeValidation = ProjectRules.validateProjectTime(
      request.estimatedHours,
      [] // No milestones yet for new project
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // ========================================================================
    // EXTERNAL VALIDATION (not in domain rules - checks external state)
    // ========================================================================
    
    // Name validation (external - not a business rule)
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (request.name && request.name.length > 200) {
      warnings.push('Project name is very long (>200 characters)');
    }

    // Check for duplicate names (external - requires database check)
    const duplicateName = context.existingProjects.find(
      p => p.name.toLowerCase() === request.name.toLowerCase()
    );
    if (duplicateName) {
      errors.push('A project with this name already exists');
    }

    // Description validation (external - not a business rule)
    if (request.description && request.description.length > 1000) {
      warnings.push('Project description is very long (>1000 characters)');
    }

    // ========================================================================
    // ANALYSIS & RECOMMENDATIONS
    // ========================================================================
    
    // Calculate duration for analysis (using domain rule)
    const mockProject = {
      startDate: request.startDate,
      endDate: request.endDate,
      continuous: false
    } as Project;
    
    const duration = ProjectRules.calculateProjectDuration(mockProject);

    if (duration && duration < 1) {
      warnings.push('Very short project duration (less than 1 day)');
    }

    if (duration && duration > 365) {
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

    // ========================================================================
    // DOMAIN RULE VALIDATION (delegates to domain layer)
    // ========================================================================
    
    // Validate date changes if provided
    if (request.startDate !== undefined || request.endDate !== undefined) {
      const newStartDate = request.startDate || currentProject.startDate;
      const newEndDate = request.endDate || currentProject.endDate;

      // Use domain rules for date validation
      const dateValidation = ProjectRules.validateProjectDates(
        newStartDate, 
        newEndDate,
        currentProject.continuous
      );
      errors.push(...dateValidation.errors);

      // Check impact on existing milestones (uses relationship rules)
      const mockUpdatedProject = {
        ...currentProject,
        startDate: newStartDate,
        endDate: newEndDate
      };

      context.projectMilestones.forEach(milestone => {
        const relationshipValidation = RelationshipRules.validateMilestoneBelongsToProject(
          milestone,
          mockUpdatedProject
        );
        if (!relationshipValidation.isValid) {
          errors.push(`Milestone "${milestone.name}": ${relationshipValidation.errors.join(', ')}`);
        }
      });

      if (errors.some(e => e.includes('Milestone'))) {
        suggestions.push('Update or remove conflicting milestones before changing project dates');
      }

      // Check for significant timeline changes
      const currentDuration = ProjectRules.calculateProjectDuration(currentProject);
      const newDuration = ProjectRules.calculateProjectDuration(mockUpdatedProject);
      
      if (currentDuration && newDuration) {
        const durationChange = Math.abs(newDuration - currentDuration);
        const changePercent = currentDuration > 0 ? (durationChange / currentDuration) * 100 : 0;

        if (changePercent > 50) {
          warnings.push(`Significant timeline change: ${changePercent.toFixed(1)}%`);
        }
      }
    }

    // Validate budget changes
    if (request.estimatedHours !== undefined) {
      // Use domain rules for time validation
      const timeValidation = ProjectRules.validateProjectTime(
        request.estimatedHours,
        context.projectMilestones
      );
      errors.push(...timeValidation.errors);
      warnings.push(...timeValidation.warnings);

      // Check impact on milestone allocations (uses domain rules)
      const currentAllocation = MilestoneRules.calculateTotalAllocation(context.projectMilestones);
      
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

    // Status validation (uses domain rules)
    if (request.status !== undefined) {
      if (!ProjectRules.isValidStatus(request.status)) {
        errors.push('Invalid project status');
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

    // Use domain rules for validation
    const budgetCheck = MilestoneRules.checkBudgetConstraint(milestones, project.estimatedHours);
    
    if (!budgetCheck.isValid) {
      errors.push(`Milestone allocation exceeds project budget by ${budgetCheck.overage}h`);
    }

    if (budgetCheck.utilizationPercentage > 80) {
      warnings.push(`High budget utilization: ${budgetCheck.utilizationPercentage.toFixed(1)}%`);
    }

    // Check milestone date ranges using domain rules
    const milestonesOutOfRange = milestones.filter(milestone => {
      const validation = MilestoneRules.validateMilestoneDateWithinProject(
        milestone.dueDate,
        project.startDate,
        project.endDate
      );
      return !validation.isValid;
    });

    if (milestonesOutOfRange.length > 0) {
      errors.push(`${milestonesOutOfRange.length} milestone(s) fall outside project dates`);
    }

    // Analyze milestone distribution
    const duration = ProjectRules.calculateProjectDuration(project);
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
          currentUtilization: budgetCheck.utilizationPercentage,
          milestoneCount: milestones.length,
          avgMilestoneAllocation: milestones.length > 0 ? 
            budgetCheck.totalAllocated / milestones.length : 0
        },
        timelineAnalysis: {
          duration,
          density,
          criticalPath: [] // Future: Calculate critical path
        }
      }
    };
  }

  /**
   * METHODS MIGRATED FROM ProjectValidationService
   * Validates project relationships and identifies integrity issues
   */
  static validateProjectRelationships(
    projects: Project[],
    groups: Group[],
    rows: Row[]
  ): ValidationResult {
    const orphanedProjects = this.findOrphanedProjects(projects);
    const mismatchedProjects = this.findMismatchedProjects(projects, rows);

    return {
      orphanedProjects,
      mismatchedProjects,
      totalIssues: orphanedProjects.length + mismatchedProjects.length,
      isValid: orphanedProjects.length === 0 && mismatchedProjects.length === 0
    };
  }

  /**
   * Finds projects that are missing required rowId or groupId
   * Migrated from ProjectValidationService
   */
  static findOrphanedProjects(projects: Project[]): OrphanedProject[] {
    return projects
      .filter(p => !p.rowId || !p.groupId)
      .map(p => ({
        id: p.id,
        name: p.name,
        rowId: p.rowId,
        groupId: p.groupId
      }));
  }

  /**
   * Finds projects that have rowId/groupId but don't match existing rows
   * Migrated from ProjectValidationService
   */
  static findMismatchedProjects(projects: Project[], rows: Row[]): MismatchedProject[] {
    return projects
      .filter(p => {
        if (!p.rowId || !p.groupId) return false;
        const matchingRow = rows.find(r => r.id === p.rowId && r.groupId === p.groupId);
        return !matchingRow;
      })
      .map(p => ({
        id: p.id,
        name: p.name,
        rowId: p.rowId,
        groupId: p.groupId
      }));
  }

  /**
   * Auto-fixes orphaned projects by assigning them to appropriate groups and rows
   * Migrated from ProjectValidationService
   */
  static autoFixOrphanedProjects(
    projects: Project[],
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void
  ): { fixed: number; skipped: number } {
    const orphanedProjects = this.findOrphanedProjects(projects);

    if (orphanedProjects.length === 0 || groups.length === 0 || rows.length === 0) {
      return { fixed: 0, skipped: orphanedProjects.length };
    }

    let fixed = 0;
    let skipped = 0;

    orphanedProjects.forEach(project => {
      const result = this.fixSingleOrphanedProject(project, groups, rows, updateProject);
      if (result.fixed) {
        fixed++;
      } else {
        skipped++;
      }
    });
    return { fixed, skipped };
  }

  /**
   * Fixes a single orphaned project
   * Migrated from ProjectValidationService
   */
  private static fixSingleOrphanedProject(
    project: OrphanedProject,
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void
  ): { fixed: boolean; reason?: string } {
    try {
      // If project has no groupId, assign to first available group
      const targetGroupId = project.groupId || groups[0].id;

      // Find first row in this group
      const groupRows = rows.filter(r => r.groupId === targetGroupId);
      const targetRowId = project.rowId || (groupRows.length > 0 ? groupRows[0].id : null);

      if (!targetRowId) {
        console.warn(`⚠️ Cannot fix project ${project.name}: no available rows in group ${targetGroupId}`);
        return { fixed: false, reason: 'No available rows in target group' };
      }

      if (targetRowId && (!project.rowId || !project.groupId)) {
        updateProject(project.id, {
          groupId: targetGroupId,
          rowId: targetRowId
        }, { silent: true });

        return { fixed: true };
      }

      return { fixed: false, reason: 'Project already has valid assignments' };
    } catch (error) {
      console.error(`❌ Error fixing project ${project.name}:`, error);
      return { fixed: false, reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Logs validation results for debugging
   * Migrated from ProjectValidationService
   */
  static logValidationResults(result: ValidationResult): void {
    if (result.orphanedProjects.length > 0) {
      console.warn('🧒 ORPHANED PROJECTS (missing rowId or groupId):',
        result.orphanedProjects.map(p => ({
          id: p.id,
          name: p.name,
          rowId: p.rowId,
          groupId: p.groupId
        }))
      );
    }

    if (result.mismatchedProjects.length > 0) {
      console.warn('🚨 MISMATCHED PROJECTS (invalid rowId/groupId):',
        result.mismatchedProjects.map(p => ({
          id: p.id,
          name: p.name,
          rowId: p.rowId,
          groupId: p.groupId
        }))
      );
    }

    if (result.isValid) {
      // All projects have valid relationships
    } else {
      console.warn(`⚠️ Found ${result.totalIssues} project relationship issues`);
    }
  }

  /**
   * Comprehensive validation and auto-fix process
   * Migrated from ProjectValidationService
   */
  static validateAndAutoFix(
    projects: Project[],
    groups: Group[],
    rows: Row[],
    updateProject: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void,
    options: { logResults?: boolean } = {}
  ): ValidationResult & { fixes: { fixed: number; skipped: number } } {
    const validation = this.validateProjectRelationships(projects, groups, rows);

    if (options.logResults !== false) {
      this.logValidationResults(validation);
    }

    const fixes = this.autoFixOrphanedProjects(projects, groups, rows, updateProject);

    return {
      ...validation,
      fixes
    };
  }
}
