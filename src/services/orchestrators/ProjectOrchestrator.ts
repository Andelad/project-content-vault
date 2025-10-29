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
import { ProjectRules } from '@/domain/rules/ProjectRules';
import { MilestoneRules } from '@/domain/rules/MilestoneRules';
import { getDateKey } from '@/utils/dateFormatUtils';
import { calculateBudgetAdjustment } from '@/services/calculations';

export interface ProjectBudgetAnalysis {
  totalAllocation: number;
  suggestedBudget: number;
  isOverBudget: boolean;
  overageHours: number;
  utilizationPercentage: number;
}

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
  rowId?: string; // Optional - deprecated in Phase 5B
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
  endDate: Date;
  timeAllocation: number;
  timeAllocationHours: number;
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

    // Validate project time constraints using domain rules
    if (!ProjectRules.validateEstimatedHours(request.estimatedHours)) {
      errors.push('Estimated hours must be greater than 0');
    }

    // Validate project dates using domain rules
    const dateValidation = ProjectRules.validateProjectDates(
      request.startDate,
      request.endDate,
      request.continuous
    );
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    }

    // Business rule: Validate name requirements
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    // Business rule: Validate client (required for database constraint)
    if (!request.client || request.client.trim().length === 0) {
      errors.push('Client is required');
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

    // Validate updated dates if changed using domain rules
    if (request.startDate !== undefined || request.endDate !== undefined || request.continuous !== undefined) {
      const dateValidation = ProjectRules.validateProjectDates(
        updatedProject.startDate,
        updatedProject.endDate,
        updatedProject.continuous
      );
      if (!dateValidation.isValid) {
        errors.push(...dateValidation.errors);
      }

      // Check milestone date compatibility using domain rules
      const incompatibleMilestones = currentMilestones.filter(m => {
        const validation = MilestoneRules.validateMilestoneDateWithinProject(
          m.dueDate,
          updatedProject.startDate,
          updatedProject.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        );
        return !validation.isValid;
      });

      if (incompatibleMilestones.length > 0) {
        errors.push(`${incompatibleMilestones.length} milestone(s) would fall outside the updated project timeframe`);
      }
    }

    // Validate budget changes using domain rules
    if (request.estimatedHours !== undefined) {
      const budgetCheck = MilestoneRules.checkBudgetConstraint(currentMilestones, updatedProject.estimatedHours);
      
      if (!budgetCheck.isValid) {
        errors.push(`Reducing budget would result in ${budgetCheck.overage}h over-allocation`);
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
    // Use domain rules for budget analysis
    const budgetCheck = MilestoneRules.checkBudgetConstraint(milestones, project.estimatedHours);
    const projectBudget: ProjectBudgetAnalysis = {
      totalAllocation: budgetCheck.totalAllocated,
      suggestedBudget: Math.max(project.estimatedHours, budgetCheck.totalAllocated),
      isOverBudget: !budgetCheck.isValid,
      overageHours: budgetCheck.overage,
      utilizationPercentage: budgetCheck.utilizationPercentage
    };

    // Simple milestone type counting (recurring detection can be enhanced later)
    const regularMilestones = milestones.filter(m => !('isRecurring' in m && (m as any).isRecurring)).length;
    const recurringMilestones = milestones.filter(m => 'isRecurring' in m && (m as any).isRecurring).length;
    
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

    if (projectBudget.utilizationPercentage < 50) {
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
    // Use domain rules to calculate total allocation
    const budgetCheck = MilestoneRules.checkBudgetConstraint(milestones, project.estimatedHours);
    const totalAllocated = budgetCheck.totalAllocated;
    
    // Delegate to calculation function
    return calculateBudgetAdjustment(project.estimatedHours, totalAllocated, targetUtilization);
  }

  /**
   * Check for milestone date conflicts
   */
  private static checkMilestoneDateConflicts(milestones: Milestone[]): boolean {
    const dateMap = new Map<string, number>();
    
    for (const milestone of milestones) {
      const dateKey = getDateKey(milestone.dueDate);
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
    
    if (analysis.projectBudget.utilizationPercentage > 95) {
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
        summary = `Project is well-configured with ${analysis.milestoneCount} milestone(s) and ${analysis.projectBudget.utilizationPercentage.toFixed(1)}% budget utilization`;
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
      console.log('🚀 ProjectOrchestrator: Starting project creation workflow', {
        request: {
          ...request,
          groupId: request.groupId,
          rowId: request.rowId,
          name: request.name,
          client: request.client
        }
      });

      // Step 1: Validate inputs
      const validation = this.validateProjectCreation(request);
      if (!validation.isValid) {
        console.error('❌ ProjectOrchestrator: Validation failed:', validation.errors);
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      if (!request.groupId || request.groupId === '') {
        console.error('❌ ProjectOrchestrator: Missing groupId');
        return {
          success: false,
          errors: ['Group ID is required for project creation']
        };
      }

      // Note: rowId is optional (deprecated in Phase 5B)
      // Projects can be created without a specific row assignment

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
      console.log('🔄 ProjectOrchestrator: Calling addProject with data:', projectData);
      let createdProject: Project;
      try {
        createdProject = await projectContext.addProject(projectData);
        console.log('✅ ProjectOrchestrator: Project created successfully:', createdProject);
      } catch (addProjectError) {
        console.error('❌ ProjectOrchestrator: addProject threw error:', addProjectError);
        console.error('❌ ProjectOrchestrator: Error type:', typeof addProjectError);
        console.error('❌ ProjectOrchestrator: Error constructor:', addProjectError?.constructor?.name);
        console.error('❌ ProjectOrchestrator: Full error:', JSON.stringify(addProjectError, null, 2));
        
        let errorMessage = 'Unknown error';
        if (addProjectError instanceof Error) {
          errorMessage = addProjectError.message;
        } else if (typeof addProjectError === 'string') {
          errorMessage = addProjectError;
        } else if (addProjectError && typeof addProjectError === 'object') {
          errorMessage = JSON.stringify(addProjectError);
        }
        
        return {
          success: false,
          errors: [`Project creation failed: ${errorMessage}`]
        };
      }

      if (!createdProject) {
        console.error('❌ ProjectOrchestrator: addProject returned null/undefined');
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
            projectId: projectId
          }, { silent: true }); // Silent mode to prevent individual milestone toasts
        } catch (error) {
          console.error('Failed to save milestone:', error);
          // Continue with other milestones even if one fails
        }
      }
    }
  }

  // Note: Repository-integrated query methods were removed as they were never used
  // Hooks (useProjects, etc.) handle data fetching directly via Supabase

}
