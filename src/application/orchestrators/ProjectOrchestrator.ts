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
import { Project, PhaseDTO, ClientStatus } from '@/shared/types/core';
import { ProjectRules } from '@/domain/rules/projects/ProjectValidation';
import { PhaseRules } from '@/domain/rules/phases/PhaseRules';
import { getDateKey } from '@/presentation/app/utils/dateFormatUtils';
import { calculateBudgetAdjustment } from '@/services';
import { Project as ProjectEntity } from '@/domain/entities/Project';
import { Client as ClientEntity } from '@/domain/entities/Client';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { supabase } from '@/infrastructure/database/client';
import { normalizeProjectColor } from '@/presentation/app/utils/normalizeProjectColor';
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
  phases?: ProjectMilestone[];
}

type ProjectMilestoneCreateInput = {
  name: string;
  projectId: string;
  dueDate: Date | string;
  timeAllocation: number;
  timeAllocationHours?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  isRecurring?: boolean;
  recurringConfig?: PhaseDTO['recurringConfig'];
  order?: number;
};

type DatabaseProjectRow = {
  id: string;
  name: string;
  client: string | null;
  client_id?: string | null;
  start_date: string;
  end_date: string;
  estimated_hours: number;
  color: string | null;
  group_id?: string | null;
  row_id?: string | null;
  notes?: string | null;
  icon?: string | null;
  continuous?: boolean | null;
  working_day_overrides?: unknown;
  user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  clients?: {
    id?: string;
    name?: string;
    status?: ClientStatus | string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    billing_address?: string | null;
    notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
};

type DatabaseProjectPayload = Partial<{
  name: string;
  client: string;
  client_id: string;
  start_date: string;
  end_date: string;
  estimated_hours: number;
  color: string;
  group_id?: string;
  row_id?: string;
  notes?: string;
  icon?: string;
  continuous?: boolean;
  working_day_overrides?: Project['autoEstimateDays'];
}>;
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
type ProjectTransformInput = Partial<Project> & {
  clientId?: string;
  autoEstimateDays?: Project['autoEstimateDays'];
};

export class ProjectOrchestrator {
  /**
   * Validate project creation request
   * 
   * Validates all project fields against domain rules before creation.
   * Calls domain rules directly (no validator layer).
   * 
   * @param request - Project creation request data
   * @param existingPhases - Optional existing milestones to validate against
   * @returns Validation result with errors and warnings
   * 
   * @example
   * ```typescript
   * const result = ProjectOrchestrator.validateProjectCreation({
   *   name: 'New Project',
   *   client: 'Acme Corp',
   *   startDate: new Date(),
   *   estimatedHours: 100,
   *   color: '#3b82f6',
   *   groupId: 'group-123'
   * });
   * if (!result.isValid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  static validateProjectCreation(
    request: ProjectCreationRequest,
    existingPhases: PhaseDTO[] = []
  ): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    // Name validation
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Project name is required');
    }
    // Client validation (required for database constraint)
    if (!request.client || request.client.trim().length === 0) {
      errors.push('Client is required');
    }
    // Call domain rule for estimated hours
    if (!ProjectRules.validateEstimatedHours(request.estimatedHours)) {
      errors.push('Estimated hours cannot be negative');
    }
    // Large hours warning
    if (request.estimatedHours > 10000) {
      warnings.push('Project estimated hours is very large (>10,000 hours)');
    }
    // Call domain rule for dates
    const dateValidation = ProjectRules.validateProjectDates(
      request.startDate,
      request.endDate,
      request.continuous
    );
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    }
    // NEW: Validate project not fully in past (Phase Time Domain Rules)
    if (request.estimatedHours > 0) {
      const tempProject: Project = {
        id: 'temp',
        name: request.name,
        client: request.client,
        clientId: '',
        startDate: request.startDate,
        endDate: request.endDate || new Date(),
        estimatedHours: request.estimatedHours,
        color: request.color,
        groupId: request.groupId,
        rowId: request.rowId,
        notes: request.notes,
        icon: request.icon,
        continuous: request.continuous,
        autoEstimateDays: request.autoEstimateDays,
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'current',
        phases: []
      };
      const pastValidation = ProjectRules.validateProjectNotFullyInPast(
        tempProject,
        existingPhases
      );
      if (!pastValidation.isValid) {
        errors.push(...pastValidation.errors);
      }
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
    currentMilestones: PhaseDTO[]
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
      const incompatiblePhases = currentMilestones.filter(p => {
        const validation = PhaseRules.validateMilestoneDateWithinProject(
          p.dueDate,
          updatedProject.startDate,
          updatedProject.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        );
        return !validation.isValid;
      });
      if (incompatiblePhases.length > 0) {
        errors.push(`${incompatiblePhases.length} milestone(s) would fall outside the updated project timeframe`);
      }
    }
    // Validate budget changes using domain rules
    if (request.estimatedHours !== undefined) {
      const budgetCheck = PhaseRules.checkBudgetConstraint(currentMilestones, updatedProject.estimatedHours);
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
    phases: PhaseDTO[]
  ): ProjectMilestoneAnalysis {
    // Use domain rules for budget analysis
    const budgetCheck = PhaseRules.checkBudgetConstraint(phases, project.estimatedHours);
    const projectBudget: ProjectBudgetAnalysis = {
      totalAllocation: budgetCheck.totalAllocated,
      suggestedBudget: Math.max(project.estimatedHours, budgetCheck.totalAllocated),
      isOverBudget: !budgetCheck.isValid,
      overageHours: budgetCheck.overage,
      utilizationPercentage: budgetCheck.utilizationPercentage
    };
    // Simple milestone type counting (recurring detection can be enhanced later)
  const regularMilestones = phases.filter(p => !('isRecurring' in p && p.isRecurring)).length;
  const recurringMilestones = phases.filter(p => p.isRecurring === true).length;
    // Check for over-budget milestones
    const hasOverBudgetMilestones = phases.some(p => 
      p.timeAllocation > project.estimatedHours
    );
    // Check for date conflicts
    const hasDateConflicts = this.checkMilestoneDateConflicts(phases);
    // Generate suggestions
    const suggestions: string[] = [];
    if (projectBudget.isOverBudget) {
      suggestions.push(`Consider increasing project budget by ${projectBudget.overageHours}h or reducing milestone allocations`);
    }
    if (phases.length === 0) {
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
      milestoneCount: phases.length,
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
    phases: PhaseDTO[],
    targetUtilization: number = 0.9 // 90% utilization target
  ): {
    currentBudget: number;
    suggestedBudget: number;
    adjustmentNeeded: number;
    reason: string;
  } {
    // Use domain rules to calculate total allocation
    const budgetCheck = PhaseRules.checkBudgetConstraint(phases, project.estimatedHours);
    const totalAllocated = budgetCheck.totalAllocated;
    // Delegate to calculation function
    return calculateBudgetAdjustment(project.estimatedHours, totalAllocated, targetUtilization);
  }
  /**
   * Check for milestone date conflicts
   */
  private static checkMilestoneDateConflicts(phases: PhaseDTO[]): boolean {
    const dateMap = new Map<string, number>();
    for (const phase of phases) {
      const dateKey = getDateKey(phase.dueDate);
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
    phases: PhaseDTO[]
  ): {
    status: 'healthy' | 'warning' | 'critical';
    summary: string;
    details: string[];
  } {
    const analysis = this.analyzeProjectMilestones(project, phases);
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
      details.push('No phases defined');
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
   * 
   * @param request - Complete project creation request including optional milestones
   * @param projectContext - Context providing addProject and addPhase functions
   * @returns Promise resolving to creation result with project or errors
   * 
   * @example
   * ```typescript
   * const result = await ProjectOrchestrator.executeProjectCreationWorkflow(
   *   {
   *     name: 'Website Redesign',
   *     client: 'Acme Corp',
   *     startDate: new Date('2025-01-01'),
   *     endDate: new Date('2025-03-31'),
   *     estimatedHours: 240,
   *     color: '#3b82f6',
   *     groupId: 'active-projects',
   *     milestones: [
   *       { name: 'Design', dueDate: new Date('2025-01-15'), timeAllocationHours: 80 },
   *       { name: 'Development', dueDate: new Date('2025-02-28'), timeAllocationHours: 120 }
   *     ]
   *   },
   *   { addProject, addPhase }
   * );
   * if (result.success) {
   *   console.log('Project created:', result.project);
   * }
   * ```
   */
  static async executeProjectCreationWorkflow(
    request: ProjectCreationWithMilestonesRequest,
    projectContext: {
      addProject: (data: Partial<Project>) => Promise<Project>;
      addPhase: (data: Partial<PhaseDTO>, options?: { silent?: boolean }) => Promise<void>;
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

      // Validate groupId requirement
      if (!request.groupId || request.groupId === '') {
        ErrorHandlingService.handle('❌ ProjectOrchestrator: Missing groupId', { source: 'ProjectOrchestrator' });
        return {
          success: false,
          errors: ['Group ID is required for project creation']
        };
      }

      // Step 1: Use Project entity for validation and creation
      // Note: Entity requires userId and clientId which addProject will resolve
      const entityResult = ProjectEntity.create({
        name: request.name,
        clientId: '', // Will be resolved by ensureClientExists in addProject
        userId: '', // Will be set by addProject from auth context
        startDate: request.startDate,
        endDate: request.endDate,
        estimatedHours: request.estimatedHours,
        color: request.color || '#3b82f6',
        groupId: request.groupId,
        notes: request.notes,
        icon: request.icon,
        continuous: request.continuous,
        existingPhases: [] // Phases will be created after project
      });

      if (!entityResult.success) {
        console.error('❌ ProjectOrchestrator: Entity validation failed:', entityResult.errors);
        return {
          success: false,
          errors: entityResult.errors,
          warnings: entityResult.warnings
        };
      }

      // Step 2: Extract validated data from entity for backward compatibility
      const projectEntity = entityResult.data!;
      const projectData = {
        ...projectEntity.toData(),
        client: request.client, // Restore client name for addProject to resolve
        rowId: request.rowId, // View layer concern (deprecated but still used)
        autoEstimateDays: request.autoEstimateDays // Not in entity, but used by addProject
      };
      // Step 3: Create project via context (delegates to existing project creation logic)
      let createdProject: Project;
      try {
        createdProject = await projectContext.addProject(projectData);
      } catch (addProjectError) {
        ErrorHandlingService.handle(addProjectError, { source: 'ProjectOrchestrator', action: '❌ ProjectOrchestrator: addProject threw error:' });
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
        ErrorHandlingService.handle('❌ ProjectOrchestrator: addProject returned null/undefined', { source: 'ProjectOrchestrator' });
        return {
          success: false,
          errors: ['Project creation failed - no project returned']
        };
      }
      // Step 4: Apply Phase Time Domain Rules auto-adjustments
      const warnings: string[] = entityResult.warnings || [];
      if (request.phases && request.phases.length > 0) {
        const phases = request.phases.filter(p => p.endDate !== undefined);
        if (phases.length > 0) {
          // Convert to Milestone objects for domain rule processing
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let phaseObjects: PhaseDTO[] = phases.map((p, index) => ({
            id: `temp-${index}`, // Temporary ID for processing
            projectId: createdProject.id,
            userId: '', // Will be set on actual save
            name: p.name,
            dueDate: p.dueDate,
            endDate: p.endDate,
            timeAllocation: p.timeAllocation,
            timeAllocationHours: p.timeAllocationHours,
            createdAt: new Date(),
            updatedAt: new Date()
          }));
          // Auto-adjust phases with estimated time that end in the past
          let needsCascade = false;
          phaseObjects = phaseObjects.map((phase) => {
            if ((phase.timeAllocation ?? 0) > 0 && phase.endDate && phase.endDate < today) {
              const minimumEndDate = PhaseRules.calculateMinimumPhaseEndDate(phase, today);
              if (minimumEndDate > phase.endDate) {
                warnings.push(
                  `Phase "${phase.name}" end date auto-adjusted from ${phase.endDate.toLocaleDateString()} to ${minimumEndDate.toLocaleDateString()} (cannot end in past with estimated time)`
                );
                needsCascade = true;
                return { ...phase, endDate: minimumEndDate };
              }
            }
            return phase;
          });
          // Cascade adjustments to subsequent phases if any phase was adjusted
          if (needsCascade) {
            // Find first adjusted phase and cascade from there
            const firstAdjustedIndex = phaseObjects.findIndex((p, idx) => {
              const original = phases[idx];
              return p.endDate?.getTime() !== original.endDate?.getTime();
            });
            if (firstAdjustedIndex >= 0) {
              const adjustedPhase = phaseObjects[firstAdjustedIndex];
              phaseObjects = PhaseRules.cascadePhaseAdjustments(
                phaseObjects,
                adjustedPhase.id,
                adjustedPhase.endDate!
              );
            }
            // Check if project end date needs adjustment
            const lastPhase = phaseObjects[phaseObjects.length - 1];
            if (lastPhase.endDate && createdProject.endDate && lastPhase.endDate > createdProject.endDate) {
              const adjustedEndDate = ProjectRules.adjustProjectEndDateForPhases(
                createdProject,
                phaseObjects
              );
              if (adjustedEndDate > createdProject.endDate) {
                warnings.push(
                  `Project end date auto-extended from ${createdProject.endDate.toLocaleDateString()} to ${adjustedEndDate.toLocaleDateString()} to accommodate phases`
                );
                createdProject.endDate = adjustedEndDate;
              }
            }
            // Update request milestones with adjusted values
            request.phases = request.phases.map((m, idx) => {
              const adjusted = phaseObjects.find(p => p.id === `temp-${idx}`);
              if (adjusted && adjusted.endDate && m.endDate) {
                return { ...m, endDate: adjusted.endDate };
              }
              return m;
            });
          }
        }
      }
      // Step 5: Handle milestone creation if provided
      if (request.phases && request.phases.length > 0) {
        await this.createProjectMilestones(
          createdProject.id,
          request.phases,
          projectContext.addPhase
        );
      }
      return {
        success: true,
        project: createdProject,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectOrchestrator', action: 'Project creation workflow error:' });
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
    addPhase: (
      data: ProjectMilestoneCreateInput | Partial<PhaseDTO>,
      options?: { silent?: boolean }
    ) => Promise<PhaseDTO | void | undefined>
  ): Promise<void> {
    for (const phase of milestones) {
      if (phase.name.trim()) {
        try {
          await addPhase({
            name: phase.name,
            dueDate: phase.dueDate,
            timeAllocation: phase.timeAllocation,
            timeAllocationHours: phase.timeAllocationHours,
            projectId: projectId
          }, { silent: true }); // Silent mode to prevent individual milestone toasts
        } catch (error) {
          ErrorHandlingService.handle(error, { source: 'ProjectOrchestrator', action: 'Failed to save milestone:' });
          // Continue with other milestones even if one fails
        }
      }
    }
  }
  /**
   * Get all projects for current user
   * Handles database fetching and transformation
   */
  static async getAllProjects(): Promise<Project[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      // Fetch projects with client data joined
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (
            id,
            name,
            status,
            contact_email,
            contact_phone,
            billing_address,
            notes,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ProjectOrchestrator', 
          action: 'getAllProjects' 
        });
        throw error;
      }

      // Transform database projects to frontend format
      return (data || []).map((dbProject) => {
        const transformed = this.transformDatabaseProject(dbProject);
        
        // Add client data if available
        if (dbProject.clients && typeof dbProject.clients === 'object' && !Array.isArray(dbProject.clients)) {
          const clientData = dbProject.clients as {
            id: string;
            name: string;
            status: string | null;
            contact_email: string | null;
            contact_phone: string | null;
            billing_address: string | null;
            notes: string | null;
            user_id: string;
            created_at: string;
            updated_at: string;
          };
          
          // Use ClientEntity to convert database format to frontend format
          transformed.clientData = ClientEntity.fromDatabase(clientData).toData();
        }
        
        return transformed;
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ProjectOrchestrator', 
        action: 'getAllProjects error' 
      });
      throw error;
    }
  }

  /**
   * Update existing project
   * Handles validation, transformation, and database update
   */
  static async updateProjectWorkflow(
    projectId: string,
    updates: Partial<Project>,
    currentProject: Project,
    currentMilestones: PhaseDTO[] = [],
    options: { silent?: boolean } = {}
  ): Promise<{ success: boolean; project?: Project; errors?: string[]; warnings?: string[] }> {
    try {
      // Validate update
      const validation = this.validateProjectUpdate(
        { id: projectId, ...updates },
        currentProject,
        currentMilestones
      );

      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // If client is being updated, ensure the client exists in clients table
      let clientId = currentProject.clientId;
      if (updates.client && updates.client !== currentProject.client) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        // Ensure client exists and get its ID
        clientId = await this.ensureClientExists(updates.client, user.id);
      }

      // Transform frontend data to database format
      const dbUpdates = this.transformToDatabase(updates);
      
      // If we got a new client_id, add it to the updates
      if (clientId && clientId !== currentProject.clientId) {
        dbUpdates.client_id = clientId;
      }

      const { data, error } = await supabase
        .from('projects')
        .update(dbUpdates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ProjectOrchestrator', 
          action: 'updateProjectWorkflow' 
        });
        throw error;
      }

      // Transform the returned data to frontend format
      const transformedProject = this.transformDatabaseProject(data);

      return {
        success: true,
        project: transformedProject,
        warnings: validation.warnings
      };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ProjectOrchestrator', 
        action: 'updateProjectWorkflow error' 
      });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Update failed']
      };
    }
  }

  /**
   * Delete project
   */
  static async deleteProjectWorkflow(
    projectId: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ProjectOrchestrator', 
          action: 'deleteProjectWorkflow' 
        });
        throw error;
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ProjectOrchestrator', 
        action: 'deleteProjectWorkflow error' 
      });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Delete failed']
      };
    }
  }

  /**
   * Transform database project to frontend project
   */
  private static transformDatabaseProject(dbProject: DatabaseProjectRow): Project {
    return {
      id: dbProject.id,
      name: dbProject.name,
      client: dbProject.client || '',
      clientId: dbProject.client_id || '',
      startDate: new Date(dbProject.start_date),
      endDate: new Date(dbProject.end_date),
      estimatedHours: dbProject.estimated_hours,
      color: normalizeProjectColor(dbProject.color || ''),
      groupId: dbProject.group_id || undefined,
      rowId: dbProject.row_id || undefined,
      notes: dbProject.notes || undefined,
      icon: dbProject.icon || undefined,
      continuous: dbProject.continuous ?? false,
      status: 'current',
      autoEstimateDays: (dbProject.working_day_overrides && typeof dbProject.working_day_overrides === 'object') ? 
        dbProject.working_day_overrides as {
          monday: boolean;
          tuesday: boolean;
          wednesday: boolean;
          thursday: boolean;
          friday: boolean;
          saturday: boolean;
          sunday: boolean;
        } : {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
      userId: dbProject.user_id || '',
      createdAt: dbProject.created_at ? new Date(dbProject.created_at) : new Date(),
      updatedAt: dbProject.updated_at ? new Date(dbProject.updated_at) : new Date()
    };
  }

  /**
   * Transform frontend project data to database format
   */
  private static transformToDatabase(projectData: ProjectTransformInput): DatabaseProjectPayload {
    const dbData: DatabaseProjectPayload = {};
    
    if (projectData.name !== undefined) dbData.name = projectData.name;
    
    // Handle client and client_id
    if (projectData.clientId !== undefined && projectData.clientId !== '') {
      dbData.client_id = projectData.clientId;
      if (projectData.client === undefined) {
        dbData.client = projectData.clientId;
      }
    } else if (projectData.client !== undefined && projectData.client !== '') {
      dbData.client_id = projectData.client;
      dbData.client = projectData.client;
    }
    
    if (projectData.client !== undefined) dbData.client = projectData.client;
    
    if (projectData.startDate !== undefined) {
      dbData.start_date = projectData.startDate instanceof Date 
        ? projectData.startDate.toISOString().split('T')[0] 
        : projectData.startDate;
    }
    
    if (projectData.endDate !== undefined) {
      dbData.end_date = projectData.endDate instanceof Date 
        ? projectData.endDate.toISOString().split('T')[0] 
        : projectData.endDate;
    } else if (projectData.continuous) {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 100);
      dbData.end_date = farFuture.toISOString().split('T')[0];
    }
    
    if (projectData.estimatedHours !== undefined) dbData.estimated_hours = projectData.estimatedHours;
    if (projectData.color !== undefined) dbData.color = projectData.color;
    if (projectData.groupId !== undefined) dbData.group_id = projectData.groupId;
    if (projectData.rowId !== undefined) dbData.row_id = projectData.rowId;
    if (projectData.notes !== undefined) dbData.notes = projectData.notes;
    if (projectData.icon !== undefined) dbData.icon = projectData.icon;
    if (projectData.continuous !== undefined) dbData.continuous = projectData.continuous;
    if (projectData.autoEstimateDays !== undefined) dbData.working_day_overrides = projectData.autoEstimateDays;
    
    return dbData;
  }

  /**
   * Ensure client exists and return client_id
   * If clientIdentifier is a UUID, verify it exists
   * If it's a name, find or create the client
   */
  static async ensureClientExists(
    clientIdentifier: string,
    userId: string
  ): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // If already a valid UUID, verify it exists and return it
    if (uuidRegex.test(clientIdentifier)) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientIdentifier)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (existingClient) {
        return existingClient.id;
      }
      // If UUID doesn't exist, treat it as a name instead
    }
    
    // Try to find existing client with this name (case-insensitive)
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', clientIdentifier)
      .maybeSingle();
    
    if (existingClient) {
      return existingClient.id;
    }
    
    // Create new client
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert([{ user_id: userId, name: clientIdentifier, status: 'active' }])
      .select('id')
      .single();
    
    if (createError) {
      ErrorHandlingService.handle(createError, { 
        source: 'ProjectOrchestrator', 
        action: 'ensureClientExists' 
      });
      throw new Error(`Failed to create client: ${createError.message}`);
    }
    
    return newClient.id;
  }

  // Note: Repository-integrated query methods were removed as they were never used
  // Orchestrator now provides all data access methods
}
