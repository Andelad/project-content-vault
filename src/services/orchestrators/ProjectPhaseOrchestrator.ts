/**
 * Project Milestone Orchestrator
 * 
 * Coordinates complex project-milestone workflows that were previously in UI components.
 * Extracts recurring milestone creation, batch operations, and milestone lifecycle management.
 * 
 * ✅ Delegates to UnifiedPhaseService for core calculations
 * ✅ Coordinates with ProjectOrchestrator for project-milestone relationships
 * ✅ Handles complex multi-step workflows
 * ✅ Provides clean API for UI components
 */

import { Project, Phase } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedPhaseService } from '../unified/UnifiedPhaseService';
import { ProjectOrchestrator } from './ProjectOrchestrator';
import { calculateDurationDays, addDaysToDate } from '../calculations/general/dateCalculations';
import { RecurringPhaseConfig as BaseRecurringPhaseConfig } from '../calculations/projects/milestoneCalculations';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

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
  recurringConfig?: Milestone['recurringConfig'];
  order?: number;
};

type MilestoneUpdatePayload = Partial<MilestoneCreatePayload> & {
  time_allocation?: number;
  time_allocation_hours?: number;
  [key: string]: unknown;
};

/**
 * Project Milestone Orchestrator
 * 
 * Extracts complex milestone workflows from UI components and coordinates
 * with domain services for milestone lifecycle management.
 * 
 * CONSOLIDATED RESPONSIBILITIES (Phase 7):
 * - Milestone CRUD operations
 * - Milestone validation and scheduling
 * - Project timeline validation (merged from ProjectTimelineOrchestrator)
 * - Budget allocation validation
 */
export class ProjectPhaseOrchestrator {

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
    milestones: Phase[] = [],
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
    
    milestones.forEach((milestone, index) => {
      const milestoneDate = new Date(milestone.endDate || milestone.dueDate);
      
      if (milestoneDate < projectStart) {
        errors.push(`Milestone "${milestone.name || `#${index + 1}`}" is before project start`);
      }
      
      if (!continuous && milestoneDate > projectEnd) {
        errors.push(`Milestone "${milestone.name || `#${index + 1}`}" is after project end`);
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
    milestone: Partial<Phase>,
    project: Project,
    existingMilestones: Phase[]
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
    const hasDateConflict = existingMilestones.some(m => {
      const existingDate = new Date(m.endDate || m.dueDate);
      return Math.abs(existingDate.getTime() - requestedDate.getTime()) < (24 * 60 * 60 * 1000);
    });

    if (hasDateConflict) {
      conflicts.push('Another milestone already exists on or near this date');
    }

    // 3. Budget validation
    const currentAllocation = existingMilestones.reduce((sum, m) => 
      sum + (m.timeAllocationHours || m.timeAllocation), 0
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
   * Create recurring milestones for a project
   * DELEGATES to UnifiedPhaseService for calculations and domain logic
   */
  static async createRecurringPhases(
    projectId: string,
    project: Project,
    recurringConfig: ProjectRecurringPhaseConfig,
    options: MilestoneOrchestrationOptions = {}
  ): Promise<RecurringPhaseCreationResult> {
    try {
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

      // Create the TEMPLATE milestone in the database
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
        
        // Use project start as the template due_date (not really used for rendering)
        due_date: new Date(project.startDate).toISOString(),
        start_date: new Date(project.startDate).toISOString()
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
      ErrorHandlingService.handle(error, { source: 'ProjectPhaseOrchestrator', action: 'Error in createRecurringPhases:' });
      return {
        success: false,
        generatedCount: 0,
        estimatedTotalCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete all recurring milestones for a project
   * Deletes the single template milestone with is_recurring=true
   */
  static async deleteRecurringPhases(
    projectId: string,
    projectMilestones: Phase[],
    options: MilestoneOrchestrationOptions = {}
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      // Find template milestone with is_recurring=true
      const recurringMilestones = projectMilestones.filter(m => m.isRecurring === true);

      // Delete milestones from database
      const deletionPromises = recurringMilestones
        .filter(milestone => milestone.id && !milestone.id.startsWith('temp-'))
        .map(milestone => this.deleteMilestoneById(milestone.id!, options));

      await Promise.allSettled(deletionPromises);

      return {
        success: true,
        deletedCount: recurringMilestones.length
      };

    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectPhaseOrchestrator', action: 'Error in deleteRecurringPhases:' });
      return {
        success: false,
        deletedCount: 0,
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
  private static async deleteMilestoneById(
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
        ErrorHandlingService.handle(error, { source: 'ProjectPhaseOrchestrator', action: 'Error deleting milestone:' });
      }
    }
  }

  /**
   * Update milestone property with budget validation and state management
   * DELEGATES to UnifiedPhaseService for validation (AI Rule)
   */
  static async updateMilestoneProperty<
    K extends keyof Milestone,
    LocalPhaseType extends Partial<Phase> & { id?: string; isNew?: boolean }
  >(
    milestoneId: string,
    property: K,
    value: Milestone[K],
    context: {
      projectMilestones: Phase[];
      projectEstimatedHours: number;
      isCreatingProject?: boolean;
      localPhasesState?: {
        milestones: LocalPhaseType[];
        setMilestones: (milestones: LocalPhaseType[]) => void;
      };
      updateMilestone?: (id: string, updates: Partial<Phase>, options?: { silent?: boolean }) => Promise<void>;
      addMilestone?: (milestone: Partial<Phase>) => Promise<Milestone | LocalPhaseType>;
      localPhases: LocalPhaseType[];
      setLocalPhases: (setter: (prev: LocalPhaseType[]) => LocalPhaseType[]) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Budget validation for time allocation changes using existing service (AI Rule)
      if (property === 'timeAllocation') {
        const budgetValidation = UnifiedPhaseService.validateBudgetAllocation(
          context.projectMilestones,
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
        const updatedMilestones = context.localPhasesState.phases.map((m) =>
          m.id === milestoneId ? { ...m, [property]: value } : m
        );
        context.localPhasesState.setMilestones(updatedMilestones);
      } else {
        // Check if this is a new milestone that needs to be saved first
        const localMilestone = context.localPhases.find(m => m.id === milestoneId);
        if (localMilestone && localMilestone.isNew && context.addMilestone) {
          // Budget validation for new milestones
          const additionalHours = property === 'timeAllocation' ? value : localMilestone.timeAllocation;
          const budgetValidation = UnifiedPhaseService.validateBudgetAllocation(
            context.projectMilestones,
            context.projectEstimatedHours
          );
          
          if (!budgetValidation.isValid) {
            return {
              success: false,
              error: `Cannot save milestone: Total milestone allocation (${budgetValidation.totalAllocated}h) would exceed project budget (${context.projectEstimatedHours}h).`
            };
          }

          // Save the new milestone to database
          await context.addMilestone({
            name: localMilestone.name,
            dueDate: localMilestone.dueDate,
            timeAllocation: localMilestone.timeAllocation,
            projectId: localMilestone.projectId,
            [property]: value // Apply the new property value
          });
          
          // Remove from local state since it's now saved
          context.setLocalPhases((prev) => prev.filter((m) => m.id !== milestoneId));
        } else if (context.updateMilestone) {
          // For existing milestones, update in database silently
          await context.updateMilestone(milestoneId, { [property]: value }, { silent: true });
        }
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectPhaseOrchestrator', action: 'ProjectPhaseOrchestrator: Failed to update milestone property:' });
      return {
        success: false,
        error: 'Failed to update milestone. Please try again.'
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
      projectMilestones: Phase[];
      recurringMilestone: RecurringPhase;
      updateMilestone: (
        id: string,
        updates: MilestoneUpdatePayload,
        options?: { silent?: boolean }
      ) => Promise<void>;
      setRecurringPhase: (milestone: RecurringPhase) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update the template recurring milestone (new system)
      const template = context.projectMilestones.find(m => m.isRecurring === true);
      if (template?.id && !template.id.startsWith('temp-')) {
        await context.updateMilestone(template.id, {
          time_allocation: newLoadValue,
          time_allocation_hours: newLoadValue
        }, { silent: true });
      }

      // Backward compatibility: update any legacy numbered instances
      const legacyRecurring = context.projectMilestones.filter(m => m.name && /\s\d+$/.test(m.name));
      for (const milestone of legacyRecurring) {
        if (milestone.id && !milestone.id.startsWith('temp-')) {
          await context.updateMilestone(milestone.id, {
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
      ErrorHandlingService.handle(error, { source: 'ProjectPhaseOrchestrator', action: 'ProjectPhaseOrchestrator: Failed to update recurring milestone load:' });
      return {
        success: false,
        error: 'Failed to update recurring milestones'
      };
    }
  }

  /**
   * Save new milestone with validation and state management
   * DELEGATES to UnifiedPhaseService for validation (AI Rule)
   */
  static async saveNewMilestone(
    milestoneIndex: number,
    context: {
      localPhases: MilestoneDraft[];
      projectMilestones: Phase[];
      projectEstimatedHours: number;
      projectId: string;
      addMilestone: (milestone: MilestoneCreatePayload) => Promise<void>;
      setLocalPhases: (setter: (prev: MilestoneDraft[]) => MilestoneDraft[]) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const phase = context.localPhases[milestoneIndex];
      if (!milestone) {
        return { success: false, error: 'Milestone not found' };
      }

      // Simulate adding the new milestone to existing ones
      const simulatedMilestones: Phase[] = [
        ...context.projectMilestones,
        {
          id: 'temp-validation',
          name: milestone.name,
          projectId: context.projectId,
          dueDate: milestone.dueDate,
          endDate: milestone.endDate || milestone.dueDate,
          timeAllocation: milestone.timeAllocation,
          timeAllocationHours: milestone.timeAllocationHours || milestone.timeAllocation,
          userId: '',
          createdAt: new Date(),
          updatedAt: new Date()
        } as Milestone
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

      // Save to database
      await context.addMilestone({
        name: milestone.name,
        dueDate: milestone.dueDate || milestone.endDate,
        timeAllocation: milestone.timeAllocationHours || milestone.timeAllocation,
        projectId: context.projectId
      });

      // Remove from local state
  context.setLocalPhases((prev) => prev.filter((_, i) => i !== milestoneIndex));

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'ProjectPhaseOrchestrator', action: 'ProjectPhaseOrchestrator: Failed to save new milestone:' });
      return {
        success: false,
        error: 'Failed to save milestone. Please try again.'
      };
    }
  }
}