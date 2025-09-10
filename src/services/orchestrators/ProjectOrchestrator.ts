/**
 * Project Orchestrator - Phase 5B Enhanced
 * 
 * Coordinates project domain rules with milestone management and external systems,
 * now enhanced with repository integration for offline-first operations and
 * performance optimization.
 * 
 * Enhanced Features:
 * - Repository-based project management with intelligent caching
 * - Offline-first project operations with automatic sync
 * - Performance-optimized project workflows
 * - Coordinated project-milestone lifecycle management
 * 
 * @module ProjectOrchestrator
 */

import { Project, Milestone } from '@/types/core';
import { UnifiedProjectEntity, UnifiedMilestoneEntity, ProjectBudgetAnalysis } from '../unified';
import { projectRepository } from '../repositories/ProjectRepository';
import type { SyncResult } from '../repositories/IBaseRepository';

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
  autoEstimateDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

export interface ProjectCreationResult {
  success: boolean;
  project?: Project;
  errors?: string[];
  warnings?: string[];
}

export interface ProjectMilestone {
  name: string;
  dueDate: Date;
  timeAllocation: number;
  order: number;
}

export interface ProjectCreationWithMilestonesRequest extends ProjectCreationRequest {
  milestones?: ProjectMilestone[];
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
    const timeValidation = UnifiedProjectEntity.validateProjectTime(
      request.estimatedHours,
      existingMilestones
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // Validate project dates
    const dateValidation = UnifiedProjectEntity.validateProjectDates(
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
      const dateValidation = UnifiedProjectEntity.validateProjectDates(
        updatedProject.startDate,
        updatedProject.endDate,
        updatedProject.continuous
      );
      errors.push(...dateValidation.errors);

      // Check milestone date compatibility
      const incompatibleMilestones = currentMilestones.filter(m => 
        !UnifiedProjectEntity.isDateWithinProject(m.dueDate, updatedProject)
      );

      if (incompatibleMilestones.length > 0) {
        errors.push(`${incompatibleMilestones.length} milestone(s) would fall outside the updated project timeframe`);
      }
    }

    // Validate budget changes
    if (request.estimatedHours !== undefined) {
      const budgetAnalysis = UnifiedProjectEntity.analyzeBudget(updatedProject, currentMilestones);
      
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
    const projectBudget = UnifiedProjectEntity.analyzeBudget(project, milestones);
    const regularMilestones = milestones.filter(m => UnifiedMilestoneEntity.isRegularMilestone(m)).length;
    const recurringMilestones = milestones.filter(m => UnifiedMilestoneEntity.isRecurringMilestone(m)).length;
    
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
    const totalAllocated = UnifiedProjectEntity.calculateTotalMilestoneAllocation(milestones);
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

  /**
   * Execute complete project creation workflow with milestones
   * EXTRACTED from ProjectModal handleCreateProject complex logic
   * 
   * Handles:
   * - Validation and preparation
   * - Project creation via context
   * - Milestone batch creation
   * - Error handling and coordination
   */
  static async executeProjectCreationWorkflow(
    request: ProjectCreationWithMilestonesRequest,
    projectContext: {
      addProject: (data: any) => Promise<Project>;
      addMilestone: (data: any, options?: { silent?: boolean }) => Promise<void>;
    }
  ): Promise<ProjectCreationResult> {
    try {
      // Step 1: Validate inputs
      if (!request.groupId || request.groupId === '') {
        return {
          success: false,
          errors: ['Group ID is required for project creation']
        };
      }

      if (!request.rowId || request.rowId === '') {
        return {
          success: false,
          errors: ['No row selected. Please select a row before creating a project.']
        };
      }

      // Step 2: Prepare project data following AI Development Rules
      const preparedProject = this.prepareProjectForCreation(request);

      // Provide defaults following the component logic
      const projectData = {
        name: preparedProject.name || 'New Project',
        client: preparedProject.client || 'N/A',
        startDate: preparedProject.startDate,
        endDate: preparedProject.endDate,
        estimatedHours: preparedProject.estimatedHours,
        groupId: preparedProject.groupId,
        rowId: preparedProject.rowId,
        color: preparedProject.color,
        notes: preparedProject.notes,
        icon: preparedProject.icon,
        continuous: preparedProject.continuous,
        autoEstimateDays: preparedProject.autoEstimateDays
      };

      // Step 3: Create project via context (delegates to existing project creation logic)
      const createdProject = await projectContext.addProject(projectData);

      if (!createdProject) {
        return {
          success: false,
          errors: ['Project creation failed - no project returned']
        };
      }

      // Step 4: Handle milestone creation if provided
      if (request.milestones && request.milestones.length > 0) {
        await this.createProjectMilestones(
          createdProject.id,
          request.milestones,
          projectContext.addMilestone
        );
      }

      return {
        success: true,
        project: createdProject
      };

    } catch (error) {
      console.error('Project creation workflow error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Project creation failed']
      };
    }
  }

  /**
   * Create milestones for a project
   * PRIVATE helper extracted from complex component logic
   */
  private static async createProjectMilestones(
    projectId: string,
    milestones: ProjectMilestone[],
    addMilestone: (data: any, options?: { silent?: boolean }) => Promise<void>
  ): Promise<void> {
    for (const milestone of milestones) {
      if (milestone.name.trim()) {
        try {
          await addMilestone({
            name: milestone.name,
            dueDate: milestone.dueDate,
            timeAllocation: milestone.timeAllocation,
            projectId: projectId,
            order: milestone.order
          }, { silent: true }); // Silent mode to prevent individual milestone toasts
        } catch (error) {
          console.error('Failed to save milestone:', error);
          // Continue with other milestones even if one fails
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------
  // PHASE 5B: REPOSITORY-INTEGRATED WORKFLOWS
  // -------------------------------------------------------------------------------------

  /**
   * Get user projects with repository optimization
   */
  static async getUserProjectsWorkflow(userId: string, options?: {
    status?: Project['status'];
    groupId?: string;
    continuous?: boolean;
    limit?: number;
  }): Promise<Project[]> {
    try {
      return await projectRepository.findByUser(userId, options);
    } catch (error) {
      console.error('Get user projects workflow failed:', error);
      return [];
    }
  }

  /**
   * Get projects by group with repository optimization
   */
  static async getGroupProjectsWorkflow(groupId: string): Promise<Project[]> {
    try {
      return await projectRepository.findByGroup(groupId);
    } catch (error) {
      console.error('Get group projects workflow failed:', error);
      return [];
    }
  }

  /**
   * Get project statistics with repository optimization
   */
  static async getProjectStatisticsWorkflow(userId: string) {
    try {
      return await projectRepository.getProjectStatistics(userId);
    } catch (error) {
      console.error('Get project statistics workflow failed:', error);
      return {
        totalProjects: 0,
        currentProjects: 0,
        archivedProjects: 0,
        totalEstimatedHours: 0,
        avgProjectDuration: 0
      };
    }
  }

  /**
   * Validate project name uniqueness
   */
  static async validateProjectNameUniqueWorkflow(name: string, userId: string, excludeId?: string): Promise<boolean> {
    try {
      return await projectRepository.validateProjectNameUnique(name, userId, excludeId);
    } catch (error) {
      console.error('Validate project name uniqueness failed:', error);
      return false;
    }
  }

  /**
   * Sync offline project changes
   */
  static async syncOfflineChanges(): Promise<SyncResult> {
    try {
      return await projectRepository.syncToServer();
    } catch (error) {
      console.error('Sync offline changes failed:', error);
      return {
        success: false,
        syncedCount: 0,
        conflictCount: 0,
        errors: [`Sync failed: ${error}`],
        conflicts: [],
        duration: 0
      };
    }
  }

  /**
   * Get repository cache statistics
   */
  static getRepositoryCacheStats() {
    return projectRepository.getCacheStats();
  }

  /**
   * Get repository offline status
   */
  static async getRepositoryOfflineStatus() {
    const offlineChanges = await projectRepository.getOfflineChanges();
    return {
      hasOfflineChanges: offlineChanges.length > 0,
      offlineChangeCount: offlineChanges.length,
      lastSyncTime: null // Repository doesn't track last sync time yet
    };
  }
}
