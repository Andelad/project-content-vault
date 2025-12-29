/**
 * Phase Business Rules
 * 
 * Single source of truth for phase-related business logic.
 * 
 * MIGRATION NOTE (December 2025):
 * This file consolidates Phase rules with legacy milestone terminology.
 * "Phase" is the primary term; "milestone" remains only for backward compatibility
 * and database field names (phase.endDate, etc.).
 * 
 * Key Domain Concepts:
 * - Phase: Has both startDate and endDate (represents a time period)
 * - Milestone (legacy term): Has only endDate/dueDate (represents a deadline)
 * 
 * Budget Model (Mutually Exclusive):
 * 1. Fixed Budget (Default): Project has total hours budget (e.g., 28h)
 *    - Can be single phase (implicit) or split into multiple phases
 *    - Budget validation applies: sum of phases ≤ project budget
 * 
 * 2. Recurring Template: Project has recurring pattern (e.g., 8h/week)
 *    - REPLACES the fixed budget entirely (budget becomes N/A)
 *    - No budget validation - operates independently of project hours
 *    - Cannot coexist with split phases
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * Services and components should delegate to these rules.
 * 
 * Created: 2025-11-10 (PhaseRules)
 * Consolidated: 2025-12-29 (merged with PhaseRules)
 * 
 * @see docs/MILESTONE_TO_PHASE_MIGRATION_ASSESSMENT.md
 * @see docs/core/Business Logic.md
 */

import type { PhaseDTO, Project } from '@/types/core';
import { normalizeToMidnight, addDaysToDate } from '@/services/calculations/general/dateCalculations';

/**
 * A Phase is a PhaseDTO with a defined start date
 * This creates a time period rather than just a deadline
 */
export type Phase = PhaseDTO & { startDate: Date };

// ============================================================================
// TYPE DEFINITIONS (from PhaseRules)
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

export interface MilestoneBudgetCheck {
  isValid: boolean;
  totalAllocated: number;
  projectBudget: number;
  remaining: number;
  overage: number;
  utilizationPercentage: number;
}

// Phase-prefixed aliases for semantic consistency
export type PhaseValidationResult = MilestoneValidationResult;
export type PhaseDateValidation = MilestoneDateValidation;
export type PhaseTimeValidation = MilestoneTimeValidation;
export type PhaseBudgetCheck = MilestoneBudgetCheck;

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
// TYPE GUARDS
// ============================================================================

/**
 * Type guard: Check if an entity is actually a phase (has a start date)
 * 
 * A phase has both startDate and endDate, representing a time period.
 * A pure milestone only has a deadline (endDate/dueDate).
 * 
 * @param entity - The phase/milestone to check
 * @returns True if the item has a startDate (is a phase)
 * 
 * @example
 * ```ts
 * const items = [phase1, milestone1, phase2];
 * const phases = items.filter(isPhase); // Type-safe Phase[]
 * ```
 */
export function isPhase(entity: PhaseDTO): entity is Phase {
  return entity.startDate !== undefined;
}

/**
 * Type guard: Check if a phase/milestone is a deadline-only entity (no start date)
 * 
 * @param entity - The phase/milestone to check
 * @returns True if the entity does NOT have a startDate
 * 
 * @example
 * ```ts
 * const items = [phase1, deadline1, phase2];
 * const deadlineOnly = items.filter(isDeadlineOnly); // Deadline-only entities
 * ```
 */
export function isDeadlineOnly(entity: PhaseDTO): boolean {
  return entity.startDate === undefined;
}

/**
 * @deprecated Use isDeadlineOnly instead. Kept for backward compatibility.
 */
export const isMilestone = isDeadlineOnly;

// ============================================================================
// FILTERING RULES
// ============================================================================

/**
 * Extract all phases from a mixed array of phases/milestones
 * 
 * Filters for items that have startDate defined and returns them
 * as type-safe Phase[] array.
 * 
 * @param milestones - Array of phases/milestones
 * @returns Array of only phases
 * 
 * @example
 * ```ts
 * const projectItems = project.phases;
 * const phases = getPhases(projectItems);
 * // phases is Phase[] - TypeScript knows they have startDate
 * ```
 */
export function getPhases(phases: PhaseDTO[]): PhaseDTO[] {
  return phases.filter(isPhase);
}

/**
 * Extract all pure milestones (non-phases) from a mixed array
 * 
 * Filters for items that do NOT have startDate defined.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Array of only pure milestones (no startDate)
 * 
 * @example
 * ```ts
 * const projectItems = project.phases;
 * const pureMilestones = getMilestones(projectItems);
 * // These are deadline-only milestones
 * ```
 */
export function getMilestones(phases: PhaseDTO[]): PhaseDTO[] {
  return phases.filter(isDeadlineOnly);
}

// ============================================================================
// SORTING RULES
// ============================================================================

/**
 * Sort phases by end date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest end date first)
 */
export function sortPhasesByEndDate(phases: PhaseDTO[]): PhaseDTO[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.endDate).getTime();
    const bDate = new Date(b.endDate).getTime();
    return aDate - bDate;
  });
}

/**
 * Sort phases by start date (ascending)
 * 
 * @param phases - Array of phases to sort
 * @returns Sorted array (earliest start date first)
 */
export function sortPhasesByStartDate(phases: PhaseDTO[]): PhaseDTO[] {
  return [...phases].sort((a, b) => {
    const aDate = new Date(a.startDate).getTime();
    const bDate = new Date(b.startDate).getTime();
    return aDate - bDate;
  });
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Get phases sorted by end date from a mixed milestone array
 * 
 * Combines filtering and sorting in one convenient function.
 * This is the most common operation needed in components.
 * 
 * @param milestones - Array of milestones (may include phases)
 * @returns Sorted array of phases only
 * 
 * @extracted-from ProjectBar.tsx line 755 (inline filter + sort)
 * 
 * @example
 * ```ts
 * // Instead of:
 * const phases = milestones.filter(p => p.endDate !== undefined)
 *   .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
 * 
 * // Use:
 * const phases = getPhasesSortedByEndDate(phases);
 * ```
 */
export function getPhasesSortedByEndDate(phases: PhaseDTO[]): PhaseDTO[] {
  return sortPhasesByEndDate(getPhases(phases));
}

/**
 * Phase Business Rules Class
 * 
 * Contains validation and business rules for phases and milestones.
 * Consolidated from PhaseRules and PhaseRules (December 2025).
 * 
 * See docs/PHASE_DOMAIN_LOGIC.md for complete phase model documentation.
 * See docs/core/Business Logic.md for business rules reference.
 * 
 * Key Rules:
 * 1. Default Phase: Every project is implicitly one phase (project duration + full budget)
 * 2. Split Phases: Explicit phases divide the project timeline sequentially
 * 3. Recurring Template: Single template that repeats (REPLACES fixed budget)
 * 4. Mutual Exclusivity: Projects can't have BOTH split phases AND recurring template
 * 
 * Budget Logic:
 * - Fixed Budget Mode: Budget validation applies (phases must sum to ≤ project budget)
 * - Recurring Mode: Budget validation DISABLED (project budget becomes N/A)
 */
export class PhaseRules {

  // ==========================================================================
  // MILESTONE VALIDATION RULES (from PhaseRules)
  // ==========================================================================
  
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
   */
  static validateRecurringPhase(
    isRecurring: boolean,
    recurringConfig: RecurringPhaseRuleConfig,
    timeAllocation: number
  ): MilestoneDateValidation {
    const errors: string[] = [];

    if (!isRecurring) {
      return { isValid: true, errors: [] };
    }

    // Validate recurring config exists
    if (!recurringConfig) {
      errors.push('Recurring milestone must have recurrence configuration');
      return { isValid: false, errors };
    }

    // Validate pattern type
    const validTypes = ['daily', 'weekly', 'monthly'];
    if (!validTypes.includes(recurringConfig.type)) {
      errors.push(`Invalid recurrence type: ${recurringConfig.type}. Must be daily, weekly, or monthly`);
    }

    // Validate interval
    if (!recurringConfig.interval || recurringConfig.interval < 1) {
      errors.push('Recurrence interval must be at least 1');
    }

    // Validate type-specific fields
    if (recurringConfig.type === 'weekly' && recurringConfig.weeklyDayOfWeek === undefined) {
      errors.push('Weekly recurrence must specify day of week (0-6)');
    }

    if (recurringConfig.type === 'monthly') {
      if (!recurringConfig.monthlyPattern) {
        errors.push('Monthly recurrence must specify pattern (date or dayOfWeek)');
      } else if (recurringConfig.monthlyPattern === 'date' && !recurringConfig.monthlyDate) {
        errors.push('Monthly date pattern must specify date (1-31)');
      } else if (recurringConfig.monthlyPattern === 'dayOfWeek' && 
                 (recurringConfig.monthlyWeekOfMonth === undefined || recurringConfig.monthlyDayOfWeek === undefined)) {
        errors.push('Monthly dayOfWeek pattern must specify week of month and day of week');
      }
    }

    // Validate time allocation
    if (timeAllocation <= 0) {
      errors.push('Recurring milestone must have positive time allocation per occurrence');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * RULE 3a: Calculate total milestone allocation
   * 
   * Business Logic Reference: Calculation Rule 2
   * Formula: SUM(phase.timeAllocationHours)
   * 
   * @param milestones - Array of milestones
   * @returns Total hours allocated
   */
  static calculateTotalAllocation(phases: PhaseDTO[]): number {
    return phases.reduce((sum, phase) => {
      const hours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
      return sum + hours;
    }, 0);
  }

  /**
   * RULE 3b: Check if milestones exceed project budget
   * 
   * Business Logic Reference: Rule 1
   * Formula: SUM(phase.timeAllocationHours) ≤ project.estimatedHours
   * 
   * @param milestones - Project milestones
   * @param projectBudget - Project estimated hours
   * @param excludeMilestoneId - Optional milestone to exclude (for updates)
   * @returns Budget check result
   */
  static checkBudgetConstraint(
    phases: PhaseDTO[],
    projectBudget: number,
    excludeMilestoneId?: string
  ): MilestoneBudgetCheck {
    // Filter out excluded milestone if provided
    const relevantPhases = excludeMilestoneId
      ? phases.filter(p => p.id !== excludeMilestoneId)
      : phases;

    const totalAllocated = this.calculateTotalAllocation(relevantPhases);
    const remaining = projectBudget - totalAllocated;
    const overage = Math.max(0, totalAllocated - projectBudget);
    const utilizationPercentage = projectBudget > 0 ? (totalAllocated / projectBudget) * 100 : 0;
    const isValid = totalAllocated <= projectBudget;

    return {
      isValid,
      totalAllocated,
      projectBudget,
      remaining,
      overage,
      utilizationPercentage
    };
  }

  /**
   * RULE 3c: Check if adding a milestone would exceed budget
   * 
   * @param milestones - Current milestones
   * @param projectBudget - Project estimated hours
   * @param additionalHours - Hours to add
   * @returns true if budget can accommodate, false otherwise
   */
  static canAccommodateAdditionalMilestone(
    phases: PhaseDTO[],
    projectBudget: number,
    additionalHours: number
  ): boolean {
    const check = this.checkBudgetConstraint(phases, projectBudget);
    return check.remaining >= additionalHours;
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
   */
  static validateMilestoneTime(
    timeAllocation: number,
    projectBudget: number
  ): MilestoneTimeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateTimeAllocation(timeAllocation)) {
      errors.push('Milestone time allocation cannot be negative');
    } else if (timeAllocation === 0) {
      warnings.push('Milestone has 0h allocated — work will not be distributed until hours are set');
    }

    if (timeAllocation > projectBudget) {
      errors.push(`Milestone allocation (${timeAllocation}h) exceeds project budget (${projectBudget}h)`);
    } else if (timeAllocation > projectBudget * 0.5) {
      warnings.push('Milestone allocation is over 50% of project budget');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
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
    const canAccommodate = this.canAccommodateAdditionalMilestone(
      existingPhases,
      project.estimatedHours,
      milestoneHours
    );

    if (!canAccommodate && !project.continuous) {
      const budgetCheck = this.checkBudgetConstraint(existingPhases, project.estimatedHours);
      if (milestone.isRecurring) {
        warnings.push(
          `Recurring milestone allocation (${milestoneHours}h per occurrence) may exceed project budget. ` +
          `Current allocation: ${budgetCheck.totalAllocated}h, ` +
          `Project budget: ${project.estimatedHours}h. ` +
          `Consider the total impact of multiple occurrences.`
        );
      } else {
        errors.push(
          `Adding this milestone would exceed project budget. ` +
          `Current allocation: ${budgetCheck.totalAllocated}h, ` +
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
   * Calculate milestone budget utilization percentage
   * 
   * Business Logic Reference: Calculation Rule 2
   * Formula: (SUM(milestone hours) / project budget) * 100
   * 
   * @param milestones - Array of milestones
   * @param projectBudget - Project estimated hours
   * @returns Utilization percentage (0-100+)
   */
  static calculateBudgetUtilization(
    phases: PhaseDTO[],
    projectBudget: number
  ): number {
    if (projectBudget === 0) return 0;
    const totalAllocated = this.calculateTotalAllocation(phases);
    return (totalAllocated / projectBudget) * 100;
  }

  /**
   * Calculate remaining budget after milestone allocations
   * 
   * Business Logic Reference: Calculation Rule 5
   * Formula: project.estimatedHours - SUM(phase.timeAllocationHours)
   * 
   * @param milestones - Array of milestones
   * @param projectBudget - Project estimated hours
   * @returns Remaining hours (can be negative if over budget)
   */
  static calculateRemainingBudget(
    phases: PhaseDTO[],
    projectBudget: number
  ): number {
    const totalAllocated = this.calculateTotalAllocation(phases);
    return projectBudget - totalAllocated;
  }

  /**
   * Calculate budget overage if milestones exceed project budget
   * 
   * Business Logic Reference: Calculation Rule 6
   * Formula: MAX(0, SUM(milestone hours) - project budget)
   * 
   * @param milestones - Array of milestones
   * @param projectBudget - Project estimated hours
   * @returns Overage hours (0 if not over budget)
   */
  static calculateBudgetOverage(
    phases: PhaseDTO[],
    projectBudget: number
  ): number {
    const totalAllocated = this.calculateTotalAllocation(phases);
    return Math.max(0, totalAllocated - projectBudget);
  }

  /**
   * Calculate average milestone allocation
   * 
   * @param milestones - Array of milestones
   * @returns Average hours per milestone
   */
  static calculateAverageMilestoneAllocation(phases: PhaseDTO[]): number {
    if (phases.length === 0) return 0;
    const totalAllocated = this.calculateTotalAllocation(phases);
    return totalAllocated / phases.length;
  }

  /**
   * Generate business recommendations based on milestone allocation
   * 
   * @param milestones - Project milestones
   * @param projectBudget - Project estimated hours
   * @returns Array of recommendation strings
   */
  static generateRecommendations(
    phases: PhaseDTO[],
    projectBudget: number
  ): string[] {
    const recommendations: string[] = [];
    const budgetCheck = this.checkBudgetConstraint(phases, projectBudget);

    if (!budgetCheck.isValid) {
      recommendations.push(
        `Budget exceeded by ${budgetCheck.overage.toFixed(1)}h. ` +
        `Consider reducing milestone allocations or increasing project budget.`
      );
    } else if (budgetCheck.utilizationPercentage > 90) {
      recommendations.push(
        'Budget utilization high (>90%). Consider adding buffer time for unexpected work.'
      );
    } else if (budgetCheck.utilizationPercentage < 50) {
      recommendations.push(
        'Budget utilization low (<50%). Consider adding more milestones or increasing detail.'
      );
    }

    if (phases.length > 0) {
      const avgAllocation = this.calculateAverageMilestoneAllocation(phases);
      if (avgAllocation < 1) {
        recommendations.push(
          'Very small milestone allocations detected. Consider consolidating milestones.'
        );
      } else if (avgAllocation > projectBudget * 0.5) {
        recommendations.push(
          'Large milestone allocations detected. Consider breaking down into smaller milestones.'
        );
      }
    }

    return recommendations;
  }

  /**
   * Sort milestones by date (natural ordering)
   * Milestones are naturally ordered by endDate - no manual ordering needed
   * 
   * @param milestones - Array of milestones
   * @returns Sorted milestones
   */
  static sortMilestonesByDate(phases: PhaseDTO[]): PhaseDTO[] {
    return phases.sort((a, b) => {
      const dateA = a.endDate || a.dueDate;
      const dateB = b.endDate || b.dueDate;
      return dateA.getTime() - dateB.getTime();
    });
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
  
  /**
   * Cascade phase date adjustments when one phase moves forward
   * 
   * When a phase's end date moves forward and comes within 1 day of the next
   * phase's start date, the next phase must also move forward to maintain
   * the required spacing.
   * 
   * @param phases - Array of phases
   * @param adjustedPhaseId - ID of the phase that was adjusted
   * @param newEndDate - New end date for the adjusted phase
   * @returns Updated array of phases with cascaded adjustments
   */
  static cascadePhaseAdjustments(
    phases: PhaseDTO[],
    adjustedPhaseId: string,
    newEndDate: Date
  ): PhaseDTO[] {
    // Sort phases by end date
    const sortedPhases = [...phases].sort((a, b) => {
      const aEnd = new Date(a.endDate || a.dueDate).getTime();
      const bEnd = new Date(b.endDate || b.dueDate).getTime();
      return aEnd - bEnd;
    });
    
    // Find the adjusted phase index
    const adjustedIndex = sortedPhases.findIndex(p => p.id === adjustedPhaseId);
    if (adjustedIndex === -1 || adjustedIndex === sortedPhases.length - 1) {
      // No cascading needed if not found or if it's the last phase
      return phases;
    }
    
    const result = [...sortedPhases];
    let previousEnd = normalizeToMidnight(new Date(newEndDate));
    
    // Cascade forward from the adjusted phase
    for (let i = adjustedIndex + 1; i < result.length; i++) {
      const phase = result[i];
      const phaseStart = normalizeToMidnight(new Date(phase.startDate || previousEnd));
      
      // Check if we need to move this phase forward
      const minStart = addDaysToDate(previousEnd, 1);
      
      if (phaseStart < minStart) {
        // Calculate how many days to shift
        const daysToShift = Math.ceil((minStart.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24));
        
        // Shift both start and end dates
        const newStart = addDaysToDate(phaseStart, daysToShift);
        const currentEnd = new Date(phase.endDate || phase.dueDate);
        const newEnd = addDaysToDate(currentEnd, daysToShift);
        
        result[i] = {
          ...phase,
          startDate: newStart,
          endDate: newEnd,
          dueDate: newEnd // Keep dueDate in sync
        };
        
        previousEnd = newEnd;
      } else {
        // No more cascading needed
        break;
      }
    }
    
    return result;
  }

  // ==========================================================================
  // PHASE-SPECIFIC RULES (from original PhaseRules)
  // ==========================================================================
  
  /**
   * RULE: Projects cannot have both split phases and recurring template
   * 
   * Split phases and recurring templates are mutually exclusive ways to structure project time.
   * Having both would create ambiguous capacity calculations.
   * 
   * @param milestones - All milestones/phases for a project
   * @returns Object indicating if project has splits, recurring, or conflict
   * 
   * @see docs/PHASE_DOMAIN_LOGIC.md - Rule 4: Mutual Exclusivity
   */
  static checkPhaseRecurringExclusivity(phases: PhaseDTO[]): {
    hasSplitPhases: boolean;
    hasRecurringTemplate: boolean;
    isValid: boolean;
    error?: string;
  } {
    const splitPhases = phases.filter(p => p.startDate !== undefined);
    const recurringTemplate = phases.find(p => p.isRecurring === true);
    
    const hasSplitPhases = splitPhases.length > 0;
    const hasRecurringTemplate = !!recurringTemplate;
    
    if (hasSplitPhases && hasRecurringTemplate) {
      return {
        hasSplitPhases,
        hasRecurringTemplate,
        isValid: false,
        error: 'Project cannot have both split phases and recurring template. These are mutually exclusive.'
      };
    }
    
    return {
      hasSplitPhases,
      hasRecurringTemplate,
      isValid: true
    };
  }
  
  /**
   * RULE: Split phases must be sequential (no overlaps)
   * 
   * Phases are ordered by start date and cannot overlap.
   * Gaps between phases are allowed (representing planned pauses).
   * First phase must start at project start, last phase must end at project end.
   * 
   * @param phases - Array of phases (sorted by start date)
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @returns Validation result with errors (overlaps) and warnings (gaps)
   */
  static validatePhasesContinuity(
    phases: PhaseDTO[],
    projectStartDate: Date,
    projectEndDate: Date
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (phases.length === 0) {
      return { isValid: true, errors, warnings };
    }
    
    // Sort by start date
    const sorted = sortPhasesByStartDate(phases);
    
    // First phase should start at project start
    const firstPhaseStart = new Date(sorted[0].startDate).getTime();
    const projectStart = new Date(projectStartDate).getTime();
    if (firstPhaseStart !== projectStart) {
      errors.push(`First phase should start at project start date`);
    }
    
    // Last phase should end at project end
    const lastPhaseEnd = new Date(sorted[sorted.length - 1].endDate).getTime();
    const projectEnd = new Date(projectEndDate).getTime();
    if (lastPhaseEnd !== projectEnd) {
      errors.push(`Last phase should end at project end date`);
    }
    
    // Check for overlaps and gaps between phases
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = new Date(sorted[i].endDate).getTime();
      const nextStart = new Date(sorted[i + 1].startDate).getTime();
      
      if (currentEnd >= nextStart) {
        // Overlap or same-day is an ERROR - phases must be sequential
        errors.push(
          `Overlap between "${sorted[i].name}" and "${sorted[i + 1].name}" - phases must be on different days`
        );
      } else if (currentEnd < nextStart) {
        // Gap is a WARNING (allowed, but informational)
        const gapDays = Math.round((nextStart - currentEnd) / (1000 * 60 * 60 * 24));
        warnings.push(
          `${gapDays}-day gap between "${sorted[i].name}" and "${sorted[i + 1].name}" (pause time with no estimate)`
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
   * RULE: Phase budget allocations should not exceed project budget
   * 
   * Alias for checkBudgetConstraint - maintained for backward compatibility.
   * 
   * Sum of all phase time allocations should be ≤ project's estimated hours.
   * This is a warning, not a hard error, as budget can be adjusted.
   * 
   * @param phases - Array of phases
   * @param projectEstimatedHours - Total project budget
   * @returns Budget check result
   */
  static validatePhaseBudgets(
    phases: PhaseDTO[],
    projectEstimatedHours: number
  ): {
    isValid: boolean;
    totalAllocated: number;
    remaining: number;
    overage: number;
    utilizationPercentage: number;
  } {
    return this.checkBudgetConstraint(phases, projectEstimatedHours);
  }

  /**
   * RULE: Calculate dates for adding a new phase
   * 
   * When adding a new phase, shrink the last phase to make room.
   * 
   * New phase gets:
   * - 1 day if last phase spans <= 21 days
   * - 6 days if last phase spans > 21 days
   * 
   * @param existingPhases - Current phases
   * @param projectEndDate - Project end date
   * @returns Dates for new phase and updated last phase end date
   */
  static calculateNewPhaseDates(
    existingPhases: PhaseDTO[],
    projectEndDate: Date
  ): {
    newPhaseStart: Date;
    newPhaseEnd: Date;
    lastPhaseNewEnd: Date;
  } {
    if (existingPhases.length === 0) {
      throw new Error('Cannot add phase: no existing phases');
    }

    // Get last phase
    const sortedPhases = [...existingPhases].sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const lastPhase = sortedPhases[sortedPhases.length - 1];

    // How many days does last phase span?
    const lastPhaseStart = new Date(lastPhase.startDate).getTime();
    const lastPhaseEnd = new Date(lastPhase.endDate || lastPhase.dueDate).getTime();
    const lastPhaseDays = Math.ceil((lastPhaseEnd - lastPhaseStart) / (24 * 60 * 60 * 1000));

    // New phase duration: 1 day or 6 days
    const newPhaseDays = lastPhaseDays <= 21 ? 1 : 6;

    // Work backwards from project end
    const newPhaseEnd = new Date(projectEndDate);
    const newPhaseStart = new Date(projectEndDate.getTime() - (newPhaseDays * 24 * 60 * 60 * 1000));
    // Last phase should end the day BEFORE new phase starts (no overlap)
    const lastPhaseNewEnd = new Date(newPhaseStart.getTime() - (24 * 60 * 60 * 1000));

    return {
      newPhaseStart,
      newPhaseEnd,
      lastPhaseNewEnd
    };
  }

  /**
   * Repair overlapping phases by adjusting dates to be sequential
   * 
   * When phases share the same end/start date, this fixes them by:
   * - Keeping the first phase's end date
   * - Moving subsequent phases to start the day after the previous phase ends
   * 
   * @param phases - Array of phases with potential overlaps
   * @returns Array of updated phases with fixes applied
   * 
   * @example
   * Input:  Phase 1 (Nov 1 → Nov 15), Phase 2 (Nov 15 → Nov 30)
   * Output: Phase 1 (Nov 1 → Nov 15), Phase 2 (Nov 16 → Nov 30)
   */
  static repairOverlappingPhases(phases: PhaseDTO[]): Array<{ phaseId: string; updates: { startDate?: Date; endDate?: Date } }> {
    if (phases.length === 0) {
      return [];
    }

    const sorted = sortPhasesByStartDate(phases);
    const repairs: Array<{ phaseId: string; updates: { startDate?: Date; endDate?: Date } }> = [];

    // Check each adjacent pair
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentPhase = sorted[i];
      const nextPhase = sorted[i + 1];
      
      const currentEnd = new Date(currentPhase.endDate).getTime();
      const nextStart = new Date(nextPhase.startDate).getTime();
      
      // If phases overlap or share same day, fix the next phase to start day after current ends
      if (currentEnd >= nextStart) {
        const fixedStartDate = new Date(currentEnd + (24 * 60 * 60 * 1000));
        repairs.push({
          phaseId: nextPhase.id,
          updates: {
            startDate: fixedStartDate
          }
        });
        
        // Update sorted array for subsequent iterations
        sorted[i + 1] = { ...nextPhase, startDate: fixedStartDate };
      }
    }

    return repairs;
  }
}
