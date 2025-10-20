/**
 * Project Milestone Orchestrator
 * 
 * Coordinates complex project-milestone workflows that were previously in UI components.
 * Extracts recurring milestone creation, batch operations, and milestone lifecycle management.
 * 
 * ✅ Delegates to UnifiedMilestoneService for core calculations
 * ✅ Coordinates with ProjectOrchestrator for project-milestone relationships
 * ✅ Handles complex multi-step workflows
 * ✅ Provides clean API for UI components
 */

import { Project, Milestone } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedMilestoneService } from '../unified/UnifiedMilestoneService';
import { ProjectOrchestrator } from './ProjectOrchestrator';
import { calculateDurationDays } from '../calculations/dateCalculations';
import { RecurringMilestoneConfig as BaseRecurringMilestoneConfig } from '../calculations/milestoneCalculations';

export interface ProjectRecurringMilestoneConfig extends BaseRecurringMilestoneConfig {
  name: string;
}

export interface RecurringMilestone {
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

export interface RecurringMilestoneCreationResult {
  success: boolean;
  recurringMilestone?: RecurringMilestone;
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
export class ProjectMilestoneOrchestrator {

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
    milestones: Milestone[] = [],
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
    milestone: Partial<Milestone>,
    project: Project,
    existingMilestones: Milestone[]
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
   * DELEGATES to UnifiedMilestoneService for calculations and domain logic
   */
  static async createRecurringMilestones(
    projectId: string,
    project: Project,
    recurringConfig: ProjectRecurringMilestoneConfig,
    options: MilestoneOrchestrationOptions = {}
  ): Promise<RecurringMilestoneCreationResult> {
    try {
      // NEW SYSTEM: Create a SINGLE template milestone instead of multiple numbered instances
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build the recurring_config JSON object
      const recurringConfigJson: any = {
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
        .from('milestones')
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
      const recurringMilestone: RecurringMilestone = {
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
      console.error('Error in createRecurringMilestones:', error);
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
   * NEW SYSTEM: Delete template milestone (is_recurring=true) AND old numbered instances
   */
  static async deleteRecurringMilestones(
    projectId: string,
    projectMilestones: Milestone[],
    options: MilestoneOrchestrationOptions = {}
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      // Clear recurring configuration from storage (legacy - may not be used anymore)
      this.clearRecurringConfiguration(projectId);

      // Find recurring milestones:
      // 1. NEW SYSTEM: Template milestones with is_recurring=true
      // 2. OLD SYSTEM: Numbered instances (name pattern ending with space and number)
      const recurringMilestones = projectMilestones.filter(m => 
        m.isRecurring || (m.name && /\s\d+$/.test(m.name))
      );

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
      console.error('Error in deleteRecurringMilestones:', error);
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
    config: ProjectRecurringMilestoneConfig,
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

  /**
   * Generate milestone instances based on recurring configuration
   * DELEGATES date calculations to core dateCalculations service
   * Phase 5: Updated to populate new milestone fields
   */
  private static generateRecurringMilestones(
    config: ProjectRecurringMilestoneConfig,
    count: number
  ): GeneratedMilestone[] {
    const milestones: GeneratedMilestone[] = [];
    const baseDate = new Date();

    for (let i = 0; i < count; i++) {
      const endDate = this.calculateNextMilestoneDate(config, baseDate, i);
      
      // Calculate start date (work backwards by interval)
      const startDate = new Date(endDate);
      switch (config.recurringType) {
        case 'daily':
          startDate.setDate(startDate.getDate() - config.recurringInterval);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - (7 * config.recurringInterval));
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - config.recurringInterval);
          break;
      }
      
      const milestone: GeneratedMilestone = {
        name: `${config.name} ${i + 1}`,
        // OLD fields (for backward compatibility)
        dueDate: endDate,
        timeAllocation: config.timeAllocation,
        // NEW fields (Phase 5)
        endDate,
        timeAllocationHours: config.timeAllocation,
        startDate,
        isRecurring: true
      };
      milestones.push(milestone);
    }

    return milestones;
  }

  /**
   * Calculate next milestone date based on recurring pattern
   * USES core date calculations (following AI rules)
   */
  private static calculateNextMilestoneDate(
    config: ProjectRecurringMilestoneConfig,
    baseDate: Date,
    iteration: number
  ): Date {
    const result = new Date(baseDate);

    switch (config.recurringType) {
      case 'daily':
        result.setDate(result.getDate() + (iteration * config.recurringInterval));
        break;
      case 'weekly':
        result.setDate(result.getDate() + (iteration * 7 * config.recurringInterval));
        if (config.weeklyDayOfWeek !== undefined) {
          // Adjust to specific day of week
          const dayDiff = config.weeklyDayOfWeek - result.getDay();
          result.setDate(result.getDate() + dayDiff);
        }
        break;
      case 'monthly':
        result.setMonth(result.getMonth() + (iteration * config.recurringInterval));
        if (config.monthlyDate) {
          result.setDate(config.monthlyDate);
        }
        break;
    }

    return result;
  }

  /**
   * Batch insert milestones to database
   * Handles database operations and coordination with external systems
   * Phase 5: Updated to DUAL-WRITE to old and new columns
   */
  private static async batchInsertMilestones(
    projectId: string,
    milestones: GeneratedMilestone[],
    options: MilestoneOrchestrationOptions
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Prepare milestones for batch insert
    const milestonesToInsert = milestones.map((milestone) => ({
      name: milestone.name,
      project_id: projectId,
      user_id: user.id,
      
      // DUAL-WRITE: Write to BOTH old and new columns
      due_date: (milestone.endDate || milestone.dueDate).toISOString(),
      time_allocation: milestone.timeAllocationHours ?? milestone.timeAllocation,
      time_allocation_hours: milestone.timeAllocationHours ?? milestone.timeAllocation,
      
      // NEW columns only
      start_date: milestone.startDate?.toISOString(),
      is_recurring: milestone.isRecurring ?? false,
      recurring_config: milestone.isRecurring ? {
        type: 'monthly', // Placeholder - actual config comes from parent
        interval: 1
      } : null
    }));

    // Single database operation
    const { data: insertedMilestones, error } = await supabase
      .from('milestones')
      .insert(milestonesToInsert)
      .select();

    if (error) throw error;

    // Trigger external coordination
    await this.coordinatePostInsertActions(projectId, insertedMilestones?.length || 0, options);
  }

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
   * Save recurring configuration to local storage
   */
  private static saveRecurringConfiguration(
    projectId: string,
    recurringMilestone: RecurringMilestone
  ): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `recurring-milestone-${projectId}`, 
        JSON.stringify(recurringMilestone)
      );
    }
  }

  /**
   * Clear recurring configuration from local storage
   */
  private static clearRecurringConfiguration(projectId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`recurring-milestone-${projectId}`);
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
        .from('milestones')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;
    } catch (error) {
      if (!options.silent) {
        console.error('Error deleting milestone:', error);
      }
    }
  }

  /**
   * Get recurring milestone configuration from storage
   */
  static getRecurringConfiguration(projectId: string): RecurringMilestone | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(`recurring-milestone-${projectId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Update milestone property with budget validation and state management
   * DELEGATES to UnifiedMilestoneService for validation (AI Rule)
   */
  static async updateMilestoneProperty(
    milestoneId: string,
    property: string,
    value: any,
    context: {
      projectMilestones: Milestone[];
      projectEstimatedHours: number;
      isCreatingProject?: boolean;
      localMilestonesState?: any;
      updateMilestone?: (id: string, updates: any, options?: any) => Promise<void>;
      addMilestone?: (milestone: any) => Promise<Milestone>;
      localMilestones: any[];
      setLocalMilestones: (setter: any) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Budget validation for time allocation changes using existing service (AI Rule)
      if (property === 'timeAllocation') {
        const budgetValidation = UnifiedMilestoneService.validateBudgetAllocation(
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
      if (context.isCreatingProject && context.localMilestonesState) {
        // For new projects, update local state
        const updatedMilestones = context.localMilestonesState.milestones.map((m: any) =>
          m.id === milestoneId ? { ...m, [property]: value } : m
        );
        context.localMilestonesState.setMilestones(updatedMilestones);
      } else {
        // Check if this is a new milestone that needs to be saved first
        const localMilestone = context.localMilestones.find(m => m.id === milestoneId);
        if (localMilestone && localMilestone.isNew && context.addMilestone) {
          // Budget validation for new milestones
          const additionalHours = property === 'timeAllocation' ? value : localMilestone.timeAllocation;
          const budgetValidation = UnifiedMilestoneService.validateBudgetAllocation(
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
          context.setLocalMilestones((prev: any) => prev.filter((m: any) => m.id !== milestoneId));
        } else if (context.updateMilestone) {
          // For existing milestones, update in database silently
          await context.updateMilestone(milestoneId, { [property]: value }, { silent: true });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('ProjectMilestoneOrchestrator: Failed to update milestone property:', error);
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
  static async updateRecurringMilestoneLoad(
    projectId: string,
    newLoadValue: number,
    context: {
      projectMilestones: Milestone[];
      recurringMilestone: RecurringMilestone;
      updateMilestone: (id: string, updates: any, options?: any) => Promise<void>;
      setRecurringMilestone: (milestone: RecurringMilestone) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all recurring milestones from the database
      const recurringMilestones = context.projectMilestones.filter(m => 
        m.name && /\s\d+$/.test(m.name) // Ends with space and number
      );

      // Update each recurring milestone in the database silently
      for (const milestone of recurringMilestones) {
        if (milestone.id && !milestone.id.startsWith('temp-')) {
          await context.updateMilestone(milestone.id, {
            time_allocation: newLoadValue
          }, { silent: true });
        }
      }
      
      // Update the recurring milestone configuration
      const updatedMilestone = {
        ...context.recurringMilestone,
        timeAllocation: newLoadValue
      };
      
      context.setRecurringMilestone(updatedMilestone);

      return { success: true };
    } catch (error) {
      console.error('ProjectMilestoneOrchestrator: Failed to update recurring milestone load:', error);
      return {
        success: false,
        error: 'Failed to update recurring milestones'
      };
    }
  }

  /**
   * Save new milestone with validation and state management
   * DELEGATES to UnifiedMilestoneService for validation (AI Rule)
   */
  static async saveNewMilestone(
    milestoneIndex: number,
    context: {
      localMilestones: any[];
      projectMilestones: Milestone[];
      projectEstimatedHours: number;
      projectId: string;
      addMilestone: (milestone: any) => Promise<void>;
      setLocalMilestones: (setter: any) => void;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const milestone = context.localMilestones[milestoneIndex];
      if (!milestone) {
        return { success: false, error: 'Milestone not found' };
      }

      // Simulate adding the new milestone to existing ones
      const simulatedMilestones: Milestone[] = [
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
      const budgetValidation = UnifiedMilestoneService.validateBudgetAllocation(
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
      context.setLocalMilestones((prev: any) => prev.filter((_: any, i: number) => i !== milestoneIndex));

      return { success: true };
    } catch (error) {
      console.error('ProjectMilestoneOrchestrator: Failed to save new milestone:', error);
      return {
        success: false,
        error: 'Failed to save milestone. Please try again.'
      };
    }
  }
}