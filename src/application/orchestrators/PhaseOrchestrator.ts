/**
 * Phase Orchestrator
 * 
 * Coordinates complex phase workflows that were previously in UI components.
 * Extracts recurring phase creation, batch operations, and phase lifecycle management.
 * 
 * ✅ Delegates to domain/rules for business logic
 * ✅ Coordinates with ProjectOrchestrator for project-phase relationships
 * ✅ Handles complex multi-step workflows
 * ✅ Provides clean API for UI components
 */

import { Project, PhaseDTO, RecurringConfig } from '@/shared/types/core';
import { supabase } from '@/infrastructure/database/client';
import { ProjectOrchestrator } from './ProjectOrchestrator';
import { calculateDurationDays, addDaysToDate } from '@/presentation/utils/dateCalculations';
import { RecurringPhaseConfig as DomainRecurringPhaseConfig } from '@/domain/rules/phases/PhaseRecurrence';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { Phase as PhaseEntity } from '@/domain/entities/Phase';
import { PhaseRecurrenceService } from '@/domain/rules/phases/PhaseRecurrence';
import { PhaseRules, PhaseCalculationsRules } from '@/domain/rules/phases/PhaseRules';
import { validatePhaseScheduling } from '@/domain/rules/phases/PhaseCalculations';
import { PhaseValidationRules } from '@/domain/rules/phases/PhaseValidation';

/**
 * Orchestration-layer recurring phase configuration
 * Includes UI/project-specific concerns (name, timeAllocation, recurringType)
 * Contains domain recurrence pattern (type, interval, weeklyDayOfWeek, etc.)
 */
export interface ProjectRecurringPhaseConfig {
  // Orchestration layer fields
  name: string;
  timeAllocation: number;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  // Domain recurrence pattern fields (for RRule generation)
  type?: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  weeklyDayOfWeek?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
  rrule?: string;
}

export interface RecurringPhase {
  id: string;
  name: string;
  // OLD fields (for backward compatibility)
  timeAllocation: number;
  // NEW fields
  timeAllocationHours?: number;
  startDate?: Date;
  endDate?: Date;
  isRecurring: true;
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  projectId: string;
  weeklyDayOfWeek?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
}

export interface GeneratedPhase {
  name: string;
  // OLD fields (required for backward compatibility)
  dueDate: Date;
  timeAllocation: number;
  // NEW fields (Phase 5)
  endDate?: Date;
  timeAllocationHours?: number;
  startDate?: Date;
  isRecurring?: boolean;
}

export interface RecurringPhaseCreationResult {
  success: boolean;
  recurringMilestone?: RecurringPhase;
  generatedCount: number;
  estimatedTotalCount: number;
  error?: string;
}

export interface PhaseOrchestrationOptions {
  silent?: boolean;
  forceRefresh?: boolean;
  normalizePhaseOrders?: (projectId: string, options?: { silent?: boolean }) => Promise<void>;
  refetchPhases?: () => Promise<void>;
}

// Mutable version of RecurringConfig for building during orchestration
type RecurringConfigBuilder = {
  -readonly [K in keyof RecurringConfig]: RecurringConfig[K];
};

type PhaseDraft = {
  id?: string;
  name: string;
  projectId: string;
  dueDate?: Date;
  endDate?: Date;
  timeAllocation?: number;
  timeAllocationHours?: number;
};

type PhaseCreatePayload = {
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

type PhaseUpdatePayload = Partial<PhaseCreatePayload> & {
  time_allocation?: number;
  time_allocation_hours?: number;
  [key: string]: unknown;
};

/**
 * Phase Orchestrator
 * 
 * Extracts complex phase workflows from UI components and coordinates
 * with domain services for phase lifecycle management.
 * 
 * CONSOLIDATED RESPONSIBILITIES (Phase 7):
 * - Phase CRUD operations
 * - Phase validation and scheduling
 * - Project timeline validation (merged from ProjectTimelineOrchestrator)
 * - Budget allocation validation
 */
export class PhaseOrchestrator {

  // ============================================================================
  // PROJECT TIMELINE VALIDATION
  // ============================================================================

  /**
   * Validate project timeframe with phase constraints
   * SINGLE SOURCE OF TRUTH for project time validation
   */
  static validateProjectTimeframe(
    startDate: Date,
    endDate: Date,
    phases: PhaseDTO[] = [],
    continuous: boolean = false
  ): { isValid: boolean; errors: string[]; warnings: string[]; schedulingIssues?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const schedulingIssues: string[] = [];

    // Basic project date validation
    if (endDate <= startDate && !continuous) {
      errors.push('Project end date must be after start date');
    }

    // Validate each phase fits within project bounds
    const projectStart = new Date(startDate);
    const projectEnd = new Date(endDate);
    
    phases.forEach((phase, index) => {
      const phaseDate = new Date(phase.endDate || phase.dueDate);
      
      if (phaseDate < projectStart) {
        errors.push(`Milestone "${phase.name || `#${index + 1}`}" is before project start`);
      }
      
      if (!continuous && phaseDate > projectEnd) {
        errors.push(`Milestone "${phase.name || `#${index + 1}`}" is after project end`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      schedulingIssues: schedulingIssues.length > 0 ? schedulingIssues : undefined
    };
  }

  /**
   * Check if project is active on given date
   */
  static isProjectActiveOnDate(project: Project, date: Date): boolean {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    return date >= startDate && date <= endDate;
  }

  /**
   * Validate phase scheduling within project context
   */
  static validatePhaseScheduling(
    phase: Partial<PhaseDTO>,
    project: Project,
    existingPhases: PhaseDTO[]
  ): { canSchedule: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    
    const requestedDate = new Date(phase.endDate || phase.dueDate!);
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    // 1. Verify phase fits within project timeframe
    if (requestedDate < projectStart || requestedDate > projectEnd) {
      conflicts.push('Milestone date must be within project timeframe');
    }

    // 2. Check for date conflicts with existing phases - DELEGATE to domain rules
    const dateConflictCheck = PhaseValidationRules.validateMilestoneDateConflict(
      requestedDate,
      existingPhases,
      phase.id // Exclude current phase if updating
    );
    
    if (dateConflictCheck.hasConflict) {
      conflicts.push(dateConflictCheck.message!);
    }

    // 3. Budget validation - DELEGATE to domain rules
    const budgetCheck = validatePhaseScheduling(
      existingPhases,
      phase,
      project.estimatedHours
    );
    
    conflicts.push(...budgetCheck.budgetConflicts);

    return {
      canSchedule: conflicts.length === 0,
      conflicts
    };
  }

  // ============================================================================
  // RECURRING MILESTONE OPERATIONS
  // ============================================================================
  /**
   * Create recurring phases for a project
   * DELEGATES to UnifiedPhaseService for calculations and domain logic
   */
  static async createRecurringPhases(
    projectId: string,
    project: Project,
    recurringConfig: ProjectRecurringPhaseConfig,
    options: PhaseOrchestrationOptions = {}
  ): Promise<RecurringPhaseCreationResult> {
    try {
      // DOMAIN RULE: Check mutual exclusivity before creating recurring phase
      // Fetch existing phases to validate
      const { data: existingPhases } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', projectId);
      
      if (existingPhases && existingPhases.length > 0) {
        const phaseDTOs = existingPhases.map(p => PhaseEntity.fromDatabase(p));
        const validation = PhaseRules.checkPhaseRecurringExclusivity(phaseDTOs);
        
        if (validation.hasSplitPhases) {
          return {
            success: false,
            generatedCount: 0,
            estimatedTotalCount: 0,
            error: 'Cannot create recurring phase: project has split phases. Delete them first.'
          };
        }
        
        if (validation.hasRecurringTemplate) {
          return {
            success: false,
            generatedCount: 0,
            estimatedTotalCount: 0,
            error: 'Cannot create recurring phase: project already has a recurring phase template.'
          };
        }
      }

      // NEW SYSTEM: Create a SINGLE template phase instead of multiple numbered instances
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build the recurring_config JSON object
      const recurringConfigJson: RecurringConfigBuilder = {
        type: recurringConfig.recurringType,
        interval: recurringConfig.recurringInterval
      };

      // Add type-specific configuration
      if (recurringConfig.recurringType === 'weekly' && recurringConfig.weeklyDayOfWeek !== undefined) {
        recurringConfigJson.weeklyDayOfWeek = recurringConfig.weeklyDayOfWeek;
      } else if (recurringConfig.recurringType === 'monthly') {
        recurringConfigJson.monthlyPattern = recurringConfig.monthlyPattern;
        if (recurringConfig.monthlyPattern === 'date') {
          recurringConfigJson.monthlyDate = recurringConfig.monthlyDate;
        } else if (recurringConfig.monthlyPattern === 'dayOfWeek') {
          recurringConfigJson.monthlyWeekOfMonth = recurringConfig.monthlyWeekOfMonth;
          recurringConfigJson.monthlyDayOfWeek = recurringConfig.monthlyDayOfWeek;
        }
      }

      // Generate RRule string for accurate recurrence calculation
      // This enables infinite recurrence for continuous projects
      const rruleString = PhaseRecurrenceService.generateRRuleFromConfig(
        recurringConfigJson as RecurringConfig,
        new Date(project.startDate),
        project.continuous ? undefined : new Date(project.endDate),
        project.continuous || false
      );
      
      // Store RRule in config for future use
      recurringConfigJson.rrule = rruleString;

      // Create the TEMPLATE phase in the database
      // For continuous projects, end_date is still set (for display) but RRule drives recurrence
      const endDate = project.continuous 
        ? new Date(new Date(project.startDate).getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(project.endDate);
      
      const templateMilestone = {
        name: recurringConfig.name, // No number suffix - this is the template
        project_id: projectId,
        user_id: user.id,
        
        // NEW SYSTEM: Template phase
        is_recurring: true,
        recurring_config: recurringConfigJson,
        time_allocation_hours: recurringConfig.timeAllocation,
        
        // DUAL-WRITE for backward compatibility (optional)
        time_allocation: recurringConfig.timeAllocation,
        
        // Recurring phase spans the entire project timeline
        start_date: new Date(project.startDate).toISOString(),
        end_date: endDate.toISOString()
      };

      // Insert the template phase
      const { data: insertedMilestone, error } = await supabase
        .from('phases')
        .insert([templateMilestone])
        .select()
        .single();

      if (error) throw error;

      // Calculate estimated total occurrences for display
      const projectDurationMs = project.continuous ? 
        365 * 24 * 60 * 60 * 1000 : // 1 year for continuous
        new Date(project.endDate).getTime() - new Date(project.startDate).getTime();
      
      const projectDurationDays = Math.ceil(projectDurationMs / (24 * 60 * 60 * 1000));
      const estimatedTotalMilestones = this.calculateEstimatedMilestoneCount(
        recurringConfig,
        projectDurationDays
      );

      // Create recurring phase object for UI state (no longer saved to localStorage)
      const recurringMilestone: RecurringPhase = {
        id: insertedMilestone.id,
        name: recurringConfig.name,
        timeAllocation: recurringConfig.timeAllocation,
        recurringType: recurringConfig.recurringType,
        recurringInterval: recurringConfig.recurringInterval,
        projectId: projectId,
        isRecurring: true as const,
        weeklyDayOfWeek: recurringConfig.weeklyDayOfWeek,
        monthlyPattern: recurringConfig.monthlyPattern,
        monthlyDate: recurringConfig.monthlyDate,
        monthlyWeekOfMonth: recurringConfig.monthlyWeekOfMonth,
        monthlyDayOfWeek: recurringConfig.monthlyDayOfWeek
      };

      // Trigger external coordination
      await this.coordinatePostInsertActions(projectId, 1, options);

      return {
        success: true,
        recurringMilestone,
        generatedCount: 1, // One template phase created
        estimatedTotalCount: estimatedTotalMilestones
      };

    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'PhaseOrchestrator', 
        action: 'Error in createRecurringPhases:',
        metadata: {
          projectId,
          projectStartDate: project?.startDate,
          projectEndDate: project?.endDate,
          projectContinuous: project?.continuous,
          recurringType: recurringConfig?.recurringType
        }
      });
      
      // Log the full error for debugging
      console.error('Recurring phase creation error:', error);
      
      return {
        success: false,
        generatedCount: 0,
        estimatedTotalCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete all recurring phases for a project
   * Deletes the single template phase with is_recurring=true
   */
  static async deleteRecurringPhases(
    projectId: string,
    projectPhases: PhaseDTO[],
    options: PhaseOrchestrationOptions = {}
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      // Find template phase with is_recurring=true
      const recurringMilestones = projectPhases.filter(p => p.isRecurring === true);

      // Delete phases from database
      const deletionPromises = recurringMilestones
        .filter(phase => phase.id && !phase.id.startsWith('temp-'))
        .map(phase => this.deletePhaseById(phase.id!, options));

      await Promise.allSettled(deletionPromises);

      return {
        success: true,
        deletedCount: recurringMilestones.length
      };

    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Error in deleteRecurringPhases:' });
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create initial split phases for a project
   * Divides project timeline at midpoint with equal budget allocation
   * 
   * Workflow:
   * 1. Call domain rule to calculate phase split
   * 2. Transform data for database
   * 3. Insert phases to database
   * 4. Coordinate post-creation actions
   */
  static async createSplitPhases(
    projectId: string,
    project: { startDate: Date; endDate: Date; estimatedHours: number },
    options: PhaseOrchestrationOptions = {}
  ): Promise<{ success: boolean; phases?: PhaseDTO[]; error?: string }> {
    try {
      // DOMAIN RULE: Check mutual exclusivity before creating split phases
      // Fetch existing phases to validate
      const { data: existingPhases } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', projectId);
      
      if (existingPhases && existingPhases.length > 0) {
        const phaseDTOs = existingPhases.map(p => PhaseEntity.fromDatabase(p));
        const validation = PhaseRules.checkPhaseRecurringExclusivity(phaseDTOs);
        
        if (validation.hasRecurringTemplate) {
          return {
            success: false,
            error: 'Cannot create split phases: project has a recurring phase template. Delete it first.'
          };
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // DOMAIN RULE: Calculate phase split (pure domain logic)
      const split = PhaseRules.calculatePhaseSplit(
        project.startDate,
        project.endDate,
        project.estimatedHours
      );

      // Transform for database insertion
      const phase1Data = {
        name: split.phase1.name,
        project_id: projectId,
        user_id: user.id,
        start_date: split.phase1.startDate.toISOString(),
        end_date: split.phase1.endDate.toISOString(),
        time_allocation: split.phase1.timeAllocation,
        time_allocation_hours: split.phase1.timeAllocation,
        is_recurring: false
      };

      const phase2Data = {
        name: split.phase2.name,
        project_id: projectId,
        user_id: user.id,
        start_date: split.phase2.startDate.toISOString(),
        end_date: split.phase2.endDate.toISOString(),
        time_allocation: split.phase2.timeAllocation,
        time_allocation_hours: split.phase2.timeAllocation,
        is_recurring: false
      };

      // Insert both phases to database
      const { data: phases, error } = await supabase
        .from('phases')
        .insert([phase1Data, phase2Data])
        .select();

      if (error) throw error;

      // Coordinate post-insertion actions
      await this.coordinatePostInsertActions(projectId, 2, options);

      return {
        success: true,
        phases: phases.map(p => PhaseEntity.fromDatabase(p))
      };

    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'PhaseOrchestrator',
        action: 'Error in createSplitPhases:',
        metadata: { projectId }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate estimated phase count based on recurring configuration
   * DELEGATES to domain rules
   */
  private static calculateEstimatedMilestoneCount(
    config: ProjectRecurringPhaseConfig,
    projectDurationDays: number
  ): number {
    // ✅ Delegate to domain rules
    return PhaseRecurrenceService.estimateOccurrenceCount(
      { recurringType: config.recurringType, interval: config.recurringInterval },
      projectDurationDays
    );
  }

  // OLD SYSTEM methods removed - we now use single template phase approach

  /**
   * Coordinate post-insertion actions (normalization, refresh, etc.)
   */
  private static async coordinatePostInsertActions(
    projectId: string,
    insertedCount: number,
    options: PhaseOrchestrationOptions
  ): Promise<void> {
    // Dispatch custom event for component coordination
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('phasesUpdated', { 
        detail: { projectId, action: 'batchInsert', count: insertedCount } 
      }));
    }

    // Normalize phase orders if function provided
    if (options.normalizePhaseOrders) {
      try {
        await options.normalizePhaseOrders(projectId, { silent: true });
      } catch (e) {
        console.warn('Phase order normalization failed:', e);
      }
    }

    // Refetch phases if function provided
    if (options.refetchPhases) {
      try {
        await options.refetchPhases();
      } catch (e) {
        console.warn('Phase refetch failed:', e);
      }
    }
  }

  /**
   * Delete a single phase by ID
   */
  private static async deletePhaseById(
    phaseId: string,
    options: PhaseOrchestrationOptions
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', phaseId);

      if (error) throw error;
    } catch (error) {
      if (!options.silent) {
        ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Error deleting phase:' });
      }
    }
  }

  /**
   * Update phase property with budget validation and state management
   * DELEGATES to UnifiedPhaseService for validation (AI Rule)
   * AUTO-UPDATES project dates when first/last phase dates change
   */
  static async updatePhaseProperty<
    K extends keyof PhaseDTO,
    LocalPhaseType extends Partial<PhaseDTO> & { id?: string; isNew?: boolean }
  >(
    phaseId: string,
    property: K,
    value: PhaseDTO[K],
    context: {
      projectPhases: PhaseDTO[];
      projectEstimatedHours: number;
      isCreatingProject?: boolean;
      localPhasesState?: {
        phases: LocalPhaseType[];
        setPhases: (phases: LocalPhaseType[]) => void;
      };
      updatePhase?: (id: string, updates: Partial<PhaseDTO>, options?: { silent?: boolean }) => Promise<void>;
      addPhase?: (phase: Partial<PhaseDTO>) => Promise<PhaseDTO | LocalPhaseType>;
      localPhases: LocalPhaseType[];
      setLocalPhases: (setter: (prev: LocalPhaseType[]) => LocalPhaseType[]) => void;
      projectId?: string;
      updateProject?: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => Promise<void>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Budget validation for time allocation changes using existing service (AI Rule)
      if (property === 'timeAllocation') {
        const budgetValidation = PhaseCalculationsRules.validateBudgetAllocation(
          context.projectPhases,
          context.projectEstimatedHours,
          phaseId
        );
        
        if (!budgetValidation.isValid) {
          return {
            success: false,
            error: `Cannot save phase: Total phase allocation (${budgetValidation.totalAllocated}h) would exceed project budget (${context.projectEstimatedHours}h).`
          };
        }
      }

      // Check if we need to auto-update project dates
      // Get non-recurring phases sorted by date
      const regularPhases = context.projectPhases.filter(p => !p.isRecurring && p.startDate && p.endDate);
      const sortedPhases = [...regularPhases].sort((a, b) => 
        new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime()
      );
      
      const currentPhase = sortedPhases.find(p => p.id === phaseId);
      const isFirstPhase = currentPhase && sortedPhases[0]?.id === phaseId;
      const isLastPhase = currentPhase && sortedPhases[sortedPhases.length - 1]?.id === phaseId;
      
      let projectUpdateNeeded = false;
      let projectUpdates: Partial<Project> = {};

      // Auto-update project start date if editing first phase's start date
      if (isFirstPhase && property === 'startDate' && value instanceof Date) {
        projectUpdateNeeded = true;
        projectUpdates.startDate = value;
      }

      // Auto-update project end date if editing last phase's end date
      if (isLastPhase && property === 'endDate' && value instanceof Date) {
        projectUpdateNeeded = true;
        projectUpdates.endDate = value;
      }

      // Handle different update contexts
      if (context.isCreatingProject && context.localPhasesState) {
        // For new projects, update local state
        const updatedPhases = context.localPhasesState.phases.map((phase) =>
          phase.id === phaseId ? { ...phase, [property]: value } : phase
        );
        context.localPhasesState.setPhases(updatedPhases);
      } else {
        // Check if this is a new phase that needs to be saved first
        const localPhase = context.localPhases.find(phase => phase.id === phaseId);
        if (localPhase && localPhase.isNew && context.addPhase) {
          // Budget validation for new phases
          const additionalHours = property === 'timeAllocation' ? value : localPhase.timeAllocation;
          const budgetValidation = PhaseCalculationsRules.validateBudgetAllocation(
            context.projectPhases,
            context.projectEstimatedHours
          );
          
          if (!budgetValidation.isValid) {
            return {
              success: false,
              error: `Cannot save phase: Total phase allocation (${budgetValidation.totalAllocated}h) would exceed project budget (${context.projectEstimatedHours}h).`
            };
          }

          // Save the new phase to database
          await context.addPhase({
            name: localPhase.name,
            dueDate: localPhase.dueDate,
            timeAllocation: localPhase.timeAllocation,
            projectId: localPhase.projectId,
            [property]: value // Apply the new property value
          });
          
          // Remove from local state since it's now saved
          context.setLocalPhases((prev) => prev.filter((phase) => phase.id !== phaseId));
        } else if (context.updatePhase) {
          // For existing phases, update in database silently
          await context.updatePhase(phaseId, { [property]: value }, { silent: true });
        }

        // Auto-update project dates if needed
        if (projectUpdateNeeded && context.projectId && context.updateProject) {
          await context.updateProject(context.projectId, projectUpdates, { silent: true });
        }
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Failed to update phase property:' });
      return {
        success: false,
        error: 'Failed to update phase. Please try again.'
      };
    }
  }

  /**
   * Update recurring phase load across all instances
   * COORDINATES with database operations and state management
   */
  static async updateRecurringPhaseLoad(
    projectId: string,
    newLoadValue: number,
    context: {
      projectPhases: PhaseDTO[];
      recurringMilestone: RecurringPhase;
      updatePhase: (
        id: string,
        updates: PhaseUpdatePayload,
        options?: { silent?: boolean }
      ) => Promise<void>;
      setRecurringPhase: (phase: RecurringPhase) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update the template recurring phase (new system)
      const template = context.projectPhases.find(p => p.isRecurring === true);
      if (template?.id && !template.id.startsWith('temp-')) {
        await context.updatePhase(template.id, {
          time_allocation: newLoadValue,
          time_allocation_hours: newLoadValue
        }, { silent: true });
      }

      // Backward compatibility: update any legacy numbered instances
      const legacyRecurring = context.projectPhases.filter(p => p.name && /\s\d+$/.test(p.name));
      for (const phase of legacyRecurring) {
        if (phase.id && !phase.id.startsWith('temp-')) {
          await context.updatePhase(phase.id, {
            time_allocation: newLoadValue,
            time_allocation_hours: newLoadValue
          }, { silent: true });
        }
      }

      // Update UI state
      const updatedMilestone = {
        ...context.recurringMilestone,
        timeAllocation: newLoadValue,
        timeAllocationHours: newLoadValue
      };

      context.setRecurringPhase(updatedMilestone as RecurringPhase);

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Failed to update recurring phase load:' });
      return {
        success: false,
        error: 'Failed to update recurring phases'
      };
    }
  }

  /**
   * Save new phase with validation and state management
   * DELEGATES to Phase Entity for validation (Entity Adoption Phase 1)
   */
  static async saveNewMilestone(
    phaseIndex: number,
    context: {
      localPhases: PhaseDraft[];
      projectPhases: PhaseDTO[];
      projectEstimatedHours: number;
      projectId: string;
      addPhase: (phase: PhaseCreatePayload) => Promise<void>;
      setLocalPhases: (setter: (prev: PhaseDraft[]) => PhaseDraft[]) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const phase = context.localPhases[phaseIndex];
      if (!phase) {
        return { success: false, error: 'Milestone not found' };
      }

      // ✅ PHASE 1: Use Phase entity for validation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const entityResult = PhaseEntity.create({
        name: phase.name,
        projectId: context.projectId,
        startDate: phase.dueDate || phase.endDate || new Date(),
        endDate: phase.endDate || phase.dueDate || new Date(),
        timeAllocationHours: phase.timeAllocationHours || phase.timeAllocation || 0,
        isRecurring: false,
        userId: user.id
      });

      if (!entityResult.success) {
        return {
          success: false,
          error: entityResult.errors?.join(', ') || 'Validation failed'
        };
      }

      // Simulate adding the new phase to existing ones for budget check
      const simulatedMilestones: PhaseDTO[] = [
        ...context.projectPhases,
        {
          id: 'temp-validation',
          name: phase.name,
          projectId: context.projectId,
          dueDate: phase.dueDate,
          endDate: phase.endDate || phase.dueDate,
          timeAllocation: phase.timeAllocation,
          timeAllocationHours: phase.timeAllocationHours || phase.timeAllocation,
          userId: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        } as PhaseDTO
      ];

      // Validate phase before saving - check if adding this phase would exceed budget
      const budgetValidation = PhaseCalculationsRules.validateBudgetAllocation(
        simulatedMilestones,
        context.projectEstimatedHours
      );
      
      if (!budgetValidation.isValid) {
        return {
          success: false,
          error: `Cannot save phase: Adding this phase would exceed project budget. Total would be ${budgetValidation.totalAllocated}h but budget is ${context.projectEstimatedHours}h.`
        };
      }

      // ✅ Extract validated data from entity for backward compatibility
      const phaseData = entityResult.data!.toData();

      // Save to database
      await context.addPhase({
        name: phaseData.name,
        dueDate: phaseData.endDate, // Map endDate to dueDate for database compatibility
        endDate: phaseData.endDate,
        timeAllocation: phaseData.timeAllocationHours,
        timeAllocationHours: phaseData.timeAllocationHours,
        projectId: context.projectId
      });

      // Remove from local state
      context.setLocalPhases((prev) => prev.filter((_, i) => i !== phaseIndex));

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Failed to save new phase:' });
      return {
        success: false,
        error: 'Failed to save phase. Please try again.'
      };
    }
  }
}