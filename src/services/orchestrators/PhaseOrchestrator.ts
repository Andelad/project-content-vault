/**
 * Phase Orchestrator
 * 
 * Coordinates complex phase workflows that were previously in UI components.
 * Extracts recurring phase creation, batch operations, and phase lifecycle management.
 * 
 * ✅ Delegates to UnifiedPhaseService for core calculations
 * ✅ Coordinates with ProjectOrchestrator for project-phase relationships
 * ✅ Handles complex multi-step workflows
 * ✅ Provides clean API for UI components
 */

import { Project, PhaseDTO } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedPhaseService } from '../unified/UnifiedPhaseService';
import { ProjectOrchestrator } from './ProjectOrchestrator';
import { calculateDurationDays, addDaysToDate } from '../calculations/general/dateCalculations';
import { RecurringPhaseConfig as BaseRecurringPhaseConfig } from '../calculations/projects/phaseCalculations';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { Phase as PhaseEntity } from '@/domain/entities/Phase';
import { PhaseRecurrenceService } from '@/domain/domain-services/PhaseRecurrenceService';
import { PhaseRules } from '@/domain/rules/PhaseRules';

export interface ProjectRecurringPhaseConfig extends BaseRecurringPhaseConfig {
  name: string;
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

export interface GeneratedMilestone {
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

export interface MilestoneOrchestrationOptions {
  silent?: boolean;
  forceRefresh?: boolean;
  normalizeMilestoneOrders?: (projectId: string, options?: { silent?: boolean }) => Promise<void>;
  refetchMilestones?: () => Promise<void>;
}

type RecurringConfigJson = Record<string, string | number | boolean | null | undefined>;

type MilestoneDraft = {
  id?: string;
  name: string;
  projectId: string;
  dueDate?: Date;
  endDate?: Date;
  timeAllocation?: number;
  timeAllocationHours?: number;
};

type MilestoneCreatePayload = {
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

type MilestoneUpdatePayload = Partial<MilestoneCreatePayload> & {
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
   * Validate project timeframe with milestone constraints
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

    // Validate each milestone fits within project bounds
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
   * Validate milestone scheduling within project context
   */
  static validateMilestoneScheduling(
    milestone: Partial<PhaseDTO>,
    project: Project,
    existingPhases: PhaseDTO[]
  ): { canSchedule: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    
    const requestedDate = new Date(milestone.endDate || milestone.dueDate!);
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    // 1. Verify milestone fits within project timeframe
    if (requestedDate < projectStart || requestedDate > projectEnd) {
      conflicts.push('Milestone date must be within project timeframe');
    }

    // 2. Check for date conflicts with existing milestones
    const hasDateConflict = existingPhases.some(phase => {
      const existingDate = new Date(phase.endDate || phase.dueDate);
      return Math.abs(existingDate.getTime() - requestedDate.getTime()) < (24 * 60 * 60 * 1000);
    });

    if (hasDateConflict) {
      conflicts.push('Another milestone already exists on or near this date');
    }

    // 3. Budget validation
    const currentAllocation = existingPhases.reduce((sum, phase) => 
      sum + (phase.timeAllocationHours || phase.timeAllocation), 0
    );
    const newAllocation = currentAllocation + (milestone.timeAllocationHours || milestone.timeAllocation || 0);
    
    if (newAllocation > project.estimatedHours) {
      conflicts.push(`Would exceed project budget by ${newAllocation - project.estimatedHours} hours`);
    }

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
    options: MilestoneOrchestrationOptions = {}
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

      // NEW SYSTEM: Create a SINGLE template milestone instead of multiple numbered instances
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build the recurring_config JSON object
      const recurringConfigJson: RecurringConfigJson = {
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
        recurringConfigJson as any, // RecurringConfigJson is compatible with RecurringConfig
        new Date(project.startDate),
        project.continuous ? undefined : new Date(project.endDate),
        project.continuous || false
      );
      
      // Store RRule in config for future use
      recurringConfigJson.rrule = rruleString;

      // Create the TEMPLATE milestone in the database
      // For continuous projects, end_date is still set (for display) but RRule drives recurrence
      const endDate = project.continuous 
        ? new Date(new Date(project.startDate).getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(project.endDate);
      
      const templateMilestone = {
        name: recurringConfig.name, // No number suffix - this is the template
        project_id: projectId,
        user_id: user.id,
        
        // NEW SYSTEM: Template milestone
        is_recurring: true,
        recurring_config: recurringConfigJson,
        time_allocation_hours: recurringConfig.timeAllocation,
        
        // DUAL-WRITE for backward compatibility (optional)
        time_allocation: recurringConfig.timeAllocation,
        
        // Recurring phase spans the entire project timeline
        start_date: new Date(project.startDate).toISOString(),
        end_date: endDate.toISOString()
      };

      // Insert the template milestone
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

      // Create recurring milestone object for UI state (no longer saved to localStorage)
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
        generatedCount: 1, // One template milestone created
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
   * Deletes the single template milestone with is_recurring=true
   */
  static async deleteRecurringPhases(
    projectId: string,
    projectPhases: PhaseDTO[],
    options: MilestoneOrchestrationOptions = {}
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      // Find template milestone with is_recurring=true
      const recurringMilestones = projectPhases.filter(p => p.isRecurring === true);

      // Delete milestones from database
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
    options: MilestoneOrchestrationOptions = {}
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
   * Calculate estimated milestone count based on recurring configuration
   * PRIVATE helper that delegates to domain calculations
   */
  private static calculateEstimatedMilestoneCount(
    config: ProjectRecurringPhaseConfig,
    projectDurationDays: number
  ): number {
    switch (config.recurringType) {
      case 'daily':
        return Math.floor(projectDurationDays / config.recurringInterval);
      case 'weekly':
        return Math.floor(projectDurationDays / (7 * config.recurringInterval));
      case 'monthly':
        return Math.floor(projectDurationDays / (30 * config.recurringInterval));
      default:
        return 0;
    }
  }

  // OLD SYSTEM methods removed - we now use single template milestone approach

  /**
   * Coordinate post-insertion actions (normalization, refresh, etc.)
   */
  private static async coordinatePostInsertActions(
    projectId: string,
    insertedCount: number,
    options: MilestoneOrchestrationOptions
  ): Promise<void> {
    // Dispatch custom event for component coordination
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('milestonesUpdated', { 
        detail: { projectId, action: 'batchInsert', count: insertedCount } 
      }));
    }

    // Normalize milestone orders if function provided
    if (options.normalizeMilestoneOrders) {
      try {
        await options.normalizeMilestoneOrders(projectId, { silent: true });
      } catch (e) {
        console.warn('Milestone order normalization failed:', e);
      }
    }

    // Refetch milestones if function provided
    if (options.refetchMilestones) {
      try {
        await options.refetchMilestones();
      } catch (e) {
        console.warn('Milestone refetch failed:', e);
      }
    }
  }

  /**
   * Delete a single milestone by ID
   */
  private static async deletePhaseById(
    milestoneId: string,
    options: MilestoneOrchestrationOptions
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;
    } catch (error) {
      if (!options.silent) {
        ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Error deleting milestone:' });
      }
    }
  }

  /**
   * Update milestone property with budget validation and state management
   * DELEGATES to UnifiedPhaseService for validation (AI Rule)
   */
  static async updatePhaseProperty<
    K extends keyof PhaseDTO,
    LocalPhaseType extends Partial<PhaseDTO> & { id?: string; isNew?: boolean }
  >(
    milestoneId: string,
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
      addPhase?: (milestone: Partial<PhaseDTO>) => Promise<PhaseDTO | LocalPhaseType>;
      localPhases: LocalPhaseType[];
      setLocalPhases: (setter: (prev: LocalPhaseType[]) => LocalPhaseType[]) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Budget validation for time allocation changes using existing service (AI Rule)
      if (property === 'timeAllocation') {
        const budgetValidation = UnifiedPhaseService.validateBudgetAllocation(
          context.projectPhases,
          context.projectEstimatedHours,
          milestoneId
        );
        
        if (!budgetValidation.isValid) {
          return {
            success: false,
            error: `Cannot save milestone: Total milestone allocation (${budgetValidation.totalAllocated}h) would exceed project budget (${context.projectEstimatedHours}h).`
          };
        }
      }

      // Handle different update contexts
      if (context.isCreatingProject && context.localPhasesState) {
        // For new projects, update local state
        const updatedPhases = context.localPhasesState.phases.map((phase) =>
          phase.id === milestoneId ? { ...phase, [property]: value } : phase
        );
        context.localPhasesState.setPhases(updatedPhases);
      } else {
        // Check if this is a new milestone that needs to be saved first
        const localMilestone = context.localPhases.find(phase => phase.id === milestoneId);
        if (localMilestone && localMilestone.isNew && context.addPhase) {
          // Budget validation for new milestones
          const additionalHours = property === 'timeAllocation' ? value : localMilestone.timeAllocation;
          const budgetValidation = UnifiedPhaseService.validateBudgetAllocation(
            context.projectPhases,
            context.projectEstimatedHours
          );
          
          if (!budgetValidation.isValid) {
            return {
              success: false,
              error: `Cannot save milestone: Total milestone allocation (${budgetValidation.totalAllocated}h) would exceed project budget (${context.projectEstimatedHours}h).`
            };
          }

          // Save the new milestone to database
          await context.addPhase({
            name: localMilestone.name,
            dueDate: localMilestone.dueDate,
            timeAllocation: localMilestone.timeAllocation,
            projectId: localMilestone.projectId,
            [property]: value // Apply the new property value
          });
          
          // Remove from local state since it's now saved
          context.setLocalPhases((prev) => prev.filter((phase) => phase.id !== milestoneId));
        } else if (context.updatePhase) {
          // For existing phases, update in database silently
          await context.updatePhase(milestoneId, { [property]: value }, { silent: true });
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
   * Update recurring milestone load across all instances
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
        updates: MilestoneUpdatePayload,
        options?: { silent?: boolean }
      ) => Promise<void>;
      setRecurringPhase: (milestone: RecurringPhase) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update the template recurring milestone (new system)
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
      ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Failed to update recurring milestone load:' });
      return {
        success: false,
        error: 'Failed to update recurring phases'
      };
    }
  }

  /**
   * Save new milestone with validation and state management
   * DELEGATES to Phase Entity for validation (Entity Adoption Phase 1)
   */
  static async saveNewMilestone(
    milestoneIndex: number,
    context: {
      localPhases: MilestoneDraft[];
      projectPhases: PhaseDTO[];
      projectEstimatedHours: number;
      projectId: string;
      addPhase: (milestone: MilestoneCreatePayload) => Promise<void>;
      setLocalPhases: (setter: (prev: MilestoneDraft[]) => MilestoneDraft[]) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const phase = context.localPhases[milestoneIndex];
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

      // Simulate adding the new milestone to existing ones for budget check
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

      // Validate milestone before saving - check if adding this milestone would exceed budget
      const budgetValidation = UnifiedPhaseService.validateBudgetAllocation(
        simulatedMilestones,
        context.projectEstimatedHours
      );
      
      if (!budgetValidation.isValid) {
        return {
          success: false,
          error: `Cannot save milestone: Adding this milestone would exceed project budget. Total would be ${budgetValidation.totalAllocated}h but budget is ${context.projectEstimatedHours}h.`
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
      context.setLocalPhases((prev) => prev.filter((_, i) => i !== milestoneIndex));

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PhaseOrchestrator', action: 'Failed to save new milestone:' });
      return {
        success: false,
        error: 'Failed to save phase. Please try again.'
      };
    }
  }
}