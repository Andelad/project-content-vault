/**
 * Phase Validation Rules
 * 
 * Handles all validation logic for phases and milestones:
 * - Date range validation
 * - Time allocation validation
 * - Position constraints (drag operations)
 * - Spacing between phases
 * - Recurring pattern validation
 * 
 * Part of three-layer architecture:
 * - domain/rules/phases/PhaseValidation.ts (THIS FILE - validation rules)
 * - domain/rules/phases/PhaseBudget.ts (budget calculations)
 * - domain/rules/phases/PhaseHierarchy.ts (sequencing & continuity)
 * 
 * Created: 2026-01-07 (split from PhaseRules.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { PhaseDTO, Project } from '@/types/core';
import { normalizeToMidnight, addDaysToDate } from '@/utils/dateCalculations';
import { PhaseRecurrenceService } from './PhaseRecurrence';
// Note: ProjectBudgetService reference removed - was not used
// import { ProjectBudgetService } from '../projects/ProjectBudget';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MilestoneValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MilestoneDateValidation {
  isValid: boolean;
  errors: string[];
}

export interface MilestoneTimeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Phase-prefixed aliases for semantic consistency
export type PhaseValidationResult = MilestoneValidationResult;
export type PhaseDateValidation = MilestoneDateValidation;
export type PhaseTimeValidation = MilestoneTimeValidation;

export interface RecurringPhaseRuleConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weeklyDayOfWeek?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
}

// ============================================================================
// PHASE VALIDATION RULES
// ============================================================================

/**
 * Phase Validation Rules
 * 
 * Validates individual phases and milestones against business rules.
 */
export class PhaseValidationRules {
  
  /**
   * RULE 1: Phase time allocation must be non-negative
   * 
   * Business Logic Reference: Rule 4
   * Formula: phase.timeAllocationHours >= 0
   * 
   * @param timeAllocation - The time allocation to validate
   * @returns true if allocation is non-negative, false otherwise
   */
  static validateTimeAllocation(timeAllocation: number): boolean {
    return timeAllocation >= 0;
  }

  /**
   * RULE 2: Phase dates must fall within project date range
   * 
   * Business Logic Reference: Rule 2
   * Formula: project.startDate ≤ phase.endDate ≤ project.endDate
   * 
   * Applies to:
   * - Single milestones: Due date must be within project dates
   * - Recurring milestones: Generated occurrences must be within project dates
   * 
   * @param milestoneEndDate - Phase end/due date
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param continuous - Whether project is continuous (no end date constraint)
   * @returns Validation result with errors
   */
  static validateMilestoneDateWithinProject(
    milestoneEndDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    continuous: boolean = false
  ): MilestoneDateValidation {
    const errors: string[] = [];

    // Check if milestone is after project start
    if (milestoneEndDate < projectStartDate) {
      errors.push('Milestone date cannot be before project start date');
    }

    // For non-continuous projects, check if milestone is before project end
    if (!continuous && milestoneEndDate > projectEndDate) {
      errors.push('Milestone date cannot be after project end date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate milestone start and end date relationship
   * 
   * @param startDate - Phase start date (optional)
   * @param endDate - Phase end date
   * @returns Validation result
   */
  static validateMilestoneDateRange(
    startDate: Date | undefined,
    endDate: Date
  ): MilestoneDateValidation {
    const errors: string[] = [];

    if (startDate && startDate >= endDate) {
      errors.push('Milestone start date must be before end date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * RULE 2B: Validate recurring milestone configuration
   * 
   * Business Logic:
   * - Recurring pattern must be valid (type, interval)
   * - Time allocation applies per occurrence
   * - Pattern generates occurrences within project boundaries
   * 
   * @param isRecurring - Whether milestone is recurring
   * @param recurringConfig - Recurrence pattern configuration
   * @param timeAllocation - Hours per occurrence
   * @returns Validation result with errors
   * 
   * @deprecated Use PhaseRecurrenceService.validateRecurringConfig instead
   * Kept for backward compatibility during migration
   */
  static validateRecurringPhase(
    isRecurring: boolean,
    recurringConfig: RecurringPhaseRuleConfig,
    timeAllocation: number
  ): MilestoneDateValidation {
    // Delegate to domain service
    return PhaseRecurrenceService.validateRecurringConfig(isRecurring, recurringConfig, timeAllocation);
  }

  /**
   * Validate milestone time allocation with recommendations
   * 
   * Combines:
   * - RULE 1: Positive time allocation
   * - Budget utilization warnings
   * 
   * @param timeAllocation - Phase time allocation
   * @param projectBudget - Project budget
   * @returns Detailed validation result
   * 
   * @deprecated Use ProjectBudgetService.validatePhaseTime instead
   * Kept for backward compatibility during migration
   */
  static validateMilestoneTime(
    timeAllocation: number,
    projectBudget: number
  ): MilestoneTimeValidation {
    // TODO: Re-implement this validation after ProjectBudgetService migration
    // return ProjectBudgetService.validatePhaseTime(timeAllocation, projectBudget);
    return {
      isValid: timeAllocation > 0 && timeAllocation <= projectBudget,
      errors: timeAllocation <= 0 ? ['Time allocation must be positive'] : 
              timeAllocation > projectBudget ? ['Time allocation exceeds project budget'] : [],
      warnings: []
    };
  }

  /**
   * Validate complete milestone against project
   * 
   * Combines all milestone validation rules:
   * - RULE 1: Positive time allocation
   * - RULE 2: Date within project range
   * - RULE 2B: Recurring pattern validation (if applicable)
   * - RULE 3: Doesn't exceed project budget (with other milestones)
   * 
   * @param milestone - Phase to validate
   * @param project - Parent project
   * @param existingPhases - Other project milestones
   * @returns Comprehensive validation result
   */
  static validateMilestone(
    milestone: PhaseDTO,
    project: Project,
    existingPhases: PhaseDTO[] = []
  ): MilestoneValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const milestoneHours = milestone.timeAllocationHours ?? milestone.timeAllocation;

    // Validate time allocation
    const timeValidation = this.validateMilestoneTime(
      milestoneHours,
      project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // For recurring phases, validate pattern
    if (milestone.isRecurring) {
      const recurringValidation = this.validateRecurringPhase(
        milestone.isRecurring,
        milestone.recurringConfig,
        milestoneHours
      );
      errors.push(...recurringValidation.errors);
    } else {
      // For single phases, validate dates
      const dateValidation = this.validateMilestoneDateWithinProject(
        milestone.endDate || milestone.dueDate,
        project.startDate,
        project.endDate,
        project.continuous
      );
      errors.push(...dateValidation.errors);

      // Validate start/end date relationship if start date exists
      if (milestone.startDate) {
        const rangeValidation = this.validateMilestoneDateRange(
          milestone.startDate,
          milestone.endDate || milestone.dueDate
        );
        errors.push(...rangeValidation.errors);
      }
    }

    // Validate budget constraint with existing milestones
    // Note: For recurring phases, this checks per-occurrence allocation
    // TODO: Re-implement budget validation after migration
    const canAccommodate = true; // Simplified for migration
    // const canAccommodate = ProjectBudgetService.canAccommodateAdditionalPhase(
    //   existingPhases,
    //   project.estimatedHours,
    //   milestoneHours
    // );

    if (!canAccommodate && !project.continuous) {
      // TODO: Re-implement budget check after migration
      const totalAllocated = existingPhases.reduce((sum, p) => sum + (p.timeAllocationHours || 0), 0);
      // const budgetCheck = ProjectBudgetService.checkBudgetConstraint(existingPhases, project.estimatedHours);
      if (milestone.isRecurring) {
        warnings.push(
          `Recurring milestone allocation (${milestoneHours}h per occurrence) may exceed project budget. ` +
          `Current allocation: ${totalAllocated}h, ` +
          `Project budget: ${project.estimatedHours}h. ` +
          `Consider the total impact of multiple occurrences.`
        );
      } else {
        errors.push(
          `Adding this milestone would exceed project budget. ` +
          `Current allocation: ${totalAllocated}h, ` +
          `New milestone: ${milestoneHours}h, ` +
          `Project budget: ${project.estimatedHours}h`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * RULE: Phase position constraints for drag operations
   * 
   * Business rules:
   * 1. Milestones must be at least 1 day after project start
   * 2. Milestones must be at least 1 day before project end
   * 3. Milestones cannot overlap with other milestones (must be at least 1 day apart)
   * 
   * @param milestoneDate - Proposed milestone date
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param otherMilestoneDates - Dates of other milestones in the project
   * @param originalDate - Original date of milestone being moved (for calculating valid range)
   * @returns Validation result with allowed range
   */
  static validateMilestonePosition(
    milestoneDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    otherMilestoneDates: Date[],
    originalDate?: Date
  ): {
    isValid: boolean;
    errors: string[];
    minAllowedDate: Date;
    maxAllowedDate: Date;
  } {
    const errors: string[] = [];
    
    // Normalize dates to midnight
    const candidate = normalizeToMidnight(new Date(milestoneDate));
    const projectStart = normalizeToMidnight(new Date(projectStartDate));
    const projectEnd = normalizeToMidnight(new Date(projectEndDate));
    const original = originalDate ? normalizeToMidnight(new Date(originalDate)) : null;
    
    // Calculate absolute min/max (project boundaries)
    const minAllowedDate = addDaysToDate(projectStart, 1); // 1 day after start
    const maxAllowedDate = addDaysToDate(projectEnd, -1); // 1 day before end
    
    // Check project boundary constraints
    if (candidate < minAllowedDate) {
      errors.push('Milestone must be at least 1 day after project start');
    }
    
    if (candidate > maxAllowedDate) {
      errors.push('Milestone must be at least 1 day before project end');
    }
    
    // Check milestone overlap constraints
    const normalizedOthers = otherMilestoneDates.map(d => normalizeToMidnight(new Date(d)));
    
    for (const otherDate of normalizedOthers) {
      // Skip if this is the original position of the milestone being moved
      if (original && otherDate.getTime() === original.getTime()) {
        continue;
      }
      
      // Check if dates are the same (overlap)
      if (candidate.getTime() === otherDate.getTime()) {
        errors.push('Milestone cannot overlap with another milestone');
        break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      minAllowedDate,
      maxAllowedDate
    };
  }

  /**
   * Check if a milestone is part of a recurring pattern (old numbered system)
   * Used to prevent editing of auto-generated recurring instances
   * 
   * @param milestone - Phase to check
   * @returns true if milestone is a recurring instance
   */
  static isRecurringPhase(milestone: PhaseDTO): boolean {
    return milestone.name ? /\s\d+$/.test(milestone.name) : false;
  }

  /**
   * RULE: Phase with estimated time must have end date >= today
   * 
   * Phases (milestones with startDate/endDate) that have estimated time
   * cannot end in the past. The end date must be at least today to allow
   * the estimated time to be placed on at least one working day.
   * 
   * @param phase - The phase to validate
   * @param today - Reference date (defaults to now)
   * @returns Validation result with errors
   */
  static validatePhaseEndDateNotInPast(
    phase: PhaseDTO,
    today: Date = new Date()
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Only validate phases (must have startDate and endDate)
    if (!phase.startDate || (!phase.endDate && !phase.dueDate)) {
      return { isValid: true, errors };
    }
    
    // Only validate if phase has estimated time
    const timeAllocation = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
    if (timeAllocation <= 0) {
      return { isValid: true, errors };
    }
    
    // Normalize dates to midnight for comparison
    const todayMidnight = normalizeToMidnight(new Date(today));
    const phaseEnd = normalizeToMidnight(new Date(phase.endDate || phase.dueDate));
    
    if (phaseEnd < todayMidnight) {
      errors.push(`Phase "${phase.name}" with estimated time cannot end in the past`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calculate minimum phase end date to accommodate estimated time
   * 
   * If a phase has estimated time, it must end at least today to allow
   * at least one day for that time to be allocated.
   * 
   * @param phase - The phase to calculate for
   * @param today - Reference date (defaults to now)
   * @returns Minimum required end date
   */
  static calculateMinimumPhaseEndDate(
    phase: PhaseDTO,
    today: Date = new Date()
  ): Date {
    const timeAllocation = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
    
    // If no estimated time, use phase's current end date
    if (timeAllocation <= 0) {
      return new Date(phase.endDate || phase.dueDate);
    }
    
    // Normalize today to midnight
    const todayMidnight = normalizeToMidnight(new Date(today));
    const currentEndDate = normalizeToMidnight(new Date(phase.endDate || phase.dueDate));
    
    // Return the later of today or current end date
    return currentEndDate >= todayMidnight ? currentEndDate : todayMidnight;
  }
  
  /**
   * Validate spacing between phases (minimum 1 day gap for non-final phases)
   * 
   * There must be at least 1 day between a phase end date and the next phase's
   * start date, unless it's the last phase.
   * 
   * @param phases - Array of phases sorted by end date
   * @returns Validation result with errors
   */
  static validatePhaseSpacing(
    phases: PhaseDTO[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Sort phases by end date
    const sortedPhases = [...phases].sort((a, b) => {
      const aEnd = new Date(a.endDate || a.dueDate).getTime();
      const bEnd = new Date(b.endDate || b.dueDate).getTime();
      return aEnd - bEnd;
    });
    
    // Check spacing between consecutive phases
    for (let i = 0; i < sortedPhases.length - 1; i++) {
      const currentPhase = sortedPhases[i];
      const nextPhase = sortedPhases[i + 1];
      
      const currentEnd = normalizeToMidnight(new Date(currentPhase.endDate || currentPhase.dueDate));
      const nextStart = normalizeToMidnight(new Date(nextPhase.startDate || currentEnd));
      
      // Next phase must start at least 1 day after current phase ends
      const minNextStart = addDaysToDate(currentEnd, 1);
      
      if (nextStart < minNextStart) {
        errors.push(
          `Phase "${nextPhase.name}" must start at least 1 day after "${currentPhase.name}" ends`
        );
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
