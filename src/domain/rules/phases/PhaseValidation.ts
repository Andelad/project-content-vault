/**
 * Phase Validation Rules
 * 
 * Handles all validation logic for phases:
 * - Date range validation
 * - Time allocation validation
 * - Position constraints (drag operations)
 * - Spacing between phases
 * - Recurring pattern validation
 * 
 * Part of three-layer architecture:
 * - domain/rules/phases/PhaseValidation.ts (THIS FILE - validation rules)
 * - domain/rules/phase./PhaseCalculations.ts (budget calculations)
 * - domain/rules/phases/PhaseHierarchy.ts (sequencing & continuity)
 * 
 * Created: 2026-01-07 (split from PhaseRules.ts)
 * 
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */

import type { PhaseDTO, Project } from '@/shared/types/core';
import { normalizeToMidnight, addDaysToDate } from '@/presentation/utils/dateCalculations';
import { PhaseRecurrenceService } from './PhaseRecurrence';
import { validatePhaseScheduling } from './PhaseCalculations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PhaseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PhaseDateValidation {
  isValid: boolean;
  errors: string[];
}

export interface PhaseTimeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

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
 * Validates individual phases against business rules.
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
   * - Single phases: Due date must be within project dates
   * - Recurring phases: Generated occurrences must be within project dates
   * 
   * @param phaseEndDate - Phase end/due date
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param continuous - Whether project is continuous (no end date constraint)
   * @returns Validation result with errors
   */
  static validatePhaseDateWithinProject(
    phaseEndDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    continuous: boolean = false
  ): PhaseDateValidation {
    const errors: string[] = [];

    // Check if phase is after project start
    if (phaseEndDate < projectStartDate) {
      errors.push('Phase date cannot be before project start date');
    }

    // For non-continuous projects, check if phase is before project end
    if (!continuous && phaseEndDate > projectEndDate) {
      errors.push('Phase date cannot be after project end date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate phase start and end date relationship
   * 
   * @param startDate - Phase start date (optional)
   * @param endDate - Phase end date
   * @returns Validation result
   */
  static validatePhaseDateRange(
    startDate: Date | undefined,
    endDate: Date
  ): PhaseDateValidation {
    const errors: string[] = [];

    if (startDate && startDate >= endDate) {
      errors.push('Phase start date must be before end date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * RULE 2B: Validate recurring phase configuration
   * 
   * Business Logic:
   * - Recurring pattern must be valid (type, interval)
   * - Time allocation applies per occurrence
   * - Pattern generates occurrences within project boundaries
   * 
   * @param isRecurring - Whether phase is recurring
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
  ): PhaseDateValidation {
    // Delegate to domain service
    return PhaseRecurrenceService.validateRecurringConfig(isRecurring, recurringConfig, timeAllocation);
  }

  /**
   * Validate phase time allocation against project budget
   * 
   * DELEGATES to PhaseBudget.validatePhaseScheduling for budget logic
   * 
   * @param timeAllocation - Time allocation for phase
   * @param projectBudget - Total project budget in hours
   * @param existingPhases - Existing phases to check against (optional, defaults to empty)
   * @returns Validation result
   */
  static validatePhaseTime(
    timeAllocation: number,
    projectBudget: number,
    existingPhases: PhaseDTO[] = []
  ): PhaseTimeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Rule: Time allocation cannot be negative
    if (timeAllocation < 0) {
      errors.push('Phase time allocation cannot be negative');
    }
    
    // Rule: Zero allocation is valid but should warn
    if (timeAllocation === 0) {
      warnings.push('Phase has 0h allocated — work will not be distributed until hours are set');
    }
    
    // Budget validation - DELEGATE to domain rules
    if (timeAllocation > 0) {
      const budgetCheck = validatePhaseScheduling(
        existingPhases,
        { timeAllocationHours: timeAllocation },
        projectBudget
      );
      
      if (!budgetCheck.canSchedule) {
        errors.push(...budgetCheck.budgetConflicts);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete phase against project
   * 
   * Combines all phase validation rules:
   * - RULE 1: Positive time allocation
   * - RULE 2: Date within project range
   * - RULE 2B: Recurring pattern validation (if applicable)
   * - RULE 3: Doesn't exceed project budget (with other phases)
   * 
   * @param phase - Phase to validate
   * @param project - Parent project
   * @param existingPhases - Other project phases
   * @returns Comprehensive validation result
   */
  static validatePhase(
    phase: PhaseDTO,
    project: Project,
    existingPhases: PhaseDTO[] = []
  ): PhaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const phaseHours = phase.timeAllocationHours ?? phase.timeAllocation;

    // Validate time allocation
    const timeValidation = this.validatePhaseTime(
      phaseHours,
      project.estimatedHours
    );
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    // For recurring phases, validate pattern
    if (phase.isRecurring) {
      const recurringValidation = this.validateRecurringPhase(
        phase.isRecurring,
        phase.recurringConfig,
        phaseHours
      );
      errors.push(...recurringValidation.errors);
    } else {
      // For single phases, validate dates
      const dateValidation = this.validatePhaseDateWithinProject(
        phase.endDate || phase.dueDate,
        project.startDate,
        project.endDate,
        project.continuous
      );
      errors.push(...dateValidation.errors);

      // Validate start/end date relationship if start date exists
      if (phase.startDate) {
        const rangeValidation = this.validatePhaseDateRange(
          phase.startDate,
          phase.endDate || phase.dueDate
        );
        errors.push(...rangeValidation.errors);
      }
    }

    // Validate budget constraint with existing phases - DELEGATE to domain rules
    // Note: For recurring phases, this checks per-occurrence allocation
    const budgetCheck = validatePhaseScheduling(
      existingPhases,
      phase,
      project.estimatedHours
    );

    if (!budgetCheck.canSchedule && !project.continuous) {
      if (phase.isRecurring) {
        warnings.push(
          `Recurring phase allocation (${phaseHours}h per occurrence) may exceed project budget. ` +
          `Current allocation: ${budgetCheck.currentAllocation}h, ` +
          `New allocation: ${budgetCheck.newAllocation}h, ` +
          `Project budget: ${project.estimatedHours}h. ` +
          `Consider the total impact of multiple occurrences.`
        );
      } else {
        errors.push(
          `Adding this phase would exceed project budget. ` +
          `Current allocation: ${budgetCheck.currentAllocation}h, ` +
          `New phase: ${phaseHours}h, ` +
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
   * 1. Phases must be at least 1 day after project start
   * 2. Phases must be at least 1 day before project end
   * 3. Phases cannot overlap with other phases (must be at least 1 day apart)
   * 
   * @param phaseDate - Proposed phase date
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param otherPhaseDates - Dates of other phases in the project
   * @param originalDate - Original date of phase being moved (for calculating valid range)
   * @returns Validation result with allowed range
   */
  static validatePhasePosition(
    phaseDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    otherPhaseDates: Date[],
    originalDate?: Date
  ): {
    isValid: boolean;
    errors: string[];
    minAllowedDate: Date;
    maxAllowedDate: Date;
  } {
    const errors: string[] = [];
    
    // Normalize dates to midnight
    const candidate = normalizeToMidnight(new Date(phaseDate));
    const projectStart = normalizeToMidnight(new Date(projectStartDate));
    const projectEnd = normalizeToMidnight(new Date(projectEndDate));
    const original = originalDate ? normalizeToMidnight(new Date(originalDate)) : null;
    
    // Calculate absolute min/max (project boundaries)
    const minAllowedDate = addDaysToDate(projectStart, 1); // 1 day after start
    const maxAllowedDate = addDaysToDate(projectEnd, -1); // 1 day before end
    
    // Check project boundary constraints
    if (candidate < minAllowedDate) {
      errors.push('Phase must be at least 1 day after project start');
    }
    
    if (candidate > maxAllowedDate) {
      errors.push('Phase must be at least 1 day before project end');
    }
    
    // Check phase overlap constraints
    const normalizedOthers = otherPhaseDates.map(d => normalizeToMidnight(new Date(d)));
    
    for (const otherDate of normalizedOthers) {
      // Skip if this is the original position of the phase being moved
      if (original && otherDate.getTime() === original.getTime()) {
        continue;
      }
      
      // Check if dates are the same (overlap)
      if (candidate.getTime() === otherDate.getTime()) {
        errors.push('Phase cannot overlap with another phase');
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
   * Check if a phase is part of a recurring pattern (old numbered system)
   * Used to prevent editing of auto-generated recurring instances
   * 
   * @param phase - Phase to check
   * @returns true if phase is a recurring instance
   */
  static isRecurringPhase(phase: PhaseDTO): boolean {
    return phase.name ? /\s\d+$/.test(phase.name) : false;
  }

  /**
   * RULE: Phase with estimated time must have end date >= today
   * 
   * Phases (phases with startDate/endDate) that have estimated time
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

  /**
   * RULE 5: Check for date conflicts between phases
   * 
   * Business Logic:
   * - Two phases should not be scheduled on the same day
   * - Allows for 24-hour separation minimum
   * 
   * This prevents phase collisions and ensures clear project timelines.
   * 
   * @param requestedDate - Date of new/updated phase
   * @param existingPhases - Currently scheduled phases
   * @param excludePhaseId - Optional phase ID to exclude (for updates)
   * @returns Validation result with conflict details
   */
  static validateMilestoneDateConflict(
    requestedDate: Date,
    existingPhases: PhaseDTO[],
    excludePhaseId?: string
  ): {
    hasConflict: boolean;
    conflictingPhase?: PhaseDTO;
    message?: string;
  } {
    const requestedTime = requestedDate.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    for (const phase of existingPhases) {
      // Skip the phase being updated
      if (excludePhaseId && phase.id === excludePhaseId) {
        continue;
      }
      
      const existingDate = new Date(phase.endDate || phase.dueDate);
      const timeDiff = Math.abs(existingDate.getTime() - requestedTime);
      
      if (timeDiff < oneDayMs) {
        return {
          hasConflict: true,
          conflictingPhase: phase,
          message: `Another phase "${phase.name}" already exists on or near this date`
        };
      }
    }
    
    return { hasConflict: false };
  }

  /**
   * RULE 6: Validate phase fits within project timeframe
   * 
   * Business Logic:
   * - Phase date must be >= project start date
   * - Phase date must be <= project end date
   * - For continuous projects, only start date is enforced
   * 
   * @param phaseDate - Date of phase
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param continuous - Whether project is continuous (no end constraint)
   * @returns Validation result
   */
  static validateMilestoneWithinProject(
    phaseDate: Date,
    projectStartDate: Date,
    projectEndDate: Date,
    continuous: boolean = false
  ): {
    isValid: boolean;
    error?: string;
  } {
    if (phaseDate < projectStartDate) {
      return {
        isValid: false,
        error: 'Phase date must be on or after project start date'
      };
    }
    
    if (!continuous && phaseDate > projectEndDate) {
      return {
        isValid: false,
        error: 'Phase date must be on or before project end date'
      };
    }
    
    return { isValid: true };
  }
}
